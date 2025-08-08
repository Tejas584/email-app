/**
 * SMTP Test Script for Render
 * Use this to test SMTP connections and debug TLS issues
 */

require('dotenv').config();
const nodemailer = require('nodemailer');
const { getRenderDHFixConfig, getRenderConfig, getRenderPermissiveConfig } = require('./config/render-smtp-config');

// Test SMTP settings (replace with your actual settings)
const testSmtp = {
  host: 'akoneseo.com',
  port: 587,
  user: 'mailclass-rOfHYINIjQ@client.moosend.online',
  pass: 'Nihalbalki36494'
};

async function testSmtpConnection() {
  console.log('Testing SMTP connection on Render...');
  console.log('SMTP Host:', testSmtp.host);
  console.log('SMTP Port:', testSmtp.port);
  console.log('SMTP User:', testSmtp.user);
  
  const configs = [
    {
      name: 'Render DH Fix Config',
      config: getRenderDHFixConfig(testSmtp.host, testSmtp.port, testSmtp.user, testSmtp.pass)
    },
    {
      name: 'Render Config',
      config: getRenderConfig(testSmtp.host, testSmtp.port, testSmtp.user, testSmtp.pass)
    },
    {
      name: 'Render Permissive Config',
      config: getRenderPermissiveConfig(testSmtp.host, testSmtp.port, testSmtp.user, testSmtp.pass)
    }
  ];
  
  for (const { name, config } of configs) {
    console.log(`\n--- Testing ${name} ---`);
    try {
      const transporter = nodemailer.createTransport(config);
      
      // Test connection
      console.log('Verifying connection...');
      await transporter.verify();
      console.log('✅ Connection verified successfully!');
      
      // Test sending
      console.log('Testing email send...');
      const result = await transporter.sendMail({
        from: 'test@example.com',
        to: 'test@example.com',
        subject: 'SMTP Test',
        text: 'This is a test email'
      });
      console.log('✅ Email sent successfully!');
      console.log('Message ID:', result.messageId);
      
      return { success: true, config: name };
    } catch (error) {
      console.log('❌ Failed:', error.message);
      if (error.code) {
        console.log('Error code:', error.code);
      }
    }
  }
  
  console.log('\n❌ All configurations failed');
  return { success: false };
}

// Run the test
testSmtpConnection()
  .then(result => {
    if (result.success) {
      console.log(`\n🎉 Success with ${result.config}!`);
      process.exit(0);
    } else {
      console.log('\n💥 All tests failed');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('Test error:', error);
    process.exit(1);
  }); 