// ==================== localStorage 工具函数 ====================
const STORAGE_KEYS = {
  RECENT_SHOWN: 'recentShown',
  HISTORY_LIST: 'historyList'
};

function getRecentShown() {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.RECENT_SHOWN);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
}

function addRecentShown(title) {
  try {
    let recent = getRecentShown();
    recent = recent.filter(t => t !== title);
    recent.unshift(title);
    if (recent.length > 30) recent = recent.slice(0, 30);
    localStorage.setItem(STORAGE_KEYS.RECENT_SHOWN, JSON.stringify(recent));
  } catch (e) {
    console.error('Failed to save recentShown:', e);
  }
}

function clearRecentShown() {
  try {
    localStorage.removeItem(STORAGE_KEYS.RECENT_SHOWN);
  } catch (e) {
    console.error('Failed to clear recentShown:', e);
  }
}

function getHistoryList() {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.HISTORY_LIST);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
}

function addHistoryItem(record) {
  try {
    let history = getHistoryList();
    history.unshift(record);
    if (history.length > 200) history = history.slice(0, 200);
    localStorage.setItem(STORAGE_KEYS.HISTORY_LIST, JSON.stringify(history));
  } catch (e) {
    console.error('Failed to save history:', e);
  }
}

function clearHistoryList() {
  try {
    localStorage.removeItem(STORAGE_KEYS.HISTORY_LIST);
  } catch (e) {
    console.error('Failed to clear history:', e);
  }
}

// ==================== 状态管理 ====================
const TYPE_COLORS = {
  body: '#00D2FF',
  care: '#4CAF50',
  focus: '#FFC107'
};

const TYPE_ICONS = {
  body: 'run',
  care: 'leaf',
  focus: 'target'
};

const TYPE_LABELS = {
  body: '身体唤醒',
  care: '自我关照',
  focus: '专注时刻'
};

let currentTasks = [];
let currentIndex = 0;
let currentSelectedTask = null;
let currentMood = 0;
let currentEnergy = 3;
let currentTimeOfDay = 'evening';
let currentPlace = '';
let deviceConnected = false;
let deviceSocket = null;
let reconnectTimer = null;
let manualDisconnect = false;
let ttsEnabled = true;

// ==================== DOM 元素 ====================
const elements = {
  moodInput: document.getElementById('moodInput'),
  moodValue: document.getElementById('moodValue'),
  energyInput: document.getElementById('energyInput'),
  energyValue: document.getElementById('energyValue'),
  timeOfDayInput: document.getElementById('timeOfDayInput'),
  placeInput: document.getElementById('placeInput'),
  getRecommendBtn: document.getElementById('getRecommendBtn'),
  changeTaskBtn: document.getElementById('changeTaskBtn'),
  prevTaskBtn: document.getElementById('prevTaskBtn'),
  nextTaskBtn: document.getElementById('nextTaskBtn'),
  clearRecentBtn: document.getElementById('clearRecentBtn'),
  statusBadge: document.getElementById('statusBadge'),
  deviceStatusBadge: document.getElementById('deviceStatusBadge'),
  deviceEndpointInput: document.getElementById('deviceEndpointInput'),
  connectDeviceBtn: document.getElementById('connectDeviceBtn'),
  disconnectDeviceBtn: document.getElementById('disconnectDeviceBtn'),
  inputForm: document.getElementById('inputForm'),
  loadingSection: document.getElementById('loadingSection'),
  taskCardsArea: document.getElementById('taskCardsArea'),
  taskCardsContainer: document.getElementById('taskCardsContainer'),
  detailPage: document.getElementById('detailPage'),
  detailTitle: document.getElementById('detailTitle'),
  detailDesc: document.getElementById('detailDesc'),
  detailMeta: document.getElementById('detailMeta'),
  backBtn: document.getElementById('backBtn'),
  completeBtn: document.getElementById('completeBtn'),
  historyList: document.getElementById('historyList'),
  clearHistoryBtn: document.getElementById('clearHistoryBtn'),
  errorMessage: document.getElementById('errorMessage'),
  mockDeviceToggle: document.getElementById('mockDeviceToggle'),
  celebrationOverlay: document.getElementById('celebrationOverlay')
};

