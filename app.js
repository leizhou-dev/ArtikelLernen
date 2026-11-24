'use strict';
/* Artikel lernen – der, die, das
   Lern-PWA für Bayern Klasse 1–5 (Grundwortschatz LehrplanPLUS + Erweiterung Kl. 5) */

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const view = $('#view');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const shuffle = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[a[i], a[j]] = [a[j], a[i]]; } return a; };
const DAY = 864e5;
let RUN = 0;
const later = (fn, ms) => { const t = RUN; setTimeout(() => { if (t === RUN) fn(); }, ms); };
const today = () => new Date().toISOString().slice(0, 10);

const STUFEN = ['1/2', '3/4', '5'];
const STUFE_NAME = { '1/2': 'Klasse 1/2', '3/4': 'Klasse 3/4', '5': 'Klasse 5' };
const THEMEN = ['Tiere', 'Essen & Trinken', 'Körper', 'Menschen & Familie', 'Schule', 'Zuhause', 'Natur & Wetter',
  'Zeit', 'Kleidung', 'Stadt & Verkehr', 'Freizeit', 'Gedanken & Gefühle', 'Sonstiges'];
const WORTARTEN = ['Nomen', 'Verb', 'Adjektiv', 'Kleines Wort', 'Zahlwort'];
const AVATARE = ['🦊', '🐼', '🐯', '🦁', '🐸', '🐨', '🐰', '🦄', '🐙', '🐳', '🦉', '🐞', '🚀', '⚽', '🌻', '🎸'];
const INTERVAL = [0, 0, 1, 3, 7, 21].map(d => d * DAY); // Fach 1..5
const ARTS = ['der', 'die', 'das'];

let WORDS = [], NOUNS = [], BYID = {};

/* ---------- Speicher ---------- */
const KEY = 'artikel-lernen-v1';
let S;
try { S = JSON.parse(localStorage.getItem(KEY)) || null; } catch (e) { S = null; }
if (!S) S = { profiles: [], current: null, data: {} };
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast('Speichern nicht möglich'); } }
function newData() {
  return {
    settings: { stufen: ['1/2', '3/4'], themen: [], wortarten: [...WORTARTEN], tts: true, farben: true, runde: 10, stimme: '' },
    art: {}, voc: {}, pl: {}, stars: 0, log: [], rounds: [], best: { rennen: 0 }, days: []
  };
}
const P = () => S.data[S.current];
const ST = () => P().settings;
function curProfile() { return S.profiles.find(p => p.id === S.current); }

function rec(kind, id) { return P()[kind][id]; }
function grade(kind, w, ok, mode) {
  const d = P();
  const r = d[kind][w.id] || (d[kind][w.id] = { b: 1, due: 0, ok: 0, err: 0 });
  if (ok) { r.ok++; r.b = Math.min(5, r.b + 1); } else { r.err++; r.b = 1; }
  r.due = Date.now() + INTERVAL[r.b];
  r.last = Date.now();
  d.log.push({ t: Date.now(), m: mode, w: w.id, ok: ok ? 1 : 0 });
  if (d.log.length > 6000) d.log.splice(0, d.log.length - 6000);
  if (!d.days.includes(today())) d.days.push(today());
  if (ok) addStars(1);
  save();
}
function addStars(n) { P().stars += n; $('#starCount').textContent = P().stars; }
function logRound(mode, ok, total) {
  P().rounds.push({ t: Date.now(), m: mode, ok, n: total });
  if (P().rounds.length > 500) P().rounds.shift();
  save();
}

/* ---------- Wortauswahl ---------- */
function nounPool(opts = {}) {
  const s = ST();
  return NOUNS.filter(w => s.stufen.includes(w.stufe) && (!s.themen.length || s.themen.includes(w.thema))
    && !w.nurPlural && (!opts.plural || w.plural));
}
function vocPool() {
  const s = ST();
  return WORDS.filter(w => s.stufen.includes(w.stufe) && s.wortarten.includes(w.wortart)
    && (w.wortart !== 'Nomen' || !s.themen.length || s.themen.includes(w.thema)));
}
function weakFirst(pool, kind, n) {
  const res = pool.map(w => { const r = rec(kind, w.id); return [w, (r ? r.b : 0.5) + Math.random() * 2.2]; })
    .sort((a, b) => a[1] - b[1]).slice(0, n).map(x => x[0]);
  return shuffle(res);
}
function duePool(pool, kind, n) {
  const now = Date.now();
  const due = pool.filter(w => { const r = rec(kind, w.id); return r && r.due <= now; }).sort((a, b) => rec(kind, a.id).due - rec(kind, b.id).due);
  const neu = shuffle(pool.filter(w => !rec(kind, w.id)));
  return shuffle([...due.slice(0, n), ...neu.slice(0, Math.max(0, n - due.length))]);
}
function dueCount(pool, kind) { const now = Date.now(); return pool.filter(w => { const r = rec(kind, w.id); return r && r.due <= now; }).length; }
function errorWords(pool, kind) {
  return pool.filter(w => { const r = rec(kind, w.id); return r && r.err > 0 && r.b <= 2; })
    .sort((a, b) => rec(kind, b.id).err - rec(kind, a.id).err);
}

/* ---------- Ton & Sprache ---------- */
let voice = null;
function pickVoice() {
  if (!window.speechSynthesis) return;
  const vs = speechSynthesis.getVoices().filter(v => (v.lang || '').toLowerCase().startsWith('de'));
  const pref = S.current && ST().stimme;
  voice = vs.find(v => v.name === pref) || vs.find(v => /Anna|Petra|Helena|Markus|Google Deutsch/i.test(v.name)) || vs[0] || null;
}
if (window.speechSynthesis) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }
function say(text, rate = 0.9) {
  if (!window.speechSynthesis || !S.current || !ST().tts || !text) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'de-DE'; if (voice) u.voice = voice; u.rate = rate;
  speechSynthesis.speak(u);
}
let actx;
function beep(ok) {
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const t = actx.currentTime;
    const notes = ok ? [660, 880] : [300, 220];
    notes.forEach((f, i) => {
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = ok ? 'sine' : 'triangle'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t + i * .1); g.gain.exponentialRampToValueAtTime(0.18, t + i * .1 + .02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + i * .1 + .16);
      o.connect(g).connect(actx.destination); o.start(t + i * .1); o.stop(t + i * .1 + .18);
    });
  } catch (e) { }
}
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove('show'), 2200); }

/* ---------- Bausteine ---------- */
const isPhoto = w => /^https?:/.test(w.bild || '');
function imgHTML(w) {
  if (!w.bild) return '<div class="qimg noimg"></div>';
  const cap = isPhoto(w) ? `<div class="credits small">Foto: ${esc(w.bildQuelle.autor)} · ${esc(w.bildQuelle.lizenz)}</div>` : '';
  return `<div class="qimg ${isPhoto(w) ? 'photo' : ''}"><img src="${esc(w.bild)}" alt="" draggable="false" onerror="this.parentNode.classList.add('noimg');this.remove()"></div>${cap}`;
}
function artWord(w) { return w.artikel ? `<span class="art c-${w.artikel}">${w.artikel}</span>${esc(w.wort)}` : esc(w.wort); }
function fullText(w) { return w.artikel ? `${w.artikel} ${w.wort}` : w.wort; }
const reEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function gapSentence(w) {
  if (!w.beispiel) return '';
  const re = new RegExp(`(^|[^A-Za-zÄÖÜäöüß])(${reEsc(w.wort)})(?=$|[^A-Za-zÄÖÜäöüß])`, 'i');
  if (!re.test(w.beispiel)) return '';
  return esc(w.beispiel.replace(re, (m, a, b) => a + '_'.repeat(Math.max(3, b.length))));
}
function ruleHTML(w) {
  let h = '';
  if (w.regel) {
    h += w.ausnahme
      ? `<div class="rule">💡 <b>Regel:</b> ${esc(w.regel)}<br>⚠️ Aber <b>${esc(fullText(w))}</b> ist eine Ausnahme – gut merken!</div>`
      : `<div class="rule">💡 <b>Tipp:</b> ${esc(w.regel)}</div>`;
  }
  if (w.hinweis) h += `<div class="rule">ℹ️ ${esc(w.hinweis)}</div>`;
  return h;
}
function progressBar(i, n) { return `<div class="progress"><i style="width:${Math.round(i / n * 100)}%"></i></div>`; }
function setTitle(t) { $('#title').textContent = t; document.title = t + ' – Artikel lernen'; }
function go(h) { if (location.hash === '#' + h) render(); else location.hash = h; }

