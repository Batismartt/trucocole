'use strict';

/* TrucoCole
   Función 1: anotador (click izquierdo suma, click derecho resta)
   Función 2: historial de partidas
   Función 3: ranking de jugadores
   Los datos se guardan en el navegador con localStorage. */

var KEY = 'trucocole:v2';
var TABS = ['anotador', 'historial', 'ranking'];

/* ---------- Estado ---------- */
var state = load();
var tab = 'anotador';
var pendingKey = null;
var pendingTimer = null;

function defaults() {
  return {
    target: 30,
    a: { name: 'Nosotros', pts: 0 },
    b: { name: 'Ellos', pts: 0 },
    undo: [],
    history: []
  };
}

function load() {
  var base = defaults();
  try {
    var raw = JSON.parse(localStorage.getItem(KEY));
    if (raw) {
      base.target = raw.target === 15 ? 15 : 30;
      base.a = { name: (raw.a && raw.a.name) || 'Nosotros', pts: (raw.a && raw.a.pts) | 0 };
      base.b = { name: (raw.b && raw.b.name) || 'Ellos', pts: (raw.b && raw.b.pts) | 0 };
      base.undo = Array.isArray(raw.undo) ? raw.undo : [];
      base.history = Array.isArray(raw.history) ? raw.history : [];
    }
  } catch (e) {}
  return base;
}

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
}

/* ---------- Utilidades ---------- */
function $(sel) { return document.querySelector(sel); }

