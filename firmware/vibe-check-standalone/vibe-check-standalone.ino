#include <Adafruit_NeoPixel.h>
#include "vibe_config.h"

#define LED_PIN 5
#define NUMPIXELS 7
#define GSR_PIN 34
#define INNER_LED_INDEX 0

// ─────────────────────────────────────────────
// BRIGHTNESS SCALE
// 1.0 = full brightness (normal use)
// 0.4 = dimmed for photography / video
// ─────────────────────────────────────────────
#define BRIGHTNESS_SCALE 1.0

int scaleBr(int brightness) {
  return (int)(brightness * BRIGHTNESS_SCALE);
}
// ─────────────────────────────────────────────

Adafruit_NeoPixel ring(NUMPIXELS, LED_PIN, NEO_GRB + NEO_KHZ800);

#define IDLE 0
#define SCANNING 1
#define TRANSITION 2
#define RESULT 3
#define TRIPPED 4
#define DRAIN 5

int state = IDLE;
unsigned long scanStart = 0;
unsigned long tripStart = 0;
unsigned long transitionStart = 0;
unsigned long drainStart = 0;

int lockedHue = 0;
int baselineDuringResult = 0;

#define SMOOTH_SAMPLES 8
int gsrReadings[SMOOTH_SAMPLES];
int readIndex = 0;
long gsrTotal = 0;
unsigned long noContactSince = 0;
#define NO_CONTACT_DELAY 200

#define SAMPLE_COUNT 50
int samples[SAMPLE_COUNT];
int sampleIndex = 0;
unsigned long lastSample = 0;

unsigned long lastGSRSample = 0;
#define GSR_SAMPLE_INTERVAL 20

int smoothed = 2000;
bool fingersOn = false;

#define DRAIN_COLLAPSE 600
#define DRAIN_BLOOM    1000
#define DRAIN_HOLD     2000

bool idleReady = false;

unsigned long tripQualifyStart = 0;
bool tripQualifying = false;
#define TRIP_QUALIFY_MS 400

int gsrToHue(int gsrValue) {
  if (gsrValue > vibeConfig.off) return 0;

  if (gsrValue > vibeConfig.blue)   return 43690; // Blue
  if (gsrValue > vibeConfig.teal)   return 32768; // Teal/Cyan
  if (gsrValue > vibeConfig.green)  return 16384; // Green
  if (gsrValue > vibeConfig.yellow) return 10922; // Yellow
  if (gsrValue > vibeConfig.orange) return 5461;  // Orange

  return 0; // Red (Peak)
}

void shimmer(int baseHue, int brightness) {
  unsigned long t = millis();
  for (int i = 0; i < NUMPIXELS; i++) {
    float speed = 400.0 + (i * 80.0);
    float wave = sin((t / speed) + (i * 1.1));
    int hueOffset = (int)(wave * 3500);
    ring.setPixelColor(i, ring.ColorHSV(baseHue + hueOffset, 255, scaleBr(brightness)));
  }
  ring.show();
}

void thunderstorm() {
  static float brightness[NUMPIXELS] = {20, 20, 20, 20, 20, 20, 20};
  static float target[NUMPIXELS]     = {20, 20, 20, 20, 20, 20, 20};
  static unsigned long nextFlicker[NUMPIXELS] = {0};
  static unsigned long lastUpdate = 0;

  unsigned long t = millis();
  float dt = (t - lastUpdate) / 1000.0;
  if (dt <= 0 || dt > 0.1) dt = 0.016;
  lastUpdate = t;

  float base = 18.0 + (sin(t / 3700.0) + sin(t / 5300.0)) * 8.0;

  for (int i = 0; i < NUMPIXELS; i++) {
    if (t >= nextFlicker[i]) {
      float r = (float)random(0, 1000) / 1000.0;

      if (r < 0.04) {
        target[i] = 80 + random(0, 60);
        nextFlicker[i] = t + random(60, 180);
      } else if (r < 0.15) {
        target[i] = base - random(5, 14);
        nextFlicker[i] = t + random(200, 600);
      } else {
        target[i] = base + random(-6, 10);
        nextFlicker[i] = t + random(300, 900);
      }
    }

    float inertia = 2.5 + (i * 0.3);
    brightness[i] += (target[i] - brightness[i]) * inertia * dt;
    brightness[i] = constrain(brightness[i], 4, 140);

    ring.setPixelColor(i, ring.ColorHSV(46000, 130, scaleBr((int)brightness[i])));
  }

  ring.show();
}