/* ---------- Ergebnis ---------- */
function resultView(mode, ok, total, wrong, again) {
  logRound(mode, ok, total);
  const perfect = total > 0 && ok === total;
  if (perfect) addStars(3);
  save();
  const pct = total ? ok / total : 0;
  const face = pct === 1 ? '🏆' : pct >= .8 ? '🌟' : pct >= .5 ? '👍' : '💪';
  const msg = pct === 1 ? 'Alles richtig! +3 Bonussterne' : pct >= .8 ? 'Super gemacht!' : pct >= .5 ? 'Gut! Weiter so.' : 'Übung macht den Meister!';
  view.innerHTML = `<div class="qcard result">
    <div class="big">${face}</div><div class="score">${ok} von ${total}</div><p>${msg}</p>
    ${wrong.length ? `<h3>Diese Wörter üben wir noch:</h3><div class="list">${wrong.map(w => `<button class="li" data-say="${esc(fullText(w))}">${w.bild ? `<img src="${esc(w.bild)}" alt="" onerror="this.outerHTML='<span class=ph>Aa</span>'">` : '<span class="ph">Aa</span>'}<span><b>${artWord(w)}</b>${w.plural ? `<small>Mehrzahl: ${esc(w.plural)}</small>` : ''}</span></button>`).join('')}</div>` : ''}
    <div class="row" style="justify-content:center;margin-top:18px">
      <button class="btn" id="again">🔁 Nochmal</button>
      <button class="btn ghost" onclick="go('home')">🏠 Start</button>
    </div></div>`;
  $('#again').onclick = again;
  $$('[data-say]').forEach(b => b.onclick = () => say(b.dataset.say));
}
function emptyView(text) {
  view.innerHTML = `<div class="qcard result"><div class="big">🙂</div><p>${text}</p>
    <div class="row" style="justify-content:center"><button class="btn ghost" onclick="go('einstellungen')">⚙️ Auswahl ändern</button>
    <button class="btn" onclick="go('home')">🏠 Start</button></div></div>`;
}

/* ---------- Artikel-Quiz (auch Karteikasten & Fehlerwörter) ---------- */
function artikelRound(items, mode, again) {
  if (!items.length) return emptyView(mode === 'fehler' ? 'Keine Fehlerwörter – super! 🎉' : 'Keine Wörter für diese Auswahl.');
  let i = 0, ok = 0; const wrong = [];
  const show = () => {
    if (i >= items.length) return resultView(mode, ok, items.length, wrong, again);
    const w = items[i];
    const r = rec('art', w.id);
    view.innerHTML = `${progressBar(i, items.length)}
      <div class="qcard">
        <button class="speak" aria-label="Vorlesen">🔊</button>
        ${imgHTML(w)}
        <div class="qword">${esc(w.wort)}</div>
        <div class="qsub">${mode === 'kasten' ? `Fach ${r ? r.b : 'neu'}` : esc(w.thema)}</div>
        <div class="answers">${ARTS.map(a => `<button class="ans ${a}" data-a="${a}">${a}</button>`).join('')}</div>
        <div class="feedback"></div>
      </div>`;
    $('.speak').onclick = () => say(w.wort);
    $$('.ans').forEach(b => b.onclick = () => answer(b.dataset.a));
    let done = false;
    function answer(a) {
      if (done) return; done = true;
      const right = a === w.artikel;
      grade('art', w, right, mode);
      beep(right);
      $$('.ans').forEach(b => { b.classList.toggle('dim', b.dataset.a !== w.artikel); b.classList.toggle('right', b.dataset.a === w.artikel); });
      $('.qword').innerHTML = artWord(w);
      say(fullText(w));
      const fb = $('.feedback');
      const pl = w.plural ? `<div class="small muted">Mehrzahl: ${esc(w.plural)}</div>` : '';
      if (right) {
        ok++;
        fb.className = 'feedback show ok';
        fb.innerHTML = `✅ <b>Richtig!</b> ${artWord(w)} ${pl}${w.ausnahme || w.hinweis ? ruleHTML(w) : ''}`;
        if (w.ausnahme || w.hinweis) fb.insertAdjacentHTML('beforeend', '<button class="btn next">Weiter ➜</button>');
        else { later(() => { i++; show(); }, 1100); return; }
      } else {
        wrong.push(w);
        fb.className = 'feedback show bad';
        fb.innerHTML = `❌ Leider falsch. Es heißt: <b>${artWord(w)}</b> ${pl}${ruleHTML(w)}
          <div class="small muted" style="margin-top:6px">${esc(w.beispiel || '')}</div>
          <button class="btn next">Weiter ➜</button>`;
        $('.qcard').classList.add('shake');
      }
      $('.next').onclick = () => { i++; show(); };
    }
  };
  show();
}

function kastenStart() {
  setTitle('Karteikasten');
  const pool = nounPool();
  const counts = [0, 0, 0, 0, 0];
  pool.forEach(w => { const r = rec('art', w.id); if (r) counts[r.b - 1]++; });
  const neu = pool.filter(w => !rec('art', w.id)).length;
  const due = dueCount(pool, 'art');
  view.innerHTML = `<div class="qcard">
    <h2>🗃️ Dein Karteikasten</h2>
    <p class="muted">Richtig beantwortet ➜ das Wort rutscht ein Fach weiter und kommt später wieder.<br>Falsch ➜ zurück in Fach 1.</p>
    <div class="boxes">${counts.map((c, k) => `<div>Fach ${k + 1}<b>${c}</b><span class="small muted">${['sofort', '1 Tag', '3 Tage', '7 Tage', '21 Tage'][k]}</span></div>`).join('')}</div>
    <p><b>${due}</b> Wörter sind heute dran · <b>${neu}</b> neue Wörter</p>
    <button class="btn" id="los" style="width:100%">Los geht's! 🚀</button></div>`;
  $('#los').onclick = () => artikelRound(duePool(pool, 'art', 15), 'kasten', kastenStart);
}

