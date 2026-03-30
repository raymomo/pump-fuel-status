const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const Redis = require('ioredis');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const prisma = require('./prismaClient');
const { getCache, setCache, clearCache } = require('./cache');
const multer = require('multer');
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY || '',
    secretAccessKey: process.env.R2_SECRET_KEY || '',
  },
});
const R2_BUCKET = process.env.R2_BUCKET || 'pump';
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || '';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production'
      ? ['https://pingnoi.me', 'https://www.pingnoi.me']
      : '*',
    methods: ['GET', 'POST'],
  },
});

// Redis adapter สำหรับ Socket.IO ข้าม PM2 cluster instances
try {
  const redisHost = process.env.REDIS_HOST || 'localhost';
  const redisPort = process.env.REDIS_PORT || 6379;
  const pubClient = new Redis({ host: redisHost, port: redisPort, maxRetriesPerRequest: 2 });
  const subClient = pubClient.duplicate();
  Promise.all([
    new Promise((resolve, reject) => { pubClient.on('ready', resolve); pubClient.on('error', reject); }),
    new Promise((resolve, reject) => { subClient.on('ready', resolve); subClient.on('error', reject); }),
  ]).then(() => {
    io.adapter(createAdapter(pubClient, subClient));
    console.log('✅ Socket.IO Redis adapter connected');
  }).catch(() => {
    console.log('⚠️ Socket.IO Redis adapter failed — single instance mode');
  });
} catch {
  console.log('⚠️ Socket.IO Redis adapter not available');
}

// Trust proxy (behind Nginx/Cloudflare)
app.set('trust proxy', true);

// Security headers
app.use(helmet({
  contentSecurityPolicy: process.env.NODE_ENV === 'production' ? {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://unpkg.com", "https://fonts.googleapis.com"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: ["'self'", "https://pingnoi.me", "wss://pingnoi.me", "https://tiles.openfreemap.org", "https://api.line.me"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
    },
  } : false,
  crossOriginEmbedderPolicy: false,
}));

// CORS - restrict to our domains
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? ['https://pingnoi.me', 'https://www.pingnoi.me']
    : true,
}));

app.use(express.json({ limit: '1mb' }));

// Rate limiting
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: { error: 'พยายามเข้าสู่ระบบบ่อยเกินไป กรุณารอ 15 นาที' } });
const apiLimiter = rateLimit({ windowMs: 1 * 60 * 1000, max: 300, message: { error: 'คำขอมากเกินไป กรุณารอสักครู่' } });
app.use('/api/staff/login', authLimiter);
app.use('/api/admin/login', authLimiter);
app.use('/api/staff/register', authLimiter);
app.use('/api', apiLimiter);

// Password helper
const hashPassword = (password) => bcrypt.hashSync(password, 10);
const comparePassword = (password, hash) => {
  if (!hash || !hash.startsWith('$2')) return false; // reject plain text passwords
  return bcrypt.compareSync(password, hash);
};

// JWT helper
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET && process.env.NODE_ENV === 'production') {
  console.error('FATAL: JWT_SECRET must be set in production');
  process.exit(1);
}
const JWT_SECRET_FINAL = JWT_SECRET || (() => { console.warn('WARNING: JWT_SECRET not set, using random secret (sessions will not survive restart)'); return require('crypto').randomBytes(32).toString('hex'); })();
const JWT_EXPIRES = '7d';

const signToken = (payload) => jwt.sign(payload, JWT_SECRET_FINAL, { expiresIn: JWT_EXPIRES });

const authMiddleware = (role) => (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบ' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET_FINAL);
    if (role && decoded.role !== role) return res.status(403).json({ error: 'ไม่มีสิทธิ์เข้าถึง' });
    req.user = decoded;
    // Auto refresh — ถ้า token เหลือน้อยกว่า 2 วัน ส่ง token ใหม่กลับ
    const timeLeft = decoded.exp - Math.floor(Date.now() / 1000);
    if (timeLeft < 2 * 24 * 60 * 60) {
      const { iat, exp, ...payload } = decoded;
      res.setHeader('X-New-Token', signToken(payload));
    }
    next();
  } catch {
    return res.status(401).json({ error: 'Token หมดอายุ กรุณาเข้าสู่ระบบใหม่' });
  }
};

// Audit log helper
async function audit(req, action, entityType, entityId, entityName, details, userType, userId, userName) {
  const ip = req.headers['x-forwarded-for'] || req.headers['cf-connecting-ip'] || req.socket?.remoteAddress || '';
  try {
    await prisma.audit_logs.create({
      data: { action, entity_type: entityType, entity_id: entityId, entity_name: entityName, details, user_type: userType, user_id: userId, user_name: userName, ip_address: ip }
    });
  } catch {}
}

// ============ PUBLIC APIs ============

// Check if feature is enabled (public, no auth)
app.get('/api/feature/:key', async (req, res) => {
  const cacheKey = `cache:feature:${req.params.key}`;
  const cached = await getCache(cacheKey);
  if (cached) return res.json(cached);
  const setting = await prisma.system_settings.findUnique({ where: { key: req.params.key } });
  const result = { enabled: setting?.value === 'true' };
  await setCache(cacheKey, result, 300);
  res.json(result);
});

// Get all provinces
app.get('/api/provinces', async (req, res) => {
  const cached = await getCache('cache:provinces');
  if (cached) return res.json(cached);
  const rows = await prisma.provinces.findMany({ orderBy: { name: 'asc' } });
  await setCache('cache:provinces', rows, 300);
  res.json(rows);
});

// Get stations
app.get('/api/stations', async (req, res) => {
  const { province_id } = req.query;
  const cacheKey = `cache:stations:${province_id || 'all'}`;
  const cached = await getCache(cacheKey);
  if (cached) return res.json(cached);

  const where = province_id ? { province_id: parseInt(province_id) } : {};
  const rows = await prisma.stations.findMany({
    where,
    include: { provinces: true },
    orderBy: [{ provinces: { name: 'asc' } }, { name: 'asc' }],
  });
  const result = rows.map(s => ({ ...s, province_name: s.provinces.name, provinces: undefined }));
  await setCache(cacheKey, result, 30);
  res.json(result);
});

