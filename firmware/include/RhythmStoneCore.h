#pragma once

/*******************************************************
   Rhythm Stone - Local Demo Core (No WiFi / No WebSocket)
   Board: Seeed Studio XIAO ESP32C3

   Pins:
     A0  - FSR linear voltage module AO
           (数值越大 = 压力越大)
     D1  - Vibration motor (HIGH = ON)
     D2  - WS2812B 8x8 matrix (Adafruit_NeoPixel)
     D4  - I2C SDA (MPU6050)
     D5  - I2C SCL (MPU6050)

   对外只暴露两个函数：
     - RhythmStoneSetup()
     - RhythmStoneLoop()
 *******************************************************/

#include <Arduino.h>
#include <Wire.h>
#include <Adafruit_Sensor.h>
#include <Adafruit_MPU6050.h>
#include <Adafruit_NeoPixel.h>

/******************** 引脚与硬件定义 ************************/

#define FSR_PIN      A0
#define MOTOR_PIN    D1
#define LED_PIN      D2
#define I2C_SDA_PIN  D4
#define I2C_SCL_PIN  D5

#define NUM_PIXELS   64   // 8x8

Adafruit_NeoPixel matrix(NUM_PIXELS, LED_PIN, NEO_GRB + NEO_KHZ800);
Adafruit_MPU6050 mpu;
bool mpuReady = false;

// MPU 倾斜阈值（m/s^2）
float TILT_THRESHOLD = 4.0f;  // 约等于 0.2g

/******************** 任务与颜色 ****************************/

const int NUM_TASKS = 3;   // 3 个任务
int currentTaskIndex = 0;  // 0,1,2

// 每个任务对应的主色
uint32_t getColorForTask(int idx) {
  idx = (idx % NUM_TASKS + NUM_TASKS) % NUM_TASKS;
  switch (idx) {
    case 0: // 专注=蓝
      return matrix.Color(0, 120, 255);
    case 1: // 身体=绿
      return matrix.Color(0, 220, 100);
    case 2: // 自我关照=黄
      return matrix.Color(255, 200, 0);
  }
  return matrix.Color(50, 50, 50);
}

/******************** PressLevel & State 类型 ***************/

enum PressLevel {
  PRESS_NONE,
  PRESS_LIGHT,
  PRESS_HEAVY
};

enum State {
  STATE_IDLE,
  STATE_WAKE,
  STATE_BROWSE,
  STATE_CONFIRM,
  STATE_DONE
};

const char* levelToStr(PressLevel lv) {
  switch (lv) {
    case PRESS_NONE:  return "NONE";
    case PRESS_LIGHT: return "LIGHT";
    case PRESS_HEAVY: return "HEAVY";
  }
  return "?";
}

/******************** LED 像素 UI ***************************/

// 将 (x,y) 映射到 8x8 矩阵的 index
// 假设 0,0 在左上角，蛇形排布：偶数行左→右，奇数行右→左
int xyToIndex(int x, int y) {
  if (x < 0 || x > 7 || y < 0 || y > 7) return 0;

  int row = y;
  int col = x;

  if (row % 2 == 0) {
    // 偶数行：左 → 右
    return row * 8 + col;
  } else {
    // 奇数行：右 → 左
    return row * 8 + (7 - col);
  }
}

// 三个任务的 8x8 图标 bitmask（1=点亮）
const uint8_t ICON_FOCUS[8] = {      // 任务0：专注 - 中间方块
  0b00000000,
  0b00011000,
  0b00111100,
  0b00111100,
  0b00111100,
  0b00111100,
  0b00011000,
  0b00000000
};

const uint8_t ICON_BODY[8] = {       // 任务1：身体 - 类“小人”
  0b00011000,
  0b00011000,
  0b00011000,
  0b00111100,
  0b00111100,
  0b00011000,
  0b00100100,
  0b01000010
};

const uint8_t ICON_SELFCARE[8] = {   // 任务2：自我关照 - 心形
  0b00000000,
  0b01100110,
  0b11111111,
  0b11111111,
  0b01111110,
  0b00111100,
  0b00011000,
  0b00000000
};

