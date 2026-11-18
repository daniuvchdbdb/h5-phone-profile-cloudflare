import crypto from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';

const ROOT = dirname(fileURLToPath(import.meta.url));
try { process.loadEnvFile(join(ROOT, '.env')); } catch { /* .env is optional in development */ }
const production = process.argv.includes('--production');
const PORT = Number(process.env.PORT || 5173);
const HOST = process.env.HOST || '0.0.0.0';
const DATA_FILE = resolve(ROOT, process.env.DATA_FILE || join('data', 'links.json'));
const configuredPasswords = Array.from({ length: 5 }, (_, index) => process.env[`ADMIN_PASSWORD_${index + 1}`]).filter(Boolean);
if (!configuredPasswords.length && process.env.ADMIN_PASSWORDS) configuredPasswords.push(...process.env.ADMIN_PASSWORDS.split(',').map((value) => value.trim()).filter(Boolean).slice(0, 5));
if (!configuredPasswords.length && process.env.ADMIN_PASSWORD) configuredPasswords.push(process.env.ADMIN_PASSWORD);
const ADMIN_PASSWORDS = configuredPasswords.length ? configuredPasswords : ['demo1001', 'demo1002', 'demo1003', 'demo1004', 'demo1005'];
const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL || '').replace(/\/$/, '');
const SESSION_HOURS = 8;
const mobilePrefixes = ['130', '131', '132', '133', '135', '136', '137', '138', '139', '150', '151', '152', '155', '156', '157', '158', '159', '166', '170', '171', '172', '173', '175', '176', '177', '178', '180', '181', '182', '183', '185', '186', '187', '188', '189', '191', '193', '195', '196', '197', '198', '199'];
const familyNames = ['陈', '林', '黄', '张', '李', '王', '吴', '刘', '周', '徐', '孙', '马', '朱', '胡', '郭', '何', '高', '罗', '郑', '梁', '谢', '宋', '唐', '许', '韩', '冯', '邓', '曹', '彭', '曾', '肖', '田', '董', '袁', '潘', '于', '蒋', '蔡', '余', '杜'];
const givenNames = ['子涵', '宇辰', '嘉宁', '思远', '雨桐', '浩然', '若曦', '俊熙', '欣怡', '奕辰', '佳琪', '文博', '诗雨', '明轩', '雅雯', '梓豪', '安然', '书瑶', '景行', '可欣', '泽宇', '星妍', '乐川', '知夏', '沐阳', '清妍', '亦凡', '舒然', '彦霖', '语晴', '承泽', '念安', '以宁', '瑾瑜', '云舟', '嘉禾', '晨曦', '向晚', '予安', '明川'];

function generatedDisplayName(phone, salt = 0) {
  const digest = crypto.createHash('sha256').update(`${phone}:${salt}`).digest();
  return `${familyNames[digest[0] % familyNames.length]}${givenNames[digest[1] % givenNames.length]}`;
}

function assignMissingDisplayNames(links) {
  const used = new Set(links.map((link) => link.displayName).filter(Boolean));
  let changed = false;
  for (const link of links) {
    if (link.displayName) continue;
    let salt = 0;
    let candidate = generatedDisplayName(link.phone, salt);
    while (used.has(candidate)) candidate = generatedDisplayName(link.phone, ++salt);
    link.displayName = candidate;
    used.add(candidate);
    changed = true;
  }
  return changed;
}

function uniqueDisplayName(phone, reserved = []) {
  const used = new Set([...database.links.map((link) => link.displayName), ...reserved]);
  let salt = 0;
  let candidate = generatedDisplayName(phone, salt);
  while (used.has(candidate)) candidate = generatedDisplayName(phone, ++salt);
  return candidate;
}

const app = express();
if (production && configuredPasswords.length !== 5) {
  throw new Error('正式运行必须配置 ADMIN_PASSWORD_1 至 ADMIN_PASSWORD_5 五个管理密码');
}
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; manifest-src 'self'; worker-src 'self'; base-uri 'none'; frame-ancestors 'none'");
  next();
});
app.use(express.json({ limit: '100kb' }));

