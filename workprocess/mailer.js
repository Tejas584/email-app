require('dotenv').config();
const emailQueue = require('./queue');
const nodemailer = require('nodemailer');
const createRedisClient = require('../config/redis');
const client = createRedisClient();
const { getLenientConfig, getPermissiveConfig } = require('../config/smtp-config');

console.log('Email worker started and waiting for jobs...');

emailQueue.process(async (job, done) => {
  console.log(`Processing job ${job.id} for email: ${job.data.email}`);
  
  const { smtp, email, from, subject, message, isHtml, logKey } = job.data;
  
  try {
    // Try with original configuration first
    let transporter = nodemailer.createTransport(smtp);
    
    // Test the connection
    try {
      await transporter.verify();
    } catch (verifyError) {
      console.log(`Connection failed with original config for ${email}, trying lenient config...`);
      
      // If original fails, try lenient configuration
      const lenientSmtp = getLenientConfig(smtp.host, smtp.port, smtp.auth.user, smtp.auth.pass);
      transporter = nodemailer.createTransport(lenientSmtp);
      
      try {
        await transporter.verify();
      } catch (lenientError) {
        console.log(`Lenient config also failed for ${email}, trying permissive config...`);
        
        // If lenient fails, try permissive configuration
        const permissiveSmtp = getPermissiveConfig(smtp.host, smtp.port, smtp.auth.user, smtp.auth.pass);
        transporter = nodemailer.createTransport(permissiveSmtp);
        
        // Don't verify permissive config as it might not support verification
      }
    }
    
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