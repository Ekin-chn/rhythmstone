// 离线兜底任务池
const FALLBACK_TASKS = {
  morning: [
    { id: 'off_m1', title: '起身喝一口水', min_action: '现在倒半杯水，喝一口；注意觉察喉咙的感受。', feedback: '对自己点头：我开始动起来了。' },
    { id: 'off_m2', title: '开窗呼吸 3 次', min_action: '走到窗边，打开窗户，深呼吸 3 次，感受新鲜空气。', feedback: '轻拍肩膀两下，微笑一下。' },
    { id: 'off_m3', title: '洗把脸并擦干', min_action: '去洗手台，用冷水拍脸 3 次，拿毛巾擦干。', feedback: '看向镜子说：做得好。' }
  ],
  noon: [
    { id: 'off_n1', title: '站起转一圈', min_action: '从座位上站起，慢慢转一圈，活动一下身体。', feedback: '对自己说：我动起来了。' },
    { id: 'off_n2', title: '走到窗边看 10 秒', min_action: '走到最近的窗边，向外看 10 秒，观察外面的景色。', feedback: '深呼吸一次，回到座位。' },
    { id: 'off_n3', title: '整理桌面一角', min_action: '整理桌面的一角，把不需要的东西放到一边。', feedback: '轻拍桌面，说：好多了。' }
  ],
  evening: [
    { id: 'off_e1', title: '把水杯装半杯水', min_action: '现在就去把水杯装半杯水，放在手边。', feedback: '对自己点头、说"我又迈出一步"。' },
    { id: 'off_e2', title: '做 3 次深呼吸', min_action: '坐直或站直，缓慢地做 3 次深呼吸，感受气息。', feedback: '轻拍胸口，说：我放松了。' },
    { id: 'off_e3', title: '收拾床铺一角', min_action: '整理床铺的一角，把被子或枕头摆正。', feedback: '看向床铺，说：整洁多了。' }
  ]
};

// 获取离线兜底任务
function getFallbackTasks(timeOfDay) {
  const timeKey = timeOfDay === 'morning' || timeOfDay === 'noon' || timeOfDay === 'evening' 
    ? timeOfDay 
    : 'evening'; // 默认使用 evening
  
  const pool = FALLBACK_TASKS[timeKey];
  // 随机选择 3 条，如果不足 3 条则重复
  const selected = [];
  for (let i = 0; i < 3; i++) {
    selected.push(pool[i % pool.length]);
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
{"tasks":[{"id":"string","title":"string","min_action":"string","feedback":"string"}, ...]}

生成 3 个不同的候选任务：
1) ≤60 秒可启动；2) 室内即可完成；3) 避免抽象口号；4) title 以动词开头简洁可执行；5) id 用英数字短码。
title 不超过 24 个中文字符，min_action 和 feedback 各不超过 120 个中文字符。`;

  const userPrompt = `用户当前状态：
- 心情：${mood}（-2 很糟糕，0 中性，+2 很好）
- 能量：${energy}/5
- 时段：${timeOfDay || '未指定'}
${place ? `- 地点：${place}` : ''}

请生成 3 个适合的微任务，要求：
1. 每个任务可在 60 秒内启动
2. 室内即可完成
3. 具体可执行，避免抽象口号
4. title 以动词开头，简洁明了
5. id 使用英数字短码（如 "a1", "b2", "c3"）

严格输出 JSON 格式，只包含 tasks 数组，每个任务包含 id、title、min_action、feedback 四个字段。`;

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
        tasks: fallbackTasks,
        source: 'fallback',
        error: 'BadShape'
      });
    }

    // 清洗和验证每个任务
    const cleanedTasks = tasksData.tasks.slice(0, 3).map((task, index) => {
      if (!task.id || !task.title || !task.min_action || !task.feedback) {
        throw new Error(`Task ${index} missing required fields`);
      }

      return {
        id: String(task.id).substring(0, 10), // 限制长度
        title: String(task.title).substring(0, 24),
        min_action: String(task.min_action).substring(0, 120),
        feedback: String(task.feedback).substring(0, 120)
      };
    });

    // 确保至少有 3 个任务
    while (cleanedTasks.length < 3) {
      cleanedTasks.push({
        id: `fallback_${cleanedTasks.length}`,
        title: '完成一个简单动作',
        min_action: '选择一个你能立即开始的小动作。',
        feedback: '做得好，你已经开始行动了。'
      });
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

