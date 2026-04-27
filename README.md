# Vibe Check
Vibe Check is a real-time hardware-software bridge that translates Galvanic Skin Response (GSR) into a dynamic color spectrum. It uses an ESP32 to monitor skin conductance and a Node.js dashboard for live calibration.

## 🚀 Features
* **Hardware:** ESP32 + NeoPixel Ring + GSR Sensor.
* **Live Dashboard:** Real-time graphing and threshold calibration.
* **Session Recording:** Annotate and export data to find your "baseline."

## 🛠 Setup
1. **Firmware:** - Navigate to `/firmware`.
   - Rename `arduino_secrets.h.example` to `arduino_secrets.h`.
   - Enter your WiFi credentials and Local IP.
   - Flash to your ESP32.
2. **Dashboard:**
   - Navigate to `/dashboard`.
   - Run `node server.js`.
   - Open `http://localhost:3000` in your browser.

## 🎨 Calibration
The visualizer uses the following default Vibe states:
- **Blue (>1800):** Deep Chill
- **Green (1300-1500):** Engaged
- **Red (<800):** Peak Intensity