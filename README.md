# 🔮 Vibe Check
### A Biometric Aura Visualizer

Vibe Check is a hardware-software suite that translates the invisible physiological signals of your skin into a dynamic color spectrum. By touching the sensors, you bridge the gap between internal skin conductance and a physical "crystal" glow. 

This project provides a telemetry suite for profiling your unique physiological range and a production-ready firmware for standalone deployment.

---

## The Experience
Vibe Check uses **Galvanic Skin Response (GSR)** to detect micro-changes in sweat gland activity. This signal is processed through an ESP32 and mapped to a visual spectrum:

* **Very Calm (Blue):** Deep stillness. The "flow state."
* **Relaxed (Teal):** Calm but present.
* **Engaged (Green):** Focused, creative, and active.
* **Active (Yellow/Orange):** High energy or exertion.
* **Peak (Red):** Maximum physiological intensity.

---

## Hardware (Core Components)
To build a Vibe Check unit, you will need the following components:

* **Microcontroller:** [ESP-WROOM-32 Development Board](https://www.amazon.com/dp/B0DSZHXG8B) — High-speed ADC and WiFi capabilities.
* **Illumination:** [7-Bit WS2812B RGB LED Ring](https://www.amazon.com/dp/B0B2D6JDVJ) — For the internal lighting.
* **Sensor:** [Seeed Studio Grove GSR Sensor](https://www.mouser.com/ProductDetail/Seeed-Studio/101020052) — To measure skin conductivity and hack into contact points in final project

---

## Project Architecture

### Dashboard & Debug Firmware (`/dashboard` & `/firmware/vibe-check-debug`)
Streams real-time GSR data to a Node.js dashboard for monitoring and exploration.
* **Live Graphing:** Monitor GSR peaks and valleys in real-time.
* **Annotation:** Mark specific moments to observe your physiological range.

### Production Firmware (`/firmware/vibe-check-standalone`)
The standalone firmware removes network overhead for a low-latency, dedicated biometric experience — ideal for permanent physical installations. Flash this once you're ready to deploy.

---

## Setup & Installation

### Dependencies

**Arduino (required for both firmware variants):**
- [ESP32 board support](https://docs.espressif.com/projects/arduino-esp32/en/latest/installing.html) — install via Arduino IDE Board Manager
- [Adafruit NeoPixel](https://github.com/adafruit/Adafruit_NeoPixel) — install via Arduino IDE Library Manager

**Dashboard:**
- [Node.js](https://nodejs.org/) v18+

### 1. Local Config Files
Several config files are excluded from version control. Copy each `.example` file to create your local version:
```
firmware/vibe-check-debug/arduino_secrets.h.example   → arduino_secrets.h
firmware/vibe-check-debug/vibe_config.h.example       → vibe_config.h
firmware/vibe-check-standalone/vibe_config.h.example  → vibe_config.h
dashboard/config.json.example                         → config.json
```

### 2. Firmware
1. Open `arduino_secrets.h` and enter your WiFi credentials and the local IP of the machine running the dashboard.
2. Flash `/firmware/vibe-check-debug/vibe-check-debug.ino` to your ESP32 via the Arduino IDE.

### 3. Dashboard
1. Navigate to the `/dashboard` directory.
2. Run `node server.js`.
3. Open `http://localhost:3000` in your browser.

---

## Optional: Personal Calibration

The firmware detects arousal via relative signal changes, so it works out of the box without tuning. If you want to dial in your personal baseline — especially if your hardware build has different sensor placement or enclosure characteristics — see [CALIBRATION.MD](./CALIBRATION.MD) for the full profiling protocol.

---

## Technical Notes
* **Signal Processing:** The firmware utilizes an 8-sample moving average filter to stabilize the ADC jitter common on the ESP32.
* **Sampling Rate:** The debug loop samples at 20Hz (50ms delay) with a 1Hz telemetry POST to the dashboard.
* **Enclosure:** This project is designed for integration into a physical housing with integrated copper touch-contacts. How you decide to set that up is up to you!