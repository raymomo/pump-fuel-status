module.exports = {
  apps: [{
    name: 'pump-api',
    script: 'index.js',
    instances: 6,
    exec_mode: 'cluster',
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production',
      PORT: 3002,
      DATABASE_URL: process.env.DATABASE_URL,
      REDIS_HOST: 'redis',
      REDIS_PORT: 6379,
    },
  }],
};
