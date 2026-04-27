const http = require('http');

const readings = [];
const annotations = [];
const sessions = [];
let activeSession = null;

function gsrToColor(gsrValue) {
  if (gsrValue > 1800)      return { hex: '#4a9eff', label: 'blue — very calm' };
  else if (gsrValue > 1500) return { hex: '#00cfcf', label: 'teal — relaxed' };
  else if (gsrValue > 1300) return { hex: '#4caf50', label: 'green — engaged' };
  else if (gsrValue > 1100) return { hex: '#f0c040', label: 'yellow — active' };
  else if (gsrValue > 800)  return { hex: '#f07820', label: 'orange — exerting' };
  else                       return { hex: '#e03030', label: 'red — peak exertion' };
}

const html = `<!DOCTYPE html>
<html>
<head>
  <title>GSR Monitor</title>
  <style>
    * { box-sizing: border-box; }
    body { background: #0f0f0f; color: #eee; font-family: monospace; margin: 0; padding: 20px; }
    h1 { color: #555; font-size: 12px; font-weight: normal; margin: 0 0 16px 0; letter-spacing: 0.08em; text-transform: uppercase; }

    #layout { display: grid; grid-template-columns: 1fr 280px; gap: 16px; }
    #left { display: flex; flex-direction: column; gap: 12px; }
    #right { display: flex; flex-direction: column; gap: 12px; }

    #chart { width: 100%; height: 300px; background: #1a1a1a; border-radius: 8px; display: block; }

    .panel { background: #1a1a1a; border-radius: 8px; padding: 14px; }
    .panel-title { font-size: 10px; color: #444; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 12px; }

    #window-controls { display: flex; gap: 6px; }
    .wbtn { background: #111; border: 1px solid #2a2a2a; color: #555; padding: 5px 10px; border-radius: 4px; cursor: pointer; font-family: monospace; font-size: 11px; }
    .wbtn:hover { color: #aaa; }
    .wbtn.active { border-color: #4a9eff; color: #4a9eff; }

    #current-val { font-size: 28px; margin: 4px 0; transition: color 0.5s; }
    #current-label { font-size: 11px; color: #444; margin-bottom: 4px; min-height: 16px; transition: color 0.5s; }
    #current-time { font-size: 11px; color: #333; }

    #aura-legend { display: flex; flex-direction: column; gap: 5px; margin-top: 4px; }
    .legend-row { display: flex; align-items: center; gap: 8px; font-size: 10px; color: #444; }
    .legend-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
    .legend-row.active-state { color: #aaa; }

    #session-name { width: 100%; background: #111; border: 1px solid #2a2a2a; color: #eee; padding: 8px 10px; border-radius: 6px; font-family: monospace; font-size: 12px; outline: none; margin-bottom: 8px; }
    #session-name:focus { border-color: #333; }
    #session-name:disabled { color: #555; }

    #start-stop { width: 100%; padding: 10px; border-radius: 6px; border: none; font-family: monospace; font-size: 13px; cursor: pointer; font-weight: bold; background: #1e3a1e; color: #4caf50; transition: all 0.2s; }
    #start-stop.recording { background: #3a1e1e; color: #f44336; }

    #timer { font-size: 11px; color: #444; margin-top: 8px; text-align: center; min-height: 16px; }

    #sessions-list { display: flex; flex-direction: column; gap: 8px; max-height: 400px; overflow-y: auto; }
    .session-card { background: #111; border-radius: 6px; padding: 10px 12px; border: 1px solid #222; cursor: pointer; transition: border-color 0.15s; }
    .session-card:hover { border-color: #333; }
    .session-card.highlighted { border-color: #4a9eff44; }
    .session-name-label { font-size: 12px; color: #ccc; margin-bottom: 4px; }
    .session-stats { font-size: 10px; color: #444; display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 6px; }
    .session-stats span { color: #666; }
    .session-aura { font-size: 10px; margin-bottom: 6px; display: flex; align-items: center; gap: 6px; }
    .aura-dot { width: 8px; height: 8px; border-radius: 50%; }
    canvas.sparkline { width: 100%; height: 32px; display: block; }

    #export-btn { width: 100%; padding: 8px; border-radius: 6px; border: 1px solid #2a2a2a; background: #111; color: #555; font-family: monospace; font-size: 11px; cursor: pointer; }
    #export-btn:hover { color: #aaa; border-color: #444; }

    #annotation-row { display: flex; gap: 8px; }
    #annotation-input { flex: 1; background: #111; border: 1px solid #2a2a2a; color: #eee; padding: 7px 10px; border-radius: 6px; font-family: monospace; font-size: 12px; outline: none; }
    #annotation-input:focus { border-color: #333; }
    .abtn { background: #111; border: 1px solid #2a2a2a; color: #555; padding: 7px 12px; border-radius: 6px; cursor: pointer; font-family: monospace; font-size: 12px; }
    .abtn:hover { color: #aaa; }

    #annotations-list { max-height: 120px; overflow-y: auto; margin-top: 8px; }
    #annotations-list div { font-size: 11px; color: #444; padding: 3px 0; border-bottom: 1px solid #1f1f1f; display: flex; gap: 10px; }
    #annotations-list .atime { color: #2a2a2a; min-width: 70px; }
    #annotations-list .alabel { color: #555; }

    ::-webkit-scrollbar { width: 4px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: #2a2a2a; border-radius: 2px; }
  </style>
</head>
<body>
  <h1>Biometric Aura Chronometer &mdash; GSR Monitor</h1>
  <div id="layout">
    <div id="left">
      <canvas id="chart"></canvas>
      <div class="panel">
        <div class="panel-title">Time Window</div>
        <div id="window-controls">
          <button class="wbtn" onclick="setWindow(2,this)">2m</button>
          <button class="wbtn" onclick="setWindow(5,this)">5m</button>
          <button class="wbtn active" onclick="setWindow(15,this)">15m</button>
          <button class="wbtn" onclick="setWindow(30,this)">30m</button>
          <button class="wbtn" onclick="setWindow(0,this)">all</button>
        </div>
      </div>
      <div class="panel">
        <div class="panel-title">Quick Annotation</div>
        <div id="annotation-row">
          <input id="annotation-input" type="text" placeholder="mark this moment..."/>
          <button class="abtn" onclick="annotate()">Mark</button>
        </div>
        <div id="annotations-list"></div>
      </div>
    </div>

    <div id="right">
      <div class="panel">
        <div class="panel-title">Live</div>
        <div id="current-val">--</div>
        <div id="current-label">&nbsp;</div>
        <div id="current-time">waiting...</div>
        <div id="aura-legend" style="margin-top:12px;">
          <div class="legend-row" id="leg-blue"><span class="legend-dot" style="background:#4a9eff"></span>blue &mdash; very calm (&gt;1800)</div>
          <div class="legend-row" id="leg-teal"><span class="legend-dot" style="background:#00cfcf"></span>teal &mdash; relaxed (1500&ndash;1800)</div>
          <div class="legend-row" id="leg-green"><span class="legend-dot" style="background:#4caf50"></span>green &mdash; engaged (1300&ndash;1500)</div>
          <div class="legend-row" id="leg-yellow"><span class="legend-dot" style="background:#f0c040"></span>yellow &mdash; active (1100&ndash;1300)</div>
          <div class="legend-row" id="leg-orange"><span class="legend-dot" style="background:#f07820"></span>orange &mdash; exerting (800&ndash;1100)</div>
          <div class="legend-row" id="leg-red"><span class="legend-dot" style="background:#e03030"></span>red &mdash; peak exertion (&lt;800)</div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-title">Record Session</div>
        <input id="session-name" type="text" placeholder="name this session..."/>
        <button id="start-stop" onclick="toggleSession()">&#9654; Start Recording</button>
        <div id="timer"></div>
      </div>

      <div class="panel" style="flex:1">
        <div class="panel-title">Sessions</div>
        <div id="sessions-list"></div>
      </div>

      <button id="export-btn" onclick="exportData()">Export Sessions to Clipboard</button>
    </div>
  </div>

  <script>
    const THRESHOLDS = [
      { min: 1800, max: Infinity, hex: '#4a9eff', label: 'blue — very calm',    legId: 'leg-blue'   },
      { min: 1500, max: 1800,     hex: '#00cfcf', label: 'teal — relaxed',      legId: 'leg-teal'   },
      { min: 1300, max: 1500,     hex: '#4caf50', label: 'green — engaged',     legId: 'leg-green'  },
      { min: 1100, max: 1300,     hex: '#f0c040', label: 'yellow — active',     legId: 'leg-yellow' },
      { min: 800,  max: 1100,     hex: '#f07820', label: 'orange — exerting',   legId: 'leg-orange' },
      { min: 0,    max: 800,      hex: '#e03030', label: 'red — peak exertion', legId: 'leg-red'    },
    ];

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
      
      // color segments based on threshold
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

      // threshold bands
      THRESHOLDS.forEach(t => {
        const y1 = toY(Math.min(t.max === Infinity ? max + 200 : t.max, max + 200));
        const y2 = toY(Math.max(t.min, min - 200));
        if (y2 > y1 && y1 < h - B && y2 > T) {
          ctx.fillStyle = t.hex + '08';
          ctx.fillRect(L, Math.max(y1, T), w - L - R, Math.min(y2, h - B) - Math.max(y1, T));
        }
      });

      // grid
      ctx.strokeStyle = '#1f1f1f'; ctx.lineWidth = 1;
      for (let i = 0; i <= 4; i++) {
        const v = min + (i/4) * (max - min);
        const y = toY(v);
        ctx.beginPath(); ctx.moveTo(L, y); ctx.lineTo(w-R, y); ctx.stroke();
        ctx.fillStyle = '#2a2a2a'; ctx.font = '10px monospace'; ctx.textAlign = 'right';
        ctx.fillText(Math.round(v), L-4, y+3);
      }

      // threshold lines
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

      // highlighted session band
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

      // annotations
      allAnnotations.filter(a => a.time >= timeStart && a.time <= timeEnd).forEach((a, idx) => {
        const x = toX(a.time);
        ctx.strokeStyle = '#a06800'; ctx.lineWidth = 1;
        ctx.setLineDash([3, 4]);
        ctx.beginPath(); ctx.moveTo(x, T); ctx.lineTo(x, h-B); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#a06800'; ctx.font = '10px monospace'; ctx.textAlign = 'left';
        ctx.fillText(a.label, Math.min(x+4, w-R-80), T + 10 + (idx % 3) * 13);
      });

      // GSR line colored by threshold
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

      // dot
      const last = readings[readings.length-1];
      const lastColor = gsrToColor(last.gsr);
      ctx.fillStyle = lastColor.hex;
      ctx.beginPath(); ctx.arc(toX(last.time), toY(last.gsr), 4, 0, Math.PI*2); ctx.fill();

      // time labels
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

    poll();
  </script>
</body>
</html>`;

