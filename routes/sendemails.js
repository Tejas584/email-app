const express = require('express');
const multer = require('multer');
const csvParse = require('csv-parse/sync');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const createRedisClient = require('../config/redis');
const redisClient = createRedisClient();
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();
const emailQueue = require('../workprocess/queue');

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const upload = multer({ dest: uploadsDir });

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Helper to store recipients in Redis
async function storeRecipients(sessionId, recipients) {
  await redisClient.set(`recipients:${sessionId}`, JSON.stringify(recipients));
}

async function getRecipients(sessionId) {
  const data = await redisClient.get(`recipients:${sessionId}`);
  return data ? JSON.parse(data) : [];
}

// Helper to track sent indices in Redis
async function getSentIndex(sessionId) {
  const idx = await redisClient.get(`sentIndex:${sessionId}`);
  return idx ? parseInt(idx) : 0;
}

async function setSentIndex(sessionId, idx) {
  await redisClient.set(`sentIndex:${sessionId}`, idx.toString());
}

// Helper to get log stats from Redis
async function getLogStats(logKey) {
  const logs = await redisClient.lrange(logKey, 0, -1);
  let sent = 0, failed = 0, lastError = '';
  if (logs) {
    logs.forEach(entry => {
      try {
        const log = JSON.parse(entry);
        if (log.status === 'sent') sent++;
        if (log.status === 'failed') {
          failed++;
          lastError = log.error || '';
        }
      } catch {}
    });
  }
  return { sent, failed, lastError };
}

router.post('/recipients', upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No file uploaded' });

    let emails = [];
    const ext = path.extname(file.originalname).toLowerCase();
    const filePath = file.path;

    if (ext === '.csv' || ext === '.txt') {
      const content = fs.readFileSync(filePath, 'utf8');
      let records;
      if (ext === '.csv') {
        records = csvParse.parse(content, { columns: false, skip_empty_lines: true });
        emails = records.flat().map(e => e.trim());
      } else {
        emails = content.split(/\r?\n/).map(e => e.trim());
      }
    } else if (ext === '.xlsx' || ext === '.xls') {
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      emails = data.flat().map(e => (typeof e === 'string' ? e.trim() : ''));
    } else if (ext === '.json') {
      const content = fs.readFileSync(filePath, 'utf8');
      const json = JSON.parse(content);
      if (Array.isArray(json)) {
        if (typeof json[0] === 'string') {
          emails = json.map(e => e.trim());
        } else if (typeof json[0] === 'object' && json[0].email) {
          emails = json.map(obj => obj.email.trim());
        }
      }
    } else {
      return res.status(400).json({ error: 'Unsupported file type' });
    }

    const validRecipients = emails.filter(isValidEmail);
    
    // Clean up uploaded file
    try {
      fs.unlinkSync(filePath);
    } catch (err) {
      console.error('Error deleting uploaded file:', err);
    }
    
    const sessionId = req.headers['x-session-id'] || uuidv4();
    await storeRecipients(sessionId, validRecipients);
    res.json({ total: validRecipients.length, validRecipients, sessionId });
  } catch (err) {
    console.error('Error in /recipients:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/send-email', async (req, res) => {
  try {
    const {
      'smtp-host': smtpHost,
      'smtp-port': smtpPort,
      'smtp-user': smtpUser,
      'smtp-pass': smtpPass,
      'test-bulk': testBulk,
      'test-recp': testRecp,
      limit,
      'smtp-from-name': fromName,
      'smtp-from-email': fromEmail,
      subject,
      'plain-html': plainHtml,
      message,
      sessionId
    } = req.body;

    let recipients = [];
    let batch = [];
    let batchCount = 0;
    let logKey = '';
    
    if (testBulk === 'Test') {
      recipients = testRecp.split(',').map(e => e.trim()).filter(isValidEmail);
      if (!recipients.length) return res.status(400).json({ error: 'No valid test recipients' });
      batch = recipients;
      batchCount = batch.length;
      logKey = `emaillog:test:${Date.now()}`;
    } else {
      if (!sessionId) return res.status(400).json({ error: 'No sessionId provided' });
      recipients = await getRecipients(sessionId);
      if (!recipients.length) return res.status(400).json({ error: 'No valid recipients' });
      const batchLimit = parseInt(limit) || recipients.length;
      const sentIndex = await getSentIndex(sessionId);
      batch = recipients.slice(sentIndex, sentIndex + batchLimit);
      if (!batch.length) return res.status(400).json({ error: 'No more recipients to send' });
      batchCount = batch.length;
      logKey = `emaillog:${sessionId}`;
    }

    const smtp = {
      host: smtpHost,
      port: parseInt(smtpPort),
      secure: parseInt(smtpPort) === 465,
      auth: { user: smtpUser, pass: smtpPass }
    };
    const from = `${fromName} <${fromEmail}>`;
    const isHtml = plainHtml === 'HTML';

    for (const email of batch) {
      await emailQueue.add({ smtp, email, from, subject, message, isHtml, logKey });
    }
    
    if (testBulk !== 'Test') {
      await setSentIndex(sessionId, (await getSentIndex(sessionId)) + batch.length);
    }
    
    res.json({ status: 'enqueued', batchCount });
  } catch (err) {
    console.error('Error in /send-email:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/status', async (req, res) => {
  try {
    const sessionId = req.query.sessionId;
    if (!sessionId) return res.status(400).json({ error: 'No sessionId provided' });
    
    const recipients = await getRecipients(sessionId);
    const total = recipients.length;
    const sentIndex = await getSentIndex(sessionId);
    const logKey = `emaillog:${sessionId}`;
    const { sent, failed, lastError } = await getLogStats(logKey);
    const pending = total - sentIndex;
    
    res.json({ total, sent, failed, pending, sentIndex, lastError });
  } catch (err) {
    console.error('Error in /status:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/log-download', async (req, res) => {
  try {
    const sessionId = req.query.sessionId;
    if (!sessionId) return res.status(400).json({ error: 'No sessionId provided' });
    
    const logKey = `emaillog:${sessionId}`;
    const logs = await redisClient.lrange(logKey, 0, -1);
    
    if (!logs || !logs.length) return res.status(404).json({ error: 'No logs found' });
    
    const rows = ['email,status,error,time'];
    logs.forEach(entry => {
      try {
        const log = JSON.parse(entry);
        rows.push([
          log.email,
          log.status,
          log.error ? '"' + log.error.replace(/"/g, '""') + '"' : '',
          log.time
        ].join(','));
      } catch (err) {
        console.error('Error parsing log entry:', err);
      }
    });
    
    const csv = rows.join('\n');
    
    res.setHeader('Content-disposition', `attachment; filename=emaillog-${sessionId}.csv`);
    res.set('Content-Type', 'text/csv');
    res.send(csv);
  } catch (err) {
    console.error('Error in log download:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;