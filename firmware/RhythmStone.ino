#include <Arduino.h>
#include <Wire.h>
#include <Adafruit_Sensor.h>
#include <Adafruit_MPU6050.h>
#include <Adafruit_NeoPixel.h>

// ================= 1. 硬件引脚定义 =================
#define PIN_FSR      A0   // 蓝色模块 AO -> A0
#define PIN_MOTOR    D1   // 震动模块 -> D1
#define PIN_LED      D2   // LED 数据 -> D2
#define PIN_SDA      D4   // MPU SDA -> D4
#define PIN_SCL      D5   // MPU SCL -> D5

#define NUM_PIXELS   64   // 8x8

// ================= 2. 全局对象 =================
Adafruit_NeoPixel matrix(NUM_PIXELS, PIN_LED, NEO_GRB + NEO_KHZ800);
Adafruit_MPU6050 mpu;
bool mpuReady = false;

// ================= 3. 核心参数 (根据手感微调) =================

// --- FSR 压力参数 ---
// 逻辑：蓝色模块用力按数值变大
// 我们用"增量"来判断，而不是绝对值
int fsrBaseline = 0;          // 开机自动测量
const int THRESHOLD_WAKE = 150;   // 唤醒需要的力度增量 (轻轻捏)
const int THRESHOLD_CONFIRM = 600; // 确认需要的力度增量 (用力捏)

// --- 倾斜参数 ---
float TILT_TRIGGER_X = 3.5;   // X轴倾斜触发阈值 (m/s^2)
const unsigned long TILT_COOLDOWN = 800; // 两次切换间的冷却时间(毫秒)
unsigned long lastTiltTime = 0;

// --- 任务数据 ---
const int TASK_COUNT = 3;
int currentTask = 0;

// ================= 4. 图标数据 (8x8) =================
// 0: 蓝色水滴 (身体)
const uint8_t ICON_0[] = {
  0,0,0,24,60,60,60,24
};
// 1: 绿色方块 (专注)
const uint8_t ICON_1[] = {
  0,0,60,60,60,60,0,0
};
// 2: 黄色爱心 (关照)
const uint8_t ICON_2[] = {
  0,102,255,255,126,60,24,0
};

// ================= 5. 状态机定义 =================
enum State {
  STATE_IDLE,    // 0. 休眠 (黑屏)
  STATE_WAKE,    // 1. 唤醒 (渐亮)
  STATE_BROWSE,  // 2. 浏览 (倾斜切换)
  STATE_CONFIRM, // 3. 确认 (震动锁定)
  STATE_DONE     // 4. 完成 (彩虹特效)
};
State currentState = STATE_IDLE;

// ================= 6. 辅助函数 =================

// 震动函数
void pulseMotor(int ms) {
  digitalWrite(PIN_MOTOR, HIGH);
  delay(ms);
  digitalWrite(PIN_MOTOR, LOW);
}

// 撞墙反馈 (两下闷震)
void bumpFeedback() {
  digitalWrite(PIN_MOTOR, HIGH); delay(40);
  digitalWrite(PIN_MOTOR, LOW);  delay(50);
  digitalWrite(PIN_MOTOR, HIGH); delay(40);
  digitalWrite(PIN_MOTOR, LOW);
}

// LED 绘图函数
void drawBitmap(const uint8_t bitmap[], uint32_t color) {
  matrix.clear();
  for (int y = 0; y < 8; y++) {
    for (int x = 0; x < 8; x++) {
      // 解析位图，假设蛇形排列 (根据实际情况可能需要调整 xy 映射)
      if (bitmap[y] & (1 << (7-x))) {
        int pixelIndex = y * 8 + x; 
        if (y % 2 != 0) pixelIndex = y * 8 + (7 - x); // 蛇形修正
        matrix.setPixelColor(pixelIndex, color);
      }
    }
  }
  matrix.show();
}

// 显示当前任务
void showTask() {
  if (currentTask == 0) drawBitmap(ICON_0, matrix.Color(0, 0, 150)); // 蓝
  else if (currentTask == 1) drawBitmap(ICON_1, matrix.Color(0, 150, 0)); // 绿
  else drawBitmap(ICON_2, matrix.Color(150, 100, 0)); // 黄
}