// ==================== 工具函数 ====================
function formatTimestamp(ts) {
  const now = Date.now();
  const diff = now - ts;
  const date = new Date(ts);
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}天前`;
  return date.toLocaleDateString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function updateStatusBadge(text, type = '') {
  elements.statusBadge.textContent = text;
  elements.statusBadge.className = 'status-badge ' + type;
}

function showError(message) {
  elements.errorMessage.textContent = message;
  elements.errorMessage.style.display = 'block';
  setTimeout(() => {
    elements.errorMessage.style.display = 'none';
  }, 5000);
}

function hideAllViews() {
  elements.loadingSection.style.display = 'none';
  elements.taskCardsArea.style.display = 'none';
  elements.detailPage.classList.remove('active');
}

function decorateTask(task) {
  const type = (task.type || 'care').toLowerCase();
  const safeType = TYPE_COLORS[type] ? type : 'care';
  return {
    ...task,
    type: safeType,
    color: task.color && TYPE_COLORS[task.color] ? task.color : safeType,
    desc: task.desc || task.min_action || task.feedback || '花 1 分钟做一个小动作，观察身体与心情的细微变化。'
  };
}

function normalizeColor(color) {
  const key = (color || '').toLowerCase();
  if (['blue', 'green', 'yellow'].includes(key)) return key;
  const matched = Object.entries(TYPE_COLORS).find(([, hex]) => hex.toLowerCase() === key);
  return matched ? matched[0] : 'blue';
}

function getTaskIcon(task) {
  const t = (task?.type || '').toLowerCase();
  return TYPE_ICONS[t] || 'spark';
}

function sendCommand(payload) {
  if (!deviceSocket || deviceSocket.readyState !== WebSocket.OPEN) {
    console.warn('[WS] 未连接，指令被忽略', payload);
    return;
  }
  try {
    deviceSocket.send(JSON.stringify(payload));
  } catch (err) {
    console.error('[WS] 发送失败', err);
  }
}

function pushTaskToDevice(task) {
  const colorKey = normalizeColor(task.color || task.type);
  syncColor(colorKey);
  sendCommand({ cmd: 'display', icon: getTaskIcon(task) });
}

function syncColor(color) {
  const colorKey = normalizeColor(color);
  console.log('[ColorSync]', colorKey);
  sendCommand({ cmd: 'color', value: colorKey });
}

function updateDeviceStatus(isConnected, textOverride) {
  deviceConnected = isConnected;
  const text = textOverride || (isConnected ? '🟢 设备已连接' : '🔴 设备未连接');
  elements.deviceStatusBadge.textContent = text;
  elements.deviceStatusBadge.className = 'status-badge connection ' + (isConnected ? 'online' : 'offline');
}

function speakText(text) {
  if (!ttsEnabled || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = 'zh-CN';
  utter.rate = 1;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utter);
}

// ==================== API 调用 ====================
async function fetchRecommendations(mood, energy, timeOfDay, place) {
  const response = await fetch('/api/recommend', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mood, energy, timeOfDay, place: place || '' })
  });

  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

function logCompletion(record) {
  try {
    fetch('/api/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record)
    }).catch(err => console.error('Failed to log completion:', err));
  } catch (e) {
    console.error('Failed to log completion:', e);
  }
}

// ==================== 设备通信（WebSocket） ====================
function resolveDeviceEndpoint() {
  const manual = elements.deviceEndpointInput.value.trim();
  if (manual) return manual;
  const { protocol, host } = window.location;
  const wsProtocol = protocol === 'https:' ? 'wss' : 'ws';
  return `${wsProtocol}://${host}/ws`;
}

function connectDevice() {
  const url = resolveDeviceEndpoint();
  manualDisconnect = false;
  if (deviceSocket) {
    try { deviceSocket.close(); } catch (e) { /* ignore */ }
  }

  updateDeviceStatus(false, '🟡 正在连接...');
  deviceSocket = new WebSocket(url);

  deviceSocket.onopen = () => {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    updateDeviceStatus(true, '🟢 设备在线');
    speakText('设备已连接，可以开始倾斜选择');
    // 上线后同步当前任务
    if (currentTasks.length) {
      pushTaskToDevice(currentTasks[currentIndex]);
    }
  };

  deviceSocket.onmessage = (event) => {
    try {
      const payload = JSON.parse(event.data);
      handleDeviceAction(payload.action);
    } catch (e) {
      console.error('[WS] 消息解析失败', e);
    }
  };

  deviceSocket.onerror = (err) => {
    console.error('[WS] 连接错误', err);
    updateDeviceStatus(false, '🔴 连接异常');
  };

  deviceSocket.onclose = () => {
    updateDeviceStatus(false);
    if (!manualDisconnect) {
      reconnectTimer = setTimeout(connectDevice, 2000);
    }
  };
}

function disconnectDevice() {
  manualDisconnect = true;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (deviceSocket) {
    try { deviceSocket.close(); } catch (e) { /* ignore */ }
  }
  updateDeviceStatus(false, '🔴 已断开');
}