// Get station detail
app.get('/api/stations/:id', async (req, res) => {
  const cacheKey = `cache:station:${req.params.id}`;
  const cached = await getCache(cacheKey);
  if (cached) return res.json(cached);

  const station = await prisma.stations.findUnique({
    where: { id: parseInt(req.params.id) },
    include: { provinces: true, fuel_status: { orderBy: { fuel_type: 'asc' } } },
  });
  if (!station) return res.status(404).json({ error: 'ไม่พบปั๊ม' });

  const brandInfo = await prisma.brands.findFirst({ where: { name: station.brand } });
  const result = {
    ...station,
    province_name: station.provinces.name,
    brand_logo: brandInfo?.logo_url || null,
    brand_color: brandInfo?.color || null,
    fuels: station.fuel_status.map(f => ({
      fuel_type: f.fuel_type, is_available: f.is_available, updated_at: f.updated_at,
      updated_by: f.updated_by, remaining_cars: f.remaining_cars,
    })),
    provinces: undefined, fuel_status: undefined,
  };
  await setCache(cacheKey, result, 15);
  res.json(result);
});

// Get all stations with fuel status summary
// Light endpoint — แค่จุด lat/lng/has_fuel สำหรับ map ไกล
app.get('/api/stations-dots', async (req, res) => {
  const cached = await getCache('cache:stations-dots');
  if (cached) return res.json(cached);

  const rows = await prisma.stations.findMany({
    select: { id: true, name: true, lat: true, lng: true, brand: true, province_id: true,
      provinces: { select: { name: true } },
      fuel_status: { select: { fuel_type: true, is_available: true } } },
  });

  const allBrands = await prisma.brands.findMany();
  const brandMap = {};
  allBrands.forEach(b => { brandMap[b.name] = b; });

  const result = rows.map(s => ({
    id: s.id, name: s.name, lat: s.lat, lng: s.lng, brand: s.brand,
    province_name: s.provinces?.name || '',
    fuels: s.fuel_status.map(f => ({ fuel_type: f.fuel_type, is_available: f.is_available })),
    has_fuel: s.fuel_status.some(f => f.is_available),
    brand_logo: brandMap[s.brand]?.logo_url || null,
  }));
  await setCache('cache:stations-dots', result, 30);
  res.json(result);
});

app.get('/api/stations-status', async (req, res) => {
  const { province_id, nocache } = req.query;
  const cacheKey = `cache:stations-status:${province_id || 'all'}`;
  if (!nocache) {
    const cached = await getCache(cacheKey);
    if (cached) return res.json(cached);
  }

  const where = province_id ? { province_id: parseInt(province_id) } : {};
  const rows = await prisma.stations.findMany({
    where,
    include: {
      provinces: true,
      fuel_status: { select: { fuel_type: true, is_available: true, updated_at: true, remaining_cars: true } },
    },
    orderBy: [{ provinces: { name: 'asc' } }, { name: 'asc' }],
  });

  const allBrands = await prisma.brands.findMany();
  const brandMap = {};
  allBrands.forEach(b => { brandMap[b.name] = b; });

  const result = rows.map(s => {
    const brandInfo = brandMap[s.brand] || null;
    return {
      ...s,
      province_name: s.provinces.name,
      fuels: s.fuel_status,
      has_fuel: s.fuel_status.some(f => f.is_available),
      brand_logo: brandInfo?.logo_url || null,
      brand_color: brandInfo?.color || null,
      provinces: undefined, fuel_status: undefined,
    };
  });
  await setCache(cacheKey, result, 15);
  res.json(result);
});

// Country overview
app.get('/api/overview', async (req, res) => {
  const cached = await getCache('cache:overview');
  if (cached) return res.json(cached);

  const rows = await prisma.$queryRaw`
    SELECT
      p.id as province_id, p.name as province_name,
      COUNT(DISTINCT s.id)::int as total_stations,
      COUNT(DISTINCT CASE WHEN fs.is_available = true THEN s.id END)::int as stations_with_fuel,
      COUNT(CASE WHEN fs.is_available = true THEN 1 END)::int as available_fuels,
      COUNT(CASE WHEN fs.is_available = false THEN 1 END)::int as unavailable_fuels,
      COUNT(fs.id)::int as total_fuels
    FROM provinces p
    LEFT JOIN stations s ON s.province_id = p.id
    LEFT JOIN fuel_status fs ON fs.station_id = s.id
    GROUP BY p.id, p.name ORDER BY p.name
  `;

  const total_stations = rows.reduce((sum, r) => sum + r.total_stations, 0);
  const stations_with_fuel = rows.reduce((sum, r) => sum + r.stations_with_fuel, 0);
  const available_fuels = rows.reduce((sum, r) => sum + r.available_fuels, 0);
  const unavailable_fuels = rows.reduce((sum, r) => sum + r.unavailable_fuels, 0);

  const response = {
    summary: {
      total_stations, stations_with_fuel,
      stations_no_fuel: total_stations - stations_with_fuel,
      available_fuels, unavailable_fuels,
      fuel_availability_pct: total_stations > 0 ? Math.round((available_fuels / (available_fuels + unavailable_fuels)) * 100) : 0,
    },
    provinces: rows.map(r => ({
      ...r,
      stations_no_fuel: r.total_stations - r.stations_with_fuel,
      fuel_availability_pct: r.total_fuels > 0 ? Math.round((r.available_fuels / r.total_fuels) * 100) : 0,
    })),
  };
  await setCache('cache:overview', response, 15);
  res.json(response);
});

// Recent updates
app.get('/api/recent-updates', async (req, res) => {
  const rows = await prisma.fuel_status.findMany({
    where: { updated_at: { not: null } },
    include: { stations: { include: { provinces: true } } },
    orderBy: { updated_at: 'desc' },
    take: 10,
  });
  res.json(rows.map(r => ({
    fuel_type: r.fuel_type, is_available: r.is_available, remaining_cars: r.remaining_cars,
    updated_at: r.updated_at, updated_by: r.updated_by,
    station_id: r.station_id, station_name: r.stations.name,
    brand: r.stations.brand, province_name: r.stations.provinces.name,
  })));
});