const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);
  }
  else if (req.method === 'GET' && req.url === '/data') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ readings, annotations, sessions }));
  }
  else if (req.method === 'POST' && req.url === '/') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const reading = { gsr: data.gsr, time: Date.now() };
        readings.push(reading);
        if (readings.length > 20000) readings.shift();
        if (activeSession) {
          activeSession.readings.push(reading);
          activeSession.min = Math.min(activeSession.min, data.gsr);
          activeSession.max = Math.max(activeSession.max, data.gsr);
          activeSession.sum += data.gsr;
          activeSession.count++;
          activeSession.avg = Math.round(activeSession.sum / activeSession.count);
        }
      } catch(e) {}
      res.writeHead(200); res.end('ok');
    });
  }
  else if (req.method === 'POST' && req.url === '/annotate') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        annotations.push({ label: data.label, time: Date.now() });
        console.log('ANNOTATION: ' + data.label);
      } catch(e) {}
      res.writeHead(200); res.end('ok');
    });
  }
  else if (req.method === 'POST' && req.url === '/session/start') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        activeSession = { name: data.name, startTime: Date.now(), endTime: null, readings: [], min: Infinity, max: -Infinity, avg: 0, sum: 0, count: 0 };
        console.log('SESSION START: ' + data.name);
      } catch(e) {}
      res.writeHead(200); res.end('ok');
    });
  }
  else if (req.method === 'POST' && req.url === '/session/stop') {
    if (activeSession) {
      activeSession.endTime = Date.now();
      sessions.push(activeSession);
      console.log('SESSION STOP: ' + activeSession.name + ' avg=' + activeSession.avg);
      activeSession = null;
    }
    res.writeHead(200); res.end('ok');
  }
  else { res.writeHead(404); res.end(); }
});

server.listen(3000, () => console.log('GSR Monitor running at http://localhost:3000'));