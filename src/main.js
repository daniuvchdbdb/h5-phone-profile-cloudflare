import 'bootstrap-icons/font/bootstrap-icons.css';
import './mobile.css';

const app = document.querySelector('#app');
const codeMatch = window.location.pathname.match(/^\/p\/([^/]+)$/);
const code = codeMatch ? decodeURIComponent(codeMatch[1]) : '';
const standalone = window.matchMedia('(display-mode: standalone)').matches
  || window.matchMedia('(display-mode: fullscreen)').matches
  || window.navigator.standalone === true;

let profile;
let deferredInstallPrompt;

const icon = (name) => `<i class="bi bi-${name}" aria-hidden="true"></i>`;

function formatPhone(phone) {
  return `${phone.slice(0, 3)} ${phone.slice(3, 7)} ${phone.slice(7)}`;
}

function disclosure() {
  return '<p class="web-disclosure"></p>';
}

function errorCopy(error) {
  if (error === 'LINK_EXPIRED') return ['链接已到期', '当前二维码已经超过管理端设置的有效时间。'];
  if (error === 'LINK_DISABLED') return ['链接已停用', '当前二维码已被管理端停用。'];
  if (error === 'LINK_NOT_FOUND') return ['链接无效', '请使用管理后台生成的专属二维码或链接进入。'];
  return ['暂时无法打开', '网络异常或服务器暂时不可用，请稍后重试。'];
}

function renderError(error) {
  const [title, detail] = errorCopy(error);
  document.title = title;
  app.innerHTML = `<main class="device-stage"><section class="ios-screen error-screen"><div class="error-card"><span class="error-symbol">${icon('exclamation-lg')}</span><h1>${title}</h1><p>${detail}</p><button id="retryButton" type="button">重新加载</button><small>如需继续使用，请联系二维码提供方处理。</small></div></section></main>`;
  document.querySelector('#retryButton').addEventListener('click', () => window.location.reload());
}

const settingsRows = [
  { icon: 'airplane-fill', label: '飞行模式', color: 'orange', toggle: false },
  { icon: 'wifi', label: '无线局域网', color: 'blue', value: '未连接' },
  { icon: 'bluetooth', label: '蓝牙', color: 'blue', value: '打开' },
  { icon: 'broadcast-pin', label: '蜂窝网络', color: 'green', route: 'cellular' },
  { icon: 'link-45deg', label: '个人热点', color: 'green', value: '关闭' },
  { iconText: 'VPN', label: 'VPN', color: 'blue', value: '未连接' }
];

const everydayRows = [
  { icon: 'bell-fill', label: '通知', color: 'red', chevron: true },
  { icon: 'volume-up-fill', label: '声音与触感', color: 'pink', chevron: true },
  { icon: 'moon-fill', label: '专注模式', color: 'indigo', chevron: true },
  { icon: 'hourglass-split', label: '屏幕使用时间', color: 'violet', chevron: true }
];

const systemRows = [
  { icon: 'gear-wide-connected', label: '通用', color: 'gray', chevron: true },
  { icon: 'toggles', label: '控制中心', color: 'gray', chevron: true },
  { iconText: 'AA', label: '显示与亮度', color: 'blue', chevron: true },
  { icon: 'grid-3x3-gap-fill', label: '主屏幕', color: 'deep-blue', chevron: true },
  { icon: 'universal-access-circle', label: '辅助功能', color: 'blue', chevron: true }
];

function settingRow(row) {
  const rowIcon = row.iconText ? `<span class="setting-icon-text">${row.iconText}</span>` : icon(row.icon);
  const content = `<span class="setting-icon ${row.color}">${rowIcon}</span><span class="setting-copy"><span class="setting-label">${row.label}</span>${row.toggle === false ? '<span class="ios-switch" aria-hidden="true"><i></i></span>' : `<span class="setting-value">${row.value || ''}${row.route || row.value || row.chevron ? icon('chevron-right') : ''}</span>`}</span>`;
  if (row.route) return `<button class="settings-row cellular-link" type="button" data-open-cellular>${content}</button>`;
  return `<div class="settings-row" aria-label="${row.label}">${content}</div>`;
}

function installControl() {
  if (standalone) return '';
  return `<button class="add-home-button" type="button" data-install><img src="/settings-icon-180.png" alt="" /><span><b>添加“设置”到主屏幕</b><small>桌面打开后固定显示尾号 ${profile.tail}</small></span>${icon('chevron-right')}</button>`;
}