// 状态切换器
void enterState(State s) {
  currentState = s;
  Serial.print(">>> 进入状态: "); Serial.println(s);
  
  if (s == STATE_IDLE) {
    matrix.clear(); matrix.show();
    pulseMotor(50);
  }
  else if (s == STATE_WAKE) {
    // 呼吸灯唤醒效果
    for(int b=0; b<80; b+=5) {
      matrix.setBrightness(b);
      showTask();
      delay(10);
    }
    pulseMotor(100);
    enterState(STATE_BROWSE); // 唤醒动画播完直接进浏览
  }
  else if (s == STATE_BROWSE) {
    matrix.setBrightness(80);
    showTask();
  }
  else if (s == STATE_CONFIRM) {
    pulseMotor(300); // 长震确认
    // 闪烁效果
    matrix.clear(); matrix.show(); delay(100);
    showTask(); delay(100);
    matrix.clear(); matrix.show(); delay(100);
    showTask(); 
  }
  else if (s == STATE_DONE) {
    pulseMotor(600); // 完成长震
    // 彩虹跑马灯
    for(int j=0; j<256; j+=5) {
      for(int i=0; i<NUM_PIXELS; i++) {
        matrix.setPixelColor(i, matrix.gamma32(matrix.ColorHSV(i*1000 + j*256)));
      }
      matrix.show();
      delay(5);
    }
    delay(1000);
    enterState(STATE_IDLE); // 完成后自动休眠
  }
}

// ================= 7. 标准 Setup =================

void setup() {
  Serial.begin(115200);
  
  // 1. 初始化引脚
  pinMode(PIN_MOTOR, OUTPUT);
  pinMode(PIN_FSR, INPUT); // 蓝色模块输出电压，直接读
  
  // 2. 初始化 LED
  matrix.begin();
  matrix.setBrightness(50);
  matrix.clear(); matrix.show();
  
  // 3. 关键延时！等待传感器上电稳定
  Serial.println("等待传感器预热...");
  delay(1000); 

  // 4. 初始化 MPU6050
  Wire.begin(PIN_SDA, PIN_SCL);
  if (!mpu.begin()) {
    Serial.println("MPU6050 连接失败! 请检查 D4/D5 接线");
    while (1) {
      // 报错死循环：快闪灯提示
      matrix.fill(matrix.Color(255, 0, 0)); matrix.show(); delay(100);
      matrix.clear(); matrix.show(); delay(100);
    }
  }
  Serial.println("MPU6050 连接成功!");
  mpu.setAccelerometerRange(MPU6050_RANGE_4_G);
  mpu.setFilterBandwidth(MPU6050_BAND_21_HZ);

  // 5. 自动校准 FSR 基线
  long sum = 0;
  for(int i=0; i<50; i++) {
    sum += analogRead(PIN_FSR);
    delay(5);
  }
  fsrBaseline = sum / 50;
  Serial.print("FSR 基准值: "); Serial.println(fsrBaseline);
  
  // 进入初始状态
  enterState(STATE_IDLE);
}

// ================= 8. 标准 Loop =================

void loop() {
  // --- 1. 读取传感器 ---
  int fsrRaw = analogRead(PIN_FSR);
  int fsrDelta = fsrRaw - fsrBaseline; // 计算按下的增量
  if (fsrDelta < 0) fsrDelta = 0;

  // 简单的状态判断
  bool isLightSqueeze = (fsrDelta > THRESHOLD_WAKE);
  bool isHeavySqueeze = (fsrDelta > THRESHOLD_CONFIRM);

  // --- 2. 状态机逻辑 ---
  switch (currentState) {
    
    case STATE_IDLE:
      // 任意捏压 -> 唤醒
      if (isLightSqueeze) {
        Serial.println("检测到捏压 -> 唤醒");
        enterState(STATE_WAKE);
        delay(500); // 防抖
      }
      break;

    case STATE_BROWSE:
      // A. 检测倾斜 (带冷却时间)
      if (millis() - lastTiltTime > TILT_COOLDOWN) {
        sensors_event_t a, g, temp;
        mpu.getEvent(&a, &g, &temp);
        
        float x = a.acceleration.x;
        
        // 向右倾斜 (X < -3.5)
        if (x < -TILT_TRIGGER_X) {
          Serial.println("向右倾斜");
          if (currentTask < TASK_COUNT - 1) {
            currentTask++; // 下一个
            showTask();
            pulseMotor(50);
          } else {
            bumpFeedback(); // 到底了，撞墙反馈
          }
          lastTiltTime = millis();
        }
        // 向左倾斜 (X > 3.5)
        else if (x > TILT_TRIGGER_X) {
          Serial.println("向左倾斜");
          if (currentTask > 0) {
            currentTask--; // 上一个
            showTask();
            pulseMotor(50);
          } else {
            bumpFeedback(); // 到头了，撞墙反馈
          }
          lastTiltTime = millis();
        }
      }
      
      // B. 检测重握 -> 确认
      if (isHeavySqueeze) {
        Serial.println("检测到重握 -> 确认任务");
        enterState(STATE_CONFIRM);
        delay(1000); // 等待松手
      }
      break;

    case STATE_CONFIRM:
      // 再次重握 -> 完成
      if (isHeavySqueeze) {
        Serial.println("再次重握 -> 任务完成");
        enterState(STATE_DONE);
        delay(1000);
      }
      break;
      
    case STATE_DONE:
      // 动画播完会自动回 IDLE，这里不用写逻辑
      break;
  }
  
  delay(20); // 循环稳定性
}