/* ---------- Sortieren ---------- */
function sortieren() {
  setTitle('Sortieren');
  const pool = nounPool();
  let items = [];
  for (const a of ARTS) items.push(...weakFirst(pool.filter(w => w.artikel === a), 'art', 3));
  items = shuffle(items);
  if (!items.length) return emptyView('Keine Wörter für diese Auswahl.');
  let ok = 0, fehler = 0; const wrong = new Set(); let selected = null;
  view.innerHTML = `<p class="center muted">Ziehe jedes Wort in die richtige Kiste – oder tippe erst das Wort und dann die Kiste.</p>
    <div class="pile">${items.map(w => `<div class="chip" data-id="${w.id}">${w.bild ? `<img src="${esc(w.bild)}" alt="" draggable="false" onerror="this.remove()">` : ''}${esc(w.wort)}</div>`).join('')}</div>
    <div class="bins">${ARTS.map(a => `<div class="bin ${a}" data-a="${a}"><h4>${a}</h4></div>`).join('')}</div>`;
  const drop = (chip, bin) => {
    const w = BYID[chip.dataset.id];
    const a = bin.dataset.a;
    if (a === w.artikel) {
      if (!wrong.has(w.id)) { grade('art', w, true, 'sort'); ok++; } else grade('art', w, true, 'sort');
      beep(true); say(fullText(w));
      chip.remove();
      bin.insertAdjacentHTML('beforeend', `<div class="done">${esc(w.wort)}</div>`);
      if (!$$('.pile .chip').length) later(() => resultView('sort', ok, items.length, [...wrong].map(id => BYID[id]), sortieren), 700);
    } else {
      fehler++; beep(false);
      if (!wrong.has(w.id)) { wrong.add(w.id); grade('art', w, false, 'sort'); }
      chip.classList.remove('shake'); void chip.offsetWidth; chip.classList.add('shake');
      bin.classList.remove('shake'); void bin.offsetWidth; bin.classList.add('shake');
    }
  };
  $$('.chip').forEach(chip => {
    chip.addEventListener('pointerdown', e => {
      e.preventDefault();
      const rect = chip.getBoundingClientRect();
      const dx = e.clientX - rect.left, dy = e.clientY - rect.top;
      let moved = false, clone = null, overBin = null;
      const move = ev => {
        if (!moved && Math.hypot(ev.clientX - e.clientX, ev.clientY - e.clientY) < 8) return;
        if (!moved) { moved = true; clone = chip.cloneNode(true); clone.classList.add('drag'); clone.style.width = rect.width + 'px'; document.body.appendChild(clone); chip.classList.add('ghost'); }
        clone.style.left = (ev.clientX - dx) + 'px'; clone.style.top = (ev.clientY - dy) + 'px';
        const el = document.elementFromPoint(ev.clientX, ev.clientY);
        const b = el && el.closest('.bin');
        if (overBin && overBin !== b) overBin.classList.remove('hover');
        overBin = b; if (b) b.classList.add('hover');
      };
      const up = ev => {
        window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up);
        if (clone) clone.remove(); chip.classList.remove('ghost');
        if (overBin) overBin.classList.remove('hover');
        if (moved && overBin) drop(chip, overBin);
        else if (!moved) { $$('.chip').forEach(c => c.style.borderColor = ''); selected = chip; chip.style.borderColor = 'var(--accent)'; say(BYID[chip.dataset.id].wort); }
      };
      window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
    });
  });
  $$('.bin').forEach(bin => bin.addEventListener('click', () => { if (selected && selected.isConnected) { const c = selected; selected = null; c.style.borderColor = ''; drop(c, bin); } }));
}

/* ---------- Mehrzahl ---------- */
function umlaut(s) {
  const m = s.match(/(au|a|o|u)(?=[^aeiouäöü]*$)/i);
  if (!m) return s;
  const map = { au: 'äu', a: 'ä', o: 'ö', u: 'ü', Au: 'Äu', A: 'Ä', O: 'Ö', U: 'Ü' };
  return s.slice(0, m.index) + map[m[1]] + s.slice(m.index + m[1].length);
}
function pluralFakes(w) {
  const b = w.wort, u = umlaut(b), real = w.plural;
  const st = b.replace(/e$/, '');
  const c = [b + 'e', b + 'en', b + 'n', b + 'er', b + 's', b, u + 'e', u + 'er', u, st + 'en', b + 'es'];
  return shuffle([...new Set(c)].filter(x => x !== real && !(b.endsWith('e') && x === b + 'e') && !/(.)\1\1/.test(x))).slice(0, 2);
}
function mehrzahl() {
  setTitle('Mehrzahl');
  const items = weakFirst(nounPool({ plural: true }), 'pl', ST().runde);
  if (!items.length) return emptyView('Keine Wörter für diese Auswahl.');
  let i = 0, ok = 0; const wrong = [];
  const show = () => {
    if (i >= items.length) return resultView('plural', ok, items.length, wrong, mehrzahl);
    const w = items[i];
    const opts = shuffle([w.plural, ...pluralFakes(w)]);
    view.innerHTML = `${progressBar(i, items.length)}<div class="qcard">
      <button class="speak">🔊</button>${imgHTML(w)}
      <div class="qword">${artWord(w)}</div>
      <div class="qsub">Wie heißt die Mehrzahl?</div>
      <div class="opts">${opts.map(o => `<button class="opt" data-o="${esc(o)}"><span class="c-die">die</span> ${esc(o)}</button>`).join('')}</div>
      <div class="feedback"></div></div>`;
    $('.speak').onclick = () => say(fullText(w));
    say(fullText(w));
    let done = false;
    $$('.opt').forEach(b => b.onclick = () => {
      if (done) return; done = true;
      const right = b.dataset.o === w.plural;
      grade('pl', w, right, 'plural'); beep(right);
      $$('.opt').forEach(x => { if (x.dataset.o === w.plural) x.classList.add('ok'); else if (x === b) x.classList.add('bad'); });
      say('die ' + w.plural);
      const fb = $('.feedback');
      if (right) { ok++; fb.className = 'feedback show ok'; fb.innerHTML = `✅ <b>Richtig!</b> ${artWord(w)} – die ${esc(w.plural)}${w.hinweis ? ruleHTML(w) : ''}`; later(() => { i++; show(); }, 1300); }
      else { wrong.push(w); fb.className = 'feedback show bad'; fb.innerHTML = `❌ Richtig ist: <b>die ${esc(w.plural)}</b>${w.hinweis ? ruleHTML(w) : ''}<button class="btn next">Weiter ➜</button>`; $('.next').onclick = () => { i++; show(); }; }
    });
  };
  show();
}

/* ---------- Zeitrennen ---------- */
function rennen() {
  setTitle('Zeitrennen');
  const pool = nounPool();
  if (!pool.length) return emptyView('Keine Wörter für diese Auswahl.');
  const best = P().best.rennen || 0;
  view.innerHTML = `<div class="qcard result"><div class="big">⏱️</div>
    <h2>Wie viele schaffst du in 60 Sekunden?</h2><p>Dein Rekord: <b>${best}</b></p>
    <button class="btn" id="los">Start!</button></div>`;
  $('#los').onclick = () => {
    let queue = shuffle(pool), score = 0, total = 0, left = 60, ended = false; const wrong = [];
    const tick = setInterval(() => {
      left--; const t = $('.timer'); if (t) { t.textContent = left + ' s'; t.classList.toggle('low', left <= 10); }
      if (left <= 0) end();
    }, 1000);
    const end = () => {
      if (ended) return; ended = true; clearInterval(tick);
      const rekord = score > (P().best.rennen || 0);
      if (rekord) P().best.rennen = score;
      addStars(Math.floor(score / 3));
      logRound('rennen', score, total);
      view.innerHTML = `<div class="qcard result"><div class="big">${rekord ? '🏆' : '⏱️'}</div>
        <div class="score">${score} richtig</div><p>${rekord ? 'Neuer Rekord!' : 'Rekord: ' + P().best.rennen}</p>
        <p class="muted">+${Math.floor(score / 3)} Sterne</p>
        ${wrong.length ? `<p>Falsch: ${wrong.slice(0, 12).map(w => artWord(w)).join(', ')}</p>` : ''}
        <div class="row" style="justify-content:center"><button class="btn" id="again">🔁 Nochmal</button><button class="btn ghost" onclick="go('home')">🏠 Start</button></div></div>`;
      $('#again').onclick = rennen;
    };
    window.__stopTimer = () => { ended = true; clearInterval(tick); };
    const next = () => {
      if (ended) return;
      if (!queue.length) queue = shuffle(pool);
      const w = queue.pop();
      view.innerHTML = `<div class="timer">${left} s</div><div class="center muted">Punkte: <b>${score}</b></div>
        <div class="qcard">${imgHTML(w)}<div class="qword">${esc(w.wort)}</div>
        <div class="answers">${ARTS.map(a => `<button class="ans ${a}" data-a="${a}">${a}</button>`).join('')}</div></div>`;
      let done = false;
      $$('.ans').forEach(b => b.onclick = () => {
        if (done || ended) return; done = true; total++;
        const right = b.dataset.a === w.artikel;
        grade('art', w, right, 'rennen'); beep(right);
        if (right) { score++; next(); }
        else { wrong.push(w); $('.qword').innerHTML = artWord(w); $$('.ans').forEach(x => x.classList.toggle('dim', x.dataset.a !== w.artikel)); later(next, 900); }
      });
    };
    next();
  };
}

