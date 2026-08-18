// Assembles build/demo.html from the manifest, the screenshots and the narration.
//
//   node build-player.mjs
//
// The result is a single page that plays the walkthrough end to end, or lets a presenter
// jump to any act and talk over it themselves. It reads shots/ and audio/ relative to
// itself, so the whole build folder is the deliverable — open it, zip it or host it.
// Fully product-agnostic: the title, subtitle and opening disclaimer shown on the gate card
// are read from the manifest (set via TITLE/SUBTITLE/DISCLAIMER exports in your scenes file),
// not hardcoded here.

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'build');

const page = (data) => {
const esc = (s) => String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(data.title || 'Guided walkthrough')}</title>
<style>
  :root {
    --bg: #0b0d12; --panel: #141824; --line: #242a3a;
    --ink: #e8ecf6; --dim: #8b93a7; --accent: #7c8cff; --accent2: #5b6ee0;
  }
  * { box-sizing: border-box; }
  html, body { height: 100%; }
  body {
    margin: 0; background: var(--bg); color: var(--ink);
    font: 15px/1.55 "Segoe UI", system-ui, -apple-system, sans-serif;
    overflow: hidden;
  }

  /* ── opening card ─────────────────────────────────────────────── */
  #gate {
    position: fixed; inset: 0; z-index: 90; display: grid; place-items: center;
    background: radial-gradient(1200px 700px at 50% 35%, #1a2138 0%, var(--bg) 70%);
    text-align: center; padding: 32px;
  }
  #gate .card { max-width: 640px; }
  #gate .mark {
    width: 62px; height: 62px; border-radius: 16px; margin: 0 auto 22px;
    background: linear-gradient(140deg, var(--accent), var(--accent2));
    display: grid; place-items: center; font-size: 28px; color: #fff;
  }
  #gate h1 { font-size: 34px; margin: 0 0 10px; letter-spacing: -0.4px; }
  #gate p { color: var(--dim); margin: 0 0 8px; font-size: 16px; }
  #gate .meta { font-size: 13px; color: #6b7288; margin-top: 20px; }
  .btn {
    appearance: none; border: 1px solid var(--line); background: var(--panel);
    color: var(--ink); border-radius: 9px; padding: 9px 15px; font-size: 14px;
    cursor: pointer; font-family: inherit;
  }
  .btn:hover { border-color: var(--accent); }
  .btn.primary {
    background: linear-gradient(140deg, var(--accent), var(--accent2));
    border-color: transparent; color: #fff; font-weight: 600;
    padding: 13px 30px; font-size: 16px; margin-top: 26px;
  }

  /* ── stage ────────────────────────────────────────────────────── */
  #stage {
    position: absolute; inset: 0 0 96px 0; display: grid; place-items: center;
    padding: 22px 22px 8px;
  }
  #frame {
    position: relative; border-radius: 12px; overflow: hidden;
    border: 1px solid var(--line); box-shadow: 0 30px 90px rgba(0,0,0,.6);
    background: #000; line-height: 0;
  }
  #frame img { display: block; width: 100%; height: 100%; object-fit: contain; }
  #frame.swap img { opacity: 0; transition: opacity .28s ease; }

  /* the region being talked about */
  #spot {
    position: absolute; border: 2px solid rgba(124,140,255,.9); border-radius: 8px;
    box-shadow: 0 0 0 4000px rgba(6,8,14,.52), 0 0 26px rgba(124,140,255,.5);
    pointer-events: none; opacity: 0; transition: opacity .5s ease, all .5s ease;
  }
  #spot.on { opacity: 1; }

  /* the cursor that presses the control leading to the next scene */
  #cursor {
    position: absolute; width: 22px; height: 22px; margin: -11px 0 0 -11px;
    pointer-events: none; opacity: 0; transition: opacity .25s ease;
    transform: translate(-50%, -50%);
  }
  #cursor svg { filter: drop-shadow(0 2px 4px rgba(0,0,0,.8)); }
  #cursor.on { opacity: 1; }
  #ping {
    position: absolute; width: 26px; height: 26px; margin: -13px 0 0 -13px;
    border: 2px solid var(--accent); border-radius: 50%; opacity: 0; pointer-events: none;
  }
  #ping.go { animation: ping .55s ease-out; }
  @keyframes ping {
    from { opacity: .95; transform: scale(.35); }
    to   { opacity: 0;   transform: scale(2.6); }
  }

  /* ── captions ─────────────────────────────────────────────────── */
  #caption {
    position: absolute; left: 50%; transform: translateX(-50%); bottom: 108px;
    max-width: min(1100px, 88vw); background: rgba(9,11,18,.9);
    border: 1px solid var(--line); border-radius: 11px; padding: 13px 20px;
    font-size: 16px; line-height: 1.5; text-align: center; z-index: 20;
    backdrop-filter: blur(8px);
  }
  #caption.off { display: none; }

  /* ── transport ────────────────────────────────────────────────── */
  #bar {
    position: absolute; left: 0; right: 0; bottom: 0; height: 96px;
    background: linear-gradient(180deg, rgba(11,13,18,0), #0b0d12 42%);
    display: flex; flex-direction: column; justify-content: flex-end;
    padding: 0 20px 14px; gap: 10px; z-index: 30;
  }
  #track { display: flex; gap: 3px; align-items: flex-end; height: 20px; }
  #track .seg {
    flex: 1; height: 5px; background: #222839; border-radius: 3px;
    cursor: pointer; position: relative; transition: height .15s ease;
  }
  #track .seg:hover { height: 11px; }
  #track .seg.done { background: #3b4666; }
  #track .seg.now { background: var(--accent); height: 11px; }
  #track .seg .fill {
    position: absolute; inset: 0 auto 0 0; width: 0; background: #fff;
    border-radius: 3px; opacity: .55;
  }
  #controls { display: flex; align-items: center; gap: 12px; }
  #controls .sp { flex: 1; }
  #now { font-size: 13px; color: var(--dim); }
  #now b { color: var(--ink); font-weight: 600; }
  .icon {
    width: 38px; height: 38px; display: grid; place-items: center; padding: 0;
    font-size: 15px; border-radius: 50%;
  }
  #play { width: 46px; height: 46px; font-size: 17px; }

  /* ── scene index ──────────────────────────────────────────────── */
  #index {
    position: absolute; top: 0; right: 0; bottom: 0; width: 380px; z-index: 40;
    background: #0e1119; border-left: 1px solid var(--line);
    transform: translateX(100%); transition: transform .28s ease;
    display: flex; flex-direction: column;
  }
  #index.open { transform: none; }
  #indexHead {
    display: flex; align-items: center; justify-content: space-between; flex: none;
    padding: 16px 14px 16px 18px; border-bottom: 1px solid var(--line);
  }
  #indexHead span { font-size: 13px; text-transform: uppercase; letter-spacing: .09em;
                    color: var(--dim); font-weight: 600; }
  #indexList { overflow: auto; padding: 10px 18px 18px; }
  #index h2 { font-size: 13px; text-transform: uppercase; letter-spacing: .09em;
              color: var(--dim); margin: 22px 0 9px; font-weight: 600; }
  #index h2:first-child { margin-top: 0; }
  #index .row {
    padding: 9px 11px; border-radius: 8px; cursor: pointer; font-size: 14px;
    display: flex; gap: 10px; align-items: baseline;
  }
  #index .row:hover { background: #171c29; }
  #index .row.now { background: #1d2438; color: #fff; }
  #index .row .n { color: var(--dim); font-variant-numeric: tabular-nums; font-size: 12px; }
  #index .row .seat { margin-left: auto; font-size: 11px; color: var(--dim); }

  #missing { position: absolute; inset: 0; display: grid; place-items: center;
             color: var(--dim); font-size: 15px; text-align: center; padding: 40px; }
