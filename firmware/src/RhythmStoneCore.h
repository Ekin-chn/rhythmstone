#pragma once

#include <Arduino.h>

struct TaskPayload {
  String color;
  String action;
};

class RhythmStoneCore {
 public:
  void begin();
  void handleHeartbeat();
  void applyColor(const String &colorCode);
  void vibrate(const String &pattern);
};
