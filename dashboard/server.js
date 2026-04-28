const express = require('express');
const path = require('path');
const app = express();

// Configuration
const VIBE_CONFIG = require('./config.json');

// Data Stores (Identical to your start point)
const readings = [];
const annotations = [];
const sessions = [];
let activeSession = null;

// Middleware to parse JSON (Standard in Express)
app.use(express.json());

// Serve static files from the 'public' directory
app.use(express.static('public'));

// --- ROUTES ---

// 1. Data Polling
app.get('/data', (req, res) => {
    res.json({ readings, annotations, sessions });
});

// 2. Firmware Ingestion (POST /)
app.post('/', (req, res) => {
    const data = req.body;
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
    res.send('ok');
});

// 3. Annotations
app.post('/annotate', (req, res) => {
    const data = req.body;
    annotations.push({ label: data.label, time: Date.now() });
    console.log('ANNOTATION: ' + data.label);
    res.send('ok');
});

// 4. Session Start
app.post('/session/start', (req, res) => {
    const data = req.body;
    activeSession = { 
        name: data.name, 
        startTime: Date.now(), 
        endTime: null, 
        readings: [], 
        min: Infinity, 
        max: -Infinity, 
        avg: 0, 
        sum: 0, 
        count: 0 
    };
    console.log('SESSION START: ' + data.name);
    res.send('ok');
});

// 5. Session Stop
app.post('/session/stop', (req, res) => {
    if (activeSession) {
        activeSession.endTime = Date.now();
        sessions.push(activeSession);
        console.log('SESSION STOP: ' + activeSession.name + ' avg=' + activeSession.avg);
        activeSession = null;
    }
    res.send('ok');
});

app.get('/config', (req, res) => {
    res.json(VIBE_CONFIG);
});

// Start Server
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`GSR Monitor running at http://localhost:${PORT}`);
});