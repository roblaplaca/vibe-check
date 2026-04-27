#include <Adafruit_NeoPixel.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include "arduino_secrets.h"
#include "vibe_config.h"

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
  // 1. Initial "No Contact" check
  if (gsrValue > vibeConfig.off) {
    return ring.Color(0, 0, 0); 
  }
  
  // 2. Cascade through the spectrum
  if (gsrValue > vibeConfig.blue)   return ring.Color(0, 0, 255);    // Blue
  if (gsrValue > vibeConfig.teal)   return ring.Color(0, 255, 255);  // Teal
  if (gsrValue > vibeConfig.green)  return ring.Color(0, 255, 0);    // Green
  if (gsrValue > vibeConfig.yellow) return ring.Color(255, 255, 0);  // Yellow
  if (gsrValue > vibeConfig.orange) return ring.Color(255, 45, 0);   // Orange
  
  // 3. Fallback/Peak State
  return ring.Color(255, 0, 0); // Red
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