const SESSION_HOURS = 8;
const LOGIN_WINDOW_MS = 10 * 60 * 1000;
const LOGIN_LIMIT = 8;

const mobilePrefixes = ['130', '131', '132', '133', '135', '136', '137', '138', '139', '150', '151', '152', '155', '156', '157', '158', '159', '166', '170', '171', '172', '173', '175', '176', '177', '178', '180', '181', '182', '183', '185', '186', '187', '188', '189', '191', '193', '195', '196', '197', '198', '199'];
const familyNames = ['陈', '林', '黄', '张', '李', '王', '吴', '刘', '周', '徐', '孙', '马', '朱', '胡', '郭', '何', '高', '罗', '郑', '梁', '谢', '宋', '唐', '许', '韩', '冯', '邓', '曹', '彭', '曾', '肖', '田', '董', '袁', '潘', '于', '蒋', '蔡', '余', '杜'];
const givenNames = ['子涵', '宇辰', '嘉宁', '思远', '雨桐', '浩然', '若曦', '俊熙', '欣怡', '奕辰', '佳琪', '文博', '诗雨', '明轩', '雅雯', '梓豪', '安然', '书瑶', '景行', '可欣', '泽宇', '星妍', '乐川', '知夏', '沐阳', '清妍', '亦凡', '舒然', '彦霖', '语晴', '承泽', '念安', '以宁', '瑾瑜', '云舟', '嘉禾', '晨曦', '向晚', '予安', '明川'];

const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'same-origin',
  'X-Frame-Options': 'DENY',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; manifest-src 'self'; worker-src 'self'; base-uri 'none'; frame-ancestors 'none'"
};

function secure(response) {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(securityHeaders)) headers.set(name, value);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extraHeaders }
  });
}

async function bodyJson(request) {
  try { return await request.json(); } catch { return {}; }
}

function cookies(request) {
  const result = {};
  for (const part of (request.headers.get('Cookie') || '').split(';')) {
    const index = part.indexOf('=');
    if (index < 0) continue;
    try { result[decodeURIComponent(part.slice(0, index).trim())] = decodeURIComponent(part.slice(index + 1).trim()); } catch { /* malformed cookie */ }
  }
  return result;
}

function sameOrigin(request) {
  const origin = request.headers.get('Origin');
  if (!origin) return true;
  try { return new URL(origin).origin === new URL(request.url).origin; } catch { return false; }
}

function toBase64Url(bytes) {
  let binary = '';
  for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(value) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4);
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
}

async function digest(value) {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
}

async function sign(secret, value) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value)));
}

function equalBytes(left, right) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index];
  return difference === 0;
}

async function accountMatch(candidate, env) {
  const passwords = String(env.ADMIN_PASSWORDS || '').split(',').map((value) => value.trim()).filter(Boolean);
  if (passwords.length !== 5) return { configured: false, index: -1 };
  const supplied = await digest(String(candidate || ''));
  for (let index = 0; index < passwords.length; index += 1) {
    if (equalBytes(supplied, await digest(passwords[index]))) return { configured: true, index };
  }
  return { configured: true, index: -1 };
}

async function makeSession(accountId, secret) {
  const payload = toBase64Url(new TextEncoder().encode(JSON.stringify({ accountId, expiresAt: Date.now() + SESSION_HOURS * 3600000 })));
  return `${payload}.${toBase64Url(await sign(secret, payload))}`;
}

async function readSession(request, env) {
  const token = cookies(request).h5_admin_session;
  if (!token || !env.SESSION_SECRET) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  try {
    if (!equalBytes(await sign(env.SESSION_SECRET, parts[0]), fromBase64Url(parts[1]))) return null;
    const data = JSON.parse(new TextDecoder().decode(fromBase64Url(parts[0])));
    return Number.isInteger(data.accountId) && data.expiresAt > Date.now() ? data : null;
  } catch { return null; }
}