/* ---------- Wörter: Hören & Schreiben ---------- */
function hoeren() {
  setTitle('Hören & Schreiben');
  const items = weakFirst(vocPool(), 'voc', ST().runde);
  if (!items.length) return emptyView('Keine Wörter für diese Auswahl.');
  let i = 0, ok = 0; const wrong = [];
  const speakWord = (w, rate) => { say(w.artikel ? fullText(w) : w.wort, rate); };
  const show = () => {
    if (i >= items.length) return resultView('hoeren', ok, items.length, wrong, hoeren);
    const w = items[i];
    const gap = gapSentence(w);
    view.innerHTML = `${progressBar(i, items.length)}<div class="qcard">
      <div class="row" style="justify-content:center;gap:12px">
        <button class="btn" id="hear">🔊 Hören</button><button class="btn ghost" id="slow">🐢 Langsam</button>
        ${w.beispiel ? '<button class="btn ghost" id="satz">💬 Satz</button>' : ''}
      </div>
      ${w.wortart === 'Nomen' ? imgHTML(w) : ''}
      <p><span class="tag">${esc(w.wortart)}</span></p>
      ${gap ? `<p style="font-size:22px">${gap}</p>` : ''}
      <input class="typein" id="inp" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" placeholder="${w.wortart === 'Nomen' ? 'Nomen ohne Artikel' : 'Schreibe das Wort'}">
      <div class="row" style="justify-content:center;margin-top:10px">${['ä', 'ö', 'ü', 'ß', 'Ä', 'Ö', 'Ü'].map(c => `<button class="btn ghost small key">${c}</button>`).join('')}</div>
      <div class="feedback"></div>
      <button class="btn next" id="check">Prüfen ✔</button></div>`;
    const inp = $('#inp');
    $('#hear').onclick = () => speakWord(w);
    $('#slow').onclick = () => speakWord(w, .55);
    if ($('#satz')) $('#satz').onclick = () => say(w.beispiel);
    $$('.key').forEach(k => k.onclick = () => { const s = inp.selectionStart ?? inp.value.length; inp.value = inp.value.slice(0, s) + k.textContent + inp.value.slice(inp.selectionEnd ?? s); inp.focus(); inp.setSelectionRange(s + 1, s + 1); });
    speakWord(w);
    setTimeout(() => inp.focus(), 50);
    let done = false;
    const check = () => {
      if (done) { i++; show(); return; }
      const v = inp.value.trim().replace(/\s+/g, ' ');
      if (!v) { inp.classList.add('shake'); setTimeout(() => inp.classList.remove('shake'), 400); return; }
      done = true;
      const right = v === w.wort;
      grade('voc', w, right, 'hoeren'); beep(right);
      const fb = $('.feedback');
      if (right) { ok++; fb.className = 'feedback show ok'; fb.innerHTML = `✅ <b>Richtig!</b> ${artWord(w)}${w.formen ? `<div class="small muted">${esc(w.formen)}</div>` : ''}`; }
      else {
        wrong.push(w);
        const caseOnly = v.toLowerCase() === w.wort.toLowerCase();
        fb.className = 'feedback show bad';
        fb.innerHTML = `${caseOnly ? '🔠 Fast! Achte auf die Groß- und Kleinschreibung.' : '❌ Nicht ganz.'}
          <div class="diff" style="margin-top:8px">Du: ${diffHTML(v, w.wort)}</div>
          <div class="diff">Richtig: <span>${artWord(w)}</span></div>
          ${w.wortart === 'Nomen' ? '<div class="small muted">Nomen schreibt man groß.</div>' : ''}`;
      }
      if (w.beispiel) fb.insertAdjacentHTML('beforeend', `<div class="small muted" style="margin-top:6px">${esc(w.beispiel)}</div>`);
      $('#check').textContent = 'Weiter ➜';
    };
    $('#check').onclick = check;
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') check(); });
  };
  show();
}
function diffHTML(a, b) {
  let h = '';
  for (let k = 0; k < Math.max(a.length, b.length); k++) {
    const c = a[k] ?? '·';
    h += `<span class="${a[k] === b[k] ? '' : 'x'}">${esc(c)}</span>`;
  }
  return h;
}

/* ---------- Wörter: Buchstabensalat ---------- */
function salat() {
  setTitle('Buchstabensalat');
  const items = weakFirst(vocPool().filter(w => w.wort.length >= 3 && w.wort.length <= 12 && !w.wort.includes(' ')), 'voc', ST().runde);
  if (!items.length) return emptyView('Keine Wörter für diese Auswahl.');
  let i = 0, ok = 0; const wrong = [];
  const show = () => {
    if (i >= items.length) return resultView('salat', ok, items.length, wrong, salat);
    const w = items[i];
    const letters = [...w.wort];
    let mix = shuffle(letters); let tries = 0;
    while (mix.join('') === w.wort && tries++ < 10) mix = shuffle(letters);
    const gap = gapSentence(w);
    view.innerHTML = `${progressBar(i, items.length)}<div class="qcard">
      <button class="speak">🔊</button>
      ${w.wortart === 'Nomen' ? imgHTML(w) : ''}
      <p><span class="tag">${esc(w.wortart)}</span></p>
      ${gap ? `<p style="font-size:22px">${gap}</p>` : ''}
      <div class="slots">${letters.map(() => '<div class="slot"></div>').join('')}</div>
      <div class="tiles">${mix.map((c, k) => `<button class="ltile" data-k="${k}">${esc(c)}</button>`).join('')}</div>
      <div class="row" style="justify-content:center;margin-top:14px"><button class="btn ghost" id="back">⌫ Zurück</button></div>
      <div class="feedback"></div></div>`;
    const typed = [];
    $('.speak').onclick = () => say(w.artikel ? fullText(w) : w.wort);
    say(w.artikel ? fullText(w) : w.wort);
    const paint = () => $$('.slot').forEach((s, k) => { const has = typed[k] !== undefined; s.textContent = has ? mix[typed[k]] : ''; s.classList.toggle('f', has); });
    let done = false;
    $$('.ltile').forEach(t => t.onclick = () => {
      if (done) return;
      typed.push(+t.dataset.k); t.classList.add('used'); paint();
      if (typed.length === letters.length) {
        done = true;
        const v = typed.map(k => mix[k]).join('');
        const right = v === w.wort;
        grade('voc', w, right, 'salat'); beep(right);
        const fb = $('.feedback');
        if (right) { ok++; fb.className = 'feedback show ok'; fb.innerHTML = `✅ <b>Richtig!</b> ${artWord(w)}`; say(w.artikel ? fullText(w) : w.wort); later(() => { i++; show(); }, 1300); }
        else { wrong.push(w); fb.className = 'feedback show bad'; fb.innerHTML = `❌ Richtig ist: <b>${artWord(w)}</b><button class="btn next">Weiter ➜</button>`; $('.next').onclick = () => { i++; show(); }; }
      }
    });
    $('#back').onclick = () => { if (done || !typed.length) return; const k = typed.pop(); $(`.ltile[data-k="${k}"]`).classList.remove('used'); paint(); };
  };
  show();
}

