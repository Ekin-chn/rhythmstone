# 节律石 Rhythm Stone Monorepo

Rhythm Stone 是一套结合网页端和硬件端的 Calm Tech 情绪节律引导系统，包含 AI 任务推荐 Web Controller 与 Seeed Studio XIAO ESP32C3 固件脚手架。

## 仓库布局
```
rhythmstone/
├─ README.md              # 顶层说明（本文件）
├─ PROJECT_SUMMARY.md     # 进度与文件概览
├─ LICENSE                # MIT 许可
├─ docs/                  # 交互流程、原型图、硬件接线图等文档（示例入口）
├─ api/                   # Vercel Serverless Functions：/api/recommend, /api/log
├─ web/                   # 网页端（Vite 驱动）
│  ├─ package.json
│  ├─ vite.config.js
│  ├─ src/
│  │  ├─ index.html       # 暗色主题单页入口
│  │  └─ main.js          # 三卡片轮播、加载/庆祝/状态逻辑
│  └─ dist/               # `npm --workspace web run build` 产物（Vercel 通过 vercel.json 指向此目录）
├─ firmware/              # 硬件端代码（PlatformIO 脚手架）
│  ├─ src/
│  │  ├─ main.cpp
│  │  └─ RhythmStoneCore.h
│  ├─ include/
│  └─ platformio.ini
└─ .github/workflows/
   ├─ web-ci.yml          # 前端 CI（Node 20 + npm install + lint + build）
   └─ firmware-ci.yml     # 固件 CI（PlatformIO 编译）
```

## 快速开始
### 前端（web）
1. 安装依赖（使用 npm workspaces 安装即可覆盖 web）
   ```bash
   npm install
   ```
2. 启动开发服务器（默认端口 5173，已配置 `/api` 代理到本地 3000；如需 LAN 访问可加 `-- --host 0.0.0.0`）
   ```bash
   npm run dev:web
   ```
3. 生产构建
   ```bash
   npm run build
   ```
   构建产物位于 `web/dist/`，`vercel.json` 通过 `@vercel/static-build` 指定 dist 目录并附带 SPA 重写，避免 Vercel 将前端子目录误判为“未检测到框架”。
4. 预览已构建产物（验证 Vercel 同源行为）
   ```bash
   npm run preview -- --host 0.0.0.0 --port 4173
   ```
   这样可在本地模拟 `/api` 代理与 SPA 重写是否生效，排查“本地预览不可访问”或 Vercel 配置问题。

> 如果需要联调 Serverless 接口，可在仓库根目录运行 `vercel dev`（或其他 Node 服务器）暴露 `/api`，Vite 开发服务器会自动代理到本地 3000。

### Serverless API
- `api/recommend.js`：调用 DeepSeek（或离线兜底）返回三条结构化任务 `{id,title,type,color,desc}`，长度裁剪并按时段提供 fallback。
- `api/log.js`：回显完成日志，预留持久化钩子。

本地调试可直接用 `vercel dev` 或任意支持 Vercel 函数规范的运行器。

### 固件（firmware）
- 基于 PlatformIO 的 XIAO ESP32C3 脚手架，预留颜色与震动控制接口。
- 构建检查（CI 同步执行）：
  ```bash
  cd firmware
  pio run
  ```

### 设备联动与协议
- 引脚：FSR@A0（正向逻辑 0-4095）、马达@D1、WS2812B@D2、MPU6050@D4/D5。
- WebSocket 事件（设备→Web）：`wake`（轻握唤醒）、`next/prev`（左右倾斜>300ms）、`confirm`（重握）。
- WebSocket 指令（Web→设备）：`{cmd:'color',value:'blue|green|yellow'}`、`{cmd:'display',icon:'run|leaf|target'}`、`{cmd:'vibrate',pattern:'short|long'}`。
- 状态机建议：IDLE 熄灯 → WAKE 呼吸 → BROWSE 常亮/颜色随卡片 → CONFIRM 重握启动 → COMPLETE 彩虹 + 长震。

更多拆解与待办详见 `docs/IMPLEMENTATION_PLAN.md`。

## 主要特性（Web Controller）
- 🤖 DeepSeek 驱动的 AI 微任务推荐，返回 3 条 `{id,title,type,color,desc}`，缺 Key 自动使用时段兜底池。
- 🌓 Calm Tech 暗色主题，任务色（蓝/绿/黄）与类型标识。
- 🃏 三卡片横向轮播 + 上/下按钮，点击卡片进入详情。
- 📡 WebSocket 可配置连接：处理硬件上报的 `wake/next/prev/confirm`，并下发 `color/display/vibrate`，含自动重连与在线徽章。
- 🔊 浏览器 TTS 轻量播报（唤醒/切换/确认提示），可在代码中关闭 `ttsEnabled`。
- 🌀 骨架 + 呼吸灯加载动效；🎉 任务完成庆祝动画；
- 💾 本地历史记录与去重逻辑（近期展示/完成记录）。

## 环境变量
- `DEEPSEEK_API_KEY`：DeepSeek API Key。缺省时自动使用离线兜底任务。

## 部署建议
- **Vercel**：根目录放置 `vercel.json`（使用 `@vercel/static-build` 针对 `web/package.json`，`distDir=dist`，保留 `/api/**/*.js` 为 Serverless）并启用 SPA 重写。仪表盘里将 Project Root 设为仓库根目录即可同时识别 `/api` 与静态站点，无需拆分仓库。若部署失败，可核对构建命令 `npm --workspace web run build` 与 dist 路径 `web/dist` 是否一致，并确认 `routes` 已包含 `/{handle:fislesystem}` + `/(.*) -> /index.html`。
- **其他静态主机**：直接将 `web/dist` 作为站点根目录，保留 `/api` 在自托管 Node/Vercel Functions 中。
- **固件**：通过 PlatformIO/Arduino CLI 将 `firmware` 刷写到 XIAO ESP32C3；需在 `RhythmStoneCore` 内落地 WebSocket 客户端、传感器/灯效/马达处理与状态机逻辑。

## 许可证
本项目采用 MIT License，详见 `LICENSE` 文件。