function toLink(row) {
  if (!row) return null;
  return {
    id: row.id, code: row.code, batchId: row.batch_id, tail: row.tail, phone: row.phone,
    displayName: row.display_name, remark: row.remark || '', active: Boolean(row.active),
    createdAt: row.created_at, expiresAt: row.expires_at, visits: Number(row.visits || 0),
    lastVisitedAt: row.last_visited_at || null
  };
}

function state(link) {
  if (!link.active) return 'disabled';
  return new Date(link.expiresAt).getTime() <= Date.now() ? 'expired' : 'active';
}

function publicLink(link, request) {
  return { ...link, state: state(link), url: `${new URL(request.url).origin}/p/${encodeURIComponent(link.code)}` };
}

function randomInt(maximum) {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return values[0] % maximum;
}

function randomHex(length) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return [...bytes].map((value) => value.toString(16).padStart(2, '0')).join('');
}

function randomPhone(tail) {
  return `${mobilePrefixes[randomInt(mobilePrefixes.length)]}${String(randomInt(10000)).padStart(4, '0')}${tail}`;
}

async function uniqueName(phone, used) {
  let salt = 0;
  while (true) {
    const hash = await digest(`${phone}:${salt}`);
    const candidate = `${familyNames[hash[0] % familyNames.length]}${givenNames[hash[1] % givenNames.length]}`;
    if (!used.has(candidate)) { used.add(candidate); return candidate; }
    salt += 1;
  }
}

function decode(value) {
  try { return decodeURIComponent(value); } catch { return value; }
}

async function asset(request, env, pathname) {
  const url = new URL(request.url);
  url.pathname = pathname;
  url.search = '';
  return env.ASSETS.fetch(new Request(url, { method: 'GET', headers: request.headers }));
}

async function login(request, env) {
  if (!sameOrigin(request)) return json({ error: 'INVALID_ORIGIN' }, 403);
  if (!env.SESSION_SECRET) return json({ error: 'SERVER_NOT_CONFIGURED', message: '管理端安全密钥尚未配置' }, 503);
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const now = Date.now();
  let attempt = await env.DB.prepare('SELECT count, reset_at FROM login_attempts WHERE ip = ?').bind(ip).first();
  if (attempt && Number(attempt.reset_at) <= now) {
    await env.DB.prepare('DELETE FROM login_attempts WHERE ip = ?').bind(ip).run();
    attempt = null;
  }
  if (attempt && Number(attempt.count) >= LOGIN_LIMIT) return json({ error: 'TOO_MANY_ATTEMPTS', message: '尝试次数过多，请稍后再试' }, 429);

  const match = await accountMatch((await bodyJson(request)).password, env);
  if (!match.configured) return json({ error: 'SERVER_NOT_CONFIGURED', message: '必须配置 5 个管理密码' }, 503);
  if (match.index < 0) {
    const resetAt = attempt ? Number(attempt.reset_at) : now + LOGIN_WINDOW_MS;
    await env.DB.prepare(`INSERT INTO login_attempts (ip, count, reset_at) VALUES (?, 1, ?)
      ON CONFLICT(ip) DO UPDATE SET count = login_attempts.count + 1, reset_at = excluded.reset_at`).bind(ip, resetAt).run();
    return json({ error: 'INVALID_PASSWORD', message: '管理密码错误' }, 401);
  }

  await env.DB.prepare('DELETE FROM login_attempts WHERE ip = ?').bind(ip).run();
  const accountId = match.index + 1;
  const token = await makeSession(accountId, env.SESSION_SECRET);
  return json({ ok: true, accountId }, 200, {
    'Set-Cookie': `h5_admin_session=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_HOURS * 3600}`
  });
}