let database = await loadDatabase();
if (assignMissingDisplayNames(database.links)) await writeFile(DATA_FILE, `${JSON.stringify(database, null, 2)}\n`, 'utf8');
let saveQueue = Promise.resolve();
const sessions = new Map();
const loginAttempts = new Map();
setInterval(() => {
  const now = Date.now();
  for (const [token, session] of sessions) if (session.expiresAt <= now) sessions.delete(token);
  for (const [ip, attempt] of loginAttempts) if (attempt.resetAt <= now) loginAttempts.delete(ip);
}, 30 * 60 * 1000).unref();

async function loadDatabase() {
  await mkdir(dirname(DATA_FILE), { recursive: true });
  try {
    const parsed = JSON.parse(await readFile(DATA_FILE, 'utf8'));
    return { version: 1, links: Array.isArray(parsed.links) ? parsed.links : [] };
  } catch (error) {
    if (error.code !== 'ENOENT') console.warn('数据文件读取失败，已创建空数据：', error.message);
    const initial = { version: 1, links: [] };
    await writeFile(DATA_FILE, `${JSON.stringify(initial, null, 2)}\n`, 'utf8');
    return initial;
  }
}

function saveDatabase() {
  const snapshot = `${JSON.stringify(database, null, 2)}\n`;
  const temporary = `${DATA_FILE}.tmp`;
  saveQueue = saveQueue
    .then(() => writeFile(temporary, snapshot, 'utf8'))
    .then(() => rename(temporary, DATA_FILE))
    .catch((error) => console.error('保存数据失败：', error));
  return saveQueue;
}

function cookies(req) {
  return Object.fromEntries(
    (req.headers.cookie || '').split(';').filter(Boolean).map((part) => {
      const index = part.indexOf('=');
      return [decodeURIComponent(part.slice(0, index).trim()), decodeURIComponent(part.slice(index + 1).trim())];
    })
  );
}

function requireAdmin(req, res, next) {
  const token = cookies(req).h5_admin_session;
  const session = token && sessions.get(token);
  if (!session || session.expiresAt <= Date.now()) {
    if (token) sessions.delete(token);
    return res.status(401).json({ error: 'UNAUTHORIZED', message: '请先登录管理后台' });
  }
  session.expiresAt = Date.now() + SESSION_HOURS * 60 * 60 * 1000;
  req.adminSession = session;
  next();
}

function requireSameOrigin(req, res, next) {
  const origin = req.get('origin');
  if (!origin) return next();
  try {
    if (new URL(origin).host !== req.get('host')) return res.status(403).json({ error: 'INVALID_ORIGIN' });
  } catch {
    return res.status(403).json({ error: 'INVALID_ORIGIN' });
  }
  next();
}

function matchingAccount(candidate) {
  const supplied = Buffer.from(String(candidate || ''));
  return ADMIN_PASSWORDS.findIndex((password) => {
    const expected = Buffer.from(password);
    return expected.length === supplied.length && crypto.timingSafeEqual(expected, supplied);
  });
}