/* ---------- Wörter: Lernkarten ---------- */
function karten() {
  setTitle('Lernkarten');
  const items = duePool(vocPool(), 'voc', ST().runde);
  if (!items.length) return emptyView('Keine Wörter für diese Auswahl.');
  let i = 0, ok = 0; const wrong = [];
  const show = () => {
    if (i >= items.length) return resultView('karten', ok, items.length, wrong, karten);
    const w = items[i];
    const gap = gapSentence(w);
    view.innerHTML = `${progressBar(i, items.length)}
      <div class="flip" id="flip"><div class="flipin">
        <div class="face front">
          ${w.wortart === 'Nomen' ? imgHTML(w) : ''}
          <span class="tag">${esc(w.wortart)} · ${esc(STUFE_NAME[w.stufe])}</span>
          ${gap ? `<p style="font-size:24px">${gap}</p>` : ''}
          <button class="btn ghost small" id="fhear">🔊 Anhören</button>
          <p style="font-size:20px">Anfangsbuchstabe: <b>${esc(w.wort[0])}</b> · ${w.wort.length} Buchstaben</p>
          <p class="muted">Stell dir vor, wie man das Wort${w.artikel ? ' mit Artikel' : ''} schreibt. </p>
          <span class="btn">🔄 Umdrehen</span>
        </div>
        <div class="face back">
          <div class="qword">${artWord(w)}</div>
          ${w.plural ? `<div>Mehrzahl: <b>die ${esc(w.plural)}</b></div>` : ''}
          ${w.formen ? `<div>${esc(w.formen)}</div>` : ''}
          ${w.beispiel ? `<p style="font-size:20px">${esc(w.beispiel)}</p>` : ''}
          ${w.artikel ? ruleHTML(w).replace(/class="rule"/g, 'class="rule small"') : ''}
        </div></div></div>
      <div class="row" id="rate" style="justify-content:center;margin-top:16px;visibility:hidden">
        <button class="btn ghost" data-r="0">😕 Noch üben</button><button class="btn" data-r="1">😀 Gewusst!</button>
      </div>`;
    say(w.wort);
    $('#fhear').onclick = e => { e.stopPropagation(); say(w.wort); };
    $('#flip').onclick = () => {
      const f = $('#flip'); f.classList.toggle('on');
      if (f.classList.contains('on')) { $('#rate').style.visibility = 'visible'; say(w.artikel ? fullText(w) : w.wort); }
    };
    $$('#rate .btn').forEach(b => b.onclick = () => {
      const right = b.dataset.r === '1';
      grade('voc', w, right, 'karten');
      if (right) ok++; else wrong.push(w);
      i++; show();
    });
  };
  show();
}

/* ---------- Wortliste ---------- */
function liste() {
  setTitle('Wortliste');
  let art = 'Alle', stufe = 'Alle', q = '';
  view.innerHTML = `<input class="search" id="q" placeholder="🔍 Wort suchen …" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">
    <div class="chips" id="fa">${['Alle', ...WORTARTEN].map(a => `<button class="tog ${a === 'Alle' ? 'on' : ''}" data-v="${a}">${a}</button>`).join('')}</div>
    <div class="chips" id="fs" style="margin:8px 0 12px">${['Alle', ...STUFEN].map(a => `<button class="tog ${a === 'Alle' ? 'on' : ''}" data-v="${a}">${a === 'Alle' ? 'Alle Klassen' : STUFE_NAME[a]}</button>`).join('')}</div>
    <div class="muted small" id="cnt"></div><div class="list" id="lst"></div>`;
  const draw = () => {
    const ql = q.toLowerCase();
    const arr = WORDS.filter(w => (art === 'Alle' || w.wortart === art) && (stufe === 'Alle' || w.stufe === stufe) && (!ql || w.wort.toLowerCase().includes(ql)))
      .sort((a, b) => a.wort.localeCompare(b.wort, 'de'));
    $('#cnt').textContent = arr.length + ' Wörter';
    $('#lst').innerHTML = arr.map(w => `<button class="li ${w.artikel ? 'bg-' + w.artikel : ''}" data-id="${w.id}">
      ${w.bild ? `<img src="${esc(w.bild)}" alt="" loading="lazy" onerror="this.outerHTML='<span class=ph>Aa</span>'">` : '<span class="ph">Aa</span>'}
      <span><b>${artWord(w)}</b><small>${w.plural ? 'die ' + esc(w.plural) : w.nurPlural ? 'nur Mehrzahl' : w.formen ? esc(w.formen) : esc(w.wortart)}</small></span></button>`).join('');
  };
  $('#lst').onclick = e => { const b = e.target.closest('.li'); if (!b) return; const w = BYID[b.dataset.id]; say((w.artikel ? fullText(w) : w.wort) + '. ' + (w.beispiel || '')); };
  $('#q').oninput = e => { q = e.target.value.trim(); draw(); };
  const chipGroup = (id, set) => $(id).onclick = e => { const b = e.target.closest('.tog'); if (!b) return; $$(id + ' .tog').forEach(x => x.classList.toggle('on', x === b)); set(b.dataset.v); draw(); };
  chipGroup('#fa', v => art = v); chipGroup('#fs', v => stufe = v);
  draw();
}

