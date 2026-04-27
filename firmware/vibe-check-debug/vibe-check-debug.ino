#include <Adafruit_NeoPixel.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include "arduino_secrets.h"

#define LED_PIN 5
#define NUMPIXELS 7
#define GSR_PIN 34

const char* ssid = SECRET_SSID;
const char* password = SECRET_PASS;
const char* webhookURL = SECRET_WEBHOOK;

Adafruit_NeoPixel ring(NUMPIXELS, LED_PIN, NEO_GRB + NEO_KHZ800);

#define SMOOTH_SAMPLES 8
int gsrReadings[SMOOTH_SAMPLES];
int readIndex = 0;
long total = 0;

unsigned long lastPost = 0;

uint32_t gsrToColor(int gsrValue) {
  // Keeping your original Off check, but moved higher to match new thresholds
  if (gsrValue > 2450)      return ring.Color(0, 0, 0);     // Instant Off (No contact)
  
  // Adjusted thresholds to match the Node Dashboard logic
  else if (gsrValue > 1800) return ring.Color(0, 0, 255);   // Blue - Very Calm
  else if (gsrValue > 1500) return ring.Color(0, 255, 255); // Teal - Relaxed
  else if (gsrValue > 1300) return ring.Color(0, 255, 0);   // Green - Engaged
  else if (gsrValue > 1100) return ring.Color(255, 255, 0); // Yellow - Active
  else if (gsrValue > 800)  return ring.Color(255, 45, 0);  // Orange - Exerting
  else                      return ring.Color(255, 0, 0);   // Red - Peak
}

void setup() {
  ring.begin();
  ring.setBrightness(180);
  ring.clear();
  ring.show();

  int initial = analogRead(GSR_PIN);
  for (int i = 0; i < SMOOTH_SAMPLES; i++) {
    gsrReadings[i] = initial;
    total += initial;
  }

  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    ring.fill(ring.Color(255, 255, 255));
    ring.show();
    delay(250);
    ring.clear();
    ring.show();
    delay(250);
  }

  ring.fill(ring.Color(255, 0, 0));
  ring.show();
  delay(2000);
}

void loop() {
  total -= gsrReadings[readIndex];
  gsrReadings[readIndex] = analogRead(GSR_PIN);
  total += gsrReadings[readIndex];
  readIndex = (readIndex + 1) % SMOOTH_SAMPLES;
  int smoothed = total / SMOOTH_SAMPLES;

  ring.fill(gsrToColor(smoothed));
  ring.show();

  if (millis() - lastPost > 1000) {
    lastPost = millis();
    if (WiFi.status() == WL_CONNECTED) {
      HTTPClient http;
      http.begin(webhookURL);
      http.addHeader("Content-Type", "application/json");
      String payload = "{\"gsr\":" + String(smoothed) + ",\"raw\":" + String(gsrReadings[(readIndex-1+SMOOTH_SAMPLES)%SMOOTH_SAMPLES]) + "}";
      http.POST(payload);
      http.end();
    }
  }

  delay(50);
}