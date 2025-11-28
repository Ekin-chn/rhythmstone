// 简易完成记录回显接口：仅存储在内存日志中，便于本地预览与 Vercel 调试
const inMemoryLogs = [];

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const payload = typeof req.body === 'object' ? req.body : {};
    const record = {
      ...payload,
      ts: Date.now(),
    };

    // 内存存储最近 50 条，便于开发验证
    inMemoryLogs.unshift(record);
    if (inMemoryLogs.length > 50) {
      inMemoryLogs.pop();
    }

    return res.status(200).json({ ok: true, received: record, recent: inMemoryLogs.slice(0, 10) });
  } catch (error) {
    console.error('[api/log] 处理失败', error);
    return res.status(500).json({ error: 'LogError', detail: error.message });
  }
}