// Auto audit for staff write operations
app.use('/api/staff', (req, res, next) => {
  if (['POST', 'PUT', 'DELETE'].includes(req.method) && req.path !== '/login' && req.path !== '/register') {
    const origJson = res.json.bind(res);
    res.json = (data) => {
      if (res.statusCode < 400) {
        const action = req.method === 'POST' ? 'create' : req.method === 'PUT' ? 'update' : 'delete';
        const pathParts = req.path.split('/').filter(Boolean);
        const entityType = pathParts[0] || 'unknown';
        const entityId = parseInt(pathParts[1]) || data?.id || null;
        const entityName = req.body?.fuel_type || req.body?.name || '';
        const details = JSON.stringify(req.body || {}).slice(0, 200);
        const user = req.user || {};
        audit(req, action, entityType, entityId, entityName, details, 'staff', user.id, user.name || req.body?.staff_name || 'staff');
      }
      return origJson(data);
    };
  }
  next();
});

// ============ STAFF APIs ============

// Staff login
app.post('/api/staff/login', async (req, res) => {
  const { username, password } = req.body;
  const staff = await prisma.staff.findUnique({
    where: { username },
    include: { stations: true },
  });

  if (!staff || !comparePassword(password, staff.password)) {
    return res.status(401).json({ error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
  }

  // Auto-hash legacy plain text password
  if (!staff.password.startsWith('$2a$') && !staff.password.startsWith('$2b$')) {
    await prisma.staff.update({ where: { id: staff.id }, data: { password: hashPassword(password) } });
  }

  const token = signToken({ id: staff.id, name: staff.name, username: staff.username, role: 'staff' });
  await audit(req, 'login', 'staff', staff.id, staff.name, `เข้าสู่ระบบ ปั๊ม: ${staff.stations?.name || 'ยังไม่มี'}`, 'staff', staff.id, staff.name);
  res.json({
    token,
    id: staff.id, name: staff.name, username: staff.username,
    station_id: staff.station_id || null,
    station_name: staff.stations?.name || null,
    has_station: !!staff.station_id,
  });
});

// Check staff status (refresh station assignment)
app.get('/api/staff/check/:id', authMiddleware(), async (req, res) => {
  if (req.user.id !== parseInt(req.params.id)) return res.status(403).json({ error: 'ไม่มีสิทธิ์' });
  const staff = await prisma.staff.findUnique({
    where: { id: parseInt(req.params.id) },
    include: { stations: { include: { provinces: true } } },
  });
  if (!staff) return res.status(404).json({ error: 'ไม่พบ' });
  res.json({
    id: staff.id, name: staff.name, username: staff.username,
    station_id: staff.station_id || null,
    station_name: staff.stations?.name || null,
    station_brand: staff.stations?.brand || null,
    station_address: staff.stations?.address || null,
    station_province: staff.stations?.provinces?.name || null,
    has_station: !!staff.station_id,
  });
});

// Update fuel status (staff หรือ admin)
app.put('/api/staff/fuel-status', authMiddleware(), async (req, res) => {
  const { station_id, fuel_type, is_available, staff_name, remaining_cars } = req.body;

  // Verify staff is assigned to this station
  if (req.user.station_id && req.user.station_id !== station_id) {
    return res.status(403).json({ error: 'คุณไม่ได้เป็นพนักงานของปั๊มนี้' });
  }

  try {
    await prisma.fuel_status.update({
      where: { station_id_fuel_type: { station_id, fuel_type } },
      data: { is_available, updated_at: new Date(), updated_by: staff_name, remaining_cars: remaining_cars ?? null },
    });
  } catch {
    await prisma.fuel_status.create({
      data: { station_id, fuel_type, is_available, updated_at: new Date(), updated_by: staff_name, remaining_cars: remaining_cars ?? null },
    });
  }

  await clearCache('cache:station*');
  await clearCache('cache:stations-status*');
  await clearCache('cache:overview');
  const userType = req.user?.role || 'staff';
  const userName = staff_name || req.user?.name || 'unknown';
  await audit(req, 'update_fuel', 'fuel_status', station_id, fuel_type, `${is_available ? 'มีน้ำมัน' : 'หมด'}${remaining_cars ? ` รองรับ ${remaining_cars} คัน` : ''}`, userType, req.user?.id || null, userName);

  // Real-time broadcast
  io.emit('fuel-updated', { station_id, fuel_type, is_available, updated_by: staff_name, remaining_cars, updated_at: new Date() });

  res.json({ success: true });
});

// Get fuel status for station
app.get('/api/staff/station/:id/fuels', async (req, res) => {
  const rows = await prisma.fuel_status.findMany({
    where: { station_id: parseInt(req.params.id) },
    orderBy: { fuel_type: 'asc' },
  });
  res.json(rows);
});

// Staff register
app.post('/api/staff/register', async (req, res) => {
  const { name, username, password, phone } = req.body;
  if (!name || !username || !password) return res.status(400).json({ error: 'กรุณากรอกข้อมูลให้ครบ' });
  try {
    const staff = await prisma.staff.create({
      data: { name, username, password: hashPassword(password), phone: phone || null },
      select: { id: true, name: true, username: true },
    });
    await audit(req, 'register', 'staff', staff.id, name, `สมัครสมาชิก โทร: ${phone || '-'}`, 'staff', staff.id, name);
    res.json(staff);
  } catch {
    res.status(400).json({ error: 'ชื่อผู้ใช้นี้ถูกใช้แล้ว' });
  }
});

// Staff stations list
app.get('/api/staff/stations-list', async (req, res) => {
  const rows = await prisma.stations.findMany({
    select: { id: true, name: true, brand: true, provinces: { select: { name: true } } },
    orderBy: [{ provinces: { name: 'asc' } }, { name: 'asc' }],
  });
  res.json(rows.map(s => ({ id: s.id, name: s.name, brand: s.brand, province_name: s.provinces.name })));
});

// Staff request join station
app.post('/api/staff/request-join', authMiddleware('staff'), async (req, res) => {
  const { staff_id, station_id } = req.body;
  try {
    const staffData = await prisma.staff.findUnique({ where: { id: staff_id } });
    const staff_name = staffData?.name || 'unknown';
    const row = await prisma.staff_station_requests.create({
      data: { staff_id, staff_name, station_id },
    });
    await audit(req, 'request_join', 'staff', staff_id, staff_name, 'ขอเข้าร่วมปั๊ม', 'staff', staff_id, staff_name);
    res.json(row);
  } catch {
    res.status(400).json({ error: 'ส่งคำขอไม่สำเร็จ' });
  }
});

// My join requests
app.get('/api/staff/my-join-requests/:staffId', authMiddleware(), async (req, res) => {
  if (req.user.id !== parseInt(req.params.staffId)) return res.status(403).json({ error: 'ไม่มีสิทธิ์' });
  const rows = await prisma.staff_station_requests.findMany({
    where: { staff_id: parseInt(req.params.staffId) },
    include: { stations: { include: { provinces: true } } },
    orderBy: { created_at: 'desc' },
  });
  res.json(rows.map(r => ({
    ...r, station_name: r.stations.name, province_name: r.stations.provinces.name,
    stations: undefined,
  })));
});

// Request new station
app.post('/api/staff/request-station', authMiddleware('staff'), async (req, res) => {
  const { name, brand, address, province_id, lat, lng, phone, staff_id, staff_name } = req.body;
  const row = await prisma.station_requests.create({
    data: { name, brand, address, province_id, lat, lng, phone, requested_by: staff_id, requested_by_name: staff_name },
  });
  res.json(row);
});

// My station requests
app.get('/api/staff/my-requests/:staffId', async (req, res) => {
  const rows = await prisma.station_requests.findMany({
    where: { requested_by: parseInt(req.params.staffId) },
    include: { provinces: true },
    orderBy: { created_at: 'desc' },
  });
  res.json(rows.map(r => ({ ...r, province_name: r.provinces.name, provinces: undefined })));
});

// ============ ADMIN APIs ============

// Admin login
app.post('/api/admin/login', async (req, res) => {
  const { username, password } = req.body;
  const admin = await prisma.admins.findUnique({ where: { username } });
  if (!admin || !comparePassword(password, admin.password)) {
    return res.status(401).json({ error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
  }

  // Auto-hash legacy plain text password
  if (!admin.password.startsWith('$2a$') && !admin.password.startsWith('$2b$')) {
    await prisma.admins.update({ where: { id: admin.id }, data: { password: hashPassword(password) } });
  }

  const token = signToken({ id: admin.id, name: admin.name, username: admin.username, role: 'admin' });
  await audit(req, 'login', 'admin', admin.id, admin.name, 'เข้าสู่ระบบผู้ดูแล', 'admin', admin.id, admin.name);
  res.json({ token, id: admin.id, name: admin.name, username: admin.username });
});

// Protect all admin routes (except login) + auto audit
app.use('/api/admin', (req, res, next) => {
  if (req.path === '/login') return next();
  authMiddleware('admin')(req, res, () => {
    // Auto audit for write operations
    const origJson = res.json.bind(res);
    res.json = (data) => {
      if (['POST', 'PUT', 'DELETE'].includes(req.method) && res.statusCode < 400 && !req.path.startsWith('/settings')) {
        const action = req.method === 'POST' ? 'create' : req.method === 'PUT' ? 'update' : 'delete';
        const pathParts = req.path.split('/').filter(Boolean);
        const entityType = pathParts[0] || 'unknown';
        const entityId = parseInt(pathParts[1]) || data?.id || null;
        const entityName = req.body?.name || data?.name || data?.station?.name || '';
        const details = JSON.stringify(req.body || {}).slice(0, 200);
        audit(req, action, entityType, entityId, entityName, details, 'admin', req.user?.id, req.user?.name || 'admin');
      }
      return origJson(data);
    };
    next();
  });
});

// Audit logs
app.get('/api/admin/audit-logs', async (req, res) => {
  const { page = 1, user_type, action, entity_type } = req.query;
  const limit = Math.min(parseInt(req.query.limit) || 50, 100);
  const where = {};
  if (user_type) where.user_type = user_type;
  if (action) where.action = action;
  if (entity_type) where.entity_type = entity_type;

  const total = await prisma.audit_logs.count({ where });
  const logs = await prisma.audit_logs.findMany({
    where, orderBy: { created_at: 'desc' },
    take: parseInt(limit), skip: (parseInt(page) - 1) * parseInt(limit),
  });
  res.json({ logs, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) });
});

// Join requests
app.get('/api/admin/join-requests', async (req, res) => {
  const rows = await prisma.staff_station_requests.findMany({
    include: { stations: { include: { provinces: true } }, staff: { select: { phone: true } } },
    orderBy: { created_at: 'desc' },
  });
  const sorted = rows.sort((a, b) => (a.status === 'pending' ? 0 : 1) - (b.status === 'pending' ? 0 : 1));
  res.json(sorted.map(r => ({
    ...r, station_name: r.stations.name, province_name: r.stations.provinces.name,
    staff_phone: r.staff.phone, stations: undefined, staff: undefined,
  })));
});

app.put('/api/admin/join-requests/:id/approve', async (req, res) => {
  const r = await prisma.staff_station_requests.findUnique({ where: { id: parseInt(req.params.id) } });
  if (!r) return res.status(404).json({ error: 'ไม่พบคำขอ' });
  if (r.status !== 'pending') return res.status(400).json({ error: 'คำขอนี้ดำเนินการแล้ว' });

  await prisma.staff.update({ where: { id: r.staff_id }, data: { station_id: r.station_id } });
  await prisma.staff_station_requests.update({ where: { id: parseInt(req.params.id) }, data: { status: 'approved', admin_note: req.body.admin_note || null } });
  res.json({ success: true });
});

app.put('/api/admin/join-requests/:id/reject', async (req, res) => {
  await prisma.staff_station_requests.updateMany({
    where: { id: parseInt(req.params.id), status: 'pending' },
    data: { status: 'rejected', admin_note: req.body.admin_note || null },
  });
  res.json({ success: true });
});

// Fuel types
app.get('/api/admin/fuel-types', async (req, res) => {
  const rows = await prisma.fuel_types.findMany({ orderBy: [{ sort_order: 'asc' }, { name: 'asc' }] });
  res.json(rows);
});

app.post('/api/admin/fuel-types', async (req, res) => {
  const { name, sort_order } = req.body;
  try {
    const row = await prisma.fuel_types.create({ data: { name, sort_order: sort_order || 0 } });
    res.json(row);
  } catch {
    res.status(400).json({ error: 'ชนิดน้ำมันนี้มีอยู่แล้ว' });
  }
});

app.delete('/api/admin/fuel-types/:id', async (req, res) => {
  const ft = await prisma.fuel_types.findUnique({ where: { id: parseInt(req.params.id) } });
  if (!ft) return res.status(404).json({ error: 'ไม่พบ' });
  await prisma.fuel_status.deleteMany({ where: { fuel_type: ft.name } });
  await prisma.fuel_types.delete({ where: { id: parseInt(req.params.id) } });
  await clearCache('cache:station*');
  await clearCache('cache:overview');
  res.json({ success: true });
});

// Station fuel types
app.post('/api/admin/stations/:id/fuels', async (req, res) => {
  try {
    await prisma.fuel_status.create({
      data: { station_id: parseInt(req.params.id), fuel_type: req.body.fuel_type, is_available: false, updated_by: 'admin' },
    });
    await clearCache('cache:station*');
    res.json({ success: true });
  } catch {
    res.status(400).json({ error: 'ปั๊มนี้มีน้ำมันชนิดนี้อยู่แล้ว' });
  }
});

app.delete('/api/admin/stations/:id/fuels/:fuelType', async (req, res) => {
  await prisma.fuel_status.deleteMany({
    where: { station_id: parseInt(req.params.id), fuel_type: decodeURIComponent(req.params.fuelType) },
  });
  await clearCache('cache:station*');
  res.json({ success: true });
});

app.get('/api/admin/stations/:id/fuels', async (req, res) => {
  const allTypes = await prisma.fuel_types.findMany({ orderBy: [{ sort_order: 'asc' }, { name: 'asc' }] });
  const stationFuels = await prisma.fuel_status.findMany({
    where: { station_id: parseInt(req.params.id) },
    select: { fuel_type: true },
  });
  const enabled = new Set(stationFuels.map(f => f.fuel_type));
  res.json(allTypes.map(ft => ({ ...ft, enabled: enabled.has(ft.name) })));
});

// Station staff management
app.get('/api/admin/stations/:id/staff', async (req, res) => {
  const rows = await prisma.staff.findMany({
    where: { station_id: parseInt(req.params.id) },
    select: { id: true, name: true, username: true, phone: true },
    orderBy: { name: 'asc' },
  });
  res.json(rows);
});

app.delete('/api/admin/stations/:id/staff/:staffId', async (req, res) => {
  await prisma.staff.update({
    where: { id: parseInt(req.params.staffId) },
    data: { station_id: null },
  });
  res.json({ success: true });
});

app.post('/api/admin/stations/:id/staff', async (req, res) => {
  const { staff_id } = req.body;
  await prisma.staff.update({
    where: { id: parseInt(staff_id) },
    data: { station_id: parseInt(req.params.id) },
  });
  res.json({ success: true });
});

// All stations fuel map (bulk)
app.get('/api/admin/stations-fuels', async (req, res) => {
  const allFuels = await prisma.fuel_status.findMany({ select: { station_id: true, fuel_type: true } });
  const fuelTypes = await prisma.fuel_types.findMany({ orderBy: [{ sort_order: 'asc' }, { name: 'asc' }] });
  const fuelsByStation = {};
  allFuels.forEach(f => {
    if (!fuelsByStation[f.station_id]) fuelsByStation[f.station_id] = new Set();
    fuelsByStation[f.station_id].add(f.fuel_type);
  });
  const result = {};
  for (const [stationId, enabledSet] of Object.entries(fuelsByStation)) {
    result[stationId] = fuelTypes.map(ft => ({ ...ft, enabled: enabledSet.has(ft.name) }));
  }
  res.json(result);
});

// Station requests
app.get('/api/admin/station-requests', async (req, res) => {
  const rows = await prisma.station_requests.findMany({
    include: { provinces: true },
    orderBy: { created_at: 'desc' },
  });
  const sorted = rows.sort((a, b) => (a.status === 'pending' ? 0 : 1) - (b.status === 'pending' ? 0 : 1));
  res.json(sorted.map(r => ({ ...r, province_name: r.provinces.name, provinces: undefined })));
});

app.put('/api/admin/station-requests/:id/approve', async (req, res) => {
  const r = await prisma.station_requests.findUnique({ where: { id: parseInt(req.params.id) } });
  if (!r) return res.status(404).json({ error: 'ไม่พบคำขอ' });
  if (r.status !== 'pending') return res.status(400).json({ error: 'คำขอนี้ดำเนินการแล้ว' });

  const station = await prisma.stations.create({
    data: { name: r.name, brand: r.brand, address: r.address, province_id: r.province_id, lat: r.lat, lng: r.lng, phone: r.phone },
  });

  const fuelTypes = ['ดีเซล', 'ดีเซล B7', 'แก๊สโซฮอล์ 91', 'แก๊สโซฮอล์ 95', 'แก๊สโซฮอล์ E20', 'เบนซิน 95'];
  await prisma.fuel_status.createMany({
    data: fuelTypes.map(ft => ({ station_id: station.id, fuel_type: ft, is_available: false, updated_by: 'admin' })),
  });

  await prisma.station_requests.update({
    where: { id: parseInt(req.params.id) },
    data: { status: 'approved', admin_note: req.body.admin_note || null, updated_at: new Date() },
  });

  await clearCache('cache:station*');
  await clearCache('cache:overview');
  res.json({ success: true, station });
});

app.put('/api/admin/station-requests/:id/reject', async (req, res) => {
  await prisma.station_requests.updateMany({
    where: { id: parseInt(req.params.id), status: 'pending' },
    data: { status: 'rejected', admin_note: req.body.admin_note || null, updated_at: new Date() },
  });
  res.json({ success: true });
});

// Province management
app.post('/api/admin/provinces', async (req, res) => {
  try {
    const row = await prisma.provinces.create({ data: { name: req.body.name } });
    res.json(row);
  } catch {
    res.status(400).json({ error: 'จังหวัดนี้มีอยู่แล้ว' });
  }
});

app.delete('/api/admin/provinces/:id', async (req, res) => {
  const count = await prisma.stations.count({ where: { province_id: parseInt(req.params.id) } });
  if (count > 0) return res.status(400).json({ error: 'ไม่สามารถลบจังหวัดที่มีปั๊มอยู่' });
  await prisma.provinces.delete({ where: { id: parseInt(req.params.id) } });
  res.json({ success: true });
});

// Upload image to R2
const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'];
const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];

app.post('/api/admin/upload', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'ไม่มีไฟล์' });
  const ext = req.file.originalname.split('.').pop().toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!ALLOWED_EXTENSIONS.includes(ext)) return res.status(400).json({ error: 'อนุญาตเฉพาะไฟล์ภาพ (jpg, png, gif, webp, svg)' });
  if (!ALLOWED_MIMES.includes(req.file.mimetype)) return res.status(400).json({ error: 'ประเภทไฟล์ไม่ถูกต้อง' });
  const key = `brands/${Date.now()}.${ext}`;
  try {
    await r2.send(new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
    }));
    const url = `${R2_PUBLIC_URL}/${key}`;
    res.json({ url });
  } catch (err) {
    res.status(500).json({ error: 'อัปโหลดไม่สำเร็จ' });
  }
});

