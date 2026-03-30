const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5435,
  database: process.env.DB_NAME || 'pump',
  user: process.env.DB_USER || 'pump_user',
  password: process.env.DB_PASS || '',
});

pool.on('error', (err) => {
  console.error('Database pool error:', err);
});

module.exports = pool;