function esc(s) {
  return String(s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

function teamName(k) {
  var n = (state[k].name || '').trim();
  return n || (k === 'a' ? 'Nosotros' : 'Ellos');
}

function winner() {
  if (state.a.pts >= state.target) return 'a';
  if (state.b.pts >= state.target) return 'b';
  return null;
}

/* Pide tocar dos veces para borrar */
function confirmed(key) {
  if (pendingKey === key) {
    pendingKey = null;
    clearTimeout(pendingTimer);
    return true;
  }
  pendingKey = key;
  clearTimeout(pendingTimer);
  pendingTimer = setTimeout(function () { pendingKey = null; render(); }, 3500);
  render();
  return false;
}

/* ---------- Función 1: anotador ---------- */
function matchSvg(pts, group) {
  var n = Math.max(0, Math.min(5, pts - group * 5));
  var segs = ['M8 38V8', 'M8 8H38', 'M38 8V38', 'M38 38H8', 'M8 38L38 8'];
  return '<svg viewBox="0 0 46 46" class="mg" aria-hidden="true">' +
    segs.map(function (d, i) { return '<path d="' + d + '" class="' + (i < n ? 'on' : 'off') + '"/>'; }).join('') +
    '</svg>';
}

function matchRows(pts) {
  var row = function (groups) {
    return '<div class="mgrid">' + groups.map(function (g) { return matchSvg(pts, g); }).join('') + '</div>';
  };
  if (state.target === 30) {
    return '<div class="mlabel">Malas</div>' + row([0, 1, 2]) + '<div class="mlabel">Buenas</div>' + row([3, 4, 5]);
  }
  return row([0, 1, 2]);
}

function teamHtml(k) {
  var tm = state[k];
  var won = winner() === k;
  var locked = winner() ? ' disabled' : '';
  var tip = 'Click izquierdo suma, click derecho resta';
  return '<article class="team ' + k + (won ? ' won' : '') + '">' +
    '<input class="name" id="name-' + k + '" value="' + esc(tm.name) + '" maxlength="30"' +
      ' placeholder="' + (k === 'a' ? 'Nosotros' : 'Ellos') + '" aria-label="Nombre del equipo ' + (k === 'a' ? 'de la izquierda' : 'de la derecha') + '">' +
    '<div class="tap" role="button" tabindex="0" data-act="tap" data-team="' + k + '" title="' + tip + '"' +
      ' aria-label="' + esc(teamName(k)) + ': ' + tm.pts + ' de ' + state.target + '. Enter suma 1, Borrar resta 1.">' +
      '<div class="pts">' + tm.pts + '</div><div class="of">de ' + state.target + '</div>' + matchRows(tm.pts) +
    '</div>' +
    '<div class="adds">' +
      [1, 2, 3].map(function (n) {
        return '<button type="button" class="btn" data-act="add" data-team="' + k + '" data-n="' + n + '"' + locked +
          ' title="' + tip + '" aria-label="Sumar ' + n + ' a ' + esc(teamName(k)) + '">+' + n + '</button>';
      }).join('') +
      '<button type="button" class="btn minus" data-act="sub" data-team="' + k + '"' + (tm.pts ? '' : ' disabled') +
        ' aria-label="Restar 1 a ' + esc(teamName(k)) + '">−1</button>' +
    '</div>' +
  '</article>';
}

function addPts(k, n) {
  if (winner()) return;
  var cur = state[k].pts;
  var next = Math.min(state.target, cur + n);
  if (next === cur) return;
  state[k].pts = next;
  state.undo.push({ k: k, d: next - cur });
  if (state.undo.length > 60) state.undo.shift();
  save(); render();
}

function subPts(k, n) {
  var cur = state[k].pts;
  var next = Math.max(0, cur - n);
  if (next === cur) return;
  state[k].pts = next;
  state.undo.push({ k: k, d: next - cur });
  if (state.undo.length > 60) state.undo.shift();
  save(); render();
}

function undo() {
  var u = state.undo.pop();
  if (!u) return;
  state[u.k].pts = Math.max(0, Math.min(state.target, state[u.k].pts - u.d));
  save(); render();
}

function setTarget(n) {
  state.target = n;
  state.a.pts = Math.min(state.a.pts, n);
  state.b.pts = Math.min(state.b.pts, n);
  state.undo = [];
  save(); render();
}

function resetGame() {
  state.a.pts = 0;
  state.b.pts = 0;
  state.undo = [];
  save(); render();
}

function saveGame() {
  if (!winner()) return;
  state.history.unshift({
    id: uid(),
    date: new Date().toISOString(),
    a: teamName('a'),
    b: teamName('b'),
    pa: state.a.pts,
    pb: state.b.pts,
    target: state.target
  });
  resetGame();
}

function renderAnotador() {
  $('#to15').setAttribute('aria-pressed', String(state.target === 15));
  $('#to30').setAttribute('aria-pressed', String(state.target === 30));
  $('#undo').disabled = !state.undo.length;
  var used = state.a.pts + state.b.pts > 0;
  var reset = $('#reset');
  reset.disabled = !used;
  reset.classList.toggle('danger', pendingKey === 'reset');
  reset.textContent = pendingKey === 'reset' ? '¿Seguro? Tocá de nuevo' : 'Nueva partida';

  var w = winner();
  var box = $('#winner');
  box.hidden = !w;
  if (w) {
    box.innerHTML = '<p class="win-t">Ganó ' + esc(teamName(w)) + '</p>' +
      '<p>' + state.a.pts + ' a ' + state.b.pts + ', partida a ' + state.target + '</p>' +
      '<div class="row"><button type="button" class="btn primary" data-act="save-game">Guardar en el historial</button>' +
      '<button type="button" class="btn" data-act="discard-game">Descartar</button></div>';
  }

  /* No se vuelve a dibujar un nombre mientras se escribe */
  var typing = document.activeElement && document.activeElement.classList.contains('name');
  if (!typing) {
    var focusTeam = document.activeElement && document.activeElement.dataset && document.activeElement.dataset.act === 'tap'
      ? document.activeElement.dataset.team : null;
    $('#teams').innerHTML = teamHtml('a') + teamHtml('b');
    if (focusTeam) { var t = $('.tap[data-team="' + focusTeam + '"]'); if (t) t.focus(); }
  } else {
    updateScoresOnly();
  }
}

/* Actualiza puntos y fósforos sin tocar los campos de nombre */
function updateScoresOnly() {
  ['a', 'b'].forEach(function (k) {
    var tap = $('.tap[data-team="' + k + '"]');
    if (tap) {
      tap.innerHTML = '<div class="pts">' + state[k].pts + '</div><div class="of">de ' + state.target + '</div>' + matchRows(state[k].pts);
    }
  });
}

/* ---------- Función 2: historial ---------- */
function formatDate(iso) {
  var d = new Date(iso);
  return d.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' }).replace('.', '');
}

function renderHistorial() {
  var list = $('#games');
  if (!state.history.length) {
    list.innerHTML = '<li class="empty">Todavía no hay partidas. Cuando alguien gane en el anotador, tocá "Guardar en el historial" y aparece acá.</li>';
    return;
  }
  list.innerHTML = state.history.map(function (g) {
    var aw = g.pa > g.pb;
    var key = 'gd-' + g.id;
    var asking = pendingKey === key;
    return '<li class="game">' +
      '<div class="g-meta">' + esc(formatDate(g.date)) + ' · a ' + g.target + ' · Ganó ' + esc(aw ? g.a : g.b) + '</div>' +
      '<div class="g-score"><span class="t a' + (aw ? ' win-n' : '') + '">' + esc(g.a) + '</span>' +
        '<span class="sc">' + g.pa + ' – ' + g.pb + '</span>' +
        '<span class="t b' + (aw ? '' : ' win-n') + '">' + esc(g.b) + '</span></div>' +
      '<div><button type="button" class="btn small' + (asking ? ' danger' : '') + '" data-act="game-del" data-id="' + esc(g.id) + '">' +
        (asking ? '¿Seguro? Tocá de nuevo' : 'Borrar partida') + '</button></div>' +
    '</li>';
  }).join('');
}

/* ---------- Función 3: ranking ---------- */
function splitPlayers(name) {
  return name.split(/\s*(?:,|&|\+|\sy\s|\se\s)\s*/i)
    .map(function (s) { return s.trim(); })
    .filter(Boolean);
}

function isDefaultName(n) { return /^(nosotros|ellos)$/i.test(n.trim()); }

function ranking() {
  var map = new Map();
  function entry(n) {
    var key = n.toLowerCase();
    if (!map.has(key)) map.set(key, { name: n, w: 0, p: 0 });
    return map.get(key);
  }
  state.history.forEach(function (g) {
    var aWon = g.pa > g.pb;
    [['a', aWon], ['b', !aWon]].forEach(function (side) {
      var name = g[side[0]];
      if (isDefaultName(name)) return;
      splitPlayers(name).forEach(function (p) {
        var r = entry(p);
        r.p++;
        if (side[1]) r.w++;
      });
    });
  });
  return Array.from(map.values()).sort(function (x, y) {
    return y.w - x.w || (y.w / y.p) - (x.w / x.p) || x.name.localeCompare(y.name);
  });
}

function renderRanking() {
  var rk = ranking();
  var box = $('#ranking');
  if (!rk.length) {
    box.innerHTML = '<div class="empty">Todavía no hay jugadores. Guardá una partida con los nombres de cada pareja (por ejemplo Santi y Mati) y el ranking aparece solo.</div>';
    return;
  }
  box.innerHTML = '<div class="card scroll"><table><thead><tr><th>#</th><th>Jugador</th><th class="n">Ganó</th><th class="n">Jugó</th><th class="n">%</th></tr></thead><tbody>' +
    rk.map(function (r, i) {
      return '<tr><td>' + (i + 1) + '</td><td>' + esc(r.name) + '</td><td class="n">' + r.w + '</td><td class="n">' + r.p +
        '</td><td class="n">' + Math.round(100 * r.w / r.p) + '%</td></tr>';
    }).join('') + '</tbody></table></div>';
}

/* ---------- Pantalla ---------- */
function render() {
  document.querySelectorAll('.nav-i').forEach(function (a) {
    if (a.dataset.tab === tab) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  TABS.forEach(function (t) { $('#p-' + t).hidden = t !== tab; });
  if (tab === 'anotador') renderAnotador();
  if (tab === 'historial') renderHistorial();
  if (tab === 'ranking') renderRanking();
}

/* ---------- Eventos ---------- */
document.addEventListener('click', function (e) {
  var b = e.target.closest('[data-act]');
  if (!b || b.disabled) return;
  var team = b.dataset.team;
  var n = Number(b.dataset.n) || 0;
  switch (b.dataset.act) {
    case 'tap': addPts(team, 1); break;
    case 'add': addPts(team, n); break;
    case 'sub': subPts(team, 1); break;
    case 'save-game': saveGame(); break;
    case 'discard-game': resetGame(); break;
    case 'game-del':
      if (confirmed('gd-' + b.dataset.id)) {
        state.history = state.history.filter(function (g) { return g.id !== b.dataset.id; });
        save(); render();
      }
      break;
  }
});

/* Click derecho: resta 1 en la columna, o resta la cantidad del botón */
document.addEventListener('contextmenu', function (e) {
  var t = e.target.closest('[data-act="tap"],[data-act="add"]');
  if (!t) return;
  e.preventDefault();
  if (e.pointerType === 'touch') return;
  var n = t.dataset.act === 'add' ? (Number(t.dataset.n) || 1) : 1;
  subPts(t.dataset.team, n);
});

/* Teclado: Enter o espacio suma, Borrar o "-" resta */
document.addEventListener('keydown', function (e) {
  var t = e.target;
  if (!t || !t.dataset || t.dataset.act !== 'tap') return;
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); addPts(t.dataset.team, 1); }
  else if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '-') { e.preventDefault(); subPts(t.dataset.team, 1); }
});

document.addEventListener('input', function (e) {
  if (e.target.id === 'name-a') { state.a.name = e.target.value; save(); }
  if (e.target.id === 'name-b') { state.b.name = e.target.value; save(); }
});

$('#to15').addEventListener('click', function () { setTarget(15); });
$('#to30').addEventListener('click', function () { setTarget(30); });
$('#undo').addEventListener('click', undo);
$('#reset').addEventListener('click', function () {
  if (confirmed('reset')) resetGame();
});

function tabFromHash() {
  var h = location.hash.replace('#', '');
  return TABS.indexOf(h) >= 0 ? h : 'anotador';
}
window.addEventListener('hashchange', function () {
  tab = tabFromHash();
  pendingKey = null;
  render();
  window.scrollTo(0, 0);
});

tab = tabFromHash();
render();
