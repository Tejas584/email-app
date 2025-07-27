require('dotenv').config();
const emailQueue = require('./queue');
const nodemailer = require('nodemailer');
const createRedisClient = require('../config/redis');
const client = createRedisClient();

console.log('Email worker started and waiting for jobs...');

emailQueue.process(async (job, done) => {
  console.log(`Processing job ${job.id} for email: ${job.data.email}`);
  
  const { smtp, email, from, subject, message, isHtml, logKey } = job.data;
  
  try {
    const transporter = nodemailer.createTransport(smtp);
    
    await transporter.sendMail({
      from,
      to: email,
      subject,
      [isHtml ? 'html' : 'text']: message
    });
    
    console.log(`Email sent successfully to ${email}`);
    // Log success
    await client.rpush(logKey, JSON.stringify({ email, status: 'sent', time: Date.now() }));
    done();
  } catch (err) {
    console.error(`Failed to send email to ${email}:`, err.message);
    // Log failure
    await client.rpush(logKey, JSON.stringify({ email, status: 'failed', error: err.message, time: Date.now() }));
    done(err);
  }
});

// Add queue event listeners for debugging
emailQueue.on('completed', (job) => {
  console.log(`Job ${job.id} completed successfully`);
});

emailQueue.on('failed', (job, err) => {
  console.error(`Job ${job.id} failed:`, err.message);
});

emailQueue.on('error', (err) => {
  console.error('Queue error:', err);
}); 