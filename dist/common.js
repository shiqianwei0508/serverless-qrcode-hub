/*
 * common.js — 登录页与管理后台共享逻辑
 * 职责：首屏前设定主题（防闪烁）、主题切换、系统主题监听、统一 Toast/Alert。
 * 由 login.html 与 admin.html 在 <head> 内以 <script src> 同步引入。
 */

/* 1. 首屏前设定主题，避免深浅色闪烁 */
(function () {
  const savedTheme = localStorage.getItem('theme');
  const mq = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');
  if (savedTheme === 'system' || !savedTheme) {
    if (!savedTheme) localStorage.setItem('theme', 'system');
    document.documentElement.setAttribute('data-theme', mq && mq.matches ? 'dark' : 'light');
  } else {
    document.documentElement.setAttribute('data-theme', savedTheme);
  }
})();

/* 2. 主题循环切换：system -> light -> dark -> system */
function toggleTheme() {
  const current = localStorage.getItem('theme') || 'system';
  const order = { system: 'light', light: 'dark', dark: 'system' };
  const next = order[current] || 'system';
  localStorage.setItem('theme', next);
  const isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.setAttribute('data-theme', next === 'system' ? (isDark ? 'dark' : 'light') : next);
  updateThemeIcon(next);
}

/* 3. 根据主题切换右上角按钮的 SVG 图标 */
function updateThemeIcon(theme) {
  const path = document.querySelector('#themeToggleBtn path');
  if (!path) return;
  const icons = {
    system: 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
    dark: 'M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z',
    light: 'M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z'
  };
  path.setAttribute('d', icons[theme] || icons.system);
}

/* 4. 跟随系统变化（仅当主题为 system 时） */
if (window.matchMedia) {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (localStorage.getItem('theme') === 'system') {
      document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
    }
  });
}

/* 5. 初始化主题按钮（DOM 就绪后调用一次） */
function initThemeToggle() {
  updateThemeIcon(localStorage.getItem('theme') || 'system');
  const btn = document.getElementById('themeToggleBtn');
  if (btn) btn.addEventListener('click', toggleTheme);
}

document.addEventListener('DOMContentLoaded', initThemeToggle);

/* 6. 统一 Toast / Alert 提示 */
const ALERT_ICONS = {
  success: '<svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-5 w-5" fill="none" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>',
  error: '<svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-5 w-5" fill="none" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>',
  warning: '<svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-5 w-5" fill="none" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01M5 19h14a2 2 0 001.84-2.75L13.74 4a2 2 0 00-3.48 0L3.16 16.25A2 2 0 005 19z"/></svg>',
  info: '<svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-5 w-5" fill="none" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>'
};

function showAlert(message, type = 'error') {
  let container = document.getElementById('alertContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'alertContainer';
    document.body.appendChild(container);
  }
  const kind = (type === 'success' || type === 'warning' || type === 'info') ? type : 'error';
  const alert = document.createElement('div');
  alert.className = 'alert ' + (kind === 'success' ? 'alert-success' : kind === 'warning' ? 'alert-warning' : kind === 'info' ? 'alert-info' : 'alert-error') + ' shadow-lg alert-enter';
  alert.innerHTML = '<div class="flex items-center gap-2">' + (ALERT_ICONS[kind] || ALERT_ICONS.error) + '<span>' + message + '</span></div>';
  container.appendChild(alert);
  requestAnimationFrame(() => alert.classList.add('alert-show'));
  setTimeout(() => {
    alert.classList.remove('alert-show');
    alert.classList.add('alert-leave');
    setTimeout(() => alert.remove(), 250);
  }, 3200);
}
