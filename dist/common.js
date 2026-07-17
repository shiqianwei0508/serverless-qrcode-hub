/*
 * common.js — shared logic for the login and admin pages.
 *
 * Responsibilities: set the theme before first paint (avoid flash),
 * toggle the theme, follow the system theme, and provide a unified
 * Toast/Alert. Also bootstraps i18n (set <html lang>, apply translations,
 * render the language switcher) which is defined in i18n.js.
 *
 * Loaded synchronously inside <head> before any page markup.
 */

/* 1. Set the theme before first paint to avoid a dark/light flash. */
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

/* 2. Toggle the theme directly between light and dark on every click. */
function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  localStorage.setItem('theme', next);
  document.documentElement.setAttribute('data-theme', next);
  updateThemeIcon(next);
}

/* 3. Swap the top-right button's SVG icon to match the theme. */
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

/* 4. Follow system theme changes, but only while theme is set to "system". */
if (window.matchMedia) {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (localStorage.getItem('theme') === 'system') {
      document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
    }
  });
}

/* 5. Initialize the theme button once the DOM is ready. */
function initThemeToggle() {
  updateThemeIcon(document.documentElement.getAttribute('data-theme') || 'light');
  const btn = document.getElementById('themeToggleBtn');
  if (btn) btn.addEventListener('click', toggleTheme);
}

document.addEventListener('DOMContentLoaded', initThemeToggle);

/* 6. Internationalization bootstrap (shared by login & admin).
 * The active language is detected before paint in i18n.js. Here we set the
 * <html lang> attribute, translate static markup, and render any language
 * switcher placed in a [data-lang-switcher] container. A page may register a
 * global onLangChange(lang) hook to re-render dynamic content. */
document.addEventListener('DOMContentLoaded', function () {
  if (!window.I18N) return;
  document.documentElement.setAttribute('lang', I18N.getLang());
  I18N.applyI18n();
  const switchers = document.querySelectorAll('[data-lang-switcher]');
  for (let i = 0; i < switchers.length; i++) {
    I18N.createLangSwitcher(switchers[i]);
  }
  onLangChange = function (lang) {
    I18N.applyI18n();
    if (typeof window.__onLangChange === 'function') window.__onLangChange(lang);
  };
});

/* 7. Unified Toast / Alert. */
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