</style>
</head>
<body>

<div id="gate">
  <div class="card">
    <div class="mark">◆</div>
    <h1>${esc(data.title || 'Guided walkthrough')}</h1>
    <p>${esc(data.subtitle || '')}</p>
    <p style="font-size:14px">${esc(data.disclaimer || '')}</p>
    <button class="btn primary" id="begin">Begin the walkthrough</button>
    <div class="meta" id="gateMeta"></div>
  </div>
</div>

<div id="stage">
  <div id="frame">
    <img id="shot" alt="">
    <div id="spot"></div>
    <div id="ping"></div>
    <div id="cursor"><svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <path d="M3 2l14 6.5-6 1.6-2.2 6.2L3 2z" fill="#fff" stroke="#1a1f2e" stroke-width="1.2"
            stroke-linejoin="round"/></svg></div>
    <div id="missing" hidden></div>
  </div>
</div>

<div id="caption" class="off"></div>

<div id="bar">
  <div id="track"></div>
  <div id="controls">
    <button class="btn icon" id="prev" title="Previous scene (←)">◀</button>
    <button class="btn icon" id="play" title="Play or pause (space)">▶</button>
    <button class="btn icon" id="next" title="Next scene (→)">▶▶</button>
    <div id="now"></div>
    <div class="sp"></div>
    <button class="btn" id="cc" title="Captions (c)">Captions</button>
    <button class="btn" id="toc" title="Scenes (s)">Scenes</button>
  </div>