// Brand management
app.get('/api/admin/brands', async (req, res) => {
  const rows = await prisma.brands.findMany({ orderBy: { sort_order: 'asc' } });
  res.json(rows);
});

app.post('/api/admin/brands', async (req, res) => {
  const { name, logo_url, color, sort_order } = req.body;
  if (!name) return res.status(400).json({ error: 'กรุณากรอกชื่อแบรนด์' });
  try {
    const row = await prisma.brands.create({ data: { name, logo_url: logo_url || null, color: color || null, sort_order: sort_order || 0 } });
    await audit(req, 'create', 'brands', row.id, name, null, 'admin', req.user?.id, req.user?.name);
    await clearCache('cache:brands');
    res.json(row);
  } catch { res.status(400).json({ error: 'ชื่อแบรนด์ซ้ำ' }); }
});

app.put('/api/admin/brands/:id', async (req, res) => {
  const { name, logo_url, color, sort_order } = req.body;
  // ลบรูปเก่าจาก R2 ถ้าเปลี่ยน
  const old = await prisma.brands.findUnique({ where: { id: parseInt(req.params.id) } });
  if (old?.logo_url && old.logo_url !== logo_url && old.logo_url.includes(R2_PUBLIC_URL)) {
    const oldKey = old.logo_url.replace(`${R2_PUBLIC_URL}/`, '');
    try { await r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: oldKey })); } catch {}
  }
  const row = await prisma.brands.update({ where: { id: parseInt(req.params.id) }, data: { name, logo_url: logo_url || null, color: color || null, sort_order: sort_order ?? 0 } });
  await audit(req, 'update', 'brands', row.id, name, null, 'admin', req.user?.id, req.user?.name);
  await clearCache('cache:brands');
  res.json(row);
});

