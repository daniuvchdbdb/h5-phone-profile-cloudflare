import QRCode from 'qrcode';
import 'bootstrap-icons/font/bootstrap-icons.css';
import './admin.css';

document.querySelector('#admin').innerHTML = `
  <section id="loginScreen" class="login-screen">
    <form id="loginForm" class="login-card">
      <div class="login-logo"><i class="bi bi-link-45deg" aria-hidden="true"></i></div>
      <div class="login-title"><span>号码链接管理系统</span><small>独立控制后台</small></div>
      <h1>管理端登录</h1>
      <p>登录后可以生成固定尾号链接、设置失效时间并查看访问状态。</p>
      <label for="passwordInput">管理密码</label>
      <div class="password-field"><input id="passwordInput" type="password" autocomplete="current-password" placeholder="请输入管理密码" required /><button id="showPassword" type="button">显示</button></div>
      <button class="login-button" type="submit">登录管理后台</button>
      <span id="loginError" class="login-error" role="alert"></span>
      <small class="login-note">系统支持 5 个独立管理密码并发登录，登录状态互不影响。</small>
    </form>
  </section>

  <div id="dashboard" hidden>
    <aside class="sidebar">
      <div class="brand"><span><i class="bi bi-link-45deg" aria-hidden="true"></i></span><div><b>号码链接</b><small>独立管理端</small></div></div>
      <nav><a class="active" href="#generator">链接分发</a><a href="#records">链接管理</a></nav>
      <button id="logoutButton" class="preview-link logout-button" type="button">退出管理端</button>
    </aside>
    <main class="admin-main">
      <header><div><p>管理后台 / 链接控制</p><h1>固定尾号链接管理</h1></div><span class="demo-pill">管理端</span></header>

      <section class="stats" aria-label="链接统计">
        <article><span>全部链接</span><strong id="totalCount">0</strong></article>
        <article><span>当前有效</span><strong id="activeCount">0</strong></article>
        <article><span>已失效</span><strong id="expiredCount">0</strong></article>
        <article><span>累计访问</span><strong id="visitCount">0</strong></article>
      </section>

      <section class="grid" id="generator">
        <article class="card generator-card">
          <div class="card-heading"><span class="step">01</span><div><h2>创建分发链接</h2><p>指定后四位、数量和有效期，前 7 位随机生成并永久固定。</p></div></div>
          <form id="linkForm">
            <div class="form-row">
              <div class="form-field grow">
                <label for="tailInput">手机号码后四位</label>
                <div class="tail-input"><span>随机前7位</span><input id="tailInput" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" placeholder="8899" autocomplete="off" required /></div>
                <div class="field-note"><span id="digitCount">0 / 4</span><span>生成完整 11 位号码</span></div>
              </div>
              <div class="form-field count-field">
                <label for="countInput">本批数量</label>
                <input id="countInput" class="text-input" type="number" min="1" max="50" value="1" required />
                <div class="field-note"><span>1–50 条</span></div>
              </div>
            </div>

            <label for="expiryInput">链接失效时间</label>
            <div class="expiry-presets" role="group" aria-label="有效期快捷设置">
              <button type="button" data-days="1">1 天</button><button class="active" type="button" data-days="7">7 天</button><button type="button" data-days="30">30 天</button><button type="button" data-days="90">90 天</button>
            </div>
            <input id="expiryInput" class="text-input" type="datetime-local" required />
            <div class="field-note"><span>到期后扫码自动显示“链接已失效”</span><span>最长 366 天</span></div>

            <label for="remarkInput">分发备注 <em>可选</em></label>
            <input id="remarkInput" class="text-input" maxlength="60" placeholder="例如：渠道 A / 客户演示" />
            <button id="generateButton" class="generate-button" type="submit">生成链接与二维码</button>
          </form>
        </article>

        <article class="card result-card empty" id="resultCard">
          <div id="emptyState"><div class="empty-visual"><i class="bi bi-qr-code" aria-hidden="true"></i></div><h2>等待生成</h2><p>生成后的二维码会显示在这里</p></div>
          <div id="resultState" hidden>
            <div class="card-heading"><span class="step success"><i class="bi bi-check-lg" aria-hidden="true"></i></span><div><h2>本批链接已就绪</h2><p id="batchSummary">已保存到服务器</p></div></div>
            <div class="qr-wrap"><canvas id="qrCanvas"></canvas><span id="qrPhone"></span></div>
            <label>当前二维码链接</label>
            <div class="link-box"><input id="resultUrl" readonly /><button id="copyButton" type="button">复制</button></div>
            <div class="result-actions"><a id="openButton" target="_blank" rel="noopener">预览页面 ↗</a><button id="downloadButton" type="button">下载二维码</button></div>
            <div id="batchActions" class="batch-actions" hidden><button id="copyBatchButton" type="button">复制本批全部链接</button><button id="csvButton" type="button">导出本批 CSV</button></div>
          </div>
        </article>
      </section>

      <section class="card records-card" id="records">
        <div class="records-heading"><div><h2>链接管理</h2><p>数据由服务器持久保存，可查看状态、访问量并提前停用</p></div><button id="refreshButton" type="button">刷新数据</button></div>
        <div class="table-wrap"><table><thead><tr><th>完整号码</th><th>尾号</th><th>备注</th><th>状态</th><th>失效时间</th><th>访问</th><th>操作</th></tr></thead><tbody id="recordRows"></tbody></table></div>
        <div id="mobileLinkCards" class="mobile-link-cards"></div>
        <div id="noRecords" class="no-records">还没有生成记录</div>
      </section>
    </main>
  </div>
  <div id="expiryDialog" class="modal-backdrop" hidden>
    <form id="expiryForm" class="modal-card">
      <button id="closeExpiryDialog" class="modal-close" type="button" aria-label="关闭"><i class="bi bi-x-lg" aria-hidden="true"></i></button>
      <span class="step"><i class="bi bi-clock-history" aria-hidden="true"></i></span>
      <h2>修改失效时间</h2>
      <p id="expiryDialogPhone">号码</p>
      <label for="editExpiryInput">新的失效时间</label>
      <input id="editExpiryInput" class="text-input" type="datetime-local" required />
      <div class="modal-actions"><button id="cancelExpiryDialog" type="button">取消</button><button class="confirm" type="submit">保存时间</button></div>
    </form>
  </div>
  <div id="linkDetailDialog" class="modal-backdrop" hidden>
    <form id="linkDetailForm" class="modal-card detail-card">
      <button id="closeLinkDetail" class="modal-close" type="button" aria-label="关闭"><i class="bi bi-x-lg" aria-hidden="true"></i></button>
      <div class="detail-heading"><span class="step"><i class="bi bi-sliders" aria-hidden="true"></i></span><div><h2 id="detailTitle">尾号</h2><p id="detailPhone">完整号码</p></div></div>
      <div class="detail-qr"><canvas id="detailQrCanvas"></canvas><small>扫描二维码进入固定号码页面</small></div>
      <label for="detailRemark">链接备注</label>
      <textarea id="detailRemark" maxlength="60" placeholder="输入分发对象或用途"></textarea>
      <label for="detailExpiry">失效时间</label>
      <input id="detailExpiry" class="text-input" type="datetime-local" required />
      <label class="disable-check"><input id="detailDisabled" type="checkbox" /><span>停用链接</span></label>
      <div class="detail-primary-actions"><button id="detailCopy" type="button">复制链接</button><button class="confirm" type="submit">保存修改</button></div>
      <button id="detailDelete" class="detail-delete" type="button">删除此链接</button>
    </form>
  </div>
  <div id="toast" class="toast">操作成功</div>
`;