</div>

<div id="index">
  <div id="indexHead"><span>Scenes</span><button class="btn icon" id="indexClose" title="Close (Esc)">×</button></div>
  <div id="indexList"></div>
</div>

<audio id="vo" preload="auto"></audio>

<script>
const DATA = ${JSON.stringify(data)};
const VW = DATA.viewport.width, VH = DATA.viewport.height;
const S = DATA.scenes;

const $ = (id) => document.getElementById(id);
const frame = $('frame'), shot = $('shot'), spot = $('spot'), cursor = $('cursor');
const ping = $('ping'), vo = $('vo'), caption = $('caption'), track = $('track');
const missing = $('missing');

let i = 0, playing = false, advanceTimer = null, triedAlt = false;

/* Keep the frame at the exact aspect of the capture so the overlay maths stay true. */
function fit() {
  const st = $('stage');
  const availW = st.clientWidth - 44, availH = st.clientHeight - 30;
  const scale = Math.min(availW / VW, availH / VH);
  frame.style.width = Math.floor(VW * scale) + 'px';
  frame.style.height = Math.floor(VH * scale) + 'px';
}
addEventListener('resize', fit);

function place(el, r, pad = 6) {
  if (!r) { el.classList.remove('on'); return null; }
  const pc = (v, total) => (v / total) * 100 + '%';
  el.style.left = pc(r.x - pad, VW);
  el.style.top = pc(r.y - pad, VH);
  el.style.width = pc(r.w + pad * 2, VW);
  el.style.height = pc(r.h + pad * 2, VH);
  el.classList.add('on');
  return r;
}

function buildTrack() {
  track.innerHTML = '';
  S.forEach((s, n) => {
    const d = document.createElement('div');
    d.className = 'seg';
    d.title = 'Act ' + s.act + ' — ' + s.title;
    d.innerHTML = '<div class="fill"></div>';
    d.onclick = () => go(n);
    track.appendChild(d);
  });
}

function buildIndex() {
  const el = $('indexList');
  el.innerHTML = '';
  let act = null;
  S.forEach((s, n) => {
    if (s.act !== act) {
      act = s.act;
      const h = document.createElement('h2');
      const a = DATA.acts.find((x) => x.n === act);
      h.textContent = act === 0 ? (a ? a.title : 'Opening') : 'Act ' + act + ' · ' + (a ? a.title : '');
      el.appendChild(h);
    }
    const r = document.createElement('div');
    r.className = 'row';
    r.dataset.n = n;
    r.innerHTML = '<span class="n">' + String(n + 1).padStart(2, '0') + '</span>'
      + '<span>' + s.title + '</span>'
      + '<span class="seat">' + (s.actor || '') + '</span>';
    r.onclick = () => { go(n); $('index').classList.remove('open'); };
    el.appendChild(r);
  });
}

function paintChrome() {
  [...track.children].forEach((c, n) => {
    c.className = 'seg' + (n < i ? ' done' : n === i ? ' now' : '');
    if (n !== i) c.querySelector('.fill').style.width = n < i ? '100%' : '0';
  });
  [...$('indexList').querySelectorAll('.row')].forEach((r) => {
    r.classList.toggle('now', Number(r.dataset.n) === i);
  });
  const s = S[i];
  const a = DATA.acts.find((x) => x.n === s.act);
  $('now').innerHTML = (s.act === 0 ? 'Opening' : 'Act ' + s.act)
    + ' · <b>' + s.title + '</b> <span style="opacity:.6">'
    + (i + 1) + ' of ' + S.length + '</span>';
  document.title = s.title;
}

function go(n, autoplay = playing) {
  clearTimeout(advanceTimer);
  i = Math.max(0, Math.min(S.length - 1, n));
  const s = S[i];

  cursor.classList.remove('on');
  spot.classList.remove('on');

  if (s.image) {
    missing.hidden = true;
    shot.style.display = '';
    shot.src = s.image;
  } else {
    shot.style.display = 'none';
    missing.hidden = false;
    missing.textContent = 'This scene did not capture. Re-run: node capture.mjs '
      + i + (s.error ? '  (' + s.error + ')' : '');
  }

  caption.textContent = s.say;
  setTimeout(() => place(spot, s.spotlight, 8), 260);
  paintChrome();

  vo.pause();
  if (s.audio) {
    if (vo.getAttribute('src') !== s.audio) { triedAlt = false; vo.src = s.audio; }
    vo.currentTime = 0;
    if (autoplay) vo.play().catch(() => {});
  } else if (autoplay) {
    // No narration for this scene — hold on it long enough to read, then move on.
    advanceTimer = setTimeout(nextAuto, Math.max(4000, s.say.length * 45));
  }
}

