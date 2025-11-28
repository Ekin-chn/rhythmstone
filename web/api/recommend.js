// 任务类型与颜色映射（符合 PRD：身体/关照/专注 → 蓝/绿/黄）
const TYPE_COLOR_MAP = {
  body: 'blue',
  care: 'green',
  focus: 'yellow'
};

// 离线兜底任务池（含 type/color/desc）
// 任务类型与颜色映射（符合 PRD：身体/关照/专注 → 蓝/绿/黄）
const TYPE_COLOR_MAP = {
  body: 'blue',
  care: 'green',
  focus: 'yellow'
};

// 离线兜底任务池（含 type/color/desc）
const FALLBACK_TASKS = {
  morning: [
    {
      id: 'off_m1',
      title: '喝一杯温水',
      type: 'body',
      color: 'blue',
      desc: '倒半杯温水，慢慢喝下去，留意水的温度让身体醒来。'
    },
    {
      id: 'off_m2',
      title: '开窗呼吸 3 次',
      type: 'care',
      color: 'green',
      desc: '走到窗边深呼吸 3 次，感受空气的流动，告诉自己：新的一天开始了。'
    },
    {
      id: 'off_m3',
      title: '洗把脸并擦干',
      type: 'body',
      color: 'blue',
      desc: '用凉水拍脸 3 次并擦干，感受肌肤的清爽，做一个温和的唤醒。'
    }
    {
      id: 'off_m1',
      title: '喝一杯温水',
      type: 'body',
      color: 'blue',
      desc: '倒半杯温水，慢慢喝下去，留意水的温度让身体醒来。'
    },
    {
      id: 'off_m2',
      title: '开窗呼吸 3 次',
      type: 'care',
      color: 'green',
      desc: '走到窗边深呼吸 3 次，感受空气的流动，告诉自己：新的一天开始了。'
    },
    {
      id: 'off_m3',
      title: '洗把脸并擦干',
      type: 'body',
      color: 'blue',
      desc: '用凉水拍脸 3 次并擦干，感受肌肤的清爽，做一个温和的唤醒。'
    }
  ],
  noon: [
    {
      id: 'off_n1',
      title: '站起转一圈',
      type: 'body',
      color: 'blue',
      desc: '从座位站起缓慢转一圈，舒展背部，让自己从久坐中抽离。'
    },
    {
      id: 'off_n2',
      title: '窗边眺望 10 秒',
      type: 'focus',
      color: 'yellow',
      desc: '走到窗边眺望 10 秒，把注意力放在远处，让眼睛和心都放松一下。'
    },
    {
      id: 'off_n3',
      title: '整理桌面一角',
      type: 'focus',
      color: 'yellow',
      desc: '花 1 分钟把桌面的一角理顺，找到一点秩序感，给任务留出空间。'
    }
    {
      id: 'off_n1',
      title: '站起转一圈',
      type: 'body',
      color: 'blue',
      desc: '从座位站起缓慢转一圈，舒展背部，让自己从久坐中抽离。'
    },
    {
      id: 'off_n2',
      title: '窗边眺望 10 秒',
      type: 'focus',
      color: 'yellow',
      desc: '走到窗边眺望 10 秒，把注意力放在远处，让眼睛和心都放松一下。'
    },
    {
      id: 'off_n3',
      title: '整理桌面一角',
      type: 'focus',
      color: 'yellow',
      desc: '花 1 分钟把桌面的一角理顺，找到一点秩序感，给任务留出空间。'
    }
  ],
  evening: [
    {
      id: 'off_e1',
      title: '为自己倒水',
      type: 'care',
      color: 'green',
      desc: '给水杯倒半杯温水，放在手边，告诉自己：我在照顾身体。'
    },
    {
      id: 'off_e2',
      title: '三次深呼吸',
      type: 'care',
      color: 'green',
      desc: '坐直或站直，缓慢做 3 次深呼吸，感受胸腔的起伏，邀请平静到来。'
    },
    {
      id: 'off_e3',
      title: '整理枕头',
      type: 'focus',
      color: 'yellow',
      desc: '把枕头拍松整平，为休息做好准备，让房间也进入舒缓状态。'
    }
  ]
};

