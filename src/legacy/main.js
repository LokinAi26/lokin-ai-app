import { createClient } from '@base44/sdk';
import './legacy.css';

var APP_ID = import.meta.env.VITE_BASE44_APP_ID;
var base44 = createClient({ appId: APP_ID });
var root = document.getElementById('app');
var snapshot = null;
var refreshTimer = null;
var CACHE_KEY = 'lokin_legacy_snapshot_v1';

function esc(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function money(value) {
  var n = Number(value || 0);
  return '$' + n.toFixed(2);
}

function compactStatus(value) {
  return String(value || 'unknown').replace(/_/g, ' ').toUpperCase();
}

function statusTone(value) {
  var s = String(value || '').toLowerCase();
  if (['online','healthy','ok','ready','active','completed','running','accepted','admitted','admitted_failover','available','working','connected','idle'].indexOf(s) >= 0) return 'ok';
  if (['degraded','warning','queued','qc','awaiting_approval','setup_required','paused','waiting_device','stale','attention'].indexOf(s) >= 0) return 'warn';
  if (['failed','blocked','cancelled','offline','error'].indexOf(s) >= 0) return 'bad';
  return 'muted';
}

function dotTone(value) {
  var tone = statusTone(value);
  if (tone === 'ok') return 'dot-ok';
  if (tone === 'bad') return 'dot-bad';
  if (tone === 'warn') return 'dot-warn';
  return '';
}

function errorMessage(err) {
  if (err && err.response && err.response.data && err.response.data.error) return err.response.data.error;
  if (err && err.message) return err.message;
  return 'Request failed.';
}

function loading(text) {
  root.innerHTML = '<div class="loading"><div class="spinner"></div><div>' + esc(text || 'Connecting to LOKIN…') + '</div></div>';
}

function showLogin(message) {
  root.innerHTML = '' +
    '<div class="login-wrap"><div class="login-card">' +
      '<div class="brand" style="margin-bottom:18px"><div class="lock">L</div><div><div class="title">LOKIN LEGACY DECK</div><div class="subtitle">SECURE OPERATOR LOGIN</div></div></div>' +
      '<h1>Command Deck</h1>' +
      '<p>Built for the original iPad Air on iOS 12.5.8. Heavy AI processing stays on the LOKIN backend.</p>' +
      (message ? '<div class="error">' + esc(message) + '</div>' : '') +
      '<form id="login-form">' +
        '<input id="email" class="field" type="email" autocomplete="email" placeholder="Email" required />' +
        '<input id="password" class="field" type="password" autocomplete="current-password" placeholder="Password" required />' +
        '<button id="login-btn" class="btn btn-primary" style="width:100%" type="submit">LOG IN</button>' +
      '</form>' +
      '<div class="divider"></div>' +
      '<button id="google-btn" class="btn" style="width:100%" type="button">CONTINUE WITH GOOGLE</button>' +
      '<div class="footer">Password is never written to deck storage. Base44 manages the authenticated session token.</div>' +
    '</div></div>';

  document.getElementById('login-form').onsubmit = function(e) {
    e.preventDefault();
    var email = document.getElementById('email').value;
    var password = document.getElementById('password').value;
    var btn = document.getElementById('login-btn');
    btn.disabled = true;
    btn.textContent = 'CONNECTING…';
    base44.auth.loginViaEmailPassword(email, password)
      .then(function() { document.getElementById('password').value = ''; return loadSnapshot(true); })
      .catch(function(err) { showLogin(errorMessage(err)); });
  };

  document.getElementById('google-btn').onclick = function() {
    base44.auth.loginWithProvider('google', window.location.href);
  };
}

function renderAlerts(alerts) {
  if (!alerts || !alerts.length) {
    return '<div class="alert"><div class="alert-title ok">No critical system failures</div><div class="alert-detail">No active deck alerts were returned.</div></div>';
  }
  return alerts.map(function(a) {
    var tone = a.severity === 'critical' ? 'bad' : 'warn';
    return '<div class="alert"><div class="alert-title ' + tone + '">' + esc(a.title) + '</div><div class="alert-detail">' + esc(a.detail || '') + '</div></div>';
  }).join('');
}

function renderEngines(engines) {
  return (engines || []).map(function(e) {
    var detail = e.detail || (e.registered ? 'Registered' : 'No runtime registration');
    return '<div class="engine"><div class="engine-name"><span class="dot ' + dotTone(e.status) + '"></span>' + esc(String(e.name || e.id).toUpperCase()) + '</div><div class="engine-status ' + statusTone(e.status) + '">' + esc(compactStatus(e.status)) + '</div><div class="engine-detail">' + esc(detail) + '</div></div>';
  }).join('');
}

function render(data, stale) {
  snapshot = data;
  var sys = data.system || {};
  var driver = data.driver || {};
  var earnings = data.earnings || {};
  var prod = data.productions || {};
  var vision = data.vision || {};
  var cap = data.capabilities || {};
  var isPaused = driver.status === 'paused';
  var systemTone = sys.status === 'ONLINE' && !stale ? 'status-online' : (stale ? 'status-offline' : 'status-degraded');
  var systemLabel = stale ? 'CACHED / OFFLINE' : (sys.status || 'UNKNOWN');
  var latestDate = earnings.latest_date || 'No earnings data';
  var pauseText = isPaused ? 'RESUME DRIVER' : 'PAUSE DRIVER';
  var pauseClass = isPaused ? 'btn-primary' : 'btn-danger';

  root.innerHTML = '' +
    '<div class="shell">' +
      '<div class="topbar">' +
        '<div class="brand"><div class="lock">L</div><div><div class="title">LOKIN LEGACY DECK</div><div class="subtitle">v' + esc(data.deck_version || '1.0.0') + ' · iOS 12 CONTROL SURFACE</div></div></div>' +
        '<div class="status-pill ' + systemTone + '">' + esc(systemLabel) + '</div>' +
      '</div>' +
      '<div class="toolbar">' +
        '<button id="refresh-btn" class="btn btn-primary grow">REFRESH</button>' +
        '<button id="logout-btn" class="btn">LOG OUT</button>' +
      '</div>' +
      '<div class="grid">' +
        '<section class="card"><h2>Driver</h2><div class="metric-small ' + statusTone(driver.status) + '">' + esc(compactStatus(driver.status)) + '</div><div class="divider"></div><div class="row small"><span class="muted">Active assignments</span><strong>' + esc(driver.active_assignments || 0) + '</strong></div><div class="row tiny"><span>Platforms</span><span>' + esc(driver.connected_platforms || 0) + '</span></div><div class="card-detail">' + esc(driver.detail || '') + '</div></section>' +
        '<section class="card"><h2>Latest Earnings</h2><div class="metric">' + esc(money(earnings.amount)) + '</div><div class="divider"></div><div class="row tiny"><span>' + esc(latestDate) + '</span><span>' + esc(earnings.trips || 0) + ' trips</span></div></section>' +
        '<section class="card"><h2>Productions</h2><div class="metric-small ' + statusTone(prod.status) + '">' + esc(compactStatus(prod.status || 'ready')) + '</div><div class="divider"></div><div class="row small"><span class="muted">Active / QC</span><strong>' + esc(prod.active || 0) + ' / ' + esc(prod.qc || 0) + '</strong></div><div class="row small"><span class="muted">Failed / blocked</span><strong class="' + (prod.failed ? 'bad' : '') + '">' + esc(prod.failed || 0) + '</strong></div><div class="card-detail">' + esc(prod.latest_status ? ('Latest: ' + compactStatus(prod.latest_status) + (prod.latest_capability ? ' · ' + prod.latest_capability : '')) : 'Production telemetry live · no recent jobs') + '</div></section>' +
        '<section class="card"><h2>LOKIN Vision</h2><div class="metric-small ' + statusTone(vision.status) + '">' + esc(compactStatus(vision.status)) + '</div><div class="divider"></div>' + (vision.battery_percent != null ? '<div class="row tiny"><span>Battery</span><span>' + esc(vision.battery_percent) + '%</span></div>' : '') + '<div class="card-detail">' + esc(vision.detail || 'No telemetry available.') + '</div></section>' +
        '<section class="card card-wide"><h2>AI Workload Engines</h2><div class="engine-list">' + renderEngines(data.engines) + '</div></section>' +
        '<section class="card card-wide"><h2>Alerts · ' + esc(sys.alert_count || 0) + '</h2><div class="alerts">' + renderAlerts(data.alerts) + '</div></section>' +
        '<section class="card card-wide"><h2>Quick Actions</h2><div class="quick">' +
          '<button id="driver-toggle" class="btn ' + pauseClass + '" ' + (cap.driver_pause_resume ? '' : 'disabled') + '>' + pauseText + '</button>' +
          '<button id="dispatch-btn" class="btn">OPEN DISPATCH</button>' +
          '<button id="production-btn" class="btn">OPEN PRODUCTIONS</button>' +
          '<button id="earnings-btn" class="btn">OPEN EARNINGS</button>' +
        '</div><div class="footer">Production and AI-engine controls are intentionally read-only until their backend control contracts are explicitly wired. No fake controls are exposed.</div></section>' +
      '</div>' +
      '<div class="footer">Operator: ' + esc((data.user && (data.user.name || data.user.email)) || 'LOKIN User') + ' · Updated ' + esc(data.generated_at || '') + '<br>Auto-refresh: 10 seconds while visible.</div>' +
    '</div>';

  document.getElementById('refresh-btn').onclick = function() { loadSnapshot(true); };
  document.getElementById('logout-btn').onclick = function() {
    try { localStorage.removeItem(CACHE_KEY); } catch (e) {}
    base44.auth.logout('/legacy.html');
  };
  document.getElementById('dispatch-btn').onclick = function() { window.location.href = '/driver-dispatch'; };
  document.getElementById('production-btn').onclick = function() { window.location.href = '/oasis'; };
  document.getElementById('earnings-btn').onclick = function() { window.location.href = '/earnings'; };
  document.getElementById('driver-toggle').onclick = function() {
    if (!cap.driver_pause_resume) return;
    var desired = isPaused ? 'resume' : 'pause';
    if (!window.confirm('Confirm driver ' + desired + '? This only changes the existing driver profile status.')) return;
    runDriverAction(isPaused ? 'driver_resume' : 'driver_pause');
  };
}

function request(action) {
  return base44.functions.invoke('legacy-deck', { action: action }).then(function(res) { return res.data || res; });
}

function saveCache(data) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch (e) {}
}