app.delete('/api/admin/brands/:id', async (req, res) => {
  const brand = await prisma.brands.findUnique({ where: { id: parseInt(req.params.id) } });
  // ลบรูปจาก R2
  if (brand?.logo_url && brand.logo_url.includes(R2_PUBLIC_URL)) {
    const oldKey = brand.logo_url.replace(`${R2_PUBLIC_URL}/`, '');
    try { await r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: oldKey })); } catch {}
  }
  await prisma.brands.delete({ where: { id: parseInt(req.params.id) } });
  await audit(req, 'delete', 'brands', parseInt(req.params.id), brand?.name, null, 'admin', req.user?.id, req.user?.name);
  await clearCache('cache:brands');
  res.json({ success: true });
});

// Public brands list
app.get('/api/brands', async (req, res) => {
  const cached = await getCache('cache:brands');
  if (cached) return res.json(cached);
  const rows = await prisma.brands.findMany({ orderBy: { sort_order: 'asc' } });
  await setCache('cache:brands', rows, 300);
  res.json(rows);
});

// Station management
app.get('/api/admin/stations', async (req, res) => {
  const rows = await prisma.stations.findMany({
    include: { provinces: true, _count: { select: { staff: true } } },
    orderBy: [{ provinces: { name: 'asc' } }, { name: 'asc' }],
  });
  res.json(rows.map(s => ({
    ...s, province_name: s.provinces.name, staff_count: s._count.staff,
    provinces: undefined, _count: undefined,
  })));
});