// 用某个图标 + 颜色绘制到 8x8
void drawIcon(const uint8_t icon[8], uint32_t color) {
  matrix.clear();
  for (int y = 0; y < 8; y++) {
    uint8_t rowMask = icon[y];
    for (int x = 0; x < 8; x++) {
      // 从左到右：最高位代表 x=0
      bool on = rowMask & (1 << (7 - x));
      if (on) {
        int idx = xyToIndex(x, y);
        matrix.setPixelColor(idx, color);
      }
    }
  }
  matrix.show();
}

// 显示当前任务的图标 UI（形状 + 颜色）
void showTaskUI() {
  uint32_t c = getColorForTask(currentTaskIndex);
  switch (currentTaskIndex) {
    case 0: // 专注
      drawIcon(ICON_FOCUS, c);
      break;
    case 1: // 身体
      drawIcon(ICON_BODY, c);
      break;
    case 2: // 自我关照
      drawIcon(ICON_SELFCARE, c);
      break;
    default:
      for (int i = 0; i < NUM_PIXELS; i++) {
        matrix.setPixelColor(i, c);
      }
      matrix.show();
      break;
  }
}

/******************** FSR 稳定判定相关 *********************/

// 偏移量：基于测得 baseline 动态算阈值
// 目前你数据大致是：
// baseline ~ 200、不按；260~300 轻按；450+ 重按
const int LIGHT_ON_OFFSET   = 60;   // 进入轻按
const int LIGHT_OFF_OFFSET  = 40;   // 退出轻按（滞回）
const int HEAVY_ON_OFFSET   = 280;  // 进入重按
const int HEAVY_OFF_OFFSET  = 220;  // 退出重按（滞回）

const int REQUIRED_STABLE_COUNT = 5;   // 连续5次一致才切状态

int fsrBaseline   = 0;
int thLightOn     = 0;
int thLightOff    = 0;
int thHeavyOn     = 0;
int thHeavyOff    = 0;

int fsrFiltered   = 0;
PressLevel fsrStableLevel = PRESS_NONE;
PressLevel fsrLastInstant = PRESS_NONE;
int fsrStableCounter      = 0;

PressLevel prevFSRLevel   = PRESS_NONE; // 状态机用的“上一帧等级”

// 重握确认需要的“按住时间”
const unsigned long CONFIRM_HOLD_MS = 700;   // 0.7 秒长按才算确认

// 倾斜切任务的冷却时间（防止连续狂跳）
const unsigned long TILT_COOLDOWN_MS = 500;  // 0.5 秒内最多切一次

// 运行时变量
unsigned long heavyStartMs      = 0;  // 记录重握开始时间（只在 BROWSE 用）
unsigned long lastTiltSwitchMs  = 0;  // 上一次倾斜切任务时间


// 自动测 baseline（上电后不要按 FSR）
int measureFSRBaseline() {
  long sum = 0;
  const int N = 200;
  for (int i = 0; i < N; i++) {
    sum += analogRead(FSR_PIN);
    delay(5);
  }
  return sum / N;
}

// 初始化 FSR：基线 + 阈值
void initFSR() {
  pinMode(FSR_PIN, INPUT);  // 线性电压模块，普通 INPUT 即可

  Serial.println("FSR init: measuring baseline... 请勿按压传感器。");
  fsrBaseline = measureFSRBaseline();

  thLightOn  = fsrBaseline + LIGHT_ON_OFFSET;
  thLightOff = fsrBaseline + LIGHT_OFF_OFFSET;
  thHeavyOn  = fsrBaseline + HEAVY_ON_OFFSET;
  thHeavyOff = fsrBaseline + HEAVY_OFF_OFFSET;

  Serial.print("FSR baseline = "); Serial.println(fsrBaseline);
  Serial.print("thLightOn  = "); Serial.println(thLightOn);
  Serial.print("thLightOff = "); Serial.println(thLightOff);
  Serial.print("thHeavyOn  = "); Serial.println(thHeavyOn);
  Serial.print("thHeavyOff = "); Serial.println(thHeavyOff);
}

