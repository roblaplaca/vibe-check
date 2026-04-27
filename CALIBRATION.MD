# Calibration Guide

This guide outlines the protocol for profiling your unique physiological baseline and mapping those values to the **Vibe Check** spectrum.

---

## Phase 1: Environment Setup

### 1. Flash Debug Firmware
Upload `/firmware/vibe-check-debug/vibe-check-debug.ino` to your ESP32. Ensure your WiFi credentials and local IP are set in `arduino_secrets.h`.

### 2. Launch the Monitor
1. Run `node server.js`.
2. Open `http://localhost:3000`.
3. Watch the live graph. **GSR values represent resistance**:
   * **Up (High Numbers):** Relaxed.
   * **Down (Low Numbers):** Stressed/Engaged.

---

## Phase 2: The 6-Stage Tuning Protocol

Record the average value on the monitor for each state:

| State | Color | Action | Context |
| :--- | :--- | :--- | :--- |
| **Off** | None | Hands off sensors. | No contact. |
| **Deep Calm** | Blue | Eyes closed, 5 deep breaths. | Parasympathetic rest. |
| **Relaxed** | Teal | Sitting comfortably. | Homeostasis. |
| **Engaged** | Green | Focus on reading or a task. | Cognitive load. |
| **Active** | Yellow | Solve a math problem aloud. | Alertness. |
| **Exerting** | Orange | Hold your breath for 10s. | Sympathetic stress. |
| **Peak** | Red | Recite a stressor or tap feet fast. | Fight or Flight. |

---

## Phase 3: Reincorporation

Update the recorded values in exactly two places to sync your entire project:

### 1. The Server (`server.js`)
Update the `VIBE_CONFIG` object at the top of the file. This syncs your graph lines, labels, and session stats.

### 2. The Firmware (`vibe-check-standalone.ino`)
Update the `VibeThresholds` struct at the top of the production code. This syncs the physical "crystal" LEDs on your device.