const loginScreen = document.querySelector('#loginScreen');
const dashboard = document.querySelector('#dashboard');
const loginForm = document.querySelector('#loginForm');
const loginError = document.querySelector('#loginError');
const tailInput = document.querySelector('#tailInput');
const digitCount = document.querySelector('#digitCount');
const expiryInput = document.querySelector('#expiryInput');
const form = document.querySelector('#linkForm');
const generateButton = document.querySelector('#generateButton');
const toast = document.querySelector('#toast');
let links = [];
let currentBatch = [];
let currentLink = null;
let editingLink = null;
let detailLink = null;

async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: 'same-origin',
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && path !== '/api/admin/login') showLogin();
    throw new Error(data.message || '请求失败，请稍后重试');
  }
  return data;
}

function showLogin() {
  loginScreen.hidden = false;
  dashboard.hidden = true;
}

function showDashboard() {
  loginScreen.hidden = true;
  dashboard.hidden = false;
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('show'), 1800);
}

function setExpiry(days) {
  const date = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  date.setSeconds(0, 0);
  expiryInput.value = toLocalInput(date);
  document.querySelectorAll('.expiry-presets button').forEach((button) => button.classList.toggle('active', Number(button.dataset.days) === days));
}

function toLocalInput(date) {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function formatDate(value) {
  return new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

function formatPhone(value) {
  return value ? `${value.slice(0, 3)} ${value.slice(3, 7)} ${value.slice(7)}` : '—';
}

function stateLabel(state) {
  return { active: '有效', expired: '已到期', disabled: '已停用' }[state] || state;
}

function clientState(link) {
  if (!link.active) return 'disabled';
  return new Date(link.expiresAt).getTime() <= Date.now() ? 'expired' : 'active';
}

function remainingLabel(link) {
  const state = clientState(link);
  if (state === 'disabled') return '已停用';
  if (state === 'expired') return '已到期';
  const minutes = Math.max(1, Math.ceil((new Date(link.expiresAt).getTime() - Date.now()) / 60000));
  return `${minutes} 分钟`;
}

function escapeHtml(value) {
  const div = document.createElement('div');
  div.textContent = value;
  return div.innerHTML;
}

async function copyText(text, message = '已复制') {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    document.body.append(area);
    area.select();
    document.execCommand('copy');
    area.remove();
  }
  showToast(message);
}

async function loadLinks() {
  const data = await api('/api/admin/links');
  links = data.links;
  renderRecords();
  renderStats();
}

function renderStats() {
  document.querySelector('#totalCount').textContent = links.length;
  document.querySelector('#activeCount').textContent = links.filter((link) => clientState(link) === 'active').length;
  document.querySelector('#expiredCount').textContent = links.filter((link) => clientState(link) !== 'active').length;
  document.querySelector('#visitCount').textContent = links.reduce((sum, link) => sum + link.visits, 0);
}

function renderRecords() {
  const rows = document.querySelector('#recordRows');
  rows.innerHTML = links.map((link) => {
    const state = clientState(link);
    return `
    <tr>
      <td><strong>${formatPhone(link.phone)}</strong></td>
      <td><span class="tail-pill">${link.tail}</span></td>
      <td>${escapeHtml(link.remark || '—')}</td>
      <td><span class="status status-${state}">${stateLabel(state)}</span></td>
      <td>${formatDate(link.expiresAt)}</td>
      <td>${link.visits}</td>
      <td><div class="table-actions"><button data-action="detail" data-id="${link.id}" type="button">详情</button><button data-action="copy" data-id="${link.id}" type="button">复制</button><button data-action="expiry" data-id="${link.id}" type="button">改时间</button>${state === 'active' ? `<button class="danger" data-action="toggle" data-id="${link.id}" type="button">停用</button>` : state === 'disabled' ? `<button data-action="toggle" data-id="${link.id}" type="button">启用</button>` : ''}</div></td>
    </tr>`;
  }).join('');
  document.querySelector('#noRecords').hidden = links.length > 0;
  rows.querySelectorAll('button').forEach((button) => button.addEventListener('click', () => handleRecordAction(button.dataset.action, button.dataset.id)));
  const cards = document.querySelector('#mobileLinkCards');
  cards.innerHTML = links.map((link) => {
    const state = clientState(link);
    return `<button class="mobile-link-card state-${state}" data-id="${link.id}" type="button"><span><b>尾号 ${link.tail}</b><small>${formatPhone(link.phone)}${link.remark ? ` · ${escapeHtml(link.remark)}` : ''}</small></span><span class="remaining ${state}">${remainingLabel(link)}</span><i class="bi bi-chevron-right" aria-hidden="true"></i></button>`;
  }).join('');
  cards.querySelectorAll('button').forEach((button) => button.addEventListener('click', () => openLinkDetail(links.find((link) => link.id === button.dataset.id))));
}

async function handleRecordAction(action, id) {
  const link = links.find((item) => item.id === id);
  if (!link) return;
  if (action === 'copy') return copyText(link.url, '链接已复制');
  if (action === 'detail') return openLinkDetail(link);
  if (action === 'expiry') {
    editingLink = link;
    document.querySelector('#expiryDialogPhone').textContent = `号码 ${formatPhone(link.phone)} · 尾号 ${link.tail}`;
    document.querySelector('#editExpiryInput').value = toLocalInput(new Date(Math.max(Date.now() + 60 * 60 * 1000, new Date(link.expiresAt).getTime())));
    document.querySelector('#expiryDialog').hidden = false;
    return;
  }
  if (action === 'qr') {
    await displayLink(link, [link]);
    document.querySelector('#resultCard').scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }
  if (action === 'toggle') {
    try {
      await api(`/api/admin/links/${id}`, { method: 'PATCH', body: JSON.stringify({ active: !link.active }) });
      await loadLinks();
      showToast(link.active ? '链接已停用' : '链接已启用');
    } catch (error) {
      showToast(error.message);
    }
  }
}

async function openLinkDetail(link) {
  if (!link) return;
  detailLink = link;
  document.querySelector('#detailTitle').textContent = `尾号 ${link.tail}`;
  document.querySelector('#detailPhone').textContent = `${link.displayName} · ${formatPhone(link.phone)} · ${remainingLabel(link)}`;
  document.querySelector('#detailRemark').value = link.remark || '';
  document.querySelector('#detailExpiry').value = toLocalInput(new Date(Math.max(Date.now() + 60 * 60 * 1000, new Date(link.expiresAt).getTime())));
  document.querySelector('#detailDisabled').checked = !link.active;
  await QRCode.toCanvas(document.querySelector('#detailQrCanvas'), link.url, { width: 260, margin: 1, color: { dark: '#111827', light: '#ffffff' }, errorCorrectionLevel: 'H' });
  document.querySelector('#linkDetailDialog').hidden = false;
}

async function displayLink(link, batch) {
  currentLink = link;
  currentBatch = batch;
  document.querySelector('#resultCard').classList.remove('empty');
  document.querySelector('#emptyState').hidden = true;
  document.querySelector('#resultState').hidden = false;
  document.querySelector('#batchSummary').textContent = `共 ${batch.length} 条 · ${formatDate(link.expiresAt)} 失效`;
  document.querySelector('#qrPhone').innerHTML = `${link.displayName} · ${formatPhone(link.phone)} · 尾号 <b>${link.tail}</b>`;
  document.querySelector('#resultUrl').value = link.url;
  document.querySelector('#openButton').href = `${link.url}?preview=1`;
  document.querySelector('#batchActions').hidden = batch.length <= 1;
  await QRCode.toCanvas(document.querySelector('#qrCanvas'), link.url, {
    width: 220,
    margin: 1,
    color: { dark: '#111827', light: '#ffffff' },
    errorCorrectionLevel: 'H'
  });
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  loginError.textContent = '';
  const submit = loginForm.querySelector('.login-button');
  submit.disabled = true;
  submit.textContent = '正在登录…';
  try {
    await api('/api/admin/login', { method: 'POST', body: JSON.stringify({ password: document.querySelector('#passwordInput').value }) });
    showDashboard();
    await loadLinks();
  } catch (error) {
    loginError.textContent = error.message;
  } finally {
    submit.disabled = false;
    submit.textContent = '登录管理后台';
  }
});