const FUEL_TYPES = ['ดีเซล', 'ดีเซล B7', 'แก๊สโซฮอล์ 91', 'แก๊สโซฮอล์ 95', 'แก๊สโซฮอล์ E20', 'เบนซิน 95'];

app.post('/api/admin/stations', async (req, res) => {
  const { name, brand, address, province_id, lat, lng, phone } = req.body;
  const station = await prisma.stations.create({
    data: { name, brand, address, province_id: parseInt(province_id), lat, lng, phone },
  });
  await prisma.fuel_status.createMany({
    data: FUEL_TYPES.map(ft => ({ station_id: station.id, fuel_type: ft, is_available: false, updated_by: 'admin' })),
  });
  res.json(station);
});

app.put('/api/admin/stations/:id', async (req, res) => {
  const { name, brand, address, province_id, lat, lng, phone } = req.body;
  try {
    const row = await prisma.stations.update({
      where: { id: parseInt(req.params.id) },
      data: { name, brand, address, province_id: parseInt(province_id), lat, lng, phone },
    });
    res.json(row);
  } catch {
    res.status(404).json({ error: 'ไม่พบปั๊ม' });
  }
});

app.delete('/api/admin/stations/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  await prisma.fuel_status.deleteMany({ where: { station_id: id } });
  await prisma.staff.updateMany({ where: { station_id: id }, data: { station_id: null } });
  await prisma.stations.delete({ where: { id } });
  res.json({ success: true });
});

// Staff management
app.get('/api/admin/staff', async (req, res) => {
  const rows = await prisma.staff.findMany({
    include: { stations: true },
    orderBy: { name: 'asc' },
  });
  res.json(rows.map(s => ({ ...s, station_name: s.stations?.name || 'ยังไม่มี', stations: undefined })));
});