// 多次采样 + 一阶滤波
int readFSRFiltered() {
  const int SAMPLES = 8;
  long sum = 0;
  for (int i = 0; i < SAMPLES; i++) {
    sum += analogRead(FSR_PIN);
    delayMicroseconds(200);
  }
  int avg = sum / SAMPLES;
  fsrFiltered = (int)(fsrFiltered * 0.7 + avg * 0.3);
  return fsrFiltered;
}

// 单帧即时等级（不考虑时间稳定）
PressLevel getInstantFSRLevel(int val) {
  // 数值越大 = 压力越大
  if (val > thHeavyOn) {
    return PRESS_HEAVY;
  } else if (val > thLightOn) {
    return PRESS_LIGHT;
  } else {
    return PRESS_NONE;
  }
}

// 带滞回 + 连续 N 帧一致 才切换的稳定等级
PressLevel updateStableFSRLevel(int val) {
  PressLevel instant = getInstantFSRLevel(val);

  // 根据当前稳定状态做滞回处理
  switch (fsrStableLevel) {
    case PRESS_NONE:
      // 从 NONE 开始，instant 直接由阈值决定
      break;

    case PRESS_LIGHT:
      if (val > thHeavyOn) {
        instant = PRESS_HEAVY;
      } else if (val < thLightOff) {
        instant = PRESS_NONE;
      } else {
        instant = PRESS_LIGHT;
      }
      break;

    case PRESS_HEAVY:
      if (val < thHeavyOff) {
        if (val > thLightOn) {
          instant = PRESS_LIGHT;
        } else if (val < thLightOff) {
          instant = PRESS_NONE;
        } else {
          instant = PRESS_LIGHT;
        }
      } else {
        instant = PRESS_HEAVY;
      }
      break;
  }

  // 连续多次一致才真正切 stableLevel
  if (instant == fsrLastInstant) {
    if (fsrStableCounter < 1000) fsrStableCounter++;
  } else {
    fsrStableCounter = 0;
    fsrLastInstant = instant;
  }

  if (fsrStableCounter >= REQUIRED_STABLE_COUNT) {
    fsrStableLevel = instant;
  }

  return fsrStableLevel;
}

// 对外接口：每帧调用，返回稳定等级
PressLevel getFSRLevel() {
  int val = readFSRFiltered();
  PressLevel lv = updateStableFSRLevel(val);

  // 如要看调试数据，可以取消注释：
  // Serial.print("FSR val="); Serial.print(val);
  // Serial.print(" stable="); Serial.println(levelToStr(lv));

  return lv;
}

/******************** 震动马达控制 **************************/

void motorPulse(int durationMs) {
  digitalWrite(MOTOR_PIN, HIGH);
  delay(durationMs);
  digitalWrite(MOTOR_PIN, LOW);
}

void motorOff() {
  digitalWrite(MOTOR_PIN, LOW);
}

/******************** LED 辅助函数 *************************/

void clearMatrix() {
  matrix.clear();
  matrix.show();
}

// WAKE：渐亮动画
void wakeAnimation() {
  uint32_t color = matrix.Color(100, 150, 255); // 蓝紫色
  for (int b = 0; b <= 255; b += 12) {
    matrix.setBrightness(b);
    for (int i = 0; i < NUM_PIXELS; i++) {
      matrix.setPixelColor(i, color);
    }
    matrix.show();
    delay(20);
  }
}

// DONE：彩虹动画
uint32_t wheel(byte pos) {
  if (pos < 85) {
    return matrix.Color(pos * 3, 255 - pos * 3, 0);
  } else if (pos < 170) {
    pos -= 85;
    return matrix.Color(255 - pos * 3, 0, pos * 3);
  } else {
    pos -= 170;
    return matrix.Color(0, pos * 3, 255 - pos * 3);
  }
}