document.querySelector('#showPassword').addEventListener('click', (event) => {
  const input = document.querySelector('#passwordInput');
  input.type = input.type === 'password' ? 'text' : 'password';
  event.currentTarget.textContent = input.type === 'password' ? '显示' : '隐藏';
});

document.querySelector('#logoutButton').addEventListener('click', async () => {
  try { await api('/api/admin/logout', { method: 'POST', body: '{}' }); } catch { /* session may already be gone */ }
  showLogin();
});

tailInput.addEventListener('input', () => {
  tailInput.value = tailInput.value.replace(/\D/g, '').slice(0, 4);
  digitCount.textContent = `${tailInput.value.length} / 4`;
});

document.querySelectorAll('.expiry-presets button').forEach((button) => button.addEventListener('click', () => setExpiry(Number(button.dataset.days))));
expiryInput.addEventListener('input', () => document.querySelectorAll('.expiry-presets button').forEach((button) => button.classList.remove('active')));

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!/^\d{4}$/.test(tailInput.value)) {
    tailInput.focus();
    return showToast('请输入 4 位数字');
  }
  generateButton.disabled = true;
  generateButton.textContent = '正在生成…';
  try {
    const data = await api('/api/admin/links', {
      method: 'POST',
      body: JSON.stringify({
        tail: tailInput.value,
        count: Number(document.querySelector('#countInput').value),
        expiresAt: new Date(expiryInput.value).toISOString(),
        remark: document.querySelector('#remarkInput').value.trim()
      })
    });
    await displayLink(data.links[0], data.links);
    await loadLinks();
    showToast(`已生成 ${data.links.length} 条链接`);
  } catch (error) {
    showToast(error.message);
  } finally {
    generateButton.disabled = false;
    generateButton.textContent = '生成链接与二维码';
  }
});