app.post('/api/admin/staff', async (req, res) => {
  const { username, password, station_id, name } = req.body;
  try {
    const row = await prisma.staff.create({
      data: { username, password: hashPassword(password), station_id: station_id ? parseInt(station_id) : null, name },
    });
    res.json(row);
  } catch {
    res.status(400).json({ error: 'ชื่อผู้ใช้ซ้ำ' });
  }
});

app.put('/api/admin/staff/:id', async (req, res) => {
  const { username, password, station_id, name } = req.body;
  try {
    const data = { username, station_id: station_id ? parseInt(station_id) : null, name };
    if (password) data.password = hashPassword(password);
    const row = await prisma.staff.update({ where: { id: parseInt(req.params.id) }, data });
    res.json(row);
  } catch {
    res.status(400).json({ error: 'ชื่อผู้ใช้ซ้ำ' });
  }
});

app.delete('/api/admin/staff/:id', async (req, res) => {
  await prisma.staff.delete({ where: { id: parseInt(req.params.id) } });
  res.json({ success: true });
});

// Admin management
app.get('/api/admin/admins', async (req, res) => {
  const rows = await prisma.admins.findMany({
    select: { id: true, username: true, name: true, created_at: true },
    orderBy: { id: 'asc' },
  });
  res.json(rows);
});

app.post('/api/admin/admins', async (req, res) => {
  const { name, username, password } = req.body;
  if (!name || !username || !password) return res.status(400).json({ error: 'กรุณากรอกข้อมูลให้ครบ' });
  try {
    const row = await prisma.admins.create({
      data: { name, username, password: hashPassword(password) },
      select: { id: true, name: true, username: true, created_at: true },
    });
    res.json(row);
  } catch {
    res.status(400).json({ error: 'ชื่อผู้ใช้ซ้ำ' });
  }
});

// Change own password
app.put('/api/admin/change-password', async (req, res) => {
  const { current_password, new_password } = req.body;
  if (!current_password || !new_password) return res.status(400).json({ error: 'กรุณากรอกข้อมูลให้ครบ' });
  if (new_password.length < 8) return res.status(400).json({ error: 'รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัว' });

  const admin = await prisma.admins.findUnique({ where: { id: req.user.id } });
  if (!admin || !comparePassword(current_password, admin.password)) {
    return res.status(400).json({ error: 'รหัสผ่านปัจจุบันไม่ถูกต้อง' });
  }

  await prisma.admins.update({ where: { id: req.user.id }, data: { password: hashPassword(new_password) } });
  res.json({ success: true });
});

app.delete('/api/admin/admins/:id', async (req, res) => {
  const count = await prisma.admins.count();
  if (count <= 1) return res.status(400).json({ error: 'ต้องมี Admin อย่างน้อย 1 คน' });
  await prisma.admins.delete({ where: { id: parseInt(req.params.id) } });
  res.json({ success: true });
});

// ============ SYSTEM SETTINGS ============

app.get('/api/admin/settings', async (req, res) => {
  const settings = await prisma.system_settings.findMany();
  res.json(settings);
});

app.put('/api/admin/settings/:key', async (req, res) => {
  const { value } = req.body;
  const key = req.params.key;
  const keyLabel = key === 'public_reporting_enabled' ? 'ระบบรายงานจากประชาชน' : key;
  const valueLabel = value === 'true' ? 'เปิด' : 'ปิด';
  const setting = await prisma.system_settings.upsert({
    where: { key },
    update: { value, updated_at: new Date(), updated_by: req.body.admin_name || 'admin' },
    create: { key, value, updated_by: req.body.admin_name || 'admin' },
  });
  await audit(req, `${valueLabel}ระบบ`, 'settings', setting.id, keyLabel, `${keyLabel}: ${valueLabel}`, 'admin', req.user?.id, req.user?.name || 'admin');
  await clearCache(`cache:feature:${key}`);
  res.json(setting);
});

// Feature gate helper
async function isFeatureEnabled(key) {
  const setting = await prisma.system_settings.findUnique({ where: { key } });
  return setting?.value === 'true';
}

// ============ LINE LOGIN ============

const LINE_CHANNEL_ID = process.env.LINE_CHANNEL_ID || '';
const LINE_CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET || '';
const LINE_CALLBACK_URL = process.env.LINE_CALLBACK_URL || 'https://pingnoi.me/api/auth/line/callback';

// Redirect to LINE Login
app.get('/api/auth/line', (req, res) => {
  const state = Math.random().toString(36).slice(2);
  const url = `https://access.line.me/oauth2/v2.1/authorize?response_type=code&client_id=${LINE_CHANNEL_ID}&redirect_uri=${encodeURIComponent(LINE_CALLBACK_URL)}&state=${state}&scope=profile%20openid`;
  res.redirect(url);
});

// LINE Login callback
app.get('/api/auth/line/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).send('Missing code');

  try {
    // Exchange code for access token
    const tokenRes = await fetch('https://api.line.me/oauth2/v2.1/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: LINE_CALLBACK_URL,
        client_id: LINE_CHANNEL_ID,
        client_secret: LINE_CHANNEL_SECRET,
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) return res.status(400).send('LINE Login ล้มเหลว');

    // Get LINE profile
    const profileRes = await fetch('https://api.line.me/v2/profile', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const profile = await profileRes.json();
    if (!profile.userId) return res.status(400).send('ไม่สามารถดึงข้อมูล LINE ได้');

    // Upsert public user
    const user = await prisma.public_users.upsert({
      where: { line_user_id: profile.userId },
      update: { display_name: profile.displayName, picture_url: profile.pictureUrl || null },
      create: { line_user_id: profile.userId, display_name: profile.displayName, picture_url: profile.pictureUrl || null },
    });

    if (user.is_banned) return res.status(403).send('บัญชีของคุณถูกระงับ');

    // Sign JWT
    const token = signToken({ id: user.id, role: 'public', name: user.display_name });

    // Redirect back with token
    const callbackParams = `token=${token}&name=${encodeURIComponent(user.display_name)}&picture=${encodeURIComponent(user.picture_url || '')}`;
    res.redirect(`/line-callback?${callbackParams}`);
  } catch (err) {
    console.error('LINE Login error:', err);
    res.status(500).send('เกิดข้อผิดพลาด');
  }
});