/* ---------- Merkregeln ---------- */
function regeln() {
  setTitle('Merkregeln');
  const ex = (re, a, n = 4) => NOUNS.filter(w => w.artikel === a && re.test(w.wort)).slice(0, n).map(w => artWord(w)).join(', ');
  const R = [
    ['die', 'Wörter auf -ung, -heit, -keit, -schaft', /(ung|heit|keit|schaft)$/],
    ['die', 'Wörter auf -ion, -tät, -ik, -ie, -ei', /(ion|tät|ik|ie|erei|zei)$/],
    ['die', 'Viele Wörter auf -e (aber: der Hase, der Löwe, das Auge …)', /[^e]e$/],
    ['die', 'Weibliche Personen und Wörter auf -in', /(Frau|Oma|Mutter|Schwester|Tante|in)$/],
    ['das', 'Verkleinerungen auf -chen und -lein – immer das!', /(chen|lein)$/],
    ['das', 'Wörter auf -ment, -um, -nis', /(ment|eum|rum|nis)$/],
    ['das', 'Aus Verben gemacht: das Essen, das Lesen, das Schwimmen', /^(Essen|Lesen|Schwimmen|Wissen)$/],
    ['das', 'Viele Wörter mit Ge- vorne', /^Ge(müse|schenk|witter|bäude|birge|fühl)/],
    ['das', 'Metalle', /^(Gold|Eisen)$/],
    ['der', 'Tage, Monate und Jahreszeiten', /^(Montag|Freitag|Januar|Mai|Winter|Sommer|Herbst|Frühling)$/],
    ['der', 'Männliche Personen und Berufe auf -er', /^(Vater|Opa|Bruder|Onkel|Lehrer|Bäcker|Schüler|Verkäufer)$/],
    ['der', 'Wörter auf -ling, -or, -ig, -ich', /(ling|or|ig|ich)$/],
    ['der', 'Himmelsrichtungen', /^Norden$/],
  ];
  view.innerHTML = `<div class="panel"><h3>🧩 Zusammengesetzte Wörter</h3>
    <p>Das <b>letzte</b> Wort bestimmt den Artikel:<br>${artWord({ artikel: 'das', wort: 'Haus' })} + ${artWord({ artikel: 'die', wort: 'Aufgabe' })} → ${artWord({ artikel: 'die', wort: 'Hausaufgabe' })}<br>
    ${artWord({ artikel: 'die', wort: 'Sonne' })} + ${artWord({ artikel: 'die', wort: 'Blume' })} → ${artWord({ artikel: 'die', wort: 'Sonnenblume' })} · ${artWord({ artikel: 'der', wort: 'Fahrrad' })}? Nein: ${artWord({ artikel: 'das', wort: 'Fahrrad' })} wegen ${artWord({ artikel: 'das', wort: 'Rad' })}!</p></div>
    ${ARTS.map(a => `<div class="panel bg-${a}"><h3 class="c-${a}" style="font-size:28px">${a}</h3>
      ${R.filter(r => r[0] === a).map(r => `<p><b>${esc(r[1])}</b><br><span class="small">${ex(r[2], a)}</span></p>`).join('')}</div>`).join('')}
    <div class="panel"><h3>💡 Profi-Tipp</h3><p>Lerne jedes Nomen immer <b>mit</b> Artikel und am besten mit Farbe: <span class="c-der">blau = der</span>, <span class="c-die">rot = die</span>, <span class="c-das">grün = das</span>. In der Mehrzahl heißt es immer <b class="c-die">die</b>.</p></div>`;
}

/* ---------- Fortschritt ---------- */
function streak() {
  const set = new Set(P().days); let n = 0; let d = new Date();
  if (!set.has(today())) d = new Date(Date.now() - DAY);
  while (set.has(d.toISOString().slice(0, 10))) { n++; d = new Date(d - DAY); }
  return n;
}
function fortschritt() {
  setTitle('Mein Fortschritt');
  const d = P();
  const nouns = NOUNS.filter(w => !w.nurPlural);
  const learned = w => { const r = d.art[w.id]; return r && r.b >= 4; };
  const boxes = [0, 0, 0, 0, 0]; nouns.forEach(w => { const r = d.art[w.id]; if (r) boxes[r.b - 1]++; });
  const vocLearned = WORDS.filter(w => { const r = d.voc[w.id]; return r && r.b >= 3; }).length;
  const answers = d.log.length, right = d.log.filter(l => l.ok).length;
  view.innerHTML = `<div class="grid" style="margin-bottom:16px">
      <div class="tile"><span class="ic">⭐</span><b>${d.stars}</b><span>Sterne</span></div>
      <div class="tile"><span class="ic">🔥</span><b>${streak()} ${streak() === 1 ? 'Tag' : 'Tage'}</b><span>am Stück geübt</span></div>
      <div class="tile"><span class="ic">🎯</span><b>${answers ? Math.round(right / answers * 100) : 0} %</b><span>richtig (${answers} Antworten)</span></div>
      <div class="tile"><span class="ic">⏱️</span><b>${d.best.rennen || 0}</b><span>Rekord Zeitrennen</span></div>
    </div>
    <div class="panel"><h3>🗃️ Artikel-Karteikasten (alle Klassen)</h3>
      <div class="boxes">${boxes.map((c, k) => `<div>Fach ${k + 1}<b>${c}</b></div>`).join('')}</div>
      <p class="small muted">Ab Fach 4 gilt ein Wort als „sicher gelernt“. Sicher: <b>${nouns.filter(learned).length}</b> von ${nouns.length} Nomen.</p></div>
    <div class="panel"><h3>📚 Artikel nach Themen</h3>
      ${THEMEN.map(t => { const ws = nouns.filter(w => w.thema === t); const l = ws.filter(learned).length; return `<div class="bar"><span class="lbl">${t}</span><span class="track"><i style="width:${ws.length ? l / ws.length * 100 : 0}%"></i></span><span class="val">${l}/${ws.length}</span></div>`; }).join('')}
    </div>
    <div class="panel"><h3>✏️ Wörter lernen</h3>
      ${STUFEN.map(s => { const ws = WORDS.filter(w => w.stufe === s); const l = ws.filter(w => { const r = d.voc[w.id]; return r && r.b >= 3; }).length; return `<div class="bar"><span class="lbl">${STUFE_NAME[s]}</span><span class="track"><i style="width:${l / ws.length * 100}%"></i></span><span class="val">${l}/${ws.length}</span></div>`; }).join('')}
      <p class="small muted">Insgesamt ${vocLearned} Wörter sicher geschrieben.</p></div>
    <div class="panel"><h3>🕑 Letzte Runden</h3>${d.rounds.length ? `<table><tr><th>Wann</th><th>Übung</th><th>Ergebnis</th></tr>${d.rounds.slice(-10).reverse().map(r => `<tr><td>${new Date(r.t).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}</td><td>${MODE[r.m] || r.m}</td><td>${r.ok}/${r.n}</td></tr>`).join('')}</table>` : '<p class="muted">Noch keine Runde gespielt.</p>'}</div>`;
}
const MODE = { quiz: 'Artikel-Quiz', kasten: 'Karteikasten', fehler: 'Fehlerwörter', sort: 'Sortieren', plural: 'Mehrzahl', rennen: 'Zeitrennen', hoeren: 'Hören & Schreiben', salat: 'Buchstabensalat', karten: 'Lernkarten' };

