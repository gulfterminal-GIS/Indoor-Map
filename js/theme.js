'use strict';

window.IndoorUI = window.IndoorUI || {};

IndoorUI.THEME_KEY = 'indoor.ui.v1.theme';

IndoorUI.toast = function (msg) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(IndoorUI._toastTimer);
  IndoorUI._toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
};

IndoorUI.applyTheme = function (theme, persist) {
  const next = theme === 'glass' ? 'glass' : 'light';
  document.documentElement.setAttribute('data-theme', next);
  const btn = document.getElementById('btn-theme');
  if (btn) {
    btn.classList.toggle('active', next === 'glass');
    btn.setAttribute('aria-pressed', next === 'glass' ? 'true' : 'false');
  }
  if (persist !== false) {
    try { localStorage.setItem(IndoorUI.THEME_KEY, next); } catch (err) { /* ignore */ }
  }
  IndoorUI.syncLiquidGlass();
};

IndoorUI.glassTargets = function () {
  return [
    document.getElementById('dock'),
    document.getElementById('map-toolbar'),
    document.getElementById('status-bar'),
    document.getElementById('map-legend'),
    document.getElementById('detail-panel')
  ].concat([].slice.call(document.querySelectorAll('.loading-card')))
    .concat([].slice.call(document.querySelectorAll('.flyout')))
    .concat([].slice.call(document.querySelectorAll('.bookmark-pill')))
    .filter(Boolean);
};

IndoorUI.wrapLiquidGlass = function (el) {
  if (!el || el.classList.contains('liquidGlass-content')) return;
  if (el.querySelector(':scope > .liquidGlass-effect') && el.querySelector(':scope > .liquidGlass-content')) return;
  if (el.classList.contains('liquidGlass-wrapper')) IndoorUI.unwrapLiquidGlass(el);
  const content = document.createElement('div');
  content.className = 'liquidGlass-content';
  while (el.firstChild) content.appendChild(el.firstChild);
  ['liquidGlass-effect', 'liquidGlass-tint', 'liquidGlass-shine'].forEach((name) => {
    const layer = document.createElement('div');
    layer.className = name;
    layer.setAttribute('aria-hidden', 'true');
    el.appendChild(layer);
  });
  el.appendChild(content);
  el.classList.add('liquidGlass-wrapper');
};

IndoorUI.unwrapLiquidGlass = function (el) {
  if (!el) return;
  const content = el.querySelector(':scope > .liquidGlass-content');
  if (content) {
    while (content.firstChild) el.appendChild(content.firstChild);
  }
  el.querySelectorAll(':scope > .liquidGlass-effect, :scope > .liquidGlass-tint, :scope > .liquidGlass-shine, :scope > .liquidGlass-content').forEach((node) => node.remove());
  el.classList.remove('liquidGlass-wrapper');
};

IndoorUI.syncLiquidGlass = function () {
  const on = document.documentElement.getAttribute('data-theme') === 'glass';
  if (on) {
    IndoorUI.glassTargets().forEach((el) => IndoorUI.wrapLiquidGlass(el));
    return;
  }
  document.querySelectorAll('.liquidGlass-wrapper').forEach((el) => IndoorUI.unwrapLiquidGlass(el));
};

IndoorUI.FLYOUTS = [
  { menu: 'search-menu', btn: 'btn-search' },
  { menu: 'basemap-menu', btn: 'btn-basemap' },
  { menu: 'data-menu', btn: 'btn-data' },
  { menu: 'pano-menu', btn: 'btn-pano' }
];

IndoorUI.closeNamedFlyout = function (menuId) {
  const spec = IndoorUI.FLYOUTS.find((f) => f.menu === menuId);
  const menu = document.getElementById(menuId);
  const btn = spec ? document.getElementById(spec.btn) : null;
  if (menu) menu.classList.remove('open');
  if (btn) {
    btn.classList.remove('active');
    btn.setAttribute('aria-expanded', 'false');
  }
};

IndoorUI.closeFlyouts = function () {
  IndoorUI.FLYOUTS.forEach((f) => IndoorUI.closeNamedFlyout(f.menu));
};

IndoorUI.positionFlyout = function (el, anchor) {
  const wrapEl = document.getElementById('map-wrap');
  if (!el || !anchor || !wrapEl) return;
  const wrap = wrapEl.getBoundingClientRect();
  const r = anchor.getBoundingClientRect();
  const width = el.offsetWidth || 240;
  let left = r.left - wrap.left + r.width / 2 - width / 2;
  left = Math.max(12, Math.min(left, wrap.width - width - 12));
  el.style.left = left + 'px';
  el.style.right = 'auto';
};

IndoorUI.setFlyoutOpen = function (menuId, open) {
  const spec = IndoorUI.FLYOUTS.find((f) => f.menu === menuId);
  const menu = document.getElementById(menuId);
  const btn = spec ? document.getElementById(spec.btn) : null;
  if (!menu || !btn) return;
  const willOpen = open !== false && !menu.classList.contains('open');
  IndoorUI.closeFlyouts();
  if (!willOpen) return;
  menu.classList.add('open');
  btn.classList.add('active');
  btn.setAttribute('aria-expanded', 'true');
  IndoorUI.positionFlyout(menu, btn);
  if (menuId === 'search-menu') {
    const input = document.getElementById('search-input');
    if (input) setTimeout(() => input.focus(), 40);
  }
};

IndoorUI.bootTheme = function () {
  let theme = 'light';
  try {
    const saved = localStorage.getItem(IndoorUI.THEME_KEY);
    if (saved === 'glass' || saved === 'light') theme = saved;
  } catch (err) { /* ignore */ }
  IndoorUI.applyTheme(theme, false);
};