async function admin(request, env, pathname) {
  const session = await readSession(request, env);
  if (!session) return json({ error: 'UNAUTHORIZED', message: '请先登录管理后台' }, 401);
  if (!sameOrigin(request)) return json({ error: 'INVALID_ORIGIN' }, 403);

  if (pathname === '/api/admin/session' && request.method === 'GET') return json({ authenticated: true, accountId: session.accountId });
  if (pathname === '/api/admin/logout' && request.method === 'POST') return json({ ok: true }, 200, {
    'Set-Cookie': 'h5_admin_session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0'
  });
  if (pathname === '/api/admin/links' && request.method === 'GET') {
    const result = await env.DB.prepare('SELECT * FROM links ORDER BY created_at DESC').all();
    return json({ links: result.results.map(toLink).map((link) => publicLink(link, request)) });
  }
  if (pathname === '/api/admin/links' && request.method === 'POST') return createLinks(request, env);

  const match = pathname.match(/^\/api\/admin\/links\/([^/]+)$/);
  if (match && request.method === 'DELETE') {
    const id = decode(match[1]);
    const current = await env.DB.prepare('SELECT id FROM links WHERE id = ?').bind(id).first();
    if (!current) return json({ error: 'NOT_FOUND', message: '链接不存在' }, 404);
    await env.DB.prepare('DELETE FROM links WHERE id = ?').bind(id).run();
    return json({ ok: true, id });
  }
  if (match && request.method === 'PATCH') return updateLink(request, env, decode(match[1]));
  return json({ error: 'NOT_FOUND', message: '接口不存在' }, 404);
}

