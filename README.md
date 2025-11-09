# 节律石 · Web 版

Task management & To-Do 风格的网页应用，基于 DeepSeek API 提供个性化任务推荐。

## 功能特性

- 🤖 **AI 任务推荐**：基于 DeepSeek API 生成 3 条个性化微任务
- 📱 **响应式设计**：适配桌面和移动设备
- 💾 **本地存储**：使用 localStorage 保存历史记录和近期已看任务
- 🔄 **智能去重**：避免近期重复展示相同任务
- 🛡️ **离线兜底**：AI 不可用时自动使用离线任务池
- ⚡ **快速响应**：优化加载体验，支持骨架屏和状态提示

## 技术栈

- **前端**：原生 HTML/CSS/JavaScript
- **后端**：Vercel Serverless Functions
- **API**：DeepSeek Chat API
- **部署**：Vercel

## 项目结构

```
vercal/
├── api/
│   ├── recommend.js    # 任务推荐 API（调用 DeepSeek）
│   └── log.js          # 完成日志 API
├── public/
│   ├── index.html      # 前端页面
│   └── app.js          # 前端逻辑
├── package.json
├── vercel.json         # Vercel 配置
└── README.md
```

## 快速开始

### 1. 环境准备

确保已安装 Node.js 和 Vercel CLI：

```bash
npm install -g vercel
```

### 2. 配置环境变量

在 Vercel 项目设置中添加环境变量：

- `DEEPSEEK_API_KEY`：你的 DeepSeek API Key

### 3. 本地开发

```bash
# 安装依赖（如果需要）
npm install

# 启动本地开发服务器
npm run dev
# 或
vercel dev
```

### 4. 部署

```bash
# 部署到 Vercel
vercel

# 生产环境部署
vercel --prod
```

## 使用说明

### 获取任务推荐

1. 调整心情滑块（-2 到 +2）
2. 调整能量滑块（1 到 5）
3. 选择时间段（早晨/中午/晚上）
4. （可选）输入地点
5. 点击「获取推荐」

### 完成任务

1. 点击任务卡片查看详情
2. 阅读「最小启动动作」和「完成后反馈」
3. 完成任务后点击「确认完成」
4. 任务将自动保存到历史记录

### 其他功能

- **换一个**：重新获取推荐，避免近期重复
- **清空近期已看**：重置去重记录
- **清空历史**：删除所有完成记录

## API 接口

### POST /api/recommend

获取任务推荐。

**请求体：**
```json
{
  "mood": -1,
  "energy": 2,
  "timeOfDay": "evening",
  "place": ""
}
```

**响应体：**
```json
{
  "tasks": [
    {
      "id": "a1",
      "title": "起身喝一口水",
      "min_action": "现在倒半杯水，喝一口；注意觉察喉咙的感受。",
      "feedback": "对自己点头：我开始动起来了。"
    }
  ],
  "source": "deepseek"
}
```

### POST /api/log

记录任务完成。

**请求体：**
```json
{
  "title": "起身喝一口水",
  "ts": 1731043200000,
  "mood": -1,
  "energy": 2
}
```

**响应体：**
```json
{
  "ok": true,
  "echo": {
    "title": "起身喝一口水",
    "ts": 1731043200000,
    "mood": -1,
    "energy": 2
  }
}
```

## 数据存储

### localStorage 结构

- `recentShown`：近期已展示的任务标题数组（最多 30 条）
- `historyList`：历史完成记录数组（最多 200 条）

```javascript
// recentShown 示例
["起身喝一口水", "开窗呼吸 3 次", ...]

// historyList 示例
[
  { title: "起身喝一口水", ts: 1731043200000, mood: -1, energy: 2 },
  ...
]
```

## 离线兜底任务

当 DeepSeek API 不可用时，系统会自动使用离线任务池：

- **早晨**：起身喝一口水、开窗呼吸 3 次、洗把脸并擦干
- **中午**：站起转一圈、走到窗边看 10 秒、整理桌面一角
- **晚上**：把水杯装半杯水、做 3 次深呼吸、收拾床铺一角

## 开发说明

### 代码组织

- `public/app.js`：前端核心逻辑
  - localStorage 工具函数
  - API 调用函数
  - 任务选择逻辑
  - 渲染函数
  - 事件处理

- `api/recommend.js`：推荐 API
  - DeepSeek API 调用
  - 错误处理和兜底
  - 数据清洗和验证

- `api/log.js`：日志 API
  - 完成记录回显
  - 预留持久化接口

### 关键功能实现

1. **避免重复**：使用 `recentShown` 数组记录近期展示的任务，优先选择未展示的任务
2. **超时处理**：使用 `AbortController` 实现 10 秒请求超时
3. **错误处理**：所有错误情况都会回退到离线兜底任务
4. **非阻塞日志**：完成记录 API 调用不阻塞用户操作

## 验收标准

- ✅ 「获取推荐」→ 页面在 2 秒内出现卡片
- ✅ 点击卡片进入详情页，展示三段信息
- ✅ 详情页点击「确认完成」→ 历史列表新增一条
- ✅ 点击「换一个」多次，短期内不会反复出现相同标题
- ✅ AI 不可用时，仍出现兜底任务卡片
- ✅ 刷新页面后，历史仍在（localStorage 有效）

## 许可证

MIT

