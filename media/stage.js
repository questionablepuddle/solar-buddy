'use strict';
/*
  The stage script. It runs inside the webview (a little sandboxed browser page) and never
  touches VS Code directly — it only sends and receives messages. The flow is:

      extension.js  --postMessage({scene})-->  here        (what's true now)
      here          --postMessage({nextStep})->  extension.js (a button was clicked)

  Everything visual is driven by one `scene` object from logic.planScene(). Read render()
  first; it is the whole program in one function. The rest is making buddies move nicely.
*/
const vscode = acquireVsCodeApi();

const $ = (sel) => document.querySelector(sel);
const field = $('#field');
const template = $('#sprout-template');
let live = 1;
let buddies = [];
let lastErrorSignature = '';

// ------------------------------------------------------------------ a single buddy
class Buddy {
  constructor() {
    this.el = template.content.firstElementChild.cloneNode(true);
    this.tag = this.el.querySelector('.tag');
    field.appendChild(this.el);
  }
  setState(cls) {
    this.el.className = 'buddy ' + cls;
  }
  // move to a fraction (0..1) across the field; `how` is the animation to play on the way
  moveTo(fraction, how) {
    const x = 6 + fraction * 88; // keep a margin so nobody runs off the edge
    if (how) this.setState(how);
    this.el.style.left = x + '%';
  }
  perch(label) {
    if (label) {
      this.tag.textContent = label;
      this.tag.hidden = false;
    }
  }
  remove() {
    this.el.remove();
  }
  onClick(fn) {
    this.el.addEventListener('click', fn);
  }
}

function clearBuddies() {
  buddies.forEach((b) => b.remove());
  buddies = [];
}

// ------------------------------------------------------------------ the card (speech + quest + errors)
function showSay(text) {
  $('#say').textContent = text || '';
}
function showQuest(scene) {
  $('#errorlist').hidden = true;
  const q = $('#quest');
  if (!scene.step) {
    q.hidden = true;
    return;
  }
  q.hidden = false;
  $('#quest-title').textContent = scene.quest || '';
  $('#quest-count').textContent = `step ${scene.stepNumber} / ${scene.stepCount}`;
  $('#bar-fill').style.width = Math.round((scene.progress || 0) * 100) + '%';
  $('#step-title').textContent = scene.step.title || '';
  $('#step-what').textContent = scene.step.what || '';
  $('#step-why').textContent = scene.step.why ? 'Why: ' + scene.step.why : '';
  const hint = $('#step-hint');
  hint.textContent = scene.step.hint ? '💡 ' + scene.step.hint : '';
  hint.hidden = !scene.step.hint;
}
function showErrors(scene) {
  $('#quest').hidden = true;
  const list = $('#errorlist');
  list.innerHTML = '';
  scene.perches.forEach((p, i) => {
    const li = document.createElement('li');
    li.innerHTML = `<span class="ln">line ${p.line + 1}</span>${escapeHtml(p.message)}`;
    li.addEventListener('click', () => {
      showSay(p.tip);
      bounce(buddies[i]);
    });
    list.appendChild(li);
  });
  list.hidden = false;
}

// ------------------------------------------------------------------ the code strip (real error lines)
function showCodeStrip(perches) {
  const strip = $('#codestrip');
  strip.innerHTML = '';
  const seen = new Set();
  for (const p of perches) {
    if (seen.has(p.line) || !p.text) continue;
    seen.add(p.line);
    const row = document.createElement('div');
    row.className = 'codeline';
    // highlight the token the error points at, so there is a real letter to run to
    const text = p.text;
    const start = Math.min(p.column, text.length);
    const end = Math.min(start + Math.max(1, (p.endColumn || start + 1) - start), text.length) || start + 1;
    row.innerHTML =
      escapeHtml(text.slice(0, start)) +
      `<span class="hit">${escapeHtml(text.slice(start, end) || ' ')}</span>` +
      escapeHtml(text.slice(end));
    strip.appendChild(row);
  }
  strip.hidden = seen.size === 0;
}