function handleDeviceAction(action) {
  if (!action) return;
  switch (action) {
    case 'wake': {
      updateStatusBadge('硬件轻握唤醒', 'success');
      speakCurrentTask('设备已唤醒，当前任务：');
      if (currentTasks.length) {
        pushTaskToDevice(currentTasks[currentIndex]);
      }
      break;
    }
    case 'next': {
      handleNext();
      speakCurrentTask('切换到');
      break;
    }
    case 'prev': {
      handlePrev();
      speakCurrentTask('切换到');
      break;
    }
    case 'confirm': {
      if (isDetailOpen()) {
        handleComplete();
      } else if (currentTasks.length) {
        const task = currentTasks[currentIndex];
        showTaskDetail(task);
        sendVibrate('short');
        speakText(`已选择 ${task.title}，用力一握即可完成`);
      }
      break;
    }
    default:
      console.warn('[WS] 未识别的动作', action);
  }
}

function speakCurrentTask(prefix = '当前任务：') {
  if (!currentTasks.length) {
    speakText('尚未获取任务，先在网页上点击获取推荐');
    return;
  }
  const task = currentTasks[currentIndex];
  speakText(`${prefix}${task.title}`);
}

function sendVibrate(pattern = 'short') {
  sendCommand({ cmd: 'vibrate', pattern });
}

function isDetailOpen() {
  return elements.detailPage.classList.contains('active');
}

// ==================== 渲染函数 ====================
function renderTaskCards() {
  const container = elements.taskCardsContainer;
  if (!currentTasks.length) {
    container.innerHTML = '<div class="empty-state">暂无任务，请重新获取推荐</div>';
    return;
  }

  container.innerHTML = '';
  currentTasks.forEach((task, index) => {
    const isActive = index === currentIndex;
    const card = document.createElement('div');
    card.className = 'task-card ' + (isActive ? 'active' : 'inactive');

    const color = TYPE_COLORS[task.color] || TYPE_COLORS[task.type] || '#5b8def';
    const dot = `<span class="color-dot" style="background:${color};"></span>`;
    const typeLabel = TYPE_LABELS[task.type] || '自我关照';

    card.innerHTML = `
      <div class="task-meta">${dot}<span>${typeLabel}</span></div>
      <div class="task-title">${escapeHtml(task.title)}</div>
      <div class="task-desc">${escapeHtml(task.desc)}</div>
    `;

    card.addEventListener('click', () => {
      if (currentIndex !== index) {
        setActiveIndex(index);
        renderTaskCards();
        return;
      }
      showTaskDetail(task);
    });

    container.appendChild(card);
  });
}

function showTaskDetail(task) {
  currentSelectedTask = task;
  hideAllViews();
  elements.detailPage.classList.add('active');
  elements.detailTitle.textContent = task.title;
  elements.detailDesc.textContent = task.desc;
  const color = TYPE_COLORS[task.color] || TYPE_COLORS[task.type] || '#5b8def';
  const typeLabel = TYPE_LABELS[task.type] || '自我关照';
  elements.detailMeta.innerHTML = `<span class="color-dot" style="background:${color};"></span> ${typeLabel} · ${color}`;
  pushTaskToDevice(task);
}

