# Calibration Guide

This guide outlines the protocol for profiling your unique physiological baseline. To protect your privacy and simplify updates, thresholds are stored in local configuration files that are excluded from version control.

---

## Phase 1: Environment Setup

### 1. Prepare Local Configs
In each of the following folders, locate the `.example` file, copy it, and rename it to remove the `.example` extension:
* `/dashboard/config.json.example` → **`config.json`**
* `/firmware/vibe-check-debug/vibe_config.h.example` → **`vibe_config.h`**
* `/firmware/vibe-check-standalone/vibe_config.h.example` → **`vibe_config.h`**

### 2. Flash Debug Firmware
Upload `/firmware/vibe-check-debug/vibe-check-debug.ino` to your ESP32. Ensure your `arduino_secrets.h` is configured with your local network credentials.

### 3. Launch the Monitor
1. Navigate to `/dashboard` and run `node server.js`.
2. Open `http://localhost:3000` in your browser.
3. Observe the live graph. **GSR values represent resistance**:
   * **Up (High Numbers):** Relaxed / High Resistance.
   * **Down (Low Numbers):** Stressed / High Conductance.

---

## Phase 2: The 6-Stage Tuning Protocol

Follow these steps to find your unique thresholds. Record the average value displayed on the monitor for each state. You will need these numbers for Phase 3.

| State | Color | Action | Context |
| :--- | :--- | :--- | :--- |
| **Off** | None | Hands off sensors entirely. | No contact detected. |
| **Deep Calm** | Blue | Eyes closed, 5 slow, deep breaths. | Parasympathetic rest. |
| **Relaxed** | Teal | Sitting comfortably and alert. | Standard homeostasis. |
| **Engaged** | Green | Focus on reading or a task. | Focused cognitive load. |
| **Active** | Yellow | Solve a math problem aloud. | Initial stress response. |
| **Exerting** | Orange | Hold your breath for 10 seconds. | High sympathetic arousal. |
| **Peak** | Red | Recite a stressor or tap feet fast. | Fight or Flight response. |

---

## Phase 3: Reincorporation

Update your recorded values in your local config files to sync the entire ecosystem.

### 1. The Server (`/dashboard/config.json`)
Update the JSON values in the dashboard folder. This will automatically update the threshold lines on the graph, the UI labels, and the session statistics calculations upon server restart.

### 2. The Firmware (`vibe_config.h`)
Update the `VibeConfig` struct in **both** firmware folders:
* `/firmware/vibe-check-debug/vibe_config.h`
* `/firmware/vibe-check-standalone/vibe_config.h`

This ensures that your physical "aura" LEDs and your debug telemetry stay perfectly in sync.
