/* ============================================================
 * dati.js — modulo condiviso (Schede Allenamento)
 * API Google Apps Script + cache offline + coda log
 * ============================================================ */

const IS_DEV = window.location.pathname.includes('/dev/');
const API   = IS_DEV
  ? 'https://script.google.com/macros/s/AKfycbxvILKHvT01CCNRqaLzea-V2pm5lC3yNKJxUjFG9I28PYB52mAejeWgZZufXJYBi5OflA/exec'
  : 'https://script.google.com/macros/s/AKfycbxvILKHvT01CCNRqaLzea-V2pm5lC3yNKJxUjFG9I28PYB52mAejeWgZZufXJYBi5OflA/exec';
const TOKEN = 'tk-e9fe32f6fc35456a';

const CACHE_PREFIX = 'dati-v1-';
const CODA_KEY     = 'coda-log-v1';

/* ---------- lettura dati con cache offline ---------- */
async function getDati(foglio, timeoutMs = 15000) {
  try {
    const ctrl = new AbortController();
    const tid  = setTimeout(() => ctrl.abort(), timeoutMs);
    const r    = await fetch(`${API}?token=${TOKEN}&azione=leggi&foglio=${foglio}`, { signal: ctrl.signal });
    const text = await r.text();
    clearTimeout(tid);
    const json = JSON.parse(text);
    if (!json.ok) throw new Error(json.errore || 'Errore server');
    try {
      localStorage.setItem(CACHE_PREFIX + foglio, JSON.stringify({ dati: json.dati || [], ts: Date.now() }));
    } catch (e) { /* storage pieno/non disponibile: ignora */ }
    return { dati: json.dati || [], offline: false };
  } catch (err) {
    /* fallback: cache locale */
    try {
      const c = JSON.parse(localStorage.getItem(CACHE_PREFIX + foglio));
      if (c && Array.isArray(c.dati)) return { dati: c.dati, offline: true, ts: c.ts };
    } catch (e) { /* niente cache */ }
    throw err;
  }
}

/* ---------- log progressi con coda offline ---------- */
function accodaLog(entry) {
  const coda = JSON.parse(localStorage.getItem(CODA_KEY) || '[]');
  coda.push(entry);
  localStorage.setItem(CODA_KEY, JSON.stringify(coda));
  aggiornaBannerOffline();
}

function codaCount() {
  try { return JSON.parse(localStorage.getItem(CODA_KEY) || '[]').length; } catch (e) { return 0; }
}

async function inviaLog(entry) {
  try {
    const ctrl = new AbortController();
    const tid  = setTimeout(() => ctrl.abort(), 15000);
    const r = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ token: TOKEN, azione: 'log_progressi', ...entry }),
      signal: ctrl.signal,
    });
    const text = await r.text();
    clearTimeout(tid);
    const json = JSON.parse(text);
    if (!json.ok) throw new Error(json.errore || 'Errore server');
    return { ok: true, inCoda: false };
  } catch (err) {
    /* errore di rete → coda locale (il log NON va perso) */
    if (!navigator.onLine || err.name === 'TypeError' || err.name === 'AbortError') {
      accodaLog(entry);
      return { ok: true, inCoda: true };
    }
    throw err;
  }
}

/* svuota la coda: riprova ogni riga, tiene in coda solo i falliti */
async function svuotaCoda() {
  const coda = JSON.parse(localStorage.getItem(CODA_KEY) || '[]');
  if (!coda.length) return 0;
  const falliti = [];
  for (const entry of coda) {
    try {
      const r = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ token: TOKEN, azione: 'log_progressi', ...entry }),
      });
      const json = await r.json();
      if (!json.ok) throw new Error(json.errore || 'Errore');
    } catch (e) { falliti.push(entry); }
  }
  localStorage.setItem(CODA_KEY, JSON.stringify(falliti));
  aggiornaBannerOffline();
  if (coda.length - falliti.length > 0) {
    window.dispatchEvent(new CustomEvent('coda-svuotata', { detail: coda.length - falliti.length }));
  }
  return coda.length - falliti.length;
}

window.addEventListener('online', () => { svuotaCoda(); });

/* ---------- banner offline (elemento opzionale #offline-banner) ---------- */
function aggiornaBannerOffline() {
  const el = document.getElementById('offline-banner');
  if (!el) return;
  const coda = codaCount();
  if (!navigator.onLine) {
    el.textContent = coda
      ? `⚠ Offline — dati in cache · ${coda} log in coda (si sincronizzeranno)`
      : '⚠ Offline — dati in cache';
    el.style.display = 'block';
  } else if (coda) {
    el.textContent = `↻ ${coda} log in coda — sincronizzazione…`;
    el.style.display = 'block';
  } else {
    el.style.display = 'none';
  }
}

function initOfflineBanner() {
  aggiornaBannerOffline();
  window.addEventListener('online',  aggiornaBannerOffline);
  window.addEventListener('offline', aggiornaBannerOffline);
  window.addEventListener('coda-svuotata', aggiornaBannerOffline);
}

/* ---------- helper data ---------- */
/* Data nei log: formato locale it-IT (gg/mm/aaaa) oppure ISO → Date */
function parseData(v) {
  if (!v) return null;
  const s = String(v).trim();
  if (!s) return null;
  if (s.includes('T')) { const d = new Date(s); return isNaN(d) ? null : d; }
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) { const d = new Date(+m[3], +m[2] - 1, +m[1]); return isNaN(d) ? null : d; }
  const d = new Date(s);
  return isNaN(d) ? null : d;
}

function oggiISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function stessaData(d1, d2) {
  return d1 && d2 && d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
}

function giorniFa(d) {
  if (!d) return null;
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}