function renderHistoryList() {
  const history = getHistoryList();
  const container = elements.historyList;
  if (!history.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div style="font-size: 42px;">📝</div>
        <div>暂无完成记录</div>
      </div>
    `;
    return;
  }

  container.innerHTML = history.map(item => {
    const color = TYPE_COLORS[item.type] || '#5b8def';
    const typeLabel = TYPE_LABELS[item.type] || '记录';
    return `
      <div class="history-item">
        <div class="history-left">
          <span class="color-dot" style="background:${color};"></span>
          <div>
            <div>${escapeHtml(item.title)}</div>
            <div class="history-time">${formatTimestamp(item.ts)}</div>
          </div>
        </div>
        <div class="pill">${typeLabel}</div>
      </div>
    `;
  }).join('');
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text || '';
  return div.innerHTML;
}

// ==================== 行为函数 ====================
function setActiveIndex(newIndex) {
  if (!currentTasks.length) return;
  currentIndex = (newIndex + currentTasks.length) % currentTasks.length;
  const activeTask = currentTasks[currentIndex];
  addRecentShown(activeTask.title);
  pushTaskToDevice(activeTask);
}

function showLoading() {
  hideAllViews();
  elements.loadingSection.style.display = 'block';
}

function showTasksArea() {
  hideAllViews();
  elements.taskCardsArea.style.display = 'block';
}

async function loadTasks({ mood, energy, timeOfDay, place, sourceTextPrefix, button }) {
  if (!button) return;

  currentMood = mood;
  currentEnergy = energy;
  currentTimeOfDay = timeOfDay;
  currentPlace = place;

  const isRefresh = sourceTextPrefix === '已刷新';
  const loadingText = isRefresh ? '正在获取新推荐...' : '正在获取推荐...';
  button.disabled = true;
  updateStatusBadge(loadingText, '');
  showLoading();

  try {
    const data = await fetchRecommendations(mood, energy, timeOfDay, place);
    currentTasks = (data.tasks || []).map(decorateTask);
    if (!currentTasks.length) throw new Error('未获取到任务');

    setActiveIndex(0);
    renderTaskCards();
    showTasksArea();

    const sourceText = data.source === 'deepseek' ? 'DeepSeek 推荐' : '离线兜底';
    updateStatusBadge(`${sourceTextPrefix} ${currentTasks.length} 条任务（${sourceText}）`, data.source === 'deepseek' ? 'success' : 'fallback');
  } catch (error) {
    console.error('Failed to load tasks:', error);
    showError(isRefresh ? '获取新推荐失败，请稍后重试' : '获取推荐失败，请稍后重试');
    updateStatusBadge('获取失败', 'error');
    hideAllViews();
    if (currentTasks.length) {
      showTasksArea();
    } else {
      elements.inputForm.style.display = 'block';
    }
  } finally {
    button.disabled = false;
  }
}

async function handleGetRecommend() {
  const mood = parseInt(elements.moodInput.value, 10);
  const energy = parseInt(elements.energyInput.value, 10);
  const timeOfDay = elements.timeOfDayInput.value;
  const place = elements.placeInput.value.trim();

  await loadTasks({
    mood,
    energy,
    timeOfDay,
    place,
    sourceTextPrefix: '获取到',
    button: elements.getRecommendBtn
  });
}

async function handleChangeTask() {
  if (elements.changeTaskBtn.disabled) return;

  await loadTasks({
    mood: currentMood,
    energy: currentEnergy,
    timeOfDay: currentTimeOfDay,
    place: currentPlace,
    sourceTextPrefix: '已刷新',
    button: elements.changeTaskBtn
  });
}

function handlePrev() {
  if (!currentTasks.length) return;
  setActiveIndex(currentIndex - 1);
  renderTaskCards();
}

function handleNext() {
  if (!currentTasks.length) return;
  setActiveIndex(currentIndex + 1);
  renderTaskCards();
}

async function handleComplete() {
  if (!currentSelectedTask) return;
  const ts = Date.now();
  const record = {
    title: currentSelectedTask.title,
    ts,
    mood: currentMood,
    energy: currentEnergy,
    type: currentSelectedTask.type
  };

  addHistoryItem(record);
  renderHistoryList();
  logCompletion(record);
  triggerCelebration();
  sendVibrate('long');
  updateStatusBadge('任务已完成！', 'success');

  setTimeout(() => updateStatusBadge('等待获取推荐'), 3000);
  currentSelectedTask = null;
  hideAllViews();
  elements.taskCardsArea.style.display = currentTasks.length ? 'block' : 'none';
}

function triggerCelebration() {
  const overlay = elements.celebrationOverlay;
  overlay.classList.add('active');
  spawnConfetti(overlay, 24);
  setTimeout(() => overlay.classList.remove('active'), 1800);
}

function spawnConfetti(container, count) {
  for (let i = 0; i < count; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti';
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.animationDelay = `${Math.random() * 0.6}s`;
    piece.style.background = Math.random() > 0.5 ? 'linear-gradient(120deg,#5b8def,#00d2ff)' : 'linear-gradient(120deg,#ffc107,#ff7f50)';
    container.appendChild(piece);
    setTimeout(() => piece.remove(), 1200);
  }
}

// ==================== 事件绑定 ====================
elements.moodInput.addEventListener('input', (e) => {
  elements.moodValue.textContent = e.target.value;
});

elements.energyInput.addEventListener('input', (e) => {
  elements.energyValue.textContent = e.target.value;
});

elements.getRecommendBtn.addEventListener('click', handleGetRecommend);
elements.changeTaskBtn.addEventListener('click', handleChangeTask);
elements.prevTaskBtn.addEventListener('click', handlePrev);
elements.nextTaskBtn.addEventListener('click', handleNext);
elements.connectDeviceBtn.addEventListener('click', connectDevice);
elements.disconnectDeviceBtn.addEventListener('click', disconnectDevice);
elements.clearRecentBtn.addEventListener('click', () => {
  clearRecentShown();
  alert('已清空近期已看记录');
});

elements.backBtn.addEventListener('click', () => {
  elements.detailPage.classList.remove('active');
  elements.taskCardsArea.style.display = 'block';
});

elements.completeBtn.addEventListener('click', handleComplete);

elements.clearHistoryBtn.addEventListener('click', () => {
  if (confirm('确定要清空所有历史记录吗？')) {
    clearHistoryList();
    renderHistoryList();
  }
});

elements.mockDeviceToggle.addEventListener('click', () => {
  updateDeviceStatus(!deviceConnected);
});

// 初始状态
renderHistoryList();
updateDeviceStatus(false);
updateStatusBadge('等待获取推荐');
connectDevice();