document.querySelector('#copyButton').addEventListener('click', () => currentLink && copyText(currentLink.url, '链接已复制'));
document.querySelector('#downloadButton').addEventListener('click', () => {
  if (!currentLink) return;
  const anchor = document.createElement('a');
  anchor.download = `号码-${currentLink.phone}-二维码.png`;
  anchor.href = document.querySelector('#qrCanvas').toDataURL('image/png');
  anchor.click();
});
document.querySelector('#copyBatchButton').addEventListener('click', () => copyText(currentBatch.map((link) => `${link.displayName}\t${link.phone}\t${link.url}`).join('\n'), '本批链接已复制'));
document.querySelector('#csvButton').addEventListener('click', () => {
  const rows = [['用户名', '完整号码', '后四位', '失效时间', '访问链接'], ...currentBatch.map((link) => [link.displayName, link.phone, link.tail, link.expiresAt, link.url])];
  const csv = `\ufeff${rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\n')}`;
  const anchor = document.createElement('a');
  anchor.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  anchor.download = `尾号-${currentBatch[0]?.tail || '链接'}-分发包.csv`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(anchor.href), 1000);
});
document.querySelector('#refreshButton').addEventListener('click', async () => {
  try { await loadLinks(); showToast('数据已刷新'); } catch (error) { showToast(error.message); }
});