// 获取离线兜底任务
function normalizeTask(task, index) {
  if (!task || !task.id || !task.title) {
    throw new Error(`Task ${index} missing required fields`);
  }

  const type = typeof task.type === 'string' ? task.type.toLowerCase() : 'care';
  const colorFromType = TYPE_COLOR_MAP[type];
  const color = typeof task.color === 'string' && task.color.length <= 10
    ? task.color.toLowerCase()
    : colorFromType || 'green';

  return {
    id: String(task.id).substring(0, 12),
    title: String(task.title).substring(0, 24),
    type: colorFromType ? type : 'care',
    color: colorFromType || (['blue', 'green', 'yellow'].includes(color) ? color : 'green'),
    desc: task.desc ? String(task.desc).substring(0, 180) : '请用 60 秒完成一个简单的小动作，观察身体和呼吸的变化。'
  };
}
    {
      id: 'off_e1',
      title: '为自己倒水',
      type: 'care',
      color: 'green',
      desc: '给水杯倒半杯温水，放在手边，告诉自己：我在照顾身体。'
    },
    {
      id: 'off_e2',
      title: '三次深呼吸',
      type: 'care',
      color: 'green',
      desc: '坐直或站直，缓慢做 3 次深呼吸，感受胸腔的起伏，邀请平静到来。'
    },
    {
      id: 'off_e3',
      title: '整理枕头',
      type: 'focus',
      color: 'yellow',
      desc: '把枕头拍松整平，为休息做好准备，让房间也进入舒缓状态。'
    }
  ]
};

// 获取离线兜底任务
function normalizeTask(task, index) {
  if (!task || !task.id || !task.title) {
    throw new Error(`Task ${index} missing required fields`);
  }

  const type = typeof task.type === 'string' ? task.type.toLowerCase() : 'care';
  const colorFromType = TYPE_COLOR_MAP[type];
  const color = typeof task.color === 'string' && task.color.length <= 10
    ? task.color.toLowerCase()
    : colorFromType || 'green';

  return {
    id: String(task.id).substring(0, 12),
    title: String(task.title).substring(0, 24),
    type: colorFromType ? type : 'care',
    color: colorFromType || (['blue', 'green', 'yellow'].includes(color) ? color : 'green'),
    desc: task.desc ? String(task.desc).substring(0, 180) : '请用 60 秒完成一个简单的小动作，观察身体和呼吸的变化。'
  };
}

// 获取离线兜底任务
function getFallbackTasks(timeOfDay) {
  const timeKey = timeOfDay === 'morning' || timeOfDay === 'noon' || timeOfDay === 'evening'
    ? timeOfDay
  const timeKey = timeOfDay === 'morning' || timeOfDay === 'noon' || timeOfDay === 'evening'
    ? timeOfDay
    : 'evening'; // 默认使用 evening
  
  const pool = FALLBACK_TASKS[timeKey];
  // 取前 3 条并做一次规范化，确保字段齐全
  // 取前 3 条并做一次规范化，确保字段齐全
  const selected = [];
  for (let i = 0; i < 3; i++) {
    selected.push(normalizeTask(pool[i % pool.length], i));
    selected.push(normalizeTask(pool[i % pool.length], i));
  }
  return selected;
}

export default async function handler(req, res) {
  // 只接受 POST 请求
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { mood, energy, timeOfDay, place } = req.body;

  // 验证必需参数
  if (typeof mood !== 'number' || mood < -2 || mood > 2) {
    return res.status(400).json({ error: 'Invalid mood, must be -2 to 2' });
  }
  if (typeof energy !== 'number' || energy < 1 || energy > 5) {
    return res.status(400).json({ error: 'Invalid energy, must be 1 to 5' });
  }

  const apiKey = process.env.DEEPSEEK_API_KEY;
  const useFallback = !apiKey;

  // 如果缺少 API Key，直接返回离线兜底任务
  if (useFallback) {
    const fallbackTasks = getFallbackTasks(timeOfDay);
    return res.status(200).json({ 
      tasks: fallbackTasks,
      source: 'fallback'
    });
  }

  // 构建 DeepSeek 提示词
  const systemPrompt = `你是行为激活(BA)教练。严格输出 JSON 对象，结构：
{"tasks":[{"id":"string","title":"string","type":"body|care|focus","color":"blue|green|yellow","desc":"string"}, ...]}
{"tasks":[{"id":"string","title":"string","type":"body|care|focus","color":"blue|green|yellow","desc":"string"}, ...]}

生成 3 个不同的候选任务：
1) ≤60 秒可启动；2) 室内即可完成；3) 避免抽象口号；4) title 以动词开头简洁可执行；5) id 用英数字短码；6) type 限定 body(身体唤醒)/care(自我关照)/focus(专注时刻)；7) color 与 type 匹配：body=blue, care=green, focus=yellow。
title ≤24 中文字符，desc ≤180 中文字符。`;
1) ≤60 秒可启动；2) 室内即可完成；3) 避免抽象口号；4) title 以动词开头简洁可执行；5) id 用英数字短码；6) type 限定 body(身体唤醒)/care(自我关照)/focus(专注时刻)；7) color 与 type 匹配：body=blue, care=green, focus=yellow。
title ≤24 中文字符，desc ≤180 中文字符。`;

  const userPrompt = `用户当前状态：
