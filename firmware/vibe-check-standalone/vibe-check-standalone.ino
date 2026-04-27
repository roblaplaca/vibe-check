#include <Adafruit_NeoPixel.h>

#define LED_PIN 5
#define NUMPIXELS 7
#define GSR_PIN 34

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
  if (gsrValue > 1420)      return 43690;
  else if (gsrValue > 1300) return 32768;
  else if (gsrValue > 1100) return 16384;
  else if (gsrValue > 900)  return 10922;
  else if (gsrValue > 800)  return 5461;
  else                      return 0;
}

void shimmer(int baseHue, int brightness) {
  unsigned long t = millis();
  for (int i = 0; i < NUMPIXELS; i++) {
    float speed = 400.0 + (i * 80.0);
    float wave = sin((t / speed) + (i * 1.1));
    int hueOffset = (int)(wave * 3500);
    ring.setPixelColor(i, ring.ColorHSV(baseHue + hueOffset, 255, brightness));
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

    ring.setPixelColor(i, ring.ColorHSV(46000, 130, (int)brightness[i]));
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

  if (state == IDLE) {
    if (idleReady) {
      thunderstorm();
    }
    if (fingersOn) {
      state = SCANNING;
      scanStart = now;
      sampleIndex = 0;
      lastSample = 0;
      idleReady = true;
    }
  }

  else if (state == SCANNING) {
    float rotations = (float)(now - scanStart) / 400.0;
    int baseHue = (int)(rotations * 65536) % 65536;
    for (int i = 0; i < NUMPIXELS; i++) {
      int hue = (baseHue + (i * (65536 / NUMPIXELS))) % 65536;
      ring.setPixelColor(i, ring.ColorHSV(hue, 255, 200));
    }
    ring.show();

    if (now - lastSample > 60 && sampleIndex < SAMPLE_COUNT) {
      samples[sampleIndex++] = smoothed;
      lastSample = now;
    }

    if (now - scanStart >= 3000) {
      long sum = 0;
      for (int i = 0; i < SAMPLE_COUNT; i++) sum += samples[i];
      baselineDuringResult = sum / SAMPLE_COUNT;
      lockedHue = gsrToHue(baselineDuringResult);
      transitionStart = now;
      state = TRANSITION;
    }
  }

  else if (state == TRANSITION) {
    float progress = (float)(now - transitionStart) / 800.0;
    if (progress >= 1.0) {
      state = RESULT;
      tripQualifying = false;
    } else {
      float eased = progress * progress * (3.0 - 2.0 * progress);
      int rainbowBright = (int)(200 * (1.0 - eased));
      int auraBright    = (int)(200 * eased);
      float rotations   = (float)(now - scanStart) / 400.0;
      int baseHue       = (int)(rotations * 65536) % 65536;

      for (int i = 0; i < NUMPIXELS; i++) {
        int hue = (baseHue + (i * (65536 / NUMPIXELS))) % 65536;
        uint32_t c1 = ring.ColorHSV(hue, 255, rainbowBright);
        float wave = sin((now / (400.0 + (i * 80.0))) + (i * 1.1));
        uint32_t c2 = ring.ColorHSV(lockedHue + (int)(wave * 7000), 255, auraBright);
        uint8_t r = min(255, (int)((c1 >> 16 & 0xFF) + (c2 >> 16 & 0xFF)));
        uint8_t g = min(255, (int)((c1 >>  8 & 0xFF) + (c2 >>  8 & 0xFF)));
        uint8_t b = min(255, (int)((c1       & 0xFF) + (c2       & 0xFF)));
        ring.setPixelColor(i, ring.Color(r, g, b));
      }
      ring.show();
    }
  }

  else if (state == RESULT) {
    shimmer(lockedHue, 200);
    int dropAmount = baselineDuringResult - smoothed;
    bool dropping = dropAmount > 100 || dropAmount > (int)(baselineDuringResult * 0.10);

    if (dropping) {
      if (!tripQualifying) {
        tripQualifying = true;
        tripQualifyStart = now;
      } else if (now - tripQualifyStart >= TRIP_QUALIFY_MS) {
        tripQualifying = false;
        tripStart = now;
        state = TRIPPED;
      }
    } else {
      tripQualifying = false;
    }
  }

  else if (state == TRIPPED) {
    float flicker = (sin(now * 0.05) * 0.5) + (random(0, 100) / 100.0 * 0.5);
    for (int i = 0; i < NUMPIXELS; i++) {
      ring.setPixelColor(i, ring.ColorHSV(0, 255, (int)(200 + (flicker * 55))));
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

    if (elapsed < DRAIN_COLLAPSE) {
      float t = (float)elapsed / DRAIN_COLLAPSE;
      float eased = t * t * t;
      int brightness = (int)(200 * (1.0 - eased));
      shimmer(lockedHue, brightness);

    } else if (elapsed < DRAIN_COLLAPSE + DRAIN_BLOOM) {
      float t = (float)(elapsed - DRAIN_COLLAPSE) / DRAIN_BLOOM;
      float eased = 1.0 - pow(1.0 - t, 3.0);
      int brightness = (int)(55 * eased);
      uint32_t color = ring.ColorHSV(46000, 120, brightness);
      for (int i = 0; i < NUMPIXELS; i++) ring.setPixelColor(i, color);
      ring.show();

    } else if (elapsed < DRAIN_COLLAPSE + DRAIN_BLOOM + DRAIN_HOLD) {
      uint32_t color = ring.ColorHSV(46000, 120, 55);
      for (int i = 0; i < NUMPIXELS; i++) ring.setPixelColor(i, color);
      ring.show();

    } else {
      idleReady = true;
      state = IDLE;
    }
  }
}