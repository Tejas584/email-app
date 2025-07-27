require('dotenv').config();
const Redis = require('ioredis');

function createRedisClient() {
  console.log('🔍 Checking Redis configuration...');
  console.log('Environment variables loaded:', Object.keys(process.env).filter(key => key.includes('REDIS')));

  if (!process.env.REDIS_URL) {
    console.error('❌ REDIS_URL environment variable is required but not set!');
    throw new Error('REDIS_URL environment variable is required.');
  }

  const isSecure = process.env.REDIS_URL.startsWith('rediss://');
  console.log(`🔗 Connecting to Redis using ${isSecure ? 'TLS (rediss)' : 'plain (redis)'}`);
  
  const client = new Redis(process.env.REDIS_URL, {
    tls: isSecure ? {} : undefined
  });

  client.on('connect', () => {
    console.log('✅ Redis connected successfully');
  });

  client.on('error', (err) => {
    console.error('❌ Redis connection error:', err.message);
    console.error('Full error:', err);
  });

  return client;
}

module.exports = createRedisClient;
