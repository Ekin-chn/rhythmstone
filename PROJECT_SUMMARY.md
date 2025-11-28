# 节律石项目概览（最新）

## ✅ 已完成功能
### 后端 API（root/api）
- **`/api/recommend.js`**：接收心情/能量/时间段/地点，调用 DeepSeek（10s 超时）或离线兜底，返回 3 条规范化任务 `{ id≤12, title≤24, type(body|care|focus), color(blue|green|yellow), desc≤180 }`，响应 `{ tasks, source, error? }`。
- **`/api/log.js`**：校验并回显完成记录 `{ title, ts, mood, energy, type }`，预留持久化接口。

- Calm Tech 深色主题，任务色点（蓝/绿/黄）与类型标识。
- 三卡片横向轮播 + 上/下按钮，点击卡片进入详情。
- 心情/能量/时间段输入，加载时骨架 + 呼吸灯动画。
- WebSocket 可配置连接，自动重连；处理 `wake/next/prev/confirm` 事件，切换/确认时下发 `color/display/vibrate` 并触发浏览器 TTS 播报。
 - 完成确认触发庆祝动画，写入历史（最多 200 条）并调用 `/api/log`；近期展示标题（30 条）用于去重。
 - 前端包版本已与根包同步至 1.3.2，便于部署/CI 读取一致的版本号。

### 固件脚手架（firmware/）
- PlatformIO 配置针对 Seeed Studio XIAO ESP32C3。
- `RhythmStoneCore` 头文件预留颜色/震动控制与心跳处理接口，`main.cpp` 骨架可直接扩展为 WebSocket 客户端。

### CI/CD
- `.github/workflows/web-ci.yml`：Node 20，`npm install` + `npm run lint`（占位）+ `npm run build`（Vite）。
- `.github/workflows/firmware-ci.yml`：安装 PlatformIO 并执行 `pio run` 进行编译检查。
- `vercel.json`：使用 `@vercel/static-build` 针对 `web/package.json`（distDir=dist），保留 `/api/**/*.js` 的 Serverless 构建，并通过 routes 提供 filesystem 兜底和 `/(.*)->/index.html` SPA 重写。Vercel 仪表盘将 Project Root 设为仓库根目录即可同时识别前端与函数。

## 🎯 核心流程
1. 用户填写心情/能量/时间段 → 点击「获取推荐」。
2. 前端显示骨架与呼吸灯 → 调用 `/api/recommend`（DeepSeek 或兜底）。
3. 返回 3 条任务 → 渲染三卡片轮播；切换写入 `recentShown` 并触发 `syncColor` 占位。
4. 点击卡片查看详情 → 点击「确认完成」→ 触发庆祝动画、写入历史（含类型/情绪/能量），异步调用 `/api/log`。
5. 「换一组」复用最近参数重新拉取；历史与近期记录存于 localStorage。

## 📂 文件清单（摘要）
```
README.md             # 顶层说明与使用指南
PROJECT_SUMMARY.md    # 本文件
LICENSE               # MIT 许可
docs/IMPLEMENTATION_PLAN.md # 6 个子任务拆解（Web+硬件联动）
 vercel.json           # Vercel 配置（@vercel/static-build 针对 web/package.json，distDir=dist，含 routes SPA 重写与 /api 保留）
api/recommend.js      # 推荐 API
api/log.js            # 完成记录回显
web/package.json      # 前端包与脚本
web/vite.config.js    # Vite 配置（root=src, outDir=dist）
web/src/index.html    # 单页入口
web/src/main.js       # 前端交互逻辑
firmware/platformio.ini
firmware/src/main.cpp
firmware/src/RhythmStoneCore.h
.github/workflows/web-ci.yml
.github/workflows/firmware-ci.yml
```

## 🔭 后续优化方向
- 实装 WebSocket 与硬件联动：颜色同步、next/prev/confirm 指令闭环。
- `/api/log` 接入持久化（KV/DB）并提供 CSV 导出入口。
- 引入真实 lint/format/test 流程（ESLint/Prettier/Vitest），补充 UI 单测。
- 完善 docs：添加交互流程图、硬件接线图、WebSocket 协议描述；补全固件状态机与传感器实现示例。
