let THRESHOLDS = [];

function gsrToColor(v) {
  return THRESHOLDS.find(t => v > t.min) || THRESHOLDS[THRESHOLDS.length - 1];
}

let allReadings = [];
let allAnnotations = [];
let allSessions = [];
let windowMinutes = 15;
let highlightedSession = null;
let timerInterval = null;
let recordingStart = null;

function setWindow(mins, btn) {
  windowMinutes = mins;
  document.querySelectorAll('.wbtn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

function annotate() {
  const input = document.getElementById('annotation-input');
  const label = input.value.trim();
  if (!label) return;
  fetch('/annotate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ label }) });
  input.value = '';
}

document.getElementById('annotation-input').addEventListener('keydown', e => { if (e.key === 'Enter') annotate(); });
document.getElementById('session-name').addEventListener('keydown', e => { if (e.key === 'Enter') toggleSession(); });

function toggleSession() {
  const nameInput = document.getElementById('session-name');
  const btn = document.getElementById('start-stop');
  const name = nameInput.value.trim();
  if (!recordingStart) {
    if (!name) { nameInput.focus(); return; }
    recordingStart = Date.now();
    fetch('/session/start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
    btn.textContent = '\u25A0 Stop Recording';
    btn.classList.add('recording');
    nameInput.disabled = true;
    timerInterval = setInterval(() => {
      const e = Math.floor((Date.now() - recordingStart) / 1000);
      document.getElementById('timer').textContent = 'Recording ' + Math.floor(e/60).toString().padStart(2,'0') + ':' + (e%60).toString().padStart(2,'0');
    }, 500);
  } else {
    recordingStart = null;
    fetch('/session/stop', { method: 'POST' });
    btn.textContent = '\u25B6 Start Recording';
    btn.classList.remove('recording');
    nameInput.disabled = false;
    nameInput.value = '';
    clearInterval(timerInterval);
    document.getElementById('timer').textContent = '';
  }
}

function exportData() {
  const summary = allSessions.map(s => ({
    name: s.name,
    duration_seconds: Math.round((s.endTime - s.startTime) / 1000),
    avg: s.avg, min: s.min, max: s.max, range: s.max - s.min,
    aura: gsrToColor(s.avg).label,
    readings: s.readings
  }));
  navigator.clipboard.writeText(JSON.stringify(summary, null, 2));
  document.getElementById('export-btn').textContent = 'Copied!';
  setTimeout(() => { document.getElementById('export-btn').textContent = 'Export Sessions to Clipboard'; }, 2000);
}

function drawSparkline(canvas, readings) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width = canvas.offsetWidth;
  const h = canvas.height = canvas.offsetHeight;
  ctx.clearRect(0, 0, w, h);
  if (readings.length < 2) return;
  const vals = readings.map(r => r.gsr);
  const min = Math.min(...vals), max = Math.max(...vals), range = max - min || 1;
  
  readings.forEach((r, i) => {
    if (i === 0) return;
    const prev = readings[i - 1];
    const x1 = ((i-1) / (readings.length-1)) * w;
    const x2 = (i / (readings.length-1)) * w;
    const y1 = h - ((prev.gsr - min) / range) * h;
    const y2 = h - ((r.gsr - min) / range) * h;
    ctx.strokeStyle = gsrToColor(r.gsr).hex;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  });
}

function renderSessions() {
  const list = document.getElementById('sessions-list');
  if (allSessions.length === 0) {
    list.innerHTML = '<div style="font-size:11px;color:#2a2a2a;">no sessions yet</div>';
    return;
  }
  list.innerHTML = allSessions.slice().reverse().map((s, i) => {
    const idx = allSessions.length - 1 - i;
    const dur = Math.round((s.endTime - s.startTime) / 1000);
    const durStr = Math.floor(dur/60) > 0 ? Math.floor(dur/60) + 'm ' + (dur%60) + 's' : dur + 's';
    const color = gsrToColor(s.avg);
    return '<div class="session-card ' + (highlightedSession === idx ? 'highlighted' : '') + '" onclick="highlightSession(' + idx + ')">' +
      '<div class="session-name-label">' + s.name + '</div>' +
      '<div class="session-aura"><span class="aura-dot" style="background:' + color.hex + '"></span><span style="color:' + color.hex + ';font-size:10px;">' + color.label + '</span></div>' +
      '<div class="session-stats"><span>' + durStr + '</span><span>avg ' + s.avg + '</span><span>min ' + s.min + '</span><span>max ' + s.max + '</span><span>range ' + (s.max - s.min) + '</span></div>' +
      '<canvas class="sparkline" id="spark-' + idx + '"></canvas>' +
      '</div>';
  }).join('');
  allSessions.forEach((s, idx) => {
    const c = document.getElementById('spark-' + idx);
    if (c) drawSparkline(c, s.readings);
  });
}

function highlightSession(idx) {
  highlightedSession = highlightedSession === idx ? null : idx;
}

function updateLegend(gsr) {
  const active = gsrToColor(gsr);
  THRESHOLDS.forEach(t => {
    const el = document.getElementById(t.legId);
    if (!el) return;
    el.classList.toggle('active-state', t.legId === active.legId);
  });
}

function draw() {
  const canvas = document.getElementById('chart');
  const ctx = canvas.getContext('2d');
  const w = canvas.width = canvas.offsetWidth;
  const h = canvas.height = canvas.offsetHeight;
  ctx.clearRect(0, 0, w, h);

  const now = Date.now();
  const cutoff = windowMinutes === 0 ? 0 : now - (windowMinutes * 60 * 1000);
  const readings = allReadings.filter(r => r.time >= cutoff);

  if (readings.length < 2) {
    ctx.fillStyle = '#222'; ctx.font = '12px monospace'; ctx.textAlign = 'center';
    ctx.fillText('waiting for data...', w/2, h/2);
    return;
  }

  const vals = readings.map(r => r.gsr);
  const dataMin = Math.min(...vals), dataMax = Math.max(...vals);
  const pad = Math.max((dataMax - dataMin) * 0.25, 100);
  const min = dataMin - pad, max = dataMax + pad;
  const L = 45, R = 10, T = 20, B = 20;
  const timeStart = readings[0].time, timeEnd = readings[readings.length-1].time;
  const timeSpan = timeEnd - timeStart || 1;
  const toX = t => L + ((t - timeStart) / timeSpan) * (w - L - R);
  const toY = v => T + (1 - (v - min) / (max - min)) * (h - T - B);

  THRESHOLDS.forEach(t => {
    const y1 = toY(Math.min(t.max === Infinity ? max + 200 : t.max, max + 200));
    const y2 = toY(Math.max(t.min, min - 200));
    if (y2 > y1 && y1 < h - B && y2 > T) {
      ctx.fillStyle = t.hex + '08';
      ctx.fillRect(L, Math.max(y1, T), w - L - R, Math.min(y2, h - B) - Math.max(y1, T));
    }
  });

  ctx.strokeStyle = '#1f1f1f'; ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const v = min + (i/4) * (max - min);
    const y = toY(v);
    ctx.beginPath(); ctx.moveTo(L, y); ctx.lineTo(w-R, y); ctx.stroke();
    ctx.fillStyle = '#2a2a2a'; ctx.font = '10px monospace'; ctx.textAlign = 'right';
    ctx.fillText(Math.round(v), L-4, y+3);
  }

  THRESHOLDS.forEach(t => {
    if (t.min === 0) return;
    const y = toY(t.min);
    if (y < T || y > h - B) return;
    ctx.strokeStyle = t.hex + '30';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 6]);
    ctx.beginPath(); ctx.moveTo(L, y); ctx.lineTo(w-R, y); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = t.hex + '60';
    ctx.font = '9px monospace'; ctx.textAlign = 'left';
    ctx.fillText(t.min, L + 2, y - 2);
  });

  if (highlightedSession !== null && allSessions[highlightedSession]) {
    const s = allSessions[highlightedSession];
    const x1 = toX(s.startTime), x2 = toX(s.endTime);
    ctx.fillStyle = '#ffffff08';
    ctx.fillRect(x1, T, x2-x1, h-T-B);
    ctx.strokeStyle = '#ffffff15'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x1, T); ctx.lineTo(x1, h-B); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x2, T); ctx.lineTo(x2, h-B); ctx.stroke();
    ctx.fillStyle = '#888'; ctx.font = '10px monospace'; ctx.textAlign = 'left';
    ctx.fillText(allSessions[highlightedSession].name, x1+4, T+12);
  }

  allAnnotations.filter(a => a.time >= timeStart && a.time <= timeEnd).forEach((a, idx) => {
    const x = toX(a.time);
    ctx.strokeStyle = '#a06800'; ctx.lineWidth = 1;
    ctx.setLineDash([3, 4]);
    ctx.beginPath(); ctx.moveTo(x, T); ctx.lineTo(x, h-B); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#a06800'; ctx.font = '10px monospace'; ctx.textAlign = 'left';
    ctx.fillText(a.label, Math.min(x+4, w-R-80), T + 10 + (idx % 3) * 13);
  });

  readings.forEach((r, i) => {
    if (i === 0) return;
    const prev = readings[i-1];
    ctx.strokeStyle = gsrToColor(r.gsr).hex;
    ctx.lineWidth = 1.5;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(toX(prev.time), toY(prev.gsr));
    ctx.lineTo(toX(r.time), toY(r.gsr));
    ctx.stroke();
  });

  const last = readings[readings.length-1];
  const lastColor = gsrToColor(last.gsr);
  ctx.fillStyle = lastColor.hex;
  ctx.beginPath(); ctx.arc(toX(last.time), toY(last.gsr), 4, 0, Math.PI*2); ctx.fill();

  ctx.fillStyle = '#2a2a2a'; ctx.textAlign = 'center'; ctx.font = '10px monospace';
  for (let i = 0; i <= 4; i++) {
    const t = new Date(timeStart + (i/4) * timeSpan);
    ctx.fillText(t.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',second:'2-digit'}), L + (i/4)*(w-L-R), h-4);
  }
}