const expiryDialog = document.querySelector('#expiryDialog');
const closeExpiryDialog = () => { expiryDialog.hidden = true; editingLink = null; };
document.querySelector('#closeExpiryDialog').addEventListener('click', closeExpiryDialog);
document.querySelector('#cancelExpiryDialog').addEventListener('click', closeExpiryDialog);
expiryDialog.addEventListener('click', (event) => { if (event.target === expiryDialog) closeExpiryDialog(); });
document.querySelector('#expiryForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!editingLink) return;
  try {
    await api(`/api/admin/links/${editingLink.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ expiresAt: new Date(document.querySelector('#editExpiryInput').value).toISOString() })
    });
    closeExpiryDialog();
    await loadLinks();
    showToast('失效时间已更新');
  } catch (error) {
    showToast(error.message);
  }
});

const linkDetailDialog = document.querySelector('#linkDetailDialog');
const closeLinkDetail = () => { linkDetailDialog.hidden = true; detailLink = null; };
document.querySelector('#closeLinkDetail').addEventListener('click', closeLinkDetail);
linkDetailDialog.addEventListener('click', (event) => { if (event.target === linkDetailDialog) closeLinkDetail(); });
document.querySelector('#detailCopy').addEventListener('click', () => detailLink && copyText(detailLink.url, '链接已复制'));
document.querySelector('#linkDetailForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!detailLink) return;
  try {
    await api(`/api/admin/links/${detailLink.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        remark: document.querySelector('#detailRemark').value,
        active: !document.querySelector('#detailDisabled').checked,
        expiresAt: new Date(document.querySelector('#detailExpiry').value).toISOString()
      })
    });
    closeLinkDetail();
    await loadLinks();
    showToast('链接修改已保存');
  } catch (error) {
    showToast(error.message);
  }
});
document.querySelector('#detailDelete').addEventListener('click', async () => {
  if (!detailLink || !window.confirm(`确定删除尾号 ${detailLink.tail} 的链接吗？删除后二维码立即失效，且无法恢复。`)) return;
  try {
    await api(`/api/admin/links/${detailLink.id}`, { method: 'DELETE', body: '{}' });
    closeLinkDetail();
    await loadLinks();
    showToast('链接已删除');
  } catch (error) {
    showToast(error.message);
  }
});

setExpiry(7);
setInterval(() => {
  if (!dashboard.hidden) loadLinks().catch(() => undefined);
}, 60000);
try {
  await api('/api/admin/session');
  showDashboard();
  await loadLinks();
} catch {
  showLogin();
}