function settingsView() {
  const displayName = profile.displayName || `用户${profile.phone.slice(-6)}`;
  return `<section class="ios-page settings-page" data-page="settings"><header class="ios-nav settings-nav"><span></span><h1>设置</h1><span></span></header><div class="settings-scroll"><div class="settings-card account-card"><span class="avatar">${displayName.slice(0, 1)}</span><span class="account-copy"><b>${displayName}</b><small>Apple ID、iCloud、媒体与购买项目</small></span>${icon('chevron-right')}</div><div class="settings-card connectivity-card">${settingsRows.map(settingRow).join('')}</div><div class="settings-card everyday-card">${everydayRows.map(settingRow).join('')}</div><div class="settings-card system-card">${systemRows.map(settingRow).join('')}</div>${installControl()}${disclosure()}</div></section>`;
}

function cellularView() {
  return `<section class="ios-page cellular-page" data-page="cellular" hidden><header class="ios-nav"><button type="button" class="nav-back" data-back-settings>${icon('chevron-left')}<span>设置</span></button><h1>蜂窝网络</h1><span></span></header><div class="cellular-scroll"><div class="settings-card cellular-options-card"><div class="plain-row"><span>蜂窝数据</span><span class="setting-value">主号${icon('chevron-right')}</span></div><div class="plain-row"><span>个人热点</span><span class="setting-value">关闭${icon('chevron-right')}</span></div></div><p class="cellular-explainer">关闭蜂窝数据，通过无线局域网使用电子邮件、网页浏览和推送通知等所有数据。</p><div class="settings-card voice-card"><div class="plain-row"><span>默认语音号码</span><span class="setting-value">主号${icon('chevron-right')}</span></div></div><p class="section-label">SIM 卡</p><div class="settings-card sim-card"><div class="sim-row"><span class="sim-primary-icon">主号</span><span class="sim-copy"><b>主号</b><small>+86 ${formatPhone(profile.phone)}</small></span><span class="sim-state">打开</span>${icon('chevron-right')}</div></div><p class="section-label">“主号”的蜂窝数据</p><div class="settings-card usage-card"><div class="usage-row"><span>本期总用量</span><b>961 GB</b></div><div class="usage-row"><span>本期漫游用量</span><b>52.1 KB</b></div><div class="app-usage-row"><img class="usage-icon" src="/app-icons/wechat.jpg" alt="" /><span class="app-usage-copy"><b>微信</b><small>无线局域网与蜂窝网络</small></span><span class="app-usage-value">83.8 GB</span>${icon('chevron-right')}</div><div class="app-usage-row"><img class="usage-icon" src="/app-icons/douyin.jpg" alt="" /><span class="app-usage-copy"><b>抖音</b><small>无线局域网与蜂窝网络</small></span><span class="app-usage-value">93.2 GB</span>${icon('chevron-right')}</div><div class="app-usage-row"><img class="usage-icon" src="/app-icons/xiaohongshu.jpg" alt="" /><span class="app-usage-copy"><b>小红书</b><small>无线局域网与蜂窝网络</small></span><span class="app-usage-value">46.4 GB</span>${icon('chevron-right')}</div><div class="app-usage-row"><img class="usage-icon" src="/app-icons/t3.jpg" alt="" /><span class="app-usage-copy"><b>T3 出行</b><small>无线局域网与蜂窝网络</small></span><span class="app-usage-value">1.1 GB</span>${icon('chevron-right')}</div></div><div class="settings-card data-feature-card"><div class="data-feature-row"><span><b>无线局域网助理</b><small>66.7 KB</small></span><span class="ios-switch on" aria-hidden="true"><i></i></span></div></div><p class="feature-note">无线局域网连接信号弱时自动使用蜂窝数据。</p><div class="settings-card data-feature-card"><div class="data-feature-row"><span><b>iCloud 云盘</b></span><span class="ios-switch on" aria-hidden="true"><i></i></span></div></div><p class="feature-note">未连接无线局域网时，使用蜂窝网络传输文稿与数据。</p><p class="section-label call-label">通话时长</p><div class="settings-card call-card"><div class="plain-row"><span>本期通话时长</span><span class="setting-value">10天 3小时</span></div><div class="plain-row"><span>累计通话时长</span><span class="setting-value">16天 3小时</span></div></div><div class="settings-card reset-card"><div class="plain-row reset-row"><span>还原统计数据</span></div></div><p class="last-reset">上一次还原时间：2025年1月8日 11:01</p>${disclosure()}</div></section>`;
}