async function createLinks(request, env) {
  const body = await bodyJson(request);
  const tail = String(body.tail || '');
  const remark = String(body.remark || '').trim().slice(0, 60);
  const count = Number(body.count || 1);
  const expiresAt = new Date(body.expiresAt || '');
  if (!/^\d{4}$/.test(tail)) return json({ error: 'INVALID_TAIL', message: '尾号必须是 4 位数字' }, 400);
  if (!Number.isInteger(count) || count < 1 || count > 50) return json({ error: 'INVALID_COUNT', message: '每批只能生成 1–50 条链接' }, 400);
  if (!Number.isFinite(expiresAt.getTime()) || expiresAt.getTime() < Date.now() + 60000) return json({ error: 'INVALID_EXPIRY', message: '失效时间至少晚于当前时间 1 分钟' }, 400);
  if (expiresAt.getTime() > Date.now() + 366 * 86400000) return json({ error: 'INVALID_EXPIRY', message: '有效期最长为 366 天' }, 400);

  const names = await env.DB.prepare('SELECT display_name FROM links').all();
  const used = new Set(names.results.map((row) => row.display_name));
  const batchId = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const codes = new Set();
  const links = [];
  for (let index = 0; index < count; index += 1) {
    const phone = randomPhone(tail);
    let code = `${tail}-${randomHex(4)}`;
    while (codes.has(code)) code = `${tail}-${randomHex(4)}`;
    codes.add(code);
    links.push({
      id: crypto.randomUUID(), code, batchId, tail, phone, displayName: await uniqueName(phone, used), remark,
      active: true, createdAt, expiresAt: expiresAt.toISOString(), visits: 0, lastVisitedAt: null
    });
  }
  await env.DB.batch(links.map((link) => env.DB.prepare(`INSERT INTO links
    (id, code, batch_id, tail, phone, display_name, remark, active, created_at, expires_at, visits, last_visited_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(
    link.id, link.code, link.batchId, link.tail, link.phone, link.displayName, link.remark,
    1, link.createdAt, link.expiresAt, 0, null
  )));
  return json({ batchId, links: links.map((link) => publicLink(link, request)) }, 201);
}

async function updateLink(request, env, id) {
  const current = await env.DB.prepare('SELECT id FROM links WHERE id = ?').bind(id).first();
  if (!current) return json({ error: 'NOT_FOUND', message: '链接不存在' }, 404);
  const body = await bodyJson(request);
  const sets = [];
  const values = [];
  if (typeof body.active === 'boolean') { sets.push('active = ?'); values.push(body.active ? 1 : 0); }
  if (typeof body.remark === 'string') { sets.push('remark = ?'); values.push(body.remark.trim().slice(0, 60)); }
  if (body.expiresAt) {
    const expiresAt = new Date(body.expiresAt);
    if (!Number.isFinite(expiresAt.getTime()) || expiresAt.getTime() < Date.now() + 60000) return json({ error: 'INVALID_EXPIRY', message: '失效时间至少晚于当前时间 1 分钟' }, 400);
    sets.push('expires_at = ?'); values.push(expiresAt.toISOString());
  }
  if (sets.length) await env.DB.prepare(`UPDATE links SET ${sets.join(', ')} WHERE id = ?`).bind(...values, id).run();
  return json({ link: publicLink(toLink(await env.DB.prepare('SELECT * FROM links WHERE id = ?').bind(id).first()), request) });
}

async function profile(request, env, code) {
  const link = toLink(await env.DB.prepare('SELECT * FROM links WHERE code = ?').bind(code).first());
  if (!link) return json({ error: 'LINK_NOT_FOUND', message: '链接不存在或已被删除' }, 404);
  const currentState = state(link);
  if (currentState === 'expired') return json({ error: 'LINK_EXPIRED', message: '此链接已到期', expiresAt: link.expiresAt }, 410);
  if (currentState === 'disabled') return json({ error: 'LINK_DISABLED', message: '此链接已被管理端停用' }, 410);
  if (new URL(request.url).searchParams.get('track') !== '0') {
    await env.DB.prepare('UPDATE links SET visits = visits + 1, last_visited_at = ? WHERE id = ?').bind(new Date().toISOString(), link.id).run();
  }
  return json({ phone: link.phone, tail: link.tail, displayName: link.displayName, expiresAt: link.expiresAt, code: link.code });
}

async function manifest(request, env) {
  const url = new URL(request.url);
  const code = String(url.searchParams.get('code') || '');
  const row = code ? await env.DB.prepare('SELECT code, tail FROM links WHERE code = ?').bind(code).first() : null;
  const requestedTail = String(url.searchParams.get('tail') || '');
  const tail = row?.tail || (/^\d{4}$/.test(requestedTail) ? requestedTail : '0000');
  const startUrl = row ? `/p/${encodeURIComponent(row.code)}` : `/?n=${tail}`;
  return json({
    name: '设置', short_name: '设置', description: `固定显示尾号 ${tail} 的网页配置展示`,
    start_url: startUrl, id: startUrl, display: 'standalone', background_color: '#f2f2f7', theme_color: '#f2f2f7',
    icons: [
      { src: '/settings-icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/settings-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' }
    ]
  }, 200, { 'Content-Type': 'application/manifest+json; charset=utf-8' });
}

async function route(request, env) {
  const pathname = new URL(request.url).pathname;
  if (pathname === '/api/health' && request.method === 'GET') return json({ ok: true, version: '2.0.0-cloudflare' });
  if (pathname === '/api/admin/login' && request.method === 'POST') return login(request, env);
  if (pathname.startsWith('/api/admin/')) return admin(request, env, pathname);
  const profileMatch = pathname.match(/^\/api\/profile\/([^/]+)$/);
  if (profileMatch && request.method === 'GET') return profile(request, env, decode(profileMatch[1]));
  if (pathname === '/api/manifest' && request.method === 'GET') return manifest(request, env);
  if (/^\/p\/[^/]+$/.test(pathname) && request.method === 'GET') return asset(request, env, '/index.html');
  if (pathname.startsWith('/api/')) return json({ error: 'NOT_FOUND', message: '接口不存在' }, 404);
  return env.ASSETS.fetch(request);
}

export default {
  async fetch(request, env) {
    try { return secure(await route(request, env)); }
    catch (error) {
      console.error('Worker request failed', error);
      return secure(json({ error: 'SERVER_ERROR', message: '服务器暂时无法处理请求' }, 500));
    }
  }
};
