/* Energy Exchange at Evolve - Staff Portal (static page for GitHub Pages). No build step, no third-party scripts.
   Talks to the portal Apps Script JSON API (API_URL in config.js) with fetch(..., {credentials:'omit'}), so no Google
   cookies are ever sent: it works the same with zero, one or several Google accounts signed in.
   Requests are text/plain POSTs (CORS "simple" requests, no preflight). The session token is sent in the JSON body only,
   never in a URL. It is kept in sessionStorage, or localStorage when "Keep me signed in" is checked. */
(function () {
'use strict';
var K = 'ee_portal_token', S = { token: null, mode: 'none', view: 'my', me: null };
var DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'], MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function $(id) { return document.getElementById(id); }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function errMsg(e) { var m = (e && e.message) ? e.message : String(e); return m.replace(/^(Error|Exception):\s*/, '').replace(/^(SIGNED_OUT|CHANGE_PASSWORD):\s*/, ''); }
function toast(msg) { var t = $('toast'); t.textContent = msg; t.style.display = 'block'; clearTimeout(toast._t); toast._t = setTimeout(function () { t.style.display = 'none'; }, 3500); }
function dnum(d) { var p = d.split('-'); return Math.round(Date.UTC(+p[0], +p[1] - 1, +p[2]) / 864e5); }
function wdIdx(d) { return (new Date(dnum(d) * 864e5).getUTCDay() + 6) % 7; }
function fmtD(d) { var p = d.split('-'); return DAYS[wdIdx(d)] + ' ' + MONTHS[+p[1] - 1] + ' ' + (+p[2]); }
function fmtT(t) { if (!t) return ''; var p = t.split(':'), h = +p[0], m = +p[1], ap = h >= 12 ? 'pm' : 'am'; h = h % 12 || 12; return h + (m ? ':' + (m < 10 ? '0' : '') + m : '') + ap; }
function hrs(n) { return (Math.round(n * 100) / 100) + 'h'; }

/* ---------- token storage ---------- */
function usable(kind) { try { var s = window[kind]; if (!s) return null; s.setItem('__ee_t', '1'); s.removeItem('__ee_t'); return s; } catch (e) { return null; } }
var store = {
  save: function (t, keep) { S.token = t; store.wipe(); var s = keep ? usable('localStorage') : null; if (s) { s.setItem(K, t); S.mode = 'local'; return; } s = usable('sessionStorage'); if (s) { s.setItem(K, t); S.mode = 'session'; return; } S.mode = 'memory'; },
  load: function () { var a = usable('localStorage'), b = usable('sessionStorage'), t = (a && a.getItem(K)) || null; if (t) { S.mode = 'local'; return t; } t = (b && b.getItem(K)) || null; if (t) { S.mode = 'session'; return t; } return null; },
  wipe: function () { ['localStorage', 'sessionStorage'].forEach(function (k) { var s = usable(k); if (s) s.removeItem(K); }); },
  clear: function () { S.token = null; S.mode = 'none'; store.wipe(); }
};
window.__eePortal = S; // read by tests only (nothing beyond what this tab already holds)

/* ---------- API ---------- */
function api(action, args) {
  var body = { action: action }; Object.keys(args || {}).forEach(function (k) { body[k] = args[k]; });
  return fetch(API_URL, {
    method: 'POST', credentials: 'omit', redirect: 'follow', cache: 'no-store', referrerPolicy: 'no-referrer',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body)
  }).catch(function () { throw new Error('Could not reach the schedule. Check your connection and try again.'); })
    .then(function (r) {
      if (!r.ok) throw new Error('The schedule did not answer (' + r.status + '). Try again in a minute.');
      return r.json().catch(function () { throw new Error('The schedule sent an unexpected answer. Try again in a minute.'); });
    })
    .then(function (j) {
      if (!j || j.ok !== true) { var e = new Error((j && j.error) || 'Something went wrong. Try again.'); e.code = j && j.code; throw e; }
      return j.data;
    });
}
/* Session calls: adds the token; handles "signed out" and "must change password" the same way everywhere. */
function call(action, args) {
  var a = { token: S.token }; Object.keys(args || {}).forEach(function (k) { a[k] = args[k]; });
  return api(action, a).catch(function (e) {
    if (e.code === 'SIGNED_OUT') { store.clear(); showLogin('Your session ended. Please sign in again.'); throw { handled: true }; }
    if (e.code === 'CHANGE_PASSWORD') { showChange(true); throw { handled: true }; }
    throw e;
  });
}
function fail(e) { if (e && e.handled) return; toast('Error: ' + errMsg(e)); }

/* ---------- header / nav ---------- */
function setWho(name) {
  if (!name) { $('who').innerHTML = ''; return; }
  $('who').innerHTML = '<span>' + esc(name) + '</span><button class="signout" id="signout" type="button">Sign out</button>';
  $('signout').onclick = signOut;
}
function renderNav() {
  var t = [['my', 'My Shifts'], ['pickup', 'Open shifts'], ['avail', 'Availability'], ['timeoff', 'Time off']];
  $('nav').innerHTML = t.map(function (x) { return '<button type="button" data-v="' + x[0] + '" class="' + (S.view === x[0] ? 'on' : '') + '">' + x[1] + '</button>'; }).join('');
  [].forEach.call($('nav').querySelectorAll('button'), function (b) { b.onclick = function () { S.view = b.getAttribute('data-v'); renderNav(); render(); window.scrollTo(0, 0); }; });
}
function signOut() { var t = S.token; store.clear(); setWho(''); $('nav').innerHTML = ''; showLogin('You are signed out.'); if (t) api('logout', { token: t }).catch(function () {}); }

/* ---------- sign in ---------- */
function pwField(id, label, auto) { return '<label for="' + id + '">' + label + '</label><div class="pwrow"><input type="password" id="' + id + '" autocomplete="' + auto + '" maxlength="128"><button type="button" class="show" data-for="' + id + '">Show</button></div>'; }
function wireShow() { [].forEach.call(document.querySelectorAll('.show'), function (b) { b.onclick = function () { var i = $(b.getAttribute('data-for')); var sh = i.type === 'password'; i.type = sh ? 'text' : 'password'; b.textContent = sh ? 'Hide' : 'Show'; }; }); }
function showLogin(note) {
  S.me = null; S.view = 'my'; setWho(''); $('nav').innerHTML = '';
  $('main').innerHTML = '<div class="signin"><div class="card"><h2>Staff sign-in</h2><p class="lead">Your Energy Exchange schedule</p>' +
    (note ? '<div class="previewbar" id="lNote">' + esc(note) + '</div>' : '') +
    '<form class="form" id="lForm" autocomplete="on" novalidate><label for="lUser">User ID</label><input type="text" id="lUser" name="username" autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" maxlength="60">' +
    pwField('lPass', 'Password', 'current-password') +
    '<label class="check"><input type="checkbox" id="lKeep"> <span>Keep me signed in on this device for 30 days<br><span class="muted">Only on your own phone or computer.</span></span></label>' +
    '<div id="lMsg"></div><button class="b p big" id="lGo" type="submit">Sign in</button></form>' +
    '<p class="muted mt12">Forgot your password or locked out? Ask Ariana or Jess for a new temporary password.</p></div>' +
    '<div class="foot">Energy Exchange at Evolve &middot; staff schedule (sandbox)</div></div>';
  wireShow();
  $('lForm').onsubmit = function (ev) {
    ev.preventDefault();
    var u = $('lUser').value.trim(), p = $('lPass').value, keep = $('lKeep').checked;
    if (!u || !p) { $('lMsg').innerHTML = '<div class="errbox">Enter your user ID and password.</div>'; return; }
    $('lGo').disabled = true; $('lGo').textContent = 'Signing in...'; $('lMsg').innerHTML = '';
    api('login', { userId: u, password: p, keep: keep }).then(function (r) {
      store.save(r.token, r.keep); $('lPass').value = '';
      if (r.mustChange) showChange(true, r.name); else start();
    }).catch(function (e) { $('lGo').disabled = false; $('lGo').textContent = 'Sign in'; $('lPass').value = ''; $('lMsg').innerHTML = '<div class="errbox">' + esc(errMsg(e)) + '</div>'; });
  };
  setTimeout(function () { try { $('lUser').focus(); } catch (e) {} }, 50);
}

/* ---------- change password ---------- */
function showChange(forced, name) {
  $('nav').innerHTML = ''; setWho(name || (S.me && S.me.name) || ' ');
  $('main').innerHTML = '<div class="signin"><div class="card"><h2>' + (forced ? 'Choose your password' : 'Change password') + '</h2>' +
    (forced ? '<p class="lead">You signed in with a temporary password.</p><p class="muted mb6">Pick your own password to continue.</p>' : '') +
    '<form class="form" id="cForm" novalidate>' + pwField('cCur', forced ? 'Temporary password' : 'Current password', 'current-password') + pwField('cNew', 'New password', 'new-password') + pwField('cNew2', 'New password again', 'new-password') +
    '<ul class="rules"><li>At least 8 characters</li><li>Not the same as your user ID</li><li>Longer is better: a short phrase works well</li></ul>' +
    '<div id="cMsg"></div><button class="b p big" id="cGo" type="submit">Save new password</button>' +
    (forced ? '' : '<button class="b big" id="cCancel" type="button">Cancel</button>') + '</form></div></div>';
  wireShow();
  if (!forced) $('cCancel').onclick = function () { renderNav(); render(); };
  $('cForm').onsubmit = function (ev) {
    ev.preventDefault();
    var a = $('cCur').value, n = $('cNew').value, n2 = $('cNew2').value;
    if (n !== n2) { $('cMsg').innerHTML = '<div class="errbox">The new passwords do not match.</div>'; return; }
    if (n.length < 8) { $('cMsg').innerHTML = '<div class="errbox">Use at least 8 characters.</div>'; return; }
    $('cGo').disabled = true;
    call('changePassword', { currentPassword: a, newPassword: n }).then(function (r) { store.save(r.token, S.mode === 'local'); toast('Password saved'); start(); })
      .catch(function (e) { $('cGo').disabled = false; if (e && e.handled) return; $('cMsg').innerHTML = '<div class="errbox">' + esc(errMsg(e)) + '</div>'; });
  };
}

/* ---------- staff pages ---------- */
function start() { $('main').innerHTML = '<div class="empty">Loading...</div>'; S.view = S.view || 'my'; load(); }
function load() { return call('me').then(function (v) { S.me = v; setWho(v.name); renderNav(); render(); }).catch(fail); }
function render() {
  var v = S.me; if (!v) return;
  if (S.view === 'my') $('main').innerHTML = '<div class="wrapmax">' + myHtml(v) + '<p class="muted mt18"><button class="b" id="chpw" type="button">Change my password</button></p></div>';
  if (S.view === 'pickup') $('main').innerHTML = '<div class="wrapmax">' + pickupHtml(v) + '</div>';
  if (S.view === 'avail') { $('main').innerHTML = '<div class="wrapmax card"><h3>My weekly availability</h3><p class="muted">Repeats every week. Managers see it when they build the schedule.</p>' + availForm(v.availability) + '<button class="b p" id="avSave" type="button">Save</button></div>'; $('avSave').onclick = saveAvail; }
  if (S.view === 'timeoff') renderTimeOff(v);
  if ($('chpw')) $('chpw').onclick = function () { showChange(false); };
  wire();
}
function shiftCard(x, actions) {
  return '<div class="shiftcard" data-color="' + esc(x.color) + '"><div class="grow"><div class="when">' + fmtT(x.Start) + ' - ' + fmtT(x.End) + '</div><div>' + esc(x.positionName) + (x.Location ? ' &middot; ' + esc(x.Location) : '') + ' <span class="muted">(' + hrs(x.hours) + ')</span></div>' +
    (x.Notes ? '<div class="muted">' + esc(x.Notes) + '</div>' : '') + (x.offeredBy ? '<div class="muted">Offered by ' + esc(x.offeredBy) + '</div>' : '') + '</div>' + (actions ? '<div class="act">' + actions + '</div>' : '') + '</div>';
}
function myHtml(v) {
  var h = '<div class="stats"><div class="stat"><span class="muted">This week</span><b>' + hrs(v.hoursThisWeek) + '</b>' + (v.maxWeeklyHours ? '<span class="muted">max ' + esc(v.maxWeeklyHours) + 'h</span>' : '') + '</div><div class="stat"><span class="muted">Next week</span><b>' + hrs(v.hoursNextWeek) + '</b></div></div>';
  h += '<h3 class="sec">My upcoming shifts</h3>';
  if (!v.shifts.length) h += '<div class="empty">No published shifts coming up.</div>';
  var last = '';
  v.shifts.forEach(function (x) {
    if (x.Date !== last) { h += '<div class="datehead">' + (x.Date === v.today ? 'Today &middot; ' : '') + fmtD(x.Date) + '</div>'; last = x.Date; }
    h += shiftCard(x, x.pendingOffer ? '<span class="badge">Offer pending</span>' : '<button class="b" type="button" data-offer="' + esc(x.ShiftId) + '">Offer shift</button>');
  });
  h += '<h3 class="sec2">My requests</h3>' + reqList(v);
  return h;
}
function pickupHtml(v) {
  var all = v.open.concat(v.offered);
  var h = '<h3 class="sec">Open and offered shifts</h3><p class="muted">Ask to pick one up. A manager approves it.</p>';
  if (!all.length) return h + '<div class="empty">No open shifts right now.</div>';
  return h + all.map(function (x) { return '<div class="datehead">' + fmtD(x.Date) + '</div>' + shiftCard(x, x.myPickupPending ? '<span class="badge">Requested</span>' : '<button class="b p" type="button" data-pick="' + esc(x.ShiftId) + '">Request</button>'); }).join('');
}
function reqList(v) {
  if (!v.requests.length) return '<div class="empty">No requests.</div>';
  return v.requests.map(function (r) { return '<div class="card tight"><span class="pill ' + esc(r.Status) + '">' + esc(r.Status) + '</span> ' + (r.Type === 'offer' ? 'Offered' : 'Pick up') + ': ' + esc(r.shift) + (r.DecisionNote ? '<div class="muted">' + esc(r.DecisionNote) + '</div>' : '') + (r.Status === 'pending' ? ' <button class="b" type="button" data-creq="' + esc(r.RequestId) + '">Cancel</button>' : '') + '</div>'; }).join('');
}
function availForm(av) {
  return '<div class="form" id="avForm">' + av.map(function (a) {
    var w = a.Kind === 'window' ? '' : ' hide';
    return '<div class="availrow" data-wd="' + esc(a.Weekday) + '"><span class="d">' + DAYS[a.Weekday] + '</span><select class="avK" aria-label="' + DAYS[a.Weekday] + ' availability"><option value="unset"' + (a.Kind === 'unset' ? ' selected' : '') + '>Not set</option><option value="all"' + (a.Kind === 'all' ? ' selected' : '') + '>Available all day</option><option value="window"' + (a.Kind === 'window' ? ' selected' : '') + '>Available from...</option><option value="off"' + (a.Kind === 'off' ? ' selected' : '') + '>Unavailable</option></select>' +
      '<input type="time" class="avS' + w + '" aria-label="From" value="' + esc(a.Start || '09:00') + '"><input type="time" class="avE' + w + '" aria-label="To" value="' + esc(a.End || '17:00') + '"></div>';
  }).join('') + '</div>';
}
function saveAvail() {
  var days = [].map.call(document.querySelectorAll('#avForm .availrow'), function (r) { return { Kind: r.querySelector('.avK').value, Start: r.querySelector('.avS').value, End: r.querySelector('.avE').value }; });
  call('saveAvailability', { days: days }).then(function () { toast('Availability saved'); load(); }).catch(fail);
}
function renderTimeOff(v) {
  var h = '<div class="wrapmax"><div class="card"><h3>Request time off</h3><div class="form"><div class="row2"><div><label for="toS">From</label><input type="date" id="toS" min="' + esc(v.today) + '" value="' + esc(v.today) + '"></div><div><label for="toE">To</label><input type="date" id="toE" min="' + esc(v.today) + '" value="' + esc(v.today) + '"></div></div><label for="toR">Reason (optional)</label><input id="toR" maxlength="300"></div><div class="btns mt10"><button class="b p" type="button" id="toSend">Send request</button></div></div>';
  h += '<h3>My time off</h3>' + (v.timeOff.length ? v.timeOff.map(function (t) { return '<div class="card tight"><span class="pill ' + esc(t.Status) + '">' + esc(t.Status) + '</span> ' + esc(fmtD(t.StartDate)) + (t.EndDate !== t.StartDate ? ' - ' + esc(fmtD(t.EndDate)) : '') + (t.Reason ? ' <span class="muted">' + esc(t.Reason) + '</span>' : '') + (t.DecisionNote ? '<div class="muted">' + esc(t.DecisionNote) + '</div>' : '') + (t.Status === 'pending' ? ' <button class="b" type="button" data-cto="' + esc(t.TimeOffId) + '">Cancel</button>' : '') + '</div>'; }).join('') : '<div class="empty">None yet.</div>');
  $('main').innerHTML = h + '</div>';
  $('toSend').onclick = function () { call('requestTimeOff', { StartDate: $('toS').value, EndDate: $('toE').value, Reason: $('toR').value }).then(function () { toast('Request sent to your managers'); load(); }).catch(fail); };
}
function wire() {
  // position colors via CSSOM (allowed by the CSP, unlike inline style attributes); only plain hex colors
  [].forEach.call(document.querySelectorAll('[data-color]'), function (el) { var c = el.getAttribute('data-color'); if (/^#[0-9a-f]{3,8}$/i.test(c)) el.style.borderLeftColor = c; });
  [].forEach.call(document.querySelectorAll('[data-offer]'), function (b) { b.onclick = function () { var n = prompt('Offer this shift for someone else to pick up? Add a note (optional):', ''); if (n === null) return; call('offerShift', { shiftId: b.getAttribute('data-offer'), note: n }).then(function () { toast('Offered. A manager has to approve.'); load(); }).catch(fail); }; });
  [].forEach.call(document.querySelectorAll('[data-pick]'), function (b) { b.onclick = function () { call('requestPickup', { shiftId: b.getAttribute('data-pick'), note: '' }).then(function () { toast('Requested. A manager has to approve.'); load(); }).catch(fail); }; });
  [].forEach.call(document.querySelectorAll('[data-creq]'), function (b) { b.onclick = function () { call('cancelRequest', { id: b.getAttribute('data-creq') }).then(function () { toast('Cancelled'); load(); }).catch(fail); }; });
  [].forEach.call(document.querySelectorAll('[data-cto]'), function (b) { b.onclick = function () { call('cancelTimeOff', { id: b.getAttribute('data-cto') }).then(function () { toast('Cancelled'); load(); }).catch(fail); }; });
}
document.addEventListener('change', function (e) {
  if (e.target && e.target.classList && e.target.classList.contains('avK')) { var r = e.target.parentNode, w = e.target.value === 'window'; r.querySelector('.avS').classList.toggle('hide', !w); r.querySelector('.avE').classList.toggle('hide', !w); }
});
function netState() { $('offline').classList.toggle('hide', navigator.onLine !== false); }
window.addEventListener('online', netState); window.addEventListener('offline', netState); netState();

/* ---------- boot ---------- */
var saved = store.load();
if (saved) { S.token = saved; start(); } else showLogin('');
})();
