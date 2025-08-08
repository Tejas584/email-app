require('dotenv').config();
const emailQueue = require('./queue');
const nodemailer = require('nodemailer');
const createRedisClient = require('../config/redis');
const client = createRedisClient();
const { getLenientConfig, getPermissiveConfig } = require('../config/smtp-config');
const { getRenderConfig, getRenderPermissiveConfig, getRenderDHFixConfig } = require('../config/render-smtp-config');

console.log('Email worker started and waiting for jobs...');

emailQueue.process(async (job, done) => {
  console.log(`Processing job ${job.id} for email: ${job.data.email}`);
  
  const { smtp, email, from, subject, message, isHtml, logKey } = job.data;
  
  try {
    // Try Render-optimized configurations first
    let transporter = null;
    let lastError = null;
    
    // Configuration 1: Render-specific DH fix
    try {
      const config1 = getRenderDHFixConfig(smtp.host, smtp.port, smtp.auth.user, smtp.auth.pass);
      transporter = nodemailer.createTransport(config1);
      await transporter.verify();
      console.log(`Success with Render DH fix config for ${email}`);
    } catch (error) {
      lastError = error;
      console.log(`Render DH fix config failed for ${email}:`, error.message);
      
      // Configuration 2: Render-optimized config
      try {
        const config2 = getRenderConfig(smtp.host, smtp.port, smtp.auth.user, smtp.auth.pass);
        transporter = nodemailer.createTransport(config2);
        await transporter.verify();
        console.log(`Success with Render config for ${email}`);
      } catch (error2) {
        lastError = error2;
        console.log(`Render config failed for ${email}:`, error2.message);
        
        // Configuration 3: Render permissive
        try {
          const config3 = getRenderPermissiveConfig(smtp.host, smtp.port, smtp.auth.user, smtp.auth.pass);
          transporter = nodemailer.createTransport(config3);
          console.log(`Using Render permissive config for ${email}`);
        } catch (error3) {
          lastError = error3;
          console.log(`Render permissive config failed for ${email}:`, error3.message);
          
          // Configuration 4: Ultra-permissive (no TLS)
          const config4 = {
            host: smtp.host,
            port: smtp.port,
            secure: false,
            auth: smtp.auth,
            tls: false,
            connectionTimeout: 60000,
            greetingTimeout: 30000,
            socketTimeout: 60000,
            ignoreTLS: true,
            requireTLS: false
          };
          transporter = nodemailer.createTransport(config4);
          console.log(`Using ultra-permissive config (no TLS) for ${email}`);
        }
      }
    }
    
    // Send the email
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