/* ---------- Elternbereich ---------- */
let elternOK = false;
function eltern() {
  setTitle('Elternbereich');
  if (!elternOK) {
    const a = 6 + Math.floor(Math.random() * 7), b = 6 + Math.floor(Math.random() * 7);
    view.innerHTML = `<div class="qcard result"><div class="big">🔒</div><h2>Nur für Eltern</h2>
      <p>Bitte rechne: <b>${a} × ${b}</b></p>
      <input class="typein" id="pin" inputmode="numeric" style="max-width:220px"><br><br>
      <button class="btn" id="ok">Öffnen</button></div>`;
    const tryIt = () => { if (+$('#pin').value === a * b) { elternOK = true; eltern(); } else { $('#pin').classList.add('shake'); setTimeout(() => $('#pin').classList.remove('shake'), 400); } };
    $('#ok').onclick = tryIt; $('#pin').onkeydown = e => { if (e.key === 'Enter') tryIt(); };
    return;
  }
  const d = P();
  const errs = (kind) => Object.entries(d[kind]).filter(([, r]) => r.err > 0).sort((x, y) => y[1].err - x[1].err).slice(0, 15)
    .map(([id, r]) => BYID[id] ? `<tr><td>${artWord(BYID[id])}</td><td>${r.err}</td><td>${r.ok}</td><td>Fach ${r.b}</td></tr>` : '').join('');
  const days = [];
  for (let k = 13; k >= 0; k--) { const dt = new Date(Date.now() - k * DAY).toISOString().slice(0, 10); days.push([dt, d.log.filter(l => new Date(l.t).toISOString().slice(0, 10) === dt).length]); }
  const mx = Math.max(1, ...days.map(x => x[1]));
  view.innerHTML = `<div class="panel"><h3>👤 Profil: ${esc(curProfile().avatar)} ${esc(curProfile().name)}</h3>
      <p>${d.log.length} Antworten · ${d.log.length ? Math.round(d.log.filter(l => l.ok).length / d.log.length * 100) : 0} % richtig · ${d.days.length} ${d.days.length === 1 ? "Übungstag" : "Übungstage"} · ⭐ ${d.stars}</p></div>
    <div class="panel"><h3>📅 Aktivität (letzte 14 Tage)</h3>
      ${days.map(([dt, n]) => `<div class="bar"><span class="lbl">${new Date(dt).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })}</span><span class="track"><i style="width:${n / mx * 100}%;background:var(--accent)"></i></span><span class="val">${n}</span></div>`).join('')}</div>
    <div class="panel"><h3>❗ Häufigste Fehler – Artikel</h3>${errs('art') ? `<table><tr><th>Wort</th><th>Falsch</th><th>Richtig</th><th>Stand</th></tr>${errs('art')}</table>` : '<p class="muted">Noch keine Fehler.</p>'}</div>
    <div class="panel"><h3>❗ Häufigste Fehler – Schreiben</h3>${errs('voc') ? `<table><tr><th>Wort</th><th>Falsch</th><th>Richtig</th><th>Stand</th></tr>${errs('voc')}</table>` : '<p class="muted">Noch keine Fehler.</p>'}</div>
    <div class="panel"><h3>🧰 Verwaltung</h3><div class="row">
      <button class="btn ghost" id="csv">⬇️ Export als CSV</button>
      <button class="btn ghost" onclick="go('einstellungen')">⚙️ Einstellungen</button>
      <button class="btn ghost" onclick="go('profile')">👥 Profile</button>
      <button class="btn ghost" onclick="go('quellen')">📜 Quellen & Lizenzen</button>
      <button class="btn ghost" id="reset">🗑️ Fortschritt zurücksetzen</button>
      <button class="btn ghost" id="del">❌ Profil löschen</button></div></div>`;
  $('#csv').onclick = exportCSV;
  $('#reset').onclick = () => { if (confirm(`Fortschritt von ${curProfile().name} wirklich löschen?`)) { const s = d.settings; S.data[S.current] = newData(); S.data[S.current].settings = s; save(); toast('Zurückgesetzt'); go('home'); } };
  $('#del').onclick = () => {
    if (!confirm(`Profil ${curProfile().name} mit allem Fortschritt löschen?`)) return;
    delete S.data[S.current]; S.profiles = S.profiles.filter(p => p.id !== S.current); S.current = S.profiles[0]?.id || null; save(); go(S.current ? 'home' : 'profile');
  };
}
function exportCSV() {
  const rows = [['Profil', 'Datum', 'Uhrzeit', 'Übung', 'Wort', 'Artikel', 'Ergebnis']];
  for (const p of S.profiles) for (const l of (S.data[p.id]?.log || [])) {
    const w = BYID[l.w]; const dt = new Date(l.t);
    rows.push([p.name, dt.toLocaleDateString('de-DE'), dt.toLocaleTimeString('de-DE'), MODE[l.m] || l.m, w ? w.wort : l.w, w?.artikel || '', l.ok ? 'richtig' : 'falsch']);
  }
  const csv = '﻿' + rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = `artikel-lernen-${today()}.csv`; document.body.appendChild(a); a.click(); a.remove();
}