function publicBase(req) {
  return PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`;
}

function linkState(link) {
  if (!link.active) return 'disabled';
  if (new Date(link.expiresAt).getTime() <= Date.now()) return 'expired';
  return 'active';
}

function publicLink(link, req) {
  return {
    ...link,
    state: linkState(link),
    url: `${publicBase(req)}/p/${encodeURIComponent(link.code)}`
  };
}

function randomPhone(tail) {
  const prefix = mobilePrefixes[crypto.randomInt(mobilePrefixes.length)];
  const middle = String(crypto.randomInt(10000)).padStart(4, '0');
  return `${prefix}${middle}${tail}`;
}

function uniqueCode(tail) {
  let code;
  do code = `${tail}-${crypto.randomBytes(4).toString('hex')}`;
  while (database.links.some((link) => link.code === code));
  return code;
}

app.get('/api/health', (_req, res) => res.json({ ok: true, version: '1.0.0' }));

app.post('/api/admin/login', requireSameOrigin, (req, res) => {
  const ip = req.ip;
  const attempt = loginAttempts.get(ip) || { count: 0, resetAt: Date.now() + 10 * 60 * 1000 };
  if (attempt.resetAt <= Date.now()) Object.assign(attempt, { count: 0, resetAt: Date.now() + 10 * 60 * 1000 });
  if (attempt.count >= 8) return res.status(429).json({ error: 'TOO_MANY_ATTEMPTS', message: '尝试次数过多，请稍后再试' });
  const accountIndex = matchingAccount(req.body?.password);
  if (accountIndex === -1) {
    attempt.count += 1;
    loginAttempts.set(ip, attempt);
    return res.status(401).json({ error: 'INVALID_PASSWORD', message: '管理密码错误' });
  }
  loginAttempts.delete(ip);
  const token = crypto.randomBytes(32).toString('hex');
  const accountId = accountIndex + 1;
  sessions.set(token, { accountId, expiresAt: Date.now() + SESSION_HOURS * 60 * 60 * 1000 });
  res.setHeader('Set-Cookie', `h5_admin_session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_HOURS * 3600}${req.secure ? '; Secure' : ''}`);
  res.json({ ok: true, accountId });
});

app.get('/api/admin/session', requireAdmin, (req, res) => res.json({ authenticated: true, accountId: req.adminSession.accountId }));

app.post('/api/admin/logout', requireSameOrigin, requireAdmin, (req, res) => {
  sessions.delete(cookies(req).h5_admin_session);
  res.setHeader('Set-Cookie', 'h5_admin_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0');
  res.json({ ok: true });
});

app.get('/api/admin/links', requireAdmin, (req, res) => {
  const links = [...database.links]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map((link) => publicLink(link, req));
  res.json({ links });
});

app.post('/api/admin/links', requireSameOrigin, requireAdmin, async (req, res) => {
  const tail = String(req.body?.tail || '');
  const remark = String(req.body?.remark || '').trim().slice(0, 60);
  const count = Number(req.body?.count || 1);
  const expiresAt = new Date(req.body?.expiresAt || '');
  if (!/^\d{4}$/.test(tail)) return res.status(400).json({ error: 'INVALID_TAIL', message: '尾号必须是 4 位数字' });
  if (!Number.isInteger(count) || count < 1 || count > 50) return res.status(400).json({ error: 'INVALID_COUNT', message: '每批只能生成 1–50 条链接' });
  if (!Number.isFinite(expiresAt.getTime()) || expiresAt.getTime() < Date.now() + 60 * 1000) return res.status(400).json({ error: 'INVALID_EXPIRY', message: '失效时间至少晚于当前时间 1 分钟' });
  if (expiresAt.getTime() > Date.now() + 366 * 24 * 60 * 60 * 1000) return res.status(400).json({ error: 'INVALID_EXPIRY', message: '有效期最长为 366 天' });

  const batchId = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const reservedNames = [];
  const links = Array.from({ length: count }, () => {
    const phone = randomPhone(tail);
    const displayName = uniqueDisplayName(phone, reservedNames);
    reservedNames.push(displayName);
    return {
      id: crypto.randomUUID(),
      code: uniqueCode(tail),
      batchId,
      tail,
      phone,
      displayName,
      remark,
      active: true,
      createdAt,
      expiresAt: expiresAt.toISOString(),
      visits: 0,
      lastVisitedAt: null
    };
  });
  database.links.push(...links);
  await saveDatabase();
  res.status(201).json({ batchId, links: links.map((link) => publicLink(link, req)) });
});

app.patch('/api/admin/links/:id', requireSameOrigin, requireAdmin, async (req, res) => {
  const link = database.links.find((item) => item.id === req.params.id);
  if (!link) return res.status(404).json({ error: 'NOT_FOUND', message: '链接不存在' });
  if (typeof req.body?.active === 'boolean') link.active = req.body.active;
  if (typeof req.body?.remark === 'string') link.remark = req.body.remark.trim().slice(0, 60);
  if (req.body?.expiresAt) {
    const expiresAt = new Date(req.body.expiresAt);
    if (!Number.isFinite(expiresAt.getTime()) || expiresAt.getTime() < Date.now() + 60 * 1000) return res.status(400).json({ error: 'INVALID_EXPIRY', message: '失效时间至少晚于当前时间 1 分钟' });
    link.expiresAt = expiresAt.toISOString();
  }
  await saveDatabase();
  res.json({ link: publicLink(link, req) });
});

app.delete('/api/admin/links/:id', requireSameOrigin, requireAdmin, async (req, res) => {
  const index = database.links.findIndex((item) => item.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'NOT_FOUND', message: '链接不存在' });
  const [removed] = database.links.splice(index, 1);
  await saveDatabase();
  res.json({ ok: true, id: removed.id });
});

app.get('/api/profile/:code', async (req, res) => {
  const link = database.links.find((item) => item.code === req.params.code);
  if (!link) return res.status(404).json({ error: 'LINK_NOT_FOUND', message: '链接不存在或已被删除' });
  const state = linkState(link);
  if (state === 'expired') return res.status(410).json({ error: 'LINK_EXPIRED', message: '此链接已到期', expiresAt: link.expiresAt });
  if (state === 'disabled') return res.status(410).json({ error: 'LINK_DISABLED', message: '此链接已被管理端停用' });
  if (req.query.track !== '0') {
    link.visits += 1;
    link.lastVisitedAt = new Date().toISOString();
    await saveDatabase();
  }
  res.json({ phone: link.phone, tail: link.tail, displayName: link.displayName, expiresAt: link.expiresAt, code: link.code });
});

app.get('/api/manifest', (req, res) => {
  const code = String(req.query.code || '');
  const link = database.links.find((item) => item.code === code);
  const tail = link?.tail || (/^\d{4}$/.test(String(req.query.tail || '')) ? String(req.query.tail) : '0000');
  const startUrl = link ? `/p/${encodeURIComponent(link.code)}` : `/?n=${tail}`;
  res.type('application/manifest+json').set('Cache-Control', 'no-store').json({
    name: '设置',
    short_name: '设置',
    description: `固定显示尾号 ${tail} 的网页配置展示`,
    start_url: startUrl,
    id: startUrl,
    display: 'standalone',
    background_color: '#f2f2f7',
    theme_color: '#f2f2f7',
    icons: [
      { src: '/settings-icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/settings-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' }
    ]
  });
});

let vite;
if (!production) {
  const { createServer } = await import('vite');
  vite = await createServer({
    server: {
      middlewareMode: true,
      watch: { ignored: ['**/.edge-capture/**', '**/.tmp-icons/**'] }
    },
    appType: 'mpa'
  });
}

app.get('/p/:code', async (req, res, next) => {
  try {
    if (production) return res.sendFile(join(ROOT, 'dist', 'index.html'));
    const template = await readFile(join(ROOT, 'index.html'), 'utf8');
    res.status(200).type('html').send(await vite.transformIndexHtml(req.originalUrl, template));
  } catch (error) {
    next(error);
  }
});

if (production) app.use(express.static(join(ROOT, 'dist'), { extensions: ['html'] }));
else app.use(vite.middlewares);

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: 'SERVER_ERROR', message: '服务器暂时无法处理请求' });
});

app.listen(PORT, HOST, () => {
  console.log(`\n号码链接管理系统 ${production ? 'production' : 'development'}`);
  console.log(`Local:   http://localhost:${PORT}/admin.html`);
  console.log(`Admin accounts: ${configuredPasswords.length ? `${ADMIN_PASSWORDS.length} configured` : '5 development accounts (demo1001–demo1005)'}`);
});