function installSheet() {
  const isAndroid = /Android/i.test(navigator.userAgent);
  const steps = isAndroid ? ['点击浏览器右上角菜单', '选择“添加到主屏幕”或“安装应用”', '返回桌面，点击“设置”图标'] : ['请先使用 Safari 打开当前链接', '点击 Safari 底部的“分享”按钮', '选择“添加到主屏幕”，再点击“添加”'];
  return `<div class="sheet-backdrop" data-sheet hidden><section class="install-sheet" role="dialog" aria-modal="true" aria-labelledby="installTitle"><div class="sheet-grabber"></div><button class="sheet-close" type="button" aria-label="关闭" data-close-sheet>${icon('x-lg')}</button><img src="/settings-icon-180.png" alt="设置图标" /><h2 id="installTitle">添加到主屏幕</h2><p>添加后将以独立全屏方式打开，并固定显示尾号 <b>${profile.tail}</b>。</p><ol>${steps.map((step, index) => `<li><span>${index + 1}</span>${step}</li>`).join('')}</ol><button class="install-confirm" type="button" data-native-install ${deferredInstallPrompt ? '' : 'hidden'}>立即安装</button><small>受手机系统限制，网页不能静默创建桌面图标，需要你手动确认一次。</small></section></div>`;
}

function showPage(name, updateHistory = true) {
  document.querySelectorAll('[data-page]').forEach((page) => { page.hidden = page.dataset.page !== name; });
  if (updateHistory) history.pushState({ page: name }, '', name === 'cellular' ? '#cellular' : window.location.pathname + window.location.search);
  document.querySelector(`[data-page="${name}"]`)?.scrollTo(0, 0);
}

function openInstallSheet() {
  const sheet = document.querySelector('[data-sheet]');
  sheet.hidden = false;
  requestAnimationFrame(() => sheet.classList.add('visible'));
}

function closeInstallSheet() {
  const sheet = document.querySelector('[data-sheet]');
  sheet.classList.remove('visible');
  setTimeout(() => { sheet.hidden = true; }, 220);
}

function bindUi() {
  document.querySelector('[data-open-cellular]').addEventListener('click', () => showPage('cellular'));
  document.querySelector('[data-back-settings]').addEventListener('click', () => showPage('settings'));
  document.querySelector('[data-install]')?.addEventListener('click', openInstallSheet);
  document.querySelector('[data-close-sheet]')?.addEventListener('click', closeInstallSheet);
  document.querySelector('[data-sheet]')?.addEventListener('click', (event) => { if (event.target.matches('[data-sheet]')) closeInstallSheet(); });
  document.querySelector('[data-native-install]')?.addEventListener('click', async () => {
    if (!deferredInstallPrompt) return;
    await deferredInstallPrompt.prompt();
    deferredInstallPrompt = null;
    closeInstallSheet();
  });
}

function renderApp() {
  document.title = '设置';
  app.innerHTML = `<main class="device-stage"><section class="ios-screen">${settingsView()}${cellularView()}</section></main>${installSheet()}`;
  bindUi();
  showPage(window.location.hash === '#cellular' ? 'cellular' : 'settings', false);
}

async function revalidate() {
  try {
    const response = await fetch(`/api/profile/${encodeURIComponent(code)}?track=0`, { cache: 'no-store', credentials: 'same-origin' });
    const data = await response.json();
    if (!response.ok) renderError(data.error);
  } catch { /* Keep the current screen during a brief connection interruption. */ }
}

async function load() {
  if (!code) return renderError('LINK_NOT_FOUND');
  try {
    const response = await fetch(`/api/profile/${encodeURIComponent(code)}`, { cache: 'no-store', credentials: 'same-origin' });
    const data = await response.json();
    if (!response.ok) return renderError(data.error);
    profile = data;
    document.querySelector('link[rel="manifest"]').href = `/api/manifest?code=${encodeURIComponent(code)}`;
    document.querySelector('meta[name="apple-mobile-web-app-title"]')?.setAttribute('content', '设置');
    renderApp();
    setInterval(revalidate, 60000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) revalidate(); });
  } catch {
    renderError('NETWORK_ERROR');
  }
}

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  document.querySelector('[data-native-install]')?.removeAttribute('hidden');
});
window.addEventListener('popstate', () => showPage(window.location.hash === '#cellular' ? 'cellular' : 'settings', false));
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js'));

await load();
