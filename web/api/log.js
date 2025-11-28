export default async function handler(req, res) {
  // 只接受 POST 请求
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { title, ts, mood, energy } = req.body;

  // 验证必需参数
  if (!title || typeof ts !== 'number') {
    return res.status(400).json({ error: 'Missing required fields: title, ts' });
  }

  // MVP 阶段：仅回显，后续可接入 KV / DB 做持久化
  const logEntry = {
    title: String(title),
    ts: Number(ts),
    mood: mood !== undefined ? Number(mood) : null,
    energy: energy !== undefined ? Number(energy) : null
  };

  // TODO: 后续可接入 Vercel KV 或数据库
  // await kv.set(`log:${ts}`, JSON.stringify(logEntry));

  return res.status(200).json({
    ok: true,
    echo: logEntry
  });
}