/* ---------- Einstellungen ---------- */
function einstellungen() {
  setTitle('Einstellungen');
  const s = ST();
  const voices = window.speechSynthesis ? speechSynthesis.getVoices().filter(v => (v.lang || '').toLowerCase().startsWith('de')) : [];
  const tg = (group, val, on, label) => `<button class="tog ${on ? 'on' : ''}" data-g="${group}" data-v="${esc(val)}">${esc(label || val)}</button>`;
  view.innerHTML = `<div class="panel"><h3>🎒 Welche Klassen?</h3><div class="chips">${STUFEN.map(x => tg('stufen', x, s.stufen.includes(x), STUFE_NAME[x])).join('')}</div></div>
    <div class="panel"><h3>🗂️ Welche Themen? <span class="small muted">(keins gewählt = alle)</span></h3><div class="chips">${THEMEN.map(x => tg('themen', x, s.themen.includes(x))).join('')}</div></div>
    <div class="panel"><h3>✏️ Wortarten beim Wörter-Lernen</h3><div class="chips">${WORTARTEN.map(x => tg('wortarten', x, s.wortarten.includes(x))).join('')}</div></div>
    <div class="panel"><h3>🔧 Sonstiges</h3>
      <div class="field"><label>Wörter pro Runde</label><select id="runde">${[5, 10, 15, 20].map(n => `<option ${n === s.runde ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
      <div class="field"><label>Vorlesen</label>${tg('tts', 'tts', s.tts, s.tts ? 'An 🔊' : 'Aus 🔇')}</div>
      <div class="field"><label>Stimme</label><select id="stimme"><option value="">Automatisch</option>${voices.map(v => `<option ${v.name === s.stimme ? 'selected' : ''}>${esc(v.name)}</option>`).join('')}</select>
        <button class="btn ghost small" id="test">Test</button></div>
      <div class="field"><label>Farben für der/die/das</label>${tg('farben', 'farben', s.farben, s.farben ? 'An 🎨' : 'Aus')}</div>
    </div>
    <p class="center"><button class="btn" onclick="go('home')">Fertig ✔</button></p>`;
  view.onclick = e => {
    const b = e.target.closest('.tog'); if (!b) return;
    const g = b.dataset.g, v = b.dataset.v;
    if (g === 'tts' || g === 'farben') { s[g] = !s[g]; applyColors(); }
    else {
      const arr = s[g]; const k = arr.indexOf(v);
      if (k >= 0) { if (g !== 'themen' && arr.length === 1) return toast('Mindestens eins auswählen'); arr.splice(k, 1); } else arr.push(v);
    }
    save(); einstellungen();
  };
  $('#runde').onchange = e => { s.runde = +e.target.value; save(); };
  $('#stimme').onchange = e => { s.stimme = e.target.value; save(); pickVoice(); say('der Hund, die Katze, das Pferd'); };
  $('#test').onclick = () => say('der Hund, die Katze, das Pferd');
}
function applyColors() { document.body.classList.toggle('nocolor', !!S.current && !ST().farben); }

/* ---------- Profile ---------- */
function profile() {
  setTitle('Wer übt?');
  view.innerHTML = `<div class="profiles">${S.profiles.map(p => `<button class="prof" data-id="${p.id}" style="${p.id === S.current ? 'border-color:var(--accent)' : ''}"><div class="av">${esc(p.avatar)}</div><b>${esc(p.name)}</b><span class="small muted">⭐ ${S.data[p.id]?.stars || 0}</span></button>`).join('')}
    <button class="prof" id="neu"><div class="av">➕</div><b>Neues Profil</b></button></div>`;
  $$('.prof[data-id]').forEach(b => b.onclick = () => { S.current = b.dataset.id; save(); pickVoice(); applyColors(); go('home'); });
  $('#neu').onclick = neuesProfil;
  if (!S.profiles.length) neuesProfil();
}
function neuesProfil() {
  setTitle('Neues Profil');
  let av = AVATARE[Math.floor(Math.random() * AVATARE.length)];
  view.innerHTML = `<div class="qcard"><h2>👋 Hallo! Wie heißt du?</h2>
    <input class="typein" id="name" maxlength="20" autocomplete="off" autocorrect="off" spellcheck="false" placeholder="Dein Name">
    <h3>Such dir ein Bild aus:</h3><div class="avatars">${AVATARE.map(a => `<button class="${a === av ? 'on' : ''}">${a}</button>`).join('')}</div>
    <p class="center"><button class="btn" id="ok" style="margin-top:16px">Los geht's! 🚀</button></p></div>`;
  $$('.avatars button').forEach(b => b.onclick = () => { av = b.textContent; $$('.avatars button').forEach(x => x.classList.toggle('on', x === b)); });
  $('#ok').onclick = () => {
    const name = $('#name').value.trim();
    if (!name) { $('#name').classList.add('shake'); setTimeout(() => $('#name').classList.remove('shake'), 400); return; }
    const id = 'p' + Date.now().toString(36);
    S.profiles.push({ id, name, avatar: av }); S.data[id] = newData(); S.current = id; save(); applyColors(); go('home');
  };
}

/* ---------- Quellen ---------- */
function quellen() {
  setTitle('Quellen & Lizenzen');
  const photos = WORDS.filter(isPhoto);
  view.innerHTML = `<div class="panel credits"><h3>📚 Wortschatz</h3>
    <p>Klasse 1/2 und 3/4: Grundwortschatz aus dem LehrplanPLUS Grundschule Bayern (ISB, „Ergänzende Informationen zum LehrplanPLUS – Grundwortschatz“).
    Klasse 5: eigene Erweiterung mit häufigen Nomen und Wörtern aus dem Unterricht der 5. Klasse. Beispielsätze, Merkregeln und Zuordnung zu Themen wurden für diese App erstellt.</p></div>
    <div class="panel credits"><h3>🎨 Bilder</h3>
    <p>Die meisten Bilder stammen von <a href="https://openmoji.org" target="_blank" rel="noopener">OpenMoji</a> – das offene Emoji-Projekt der Hochschule für Gestaltung Schwäbisch Gmünd. Lizenz: <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener">CC BY-SA 4.0</a>.</p>
    <p>Fotos von Wikimedia Commons:</p>
    <table>${photos.map(w => `<tr><td>${esc(w.wort)}</td><td>${esc(w.bildQuelle.autor)}</td><td>${esc(w.bildQuelle.lizenz)}</td><td><a href="${esc(w.bildQuelle.seite)}" target="_blank" rel="noopener">Quelle</a></td></tr>`).join('')}</table>
    <p>Abstrakte Wörter (z. B. die Angst, die Freiheit) haben absichtlich kein Bild.</p></div>`;
}

/* ---------- Startseite ---------- */
function home() {
  const p = curProfile(); const s = ST();
  setTitle('Artikel lernen');
  const np = nounPool(), vp = vocPool();
  const fehlerN = errorWords(np, 'art').length;
  const dueArt = dueCount(np, 'art'), dueVoc = dueCount(vp, 'voc');
  const tile = (h, ic, t, sub, badge) => `<button class="tile" onclick="go('${h}')"><span class="ic">${ic}</span><b>${t}</b><span>${sub}</span>${badge ? `<span class="badge">${badge}</span>` : ''}</button>`;
  view.innerHTML = `<div class="row"><h2 style="margin:6px 0">Hallo ${esc(p.name)}! ${esc(p.avatar)}</h2><span class="spacer"></span>
      <button class="btn ghost small" onclick="go('einstellungen')">⚙️ ${s.stufen.map(x => STUFE_NAME[x].replace('Klasse ', 'Kl. ')).join(' + ')} · ${s.themen.length ? s.themen.length + ' Themen' : 'alle Themen'}</button></div>
    <div class="section"><h2>der · die · das <span class="small muted">(${np.length} Nomen)</span></h2><div class="grid">
      ${tile('quiz', '🎯', 'Artikel-Quiz', 'Bild ansehen, Artikel tippen')}
      ${tile('sortieren', '🧺', 'Sortieren', 'Wörter in die richtige Kiste ziehen')}
      ${tile('kasten', '🗃️', 'Karteikasten', 'Jeden Tag ein bisschen', dueArt ? dueArt + ' fällig' : '')}
      ${tile('mehrzahl', '👯', 'Mehrzahl', 'ein Hund – viele Hunde')}
      ${tile('rennen', '⏱️', 'Zeitrennen', '60 Sekunden – wie viele schaffst du?')}
      ${tile('fehler', '🩹', 'Fehlerwörter', 'Was noch schwer ist', fehlerN || '')}
    </div></div>
    <div class="section"><h2>Wörter lernen <span class="small muted">(${vp.length} Wörter)</span></h2><div class="grid">
      ${tile('hoeren', '🎧', 'Hören & Schreiben', 'Wort anhören und richtig schreiben')}
      ${tile('salat', '🔤', 'Buchstabensalat', 'Buchstaben ordnen')}
      ${tile('karten', '🃏', 'Lernkarten', 'Umdrehen und merken', dueVoc ? dueVoc + ' fällig' : '')}
      ${tile('liste', '📖', 'Wortliste', 'Alle Wörter anschauen und anhören')}
    </div></div>
    <div class="grid">
      ${tile('regeln', '💡', 'Merkregeln', 'Tricks für der, die, das')}
      ${tile('fortschritt', '📈', 'Mein Fortschritt', `⭐ ${P().stars} · 🔥 ${streak()} ${streak() === 1 ? 'Tag' : 'Tage'}`)}
      ${tile('profile', '👥', 'Profil wechseln', 'Wer übt gerade?')}
      ${tile('eltern', '🔒', 'Eltern', 'Statistik, Export, Verwaltung')}
    </div>`;
}

/* ---------- Router ---------- */
const ROUTES = {
  home, profile, einstellungen, eltern, fortschritt, regeln, liste, quellen,
  quiz: () => { setTitle('Artikel-Quiz'); const go2 = () => artikelRound(weakFirst(nounPool(), 'art', ST().runde), 'quiz', go2); go2(); },
  fehler: () => { setTitle('Fehlerwörter'); const go2 = () => artikelRound(errorWords(nounPool(), 'art').slice(0, ST().runde), 'fehler', go2); go2(); },
  kasten: kastenStart, sortieren, mehrzahl, rennen, hoeren, salat, karten,
};
function render() {
  RUN++;
  if (window.__stopTimer) { window.__stopTimer(); window.__stopTimer = null; }
  if (window.speechSynthesis) speechSynthesis.cancel();
  view.onclick = null;
  let r = (location.hash || '#home').slice(1);
  if (!S.current || !S.data[S.current]) { S.current = null; if (r !== 'profile') r = 'profile'; }
  if (S.current) { const d = P(); for (const k of ['art', 'voc', 'pl']) d[k] = d[k] || {}; $('#starCount').textContent = P().stars; applyColors(); }
  (ROUTES[r] || home)();
  window.scrollTo(0, 0);
}
$('#btnHome').onclick = () => go(S.current ? 'home' : 'profile');
window.addEventListener('hashchange', render);

fetch('words.json').then(r => r.json()).then(ws => {
  WORDS = ws; NOUNS = ws.filter(w => w.wortart === 'Nomen');
  ws.forEach(w => BYID[w.id] = w);
  render();
}).catch(() => { view.innerHTML = '<p>Wörter konnten nicht geladen werden. Bitte neu laden.</p>'; });

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => { }));
}