void rainbowAnimationWithDelay(uint16_t cycles, uint8_t waitMs) {
  for (uint16_t j = 0; j < cycles; j++) {
    for (uint16_t i = 0; i < NUM_PIXELS; i++) {
      matrix.setPixelColor(i, wheel((i + j) & 255));
    }
    matrix.show();
    delay(waitMs);
  }
}

/******************** FSM 状态定义 **************************/

State currentState = STATE_IDLE;
unsigned long stateEntryTime = 0;

int lastTiltDir = 0;  // -1 左, 0 中, 1 右

const char* stateToString(State s) {
  switch (s) {
    case STATE_IDLE:    return "IDLE";
    case STATE_WAKE:    return "WAKE";
    case STATE_BROWSE:  return "BROWSE";
    case STATE_CONFIRM: return "CONFIRM";
    case STATE_DONE:    return "DONE";
  }
  return "UNKNOWN";
}

void enterState(State newState);   // 前置声明
void onEnterState(State s);

/******************** MPU6050 倾斜检测 *********************/

int getTiltDirection() {
  if (!mpuReady) return 0;

  sensors_event_t a, g, temp;
  mpu.getEvent(&a, &g, &temp);
  float ax = a.acceleration.x;

  // 调试时可以打开：
  // Serial.print("Ax="); Serial.println(ax);

  if (ax > TILT_THRESHOLD) {
    return 1;   // 向右
  } else if (ax < -TILT_THRESHOLD) {
    return -1;  // 向左
  }
  return 0;
}

/******************** “语音请求” 本地表现 ******************/

void sendVoiceRequest() {
  int taskId = currentTaskIndex + 1;

  // 串口输出 JSON，便于后续接网页 / TTS
  Serial.print("{\"event\":\"voice_request\",\"task_id\":");
  Serial.print(taskId);
  Serial.println("}");

  // 白闪一下表示“请求语音播报”
  uint32_t c = matrix.Color(255, 255, 255);
  matrix.clear();
  for (int i = 0; i < NUM_PIXELS; i++) {
    matrix.setPixelColor(i, c);
  }
  matrix.show();
  delay(80);
  showTaskUI();  // 恢复任务像素 UI
}

/******************** 状态进入时的一次性动作 **************/

void enterState(State newState) {
  currentState = newState;
  stateEntryTime = millis();

  Serial.print("ENTER STATE_");
  Serial.println(stateToString(newState));

  onEnterState(newState);
}

void onEnterState(State s) {
  switch (s) {
    case STATE_IDLE:
      motorOff();
      clearMatrix();
      break;

    case STATE_WAKE:
      wakeAnimation();
      motorPulse(120);         // 短震
      enterState(STATE_BROWSE);
      break;

    case STATE_BROWSE:
      showTaskUI();
      lastTiltDir = 0;
      heavyStartMs  = 0;  // 进入浏览时重置长按计时
      break;

    case STATE_CONFIRM:
      // LED 闪烁锁定 + 中震
      for (int i = 0; i < 3; i++) {
        matrix.fill(getColorForTask(currentTaskIndex), 0, NUM_PIXELS);
        matrix.show();
        delay(130);
        clearMatrix();
        delay(130);
      }
      motorPulse(250);  // 中震

      Serial.print("{\"event\":\"task_confirm\",\"task_id\":");
      Serial.print(currentTaskIndex + 1);
      Serial.println("}");
      break;

    case STATE_DONE:
      motorPulse(500); // 长震
      rainbowAnimationWithDelay(256, 20); // 彩虹跑一圈
      delay(3000);
      enterState(STATE_IDLE);
      break;
  }
}

/******************** 各状态处理逻辑 ************************/

void handleIdle(PressLevel level, PressLevel lastLevel) {
  // 轻握/重握从 NONE 变来 → 唤醒
  if ((level == PRESS_LIGHT || level == PRESS_HEAVY) &&
      lastLevel == PRESS_NONE) {
    enterState(STATE_WAKE);
  }
}

