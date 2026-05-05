# Changelog

## [1.0.0] - 2026-05-05

### Added
- Standalone production firmware (`vibe-check-standalone`) for low-latency deployment without network overhead
- Debug firmware (`vibe-check-debug`) with WiFi telemetry and 20Hz GSR sampling
- Node.js dashboard with live GSR graphing and session annotation
- 1.5s RGB transition interpolation between vibe states for smooth visual changes
- `stressFactor` in RESULT state to shift LED brightness and saturation under high arousal
- Calibration guide (`CALIBRATION.MD`) with 6-stage physiological profiling protocol
- `.example` config files for all sensitive/local configuration (`arduino_secrets.h`, `vibe_config.h`, `config.json`)

### Changed
- Slope-based arousal detection replaces fixed GSR thresholds for better out-of-the-box accuracy
- DRAIN state logic tightened to remove white flash and abrupt brightness jumps
- `vibe_config.h` default thresholds tuned for improved resting state detection
- Calibration reframed as optional fine-tuning rather than a required setup step