// ------------------------------------------------------------------ render a scene
function render(scene) {
  showSay(scene.say);

  if (scene.mood === 'concentrate' && scene.perches && scene.perches.length) {
    renderErrors(scene);
  } else {
    // peaceful: one buddy in the meadow, show the quest step
    $('#codestrip').hidden = true;
    const signature = 'idle';
    if (lastErrorSignature !== signature) {
      clearBuddies();
      const b = new Buddy();
      b.moveTo(0.5, scene.mood === 'celebrate' ? 'happy idle' : 'idle');
      b.onClick(() => bounce(b));
      buddies = [b];
      lastErrorSignature = signature;
    } else {
      buddies[0] && buddies[0].setState(scene.mood === 'celebrate' ? 'happy idle' : 'idle');
    }
    if (scene.mood === 'celebrate') celebrate();
    showQuest(scene);
  }
}

/** The headline move: concentrate, then multiply to one buddy per error and run each to its line. */
function renderErrors(scene) {
  showCodeStrip(scene.perches);
  showErrors(scene);

  const signature = scene.perches.map((p) => p.line + ':' + p.column).join('|');
  if (signature === lastErrorSignature) return; // same errors as last time: don't restart the dance
  lastErrorSignature = signature;
  clearBuddies();

  const n = scene.perches.length;
  // one buddy appears in the middle and concentrates...
  const lead = new Buddy();
  lead.moveTo(0.5, 'concentrate');
  buddies.push(lead);

  // ...then, a beat later, it multiplies: each error gets its own buddy, who runs to its spot.
  const spread = (i) => (n === 1 ? 0.5 : 0.08 + (0.84 * i) / (n - 1));
  setTimeout(() => {
    scene.perches.forEach((p, i) => {
      const b = i === 0 ? lead : spawnFrom(lead);
      const dir = spread(i) < 0.5 ? 'flip' : '';
      b.moveTo(spread(i), 'run ' + dir);
      b.onClick(() => {
        showSay(p.tip);
        bounce(b);
      });
      // when it arrives, settle into concentrating on its line
      setTimeout(() => {
        b.setState('concentrate');
        b.perch('line ' + (p.line + 1));
      }, 900);
      buddies.push(b);
    });
  }, 650 / live);
}

function spawnFrom(lead) {
  const b = new Buddy();
  b.el.style.left = lead.el.style.left || '50%';
  // let the browser apply the start position before we animate, or it teleports
  void b.el.offsetWidth;
  return b;
}

function bounce(b) {
  if (!b) return;
  b.el.animate(
    [{ transform: 'translateY(0)' }, { transform: 'translateY(-14px)' }, { transform: 'translateY(0)' }],
    { duration: 420, easing: 'ease-out' }
  );
}

function celebrate() {
  for (let i = 0; i < 14; i++) {
    const leaf = document.createElement('div');
    leaf.className = 'mote';
    leaf.style.left = Math.random() * 100 + '%';
    leaf.style.top = '-10px';
    leaf.style.background = ['#9adb84', '#ffd36b', '#6cbf79'][i % 3];
    leaf.style.animation = `fall ${1.4 + Math.random()}s ease-in forwards`;
    $('#motes').appendChild(leaf);
    setTimeout(() => leaf.remove(), 2600);
  }
}

// ------------------------------------------------------------------ odds and ends
function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

// floating pollen motes, just for atmosphere
function seedMotes() {
  const motes = $('#motes');
  for (let i = 0; i < 12; i++) {
    const m = document.createElement('div');
    m.className = 'mote';
    m.style.left = Math.random() * 100 + '%';
    m.style.bottom = '-10px';
    m.style.animationDuration = 8 + Math.random() * 10 + 's';
    m.style.animationDelay = -Math.random() * 10 + 's';
    motes.appendChild(m);
  }
  // a keyframe for the celebrate leaves (defined here so the CSS file stays about the scene)
  const style = document.createElement('style');
  style.textContent = '@keyframes fall { to { transform: translateY(120vh) rotate(260deg); opacity: 0.2; } }';
  document.head.appendChild(style);
}

// buttons inside the panel talk back to the extension
$('#btn-next').addEventListener('click', () => vscode.postMessage({ type: 'nextStep' }));
$('#btn-checks').addEventListener('click', () => vscode.postMessage({ type: 'runChecks' }));

window.addEventListener('message', (e) => {
  const msg = e.data;
  if (msg.type !== 'scene') return;
  live = Math.max(0.2, msg.liveliness || 1);
  document.documentElement.style.setProperty('--live', live);
  render(msg.scene);
});

seedMotes();
vscode.postMessage({ type: 'ready' }); // tell the extension we're up, so it sends the first scene
