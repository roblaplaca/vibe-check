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

This project is organized into two phases to allow for precision calibration:

### 1. Calibration Suite (`/dashboard` & `/firmware/vibe-check-debug`)
GSR baselines vary significantly between builds. This suite streams real-time data to a Node.js dashboard to help you find your unique thresholds.
* **Live Graphing:** Monitor GSR peaks and valleys in real-time.
* **Annotation:** Mark specific moments to identify your baseline "floor" and arousal "ceiling."

### 2. Production Firmware (`/firmware/vibe-check-standalone`)
Once thresholds are identified, flash the standalone firmware. It removes the network overhead for a low-latency, dedicated biometric experience—ideal for permanent physical installations.

---

## Setup & Installation

### 1. Firmware
1. Navigate to `/firmware/vibe-check-debug`.
2. Rename `arduino_secrets.h.example` to `arduino_secrets.h`.
3. Input your WiFi credentials and the Local IP of the machine running the dashboard.
4. Flash to your ESP32 via the Arduino IDE.

### 2. Dashboard
1. Navigate to the `/dashboard` directory.
2. Run `node server.js`.
3. Open `http://localhost:3000` in your browser.

---

## Calibration Logic
Default thresholds are configured for a cased hardware baseline (ESP32 12-bit ADC):

| State | GSR Value | Color |
| :--- | :--- | :--- |
| **Deep Calm** | > 1800 | Blue |
| **Engaged** | 1300 - 1500 | Green |
| **Peak** | < 800 | Red |
| **Sensor Off** | > 2450 | Off |

---

## Technical Notes
* **Signal Processing:** The firmware utilizes an 8-sample moving average filter to stabilize the ADC jitter common on the ESP32.
* **Sampling Rate:** The debug loop samples at 20Hz (50ms delay) with a 1Hz telemetry POST to the dashboard.
* **Enclosure:** This project is designed for integration into a physical housing with integrated copper touch-contacts. How you decide to set that up is up to you!