/* Move the pointer onto the control this scene ends by pressing, then advance. */
function pressThenAdvance() {
  const s = S[i];
  const r = s.click;
  if (!r || i >= S.length - 1) return nextAuto();

  cursor.style.transition = 'none';
  cursor.style.left = '50%';
  cursor.style.top = '78%';
  cursor.classList.add('on');
  requestAnimationFrame(() => {
    cursor.style.transition = 'left .85s cubic-bezier(.4,0,.2,1), top .85s cubic-bezier(.4,0,.2,1), opacity .25s';
    cursor.style.left = ((r.x + r.w / 2) / VW) * 100 + '%';
    cursor.style.top = ((r.y + r.h / 2) / VH) * 100 + '%';
  });
  advanceTimer = setTimeout(() => {
    ping.style.left = ((r.x + r.w / 2) / VW) * 100 + '%';
    ping.style.top = ((r.y + r.h / 2) / VH) * 100 + '%';
    ping.classList.remove('go');
    void ping.offsetWidth;
    ping.classList.add('go');
    advanceTimer = setTimeout(nextAuto, 620);
  }, 900);
}

function nextAuto() {
  if (i >= S.length - 1) { setPlaying(false); return; }
  go(i + 1, playing);
}

function setPlaying(on) {
  playing = on;
  $('play').textContent = on ? '❚❚' : '▶';
  if (!on) { vo.pause(); clearTimeout(advanceTimer); }
  else if (vo.src) vo.play().catch(() => {});
}

vo.addEventListener('ended', pressThenAdvance);

/* Chromium built without proprietary codecs cannot decode MP3, and reports canPlayType as
   "probably" before failing — so a <source> list would pick the MP3 and never fall back.
   Switch to the Opus copy only once decoding has actually failed. */
vo.addEventListener('error', () => {
  const s = S[i];
  if (triedAlt || !s.audioAlt) return;
  triedAlt = true;
  vo.src = s.audioAlt;
  vo.currentTime = 0;
  if (playing) vo.play().catch(() => {});
});

vo.addEventListener('timeupdate', () => {
  const total = Number.isFinite(vo.duration) && vo.duration > 0 ? vo.duration : S[i].seconds;
  if (!total) return;
  const seg = track.children[i];
  if (seg) seg.querySelector('.fill').style.width =
    Math.min(100, (vo.currentTime / total) * 100) + '%';
});

$('play').onclick = () => setPlaying(!playing);
$('next').onclick = () => go(i + 1, playing);
$('prev').onclick = () => go(i - 1, playing);
$('toc').onclick = () => $('index').classList.toggle('open');
$('indexClose').onclick = () => $('index').classList.remove('open');
$('cc').onclick = () => caption.classList.toggle('off');

addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  if (e.key === ' ') { e.preventDefault(); setPlaying(!playing); }
  if (e.key === 'ArrowRight') go(i + 1, playing);
  if (e.key === 'ArrowLeft') go(i - 1, playing);
  if (e.key === 'c') caption.classList.toggle('off');
  if (e.key === 's') $('index').classList.toggle('open');
  if (e.key === 'Escape') $('index').classList.remove('open');
});

$('gateMeta').textContent = S.length + ' scenes · narrated by '
  + (DATA.voice || 'Azure AI Speech')
  + ' · captured ' + new Date(DATA.capturedAt).toLocaleDateString('en-GB',
      { day: 'numeric', month: 'long', year: 'numeric' });

$('begin').onclick = () => {
  $('gate').remove();
  fit();
  // Start the scene from inside the click, and set the source exactly once: assigning
  // src again after play() aborts the load and the narration never begins.
  playing = true;
  $('play').textContent = '\u275a\u275a';
  go(0, true);
};

buildTrack();
buildIndex();
fit();
go(0, false);
</script>
</body>
</html>
`;
};

async function main() {
  const arg = (flag, fallback) => {
    const i = process.argv.indexOf(flag);
    return i > -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')
      ? process.argv[i + 1] : fallback;
  };
  const manifestName = arg('--manifest', 'scenes.json');
  const outName = arg('--out', 'demo.html');

  const data = JSON.parse(await readFile(path.join(OUT, manifestName), 'utf8'));
  const html = page(data);
  const out = path.join(OUT, outName);
  await writeFile(out, html, 'utf8');
  const withShot = data.scenes.filter((s) => s.image).length;
  const withAudio = data.scenes.filter((s) => s.audio).length;
  console.log(`${outName} written — ${data.scenes.length} scenes, ${withShot} captured, ${withAudio} narrated`);
  console.log(out);
}

main();