void handleBrowse(PressLevel level, PressLevel lastLevel) {
  unsigned long now = millis();

  /***** 1. 倾斜切任务（带冷却时间） *****/
  int dir = getTiltDirection();

  if (dir != 0 && dir != lastTiltDir &&
      (now - lastTiltSwitchMs) > TILT_COOLDOWN_MS) {

    currentTaskIndex += dir;
    if (currentTaskIndex < 0) currentTaskIndex = NUM_TASKS - 1;
    if (currentTaskIndex >= NUM_TASKS) currentTaskIndex = 0;   // ← 这里就是“3 个任务轮回”

    lastTiltDir       = dir;
    lastTiltSwitchMs  = now;

    showTaskUI();
    motorPulse(100);  // 轻震提示切换

  } else if (dir == 0) {
    // 回到中立
    lastTiltDir = 0;
  }

  /***** 2. FSR 逻辑：重握长按 = 确认 *****/

  // 只有“从非 HEAVY → HEAVY 的那一刻”才开始计时
  if (level == PRESS_HEAVY) {
    if (lastLevel != PRESS_HEAVY && heavyStartMs == 0) {
      // 刚刚从 LIGHT/NONE 变成 HEAVY，开始计时
      heavyStartMs = now;
    } else if (heavyStartMs != 0 &&
               (now - heavyStartMs) >= CONFIRM_HOLD_MS) {
      // 按住超过设定时间 → 确认
      enterState(STATE_CONFIRM);
      heavyStartMs = 0;
      return;
    }
  } else {
    // 只要不是重按，就清空计时，避免误触
    heavyStartMs = 0;
  }

  /***** 3. 轻握：请求“语音播报” *****/
  if (level == PRESS_LIGHT && lastLevel == PRESS_NONE) {
    sendVoiceRequest();
  }
}



void handleConfirm(PressLevel level, PressLevel lastLevel) {
  // 再次重握：进入 DONE
  if (level == PRESS_HEAVY && lastLevel != PRESS_HEAVY) {
    enterState(STATE_DONE);
  }
}

void handleDone() {
  // 主要逻辑在 onEnterState(STATE_DONE) 中执行，这里留空
}

/******************** 对外接口：供 .ino 调用 ****************/

void RhythmStoneSetup() {
  Serial.begin(115200);
  delay(300);

  pinMode(MOTOR_PIN, OUTPUT);
  digitalWrite(MOTOR_PIN, LOW);

  // 初始化 LED
  matrix.begin();
  matrix.setBrightness(80);
  clearMatrix();

  // 初始化 FSR（自动测基线）
  initFSR();

  // 初始化 I2C + MPU6050
  Wire.begin(I2C_SDA_PIN, I2C_SCL_PIN);
  if (!mpu.begin()) {
    Serial.println("MPU6050 not found, tilt browse disabled.");
    mpuReady = false;
  } else {
    Serial.println("MPU6050 OK, tilt browse enabled.");
    mpuReady = true;
    mpu.setAccelerometerRange(MPU6050_RANGE_4_G);
    mpu.setGyroRange(MPU6050_RANGE_500_DEG);
    mpu.setFilterBandwidth(MPU6050_BAND_21_HZ);
  }

  // 初始状态
  enterState(STATE_IDLE);
}

void RhythmStoneLoop() {
  // 每帧读取 FSR 稳定等级
  PressLevel level = getFSRLevel();

  switch (currentState) {
    case STATE_IDLE:
      handleIdle(level, prevFSRLevel);
      break;
    case STATE_BROWSE:
      handleBrowse(level, prevFSRLevel);
      break;
    case STATE_CONFIRM:
      handleConfirm(level, prevFSRLevel);
      break;
    case STATE_WAKE:
      // WAKE 在 onEnterState 中立刻跳到 BROWSE，一般不会在 loop 停留
      break;
    case STATE_DONE:
      handleDone();
      break;
  }

  prevFSRLevel = level;
  delay(10);
}
