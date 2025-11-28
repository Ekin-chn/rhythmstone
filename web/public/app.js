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

function syncColor(color) {
  console.log('[ColorSync]', color);
}

function updateDeviceStatus(isConnected) {
  deviceConnected = isConnected;
  elements.deviceStatusBadge.textContent = isConnected ? '🟢 设备已连接' : '🔴 设备未连接';
  elements.deviceStatusBadge.className = 'status-badge connection ' + (isConnected ? 'online' : 'offline');
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
  syncColor(activeTask.color || activeTask.type);
}

function showLoading() {
  hideAllViews();
  elements.loadingSection.style.display = 'block';
}

function showTasksArea() {
  hideAllViews();
  elements.taskCardsArea.style.display = 'block';
}

async function handleGetRecommend() {
  const mood = parseInt(elements.moodInput.value, 10);
  const energy = parseInt(elements.energyInput.value, 10);
  const timeOfDay = elements.timeOfDayInput.value;
  const place = elements.placeInput.value.trim();

  currentMood = mood;
  currentEnergy = energy;
  currentTimeOfDay = timeOfDay;
  currentPlace = place;

  elements.getRecommendBtn.disabled = true;
  updateStatusBadge('正在获取推荐...', '');
  showLoading();

  try {
    const data = await fetchRecommendations(mood, energy, timeOfDay, place);
    currentTasks = (data.tasks || []).map(decorateTask);
    if (!currentTasks.length) throw new Error('未获取到任务');

    setActiveIndex(0);
    renderTaskCards();
    showTasksArea();

    const sourceText = data.source === 'deepseek' ? 'DeepSeek 推荐' : '离线兜底';
    updateStatusBadge(`获取到 ${currentTasks.length} 条任务（${sourceText}）`, data.source === 'deepseek' ? 'success' : 'fallback');
  } catch (error) {
    console.error('Failed to get recommendations:', error);
    showError('获取推荐失败，请稍后重试');
    updateStatusBadge('获取失败', 'error');
    hideAllViews();
    elements.inputForm.style.display = 'block';
  } finally {
    elements.getRecommendBtn.disabled = false;
  }
}

async function handleChangeTask() {
  if (elements.changeTaskBtn.disabled) return;
  elements.changeTaskBtn.disabled = true;
  updateStatusBadge('正在获取新推荐...', '');
  showLoading();

  try {
    const data = await fetchRecommendations(currentMood, currentEnergy, currentTimeOfDay, currentPlace);
    currentTasks = (data.tasks || []).map(decorateTask);
    if (!currentTasks.length) throw new Error('未获取到任务');

    setActiveIndex(0);
    renderTaskCards();
    showTasksArea();

    const sourceText = data.source === 'deepseek' ? 'DeepSeek 推荐' : '离线兜底';
    updateStatusBadge(`已刷新 ${currentTasks.length} 条任务（${sourceText}）`, data.source === 'deepseek' ? 'success' : 'fallback');
  } catch (error) {
    console.error('Failed to change task:', error);
    showError('获取新推荐失败，请稍后重试');
    updateStatusBadge('获取失败', 'error');
  } finally {
    elements.changeTaskBtn.disabled = false;
  }
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
