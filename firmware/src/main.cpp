#include <Arduino.h>
#include "RhythmStoneCore.h"

RhythmStoneCore rhythmStone;

void setup() {
  Serial.begin(115200);
  rhythmStone.begin();
  Serial.println("Rhythm Stone firmware scaffold booted");
}

void loop() {
  rhythmStone.handleHeartbeat();
  delay(50);
}