- 心情：${mood}（-2 很糟糕，0 中性，+2 很好）
- 能量：${energy}/5
- 时段：${timeOfDay || '未指定'}
${place ? `- 地点：${place}` : ''}

请生成 3 个适合的微任务，要求：
1. 每个任务可在 60 秒内启动，室内即可完成
2. 具体可执行，避免抽象口号
3. title 以动词开头，简洁明了
4. id 使用英数字短码（如 "a1", "b2", "c3"）
5. 输出字段：id, title, type(body|care|focus), color(blue|green|yellow), desc（一句话引导语）
1. 每个任务可在 60 秒内启动，室内即可完成
2. 具体可执行，避免抽象口号
3. title 以动词开头，简洁明了
4. id 使用英数字短码（如 "a1", "b2", "c3"）
5. 输出字段：id, title, type(body|care|focus), color(blue|green|yellow), desc（一句话引导语）

严格输出 JSON 格式，只包含 tasks 数组。`;
严格输出 JSON 格式，只包含 tasks 数组。`;

  try {
    // 使用 AbortController 实现超时
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 秒超时

    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        response_format: { type: 'json_object' },
        max_tokens: 800,
        temperature: 0.7
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('DeepSeek API error:', response.status, errorText);
      
      // API 错误时返回离线兜底任务
      const fallbackTasks = getFallbackTasks(timeOfDay);
      return res.status(200).json({ 
        tasks: fallbackTasks,
        source: 'fallback',
        error: `DeepSeek API returned ${response.status}`
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return res.status(500).json({ 
        error: 'BadShape', 
        raw: 'No content in response' 
      });
    }

    // 解析 JSON
    let tasksData;
    try {
      tasksData = JSON.parse(content);
    } catch (parseError) {
      // JSON 解析失败时返回离线兜底任务
      const fallbackTasks = getFallbackTasks(timeOfDay);
      return res.status(200).json({ 
        tasks: fallbackTasks,
        source: 'fallback',
        error: 'UpstreamNonJSON'
      });
    }

    // 验证结构
    if (!tasksData.tasks || !Array.isArray(tasksData.tasks) || tasksData.tasks.length === 0) {
      // 结构错误时返回离线兜底任务
      const fallbackTasks = getFallbackTasks(timeOfDay);
      return res.status(200).json({
      return res.status(200).json({
        tasks: fallbackTasks,
        source: 'fallback',
        error: 'BadShape'
      });
    }

    // 清洗和验证每个任务
    const cleanedTasks = tasksData.tasks.slice(0, 3).map((task, index) => normalizeTask(task, index));
    const cleanedTasks = tasksData.tasks.slice(0, 3).map((task, index) => normalizeTask(task, index));

    // 确保至少有 3 个任务
    while (cleanedTasks.length < 3) {
      cleanedTasks.push(normalizeTask({
      cleanedTasks.push(normalizeTask({
        id: `fallback_${cleanedTasks.length}`,
        title: '完成一个简单动作',
        type: 'care',
        color: 'green',
        desc: '选择一个你能立即开始的小动作，完成后深呼吸一次。'
      }, cleanedTasks.length));
        type: 'care',
        color: 'green',
        desc: '选择一个你能立即开始的小动作，完成后深呼吸一次。'
      }, cleanedTasks.length));
    }

    return res.status(200).json({ 
      tasks: cleanedTasks,
      source: 'deepseek'
    });

  } catch (error) {
    console.error('Error calling DeepSeek API:', error);
    
    // 任何异常都返回离线兜底任务
    const fallbackTasks = getFallbackTasks(timeOfDay);
    return res.status(200).json({ 
      tasks: fallbackTasks,
      source: 'fallback',
      error: error.name === 'AbortError' || error.message.includes('timeout') 
        ? 'Request timeout' 
        : error.message
    });
  }
}

