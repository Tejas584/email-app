require('dotenv').config();
const Queue = require('bull');
const { URL } = require('url');

console.log('🔍 Queue: Checking Redis configuration...');
console.log('Queue: Environment variables loaded:', Object.keys(process.env).filter(key => key.includes('REDIS')));

if (!process.env.REDIS_URL) {
  console.error('❌ REDIS_URL environment variable is required but not set!');
  throw new Error('REDIS_URL environment variable is required.');
}

const redisUrl = new URL(process.env.REDIS_URL);
const isSecure = redisUrl.protocol === 'rediss:';

const redisOptions = {
  host: redisUrl.hostname,
  port: Number(redisUrl.port),
  password: redisUrl.password,
  tls: isSecure ? {} : undefined
};

const emailQueue = new Queue('emailQueue', { redis: redisOptions });

// Add queue event listeners for better debugging
emailQueue.on('error', (err) => {
  console.error('❌ Bull Queue error:', err.message);
  console.error('Full queue error:', err);
});

emailQueue.on('ready', () => {
  console.log('✅ Bull Queue ready and connected to Redis');
});

module.exports = emailQueue;