function readCache() {
  try {
    var raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

function loadSnapshot(showSpinner) {
  if (showSpinner && !snapshot) loading('Loading LOKIN system state…');
  return request('snapshot')
    .then(function(data) {
      saveCache(data);
      render(data, false);
      return data;
    })
    .catch(function(err) {
      var msg = errorMessage(err);
      if (String(msg).toLowerCase().indexOf('unauthorized') >= 0 || (err && err.response && err.response.status === 401)) {
        showLogin('Sign in to access the LOKIN Legacy Deck.');
        return null;
      }
      var cached = readCache();
      if (cached) {
        render(cached, true);
        return cached;
      }
      root.innerHTML = '<div class="login-wrap"><div class="login-card"><h1>Deck unavailable</h1><div class="error">' + esc(msg) + '</div><button id="retry" class="btn btn-primary" style="width:100%">RETRY</button></div></div>';
      document.getElementById('retry').onclick = function() { loadSnapshot(true); };
      return null;
    });
}

function runDriverAction(action) {
  var button = document.getElementById('driver-toggle');
  if (button) { button.disabled = true; button.textContent = 'UPDATING…'; }
  request(action)
    .then(function() { return loadSnapshot(false); })
    .catch(function(err) { window.alert(errorMessage(err)); return loadSnapshot(false); });
}

function startRefresh() {
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = setInterval(function() {
    if (document.hidden !== true) loadSnapshot(false);
  }, 10000);
}

loading('Starting LOKIN Legacy Deck…');
base44.auth.isAuthenticated()
  .then(function(ok) {
    if (!ok) { showLogin('Sign in to access the LOKIN Legacy Deck.'); return; }
    loadSnapshot(true);
    startRefresh();
  })
  .catch(function() { showLogin('Sign in to access the LOKIN Legacy Deck.'); });