void setup() {
  ring.begin();
  ring.clear();
  ring.show();

  delay(100);
  for (int i = 0; i < 5; i++) { analogRead(GSR_PIN); delay(5); }

  int initial = analogRead(GSR_PIN);
  for (int i = 0; i < SMOOTH_SAMPLES; i++) {
    gsrReadings[i] = initial;
    gsrTotal += initial;
  }

  idleReady = true;
}

void loop() {
  unsigned long now = millis();

  if (now - lastGSRSample >= GSR_SAMPLE_INTERVAL) {
    lastGSRSample = now;
    int rawRead = analogRead(GSR_PIN);

    if (rawRead > 2000) {
      for (int i = 0; i < SMOOTH_SAMPLES; i++) gsrReadings[i] = rawRead;
      gsrTotal = (long)rawRead * SMOOTH_SAMPLES;
      if (noContactSince == 0) noContactSince = now;
    } else {
      noContactSince = 0;
      gsrTotal -= gsrReadings[readIndex];
      gsrReadings[readIndex] = rawRead;
      gsrTotal += gsrReadings[readIndex];
      readIndex = (readIndex + 1) % SMOOTH_SAMPLES;
    }

    smoothed = gsrTotal / SMOOTH_SAMPLES;
    fingersOn = smoothed < 2000 && noContactSince == 0;

    if (!fingersOn && state != IDLE && state != DRAIN) {
      if (noContactSince > 0 && now - noContactSince >= NO_CONTACT_DELAY) {
        drainStart = now;
        state = DRAIN;
      }
    }
  }

  else if (state == IDLE) {
    for (int i = 0; i < NUMPIXELS; i++) {
      if (i != INNER_LED_INDEX) {
        ring.setPixelColor(i, ring.ColorHSV(46000, 200, scaleBr(5)));
      }
    }

    float phase = millis() / 2000.0;
    float rawSine = sin(phase * PI);
    float breathCurve = (rawSine + 1.0) / 2.0;
    breathCurve = pow(breathCurve, 3);

    int brightness = map(breathCurve * 100, 0, 100, 10, 180);
    uint32_t breathColor = ring.ColorHSV(46000, 180, scaleBr(brightness));

    ring.setPixelColor(INNER_LED_INDEX, breathColor);
    ring.show();

    if (fingersOn) {
      scanStart = now;
      sampleIndex = 0;
      state = SCANNING;
    }
  }

  else if (state == SCANNING) {
    float rotations = (float)(now - scanStart) / 400.0;
    int baseHue = (int)(rotations * 65536) % 65536;
    for (int i = 0; i < NUMPIXELS; i++) {
      int hue = (baseHue + (i * (65536 / NUMPIXELS))) % 65536;
      ring.setPixelColor(i, ring.ColorHSV(hue, 255, scaleBr(200)));
    }
    ring.show();

    if (now - scanStart > 3000) {
      if (now - lastSample > 60 && sampleIndex < SAMPLE_COUNT) {
        samples[sampleIndex++] = smoothed;
        lastSample = now;
      }
    }

    if (now - scanStart >= 6000) {
      long sum = 0;
      for (int i = 0; i < sampleIndex; i++) sum += samples[i];

      baselineDuringResult = (sampleIndex > 0) ? (sum / sampleIndex) : smoothed;
      lockedHue = gsrToHue(baselineDuringResult);

      transitionStart = now;
      state = TRANSITION;
    }
  }

  else if (state == TRANSITION) {
    float progress = (float)(now - transitionStart) / 1500.0;

    if (progress >= 1.0) {
      state = RESULT;
    } else {
      float rotations = (float)(now - scanStart) / 400.0;
      int currentRainbowBase = (int)(rotations * 65536) % 65536;

      for (int i = 0; i < NUMPIXELS; i++) {
        int rHue = (currentRainbowBase + (i * (65536 / NUMPIXELS))) % 65536;
        uint32_t c1 = ring.ColorHSV(rHue, 255, scaleBr(200));

        float wave = sin((now / (400.0 + (i * 80.0))) + (i * 1.1));
        uint32_t c2 = ring.ColorHSV(lockedHue + (int)(wave * 3000), 255, scaleBr(200));

        uint8_t r = (uint8_t)((1.0 - progress) * (c1 >> 16 & 0xFF) + progress * (c2 >> 16 & 0xFF));
        uint8_t g = (uint8_t)((1.0 - progress) * (c1 >> 8 & 0xFF) + progress * (c2 >> 8 & 0xFF));
        uint8_t b = (uint8_t)((1.0 - progress) * (c1 & 0xFF) + progress * (c2 & 0xFF));

        ring.setPixelColor(i, ring.Color(r, g, b));
      }
      ring.show();
    }
  }

  else if (state == RESULT) {
    if (!fingersOn || smoothed >= (vibeConfig.off - 100)) {
      shimmer(lockedHue, 200);
      return;
    }

    int lastSampleVal = gsrReadings[(readIndex + SMOOTH_SAMPLES - 1) % SMOOTH_SAMPLES];
    int slope = smoothed - lastSampleVal;

    int agitation = (slope > 25) ? (slope * 40) : 0;

    int currentDrop = baselineDuringResult - smoothed;
    float stressFactor = constrain((float)currentDrop / 200.0, 0.0, 1.0);

    unsigned long t = millis();

    if (stressFactor < 0.2) {
      for (int i = 0; i < NUMPIXELS; i++) {
        float speed = 400.0 + (i * 80.0);
        float wave = sin((t / speed) + (i * 1.1));
        int hueOffset = (int)(wave * (3000 + agitation));
        ring.setPixelColor(i, ring.ColorHSV(lockedHue + hueOffset, 255, scaleBr(200)));
      }
    } else {
      uint32_t surgeColor = ring.ColorHSV(lockedHue, (255 - (int)(stressFactor * 200)), scaleBr(255));
      uint32_t baseColor  = ring.ColorHSV(lockedHue, 255, scaleBr((int)(150 - (stressFactor * 100))));

      for (int i = 0; i < NUMPIXELS; i++) {
        if (random(1000) < (stressFactor * 300)) {
          ring.setPixelColor(i, surgeColor);
        } else {
          ring.setPixelColor(i, baseColor);
        }
      }
    }
    ring.show();

    if (currentDrop > 250) {
      if (!tripQualifying) { tripQualifyStart = now; tripQualifying = true; }
      else if (now - tripQualifyStart >= TRIP_QUALIFY_MS) {
        state = TRIPPED; tripStart = now; tripQualifying = false;
      }
    } else { tripQualifying = false; }
  }

  else if (state == TRIPPED) {
    float flicker = (sin(now * 0.05) * 0.5) + (random(0, 100) / 100.0 * 0.5);
    for (int i = 0; i < NUMPIXELS; i++) {
      ring.setPixelColor(i, ring.ColorHSV(0, 255, scaleBr((int)(200 + (flicker * 55)))));
    }
    ring.show();
    if (now - tripStart > 2500) {
      baselineDuringResult = smoothed;
      tripQualifying = false;
      state = RESULT;
    }
  }

  else if (state == DRAIN) {
    unsigned long elapsed = now - drainStart;
    const int idleHue = 46000;

    if (elapsed < DRAIN_COLLAPSE) {
      float t = (float)elapsed / DRAIN_COLLAPSE;
      int currentBr = (int)(200 * (1.0 - t));

      for (int i = 0; i < NUMPIXELS; i++) {
        ring.setPixelColor(i, ring.ColorHSV(lockedHue, 255, scaleBr(currentBr)));
      }
      ring.show();

    } else if (elapsed < DRAIN_COLLAPSE + DRAIN_BLOOM) {
      float t = (float)(elapsed - DRAIN_COLLAPSE) / DRAIN_BLOOM;

      int ringBr = (int)(5 * t);
      float phase = now / 2000.0;
      float breathCurve = pow((sin(phase * PI) + 1.0) / 2.0, 3);
      int targetCenterBr = map(breathCurve * 100, 0, 100, 10, 180);
      int centerBr = (int)(targetCenterBr * t);

      for (int i = 0; i < NUMPIXELS; i++) {
        if (i == INNER_LED_INDEX) {
          ring.setPixelColor(i, ring.ColorHSV(idleHue, 180, scaleBr(centerBr)));
        } else {
          ring.setPixelColor(i, ring.ColorHSV(idleHue, 200, scaleBr(ringBr)));
        }
      }
      ring.show();

    } else {
      state = IDLE;
    }
  }
}