// LINE Login from mobile SDK (exchange LINE access token for our JWT)
app.post('/api/auth/line/token', async (req, res) => {
  const { access_token } = req.body;
  if (!access_token) return res.status(400).json({ error: 'Missing access_token' });

  try {
    const profileRes = await fetch('https://api.line.me/v2/profile', {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    const profile = await profileRes.json();
    if (!profile.userId) return res.status(400).json({ error: 'Invalid LINE token' });

    const user = await prisma.public_users.upsert({
      where: { line_user_id: profile.userId },
      update: { display_name: profile.displayName, picture_url: profile.pictureUrl || null },
      create: { line_user_id: profile.userId, display_name: profile.displayName, picture_url: profile.pictureUrl || null },
    });

    if (user.is_banned) return res.status(403).json({ error: 'บัญชีถูกระงับ' });

    const token = signToken({ id: user.id, role: 'public', name: user.display_name });
    res.json({ token, name: user.display_name, picture: user.picture_url });
  } catch (err) {
    console.error('LINE token exchange error:', err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
  }
});

// ============ PUBLIC REPORTING ============

// Haversine distance (meters)
function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Create report
app.post('/api/public/reports', authMiddleware('public'), async (req, res) => {
  if (!(await isFeatureEnabled('public_reporting_enabled'))) {
    return res.status(403).json({ error: 'ระบบรายงานจากประชาชนยังไม่เปิดใช้งาน' });
  }

  const { station_id, fuel_type, is_available, lat, lng } = req.body;
  if (!station_id || !fuel_type || is_available === undefined) {
    return res.status(400).json({ error: 'กรุณากรอกข้อมูลให้ครบ' });
  }

  // Rate limit: 5 reports/hour per user
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recentCount = await prisma.public_reports.count({
    where: { user_id: req.user.id, created_at: { gte: oneHourAgo } },
  });
  if (recentCount >= 5) {
    return res.status(429).json({ error: 'คุณรายงานได้สูงสุด 5 ครั้ง/ชม.' });
  }

  // Get station location
  const station = await prisma.stations.findUnique({ where: { id: station_id } });
  if (!station) return res.status(404).json({ error: 'ไม่พบปั๊ม' });

  // GPS check: must be within 500m
  let distance = null;
  if (lat && lng) {
    distance = haversineMeters(lat, lng, station.lat, station.lng);
    if (distance > 500) {
      return res.status(403).json({ error: `คุณอยู่ห่างจากปั๊ม ${Math.round(distance)} เมตร (ต้อง ≤500 เมตร)` });
    }
  } else {
    return res.status(400).json({ error: 'ต้องเปิด GPS เพื่อรายงาน' });
  }

  // Calculate confidence
  let confidence = 60;
  if (distance <= 500) confidence = 80;

  // Check how many others reported the same thing (same station + fuel_type + is_available + active + last 6 hours)
  const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
  const sameReports = await prisma.public_reports.count({
    where: {
      station_id, fuel_type, is_available, status: 'active',
      created_at: { gte: sixHoursAgo },
      user_id: { not: req.user.id },
    },
  });
  if (sameReports >= 2) confidence = 90;

  const expiresAt = new Date(Date.now() + 6 * 60 * 60 * 1000);

  const report = await prisma.public_reports.create({
    data: {
      station_id, fuel_type, is_available,
      user_id: req.user.id,
      lat, lng, distance_meters: distance,
      confidence, status: 'active', expires_at: expiresAt,
    },
  });

  // Update user stats
  await prisma.public_users.update({
    where: { id: req.user.id },
    data: { total_reports: { increment: 1 } },
  });

  // Emit socket event
  io.emit('public-report', { station_id, fuel_type, is_available, confidence, reporters: sameReports + 1 });

  res.json({ success: true, report, same_reports: sameReports + 1 });
});

// Get reports for a station
app.get('/api/stations/:id/reports', async (req, res) => {
  if (!(await isFeatureEnabled('public_reporting_enabled'))) {
    return res.json([]);
  }

  const stationId = parseInt(req.params.id);
  const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);

  const reports = await prisma.public_reports.findMany({
    where: { station_id: stationId, status: 'active', created_at: { gte: sixHoursAgo } },
    include: { public_users: { select: { display_name: true, picture_url: true } } },
    orderBy: { created_at: 'desc' },
  });

  // Group by fuel_type + is_available, count reporters
  const grouped = {};
  for (const r of reports) {
    const key = `${r.fuel_type}:${r.is_available}`;
    if (!grouped[key]) {
      grouped[key] = {
        fuel_type: r.fuel_type,
        is_available: r.is_available,
        reporters: [],
        confidence: r.confidence,
        latest_at: r.created_at,
      };
    }
    grouped[key].reporters.push({
      name: r.public_users.display_name,
      picture: r.public_users.picture_url,
      created_at: r.created_at,
      distance_meters: r.distance_meters,
    });
    // Confidence based on count
    const count = grouped[key].reporters.length;
    grouped[key].confidence = count >= 3 ? 90 : count >= 2 ? 80 : 60;
  }

  res.json(Object.values(grouped));
});

// My reports
app.get('/api/public/my-reports', authMiddleware('public'), async (req, res) => {
  const reports = await prisma.public_reports.findMany({
    where: { user_id: req.user.id },
    include: { stations: { select: { name: true, brand: true } } },
    orderBy: { created_at: 'desc' },
    take: 50,
  });
  res.json(reports);
});

// ============ AUTO-EXPIRE REPORTS ============

setInterval(async () => {
  try {
    const now = new Date();
    // Expire reports older than 6 hours
    await prisma.public_reports.updateMany({
      where: { status: 'active', expires_at: { lt: now } },
      data: { status: 'expired' },
    });
    // Reduce confidence for reports older than 2 hours
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    await prisma.public_reports.updateMany({
      where: { status: 'active', created_at: { lt: twoHoursAgo }, confidence: { gt: 50 } },
      data: { confidence: 50 },
    });
  } catch (err) {
    console.error('Auto-expire error:', err);
  }
}, 5 * 60 * 1000); // Every 5 minutes

const PORT = process.env.PORT || 3002;
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});

io.on('connection', (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);
  socket.on('disconnect', () => console.log(`🔌 Client disconnected: ${socket.id}`));
});