async function poll() {
  try {
    const res = await fetch('/data');
    const data = await res.json();
    allReadings = data.readings;
    allAnnotations = data.annotations;
    allSessions = data.sessions;

    if (allReadings.length > 0) {
      const last = allReadings[allReadings.length-1];
      const color = gsrToColor(last.gsr);
      const valEl = document.getElementById('current-val');
      const labelEl = document.getElementById('current-label');
      valEl.textContent = last.gsr;
      valEl.style.color = color.hex;
      labelEl.textContent = color.label;
      labelEl.style.color = color.hex;
      document.getElementById('current-time').textContent = new Date(last.time).toLocaleTimeString();
      updateLegend(last.gsr);
    }

    const alist = document.getElementById('annotations-list');
    alist.innerHTML = allAnnotations.slice().reverse().slice(0,10).map(a =>
      '<div><span class="atime">' + new Date(a.time).toLocaleTimeString() + '</span><span class="alabel">' + a.label + '</span></div>'
    ).join('');

    renderSessions();
    draw();
  } catch(e) {}
  setTimeout(poll, 500);
}

async function init() {
  try {
    const res = await fetch('/config');
    const cfg = await res.json();

    // Map your config.json keys to the UI threshold structure
    THRESHOLDS = [
      { min: cfg.blue,   max: Infinity, hex: '#4a9eff', label: 'blue — very calm',    legId: 'leg-blue'   },
      { min: cfg.teal,   max: cfg.blue, hex: '#00cfcf', label: 'teal — relaxed',      legId: 'leg-teal'   },
      { min: cfg.green,  max: cfg.teal, hex: '#4caf50', label: 'green — engaged',     legId: 'leg-green'  },
      { min: cfg.yellow, max: cfg.green,hex: '#f0c040', label: 'yellow — active',     legId: 'leg-yellow' },
      { min: cfg.orange, max: cfg.yellow,hex: '#f07820', label: 'orange — exerting',   legId: 'leg-orange' },
      { min: 0,          max: cfg.orange,hex: '#e03030', label: 'red — peak exertion', legId: 'leg-red'    },
    ];

    console.log("Config loaded from server.");
    poll(); // Start polling only after config is ready
  } catch (e) {
    console.error("Failed to load config, using defaults.");
    // Fallback logic here if needed
  }
}

(async () => {
  await init();
  poll();
})();