// ==================== localStorage 工具函数 ====================

const STORAGE_KEYS = {
  RECENT_SHOWN: 'recentShown',
  HISTORY_LIST: 'historyList'
};

// 获取近期已展示的任务标题（最多30条）
function getRecentShown() {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.RECENT_SHOWN);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
}

// 添加近期已展示的任务标题
function addRecentShown(title) {
  try {
    let recent = getRecentShown();
    // 如果已存在，先移除
    recent = recent.filter(t => t !== title);
    // 添加到开头
    recent.unshift(title);
    // 限制最多30条
    if (recent.length > 30) {
      recent = recent.slice(0, 30);
    }
    localStorage.setItem(STORAGE_KEYS.RECENT_SHOWN, JSON.stringify(recent));
  } catch (e) {
    console.error('Failed to save recentShown:', e);
  }
}

// 清空近期已展示
function clearRecentShown() {
  try {
    localStorage.removeItem(STORAGE_KEYS.RECENT_SHOWN);
  } catch (e) {
    console.error('Failed to clear recentShown:', e);
  }
}

// 获取历史完成记录（最多200条）
function getHistoryList() {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.HISTORY_LIST);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
}

// 添加历史完成记录
function addHistoryItem(title, ts, mood, energy) {
  try {
    let history = getHistoryList();
    // 添加到开头
    history.unshift({ title, ts, mood, energy });
    // 限制最多200条
    if (history.length > 200) {
      history = history.slice(0, 200);
    }
    localStorage.setItem(STORAGE_KEYS.HISTORY_LIST, JSON.stringify(history));
  } catch (e) {
    console.error('Failed to save history:', e);
  }
}

// 清空历史记录
function clearHistoryList() {
  try {
    localStorage.removeItem(STORAGE_KEYS.HISTORY_LIST);
  } catch (e) {
    console.error('Failed to clear history:', e);
  }
}

// ==================== 状态管理 ====================

let currentTasks = [];
let currentSelectedTask = null;
let currentMood = 0;
let currentEnergy = 3;
let currentTimeOfDay = 'evening';
let currentPlace = '';

// ==================== DOM 元素 ====================

const elements = {
  // 输入表单
  moodInput: document.getElementById('moodInput'),
  moodValue: document.getElementById('moodValue'),
  energyInput: document.getElementById('energyInput'),
  energyValue: document.getElementById('energyValue'),
  timeOfDayInput: document.getElementById('timeOfDayInput'),
  placeInput: document.getElementById('placeInput'),
  getRecommendBtn: document.getElementById('getRecommendBtn'),

  // 状态和UI
  statusBadge: document.getElementById('statusBadge'),
  inputForm: document.getElementById('inputForm'),
  loadingSkeleton: document.getElementById('loadingSkeleton'),
  taskCardsArea: document.getElementById('taskCardsArea'),
  taskCardsContainer: document.getElementById('taskCardsContainer'),
  changeTaskBtn: document.getElementById('changeTaskBtn'),
  clearRecentBtn: document.getElementById('clearRecentBtn'),
  errorMessage: document.getElementById('errorMessage'),

  // 详情页
  detailPage: document.getElementById('detailPage'),
  detailTitle: document.getElementById('detailTitle'),
  detailMinAction: document.getElementById('detailMinAction'),
  detailFeedback: document.getElementById('detailFeedback'),
  backBtn: document.getElementById('backBtn'),
  completeBtn: document.getElementById('completeBtn'),

  // 历史列表
  historyList: document.getElementById('historyList'),
  clearHistoryBtn: document.getElementById('clearHistoryBtn')
};

// ==================== 工具函数 ====================

// 格式化时间戳
function formatTimestamp(ts) {
  const date = new Date(ts);
  const now = new Date();
  const diff = now - date;
  
  if (diff < 60000) {
    return '刚刚';
  } else if (diff < 3600000) {
    return `${Math.floor(diff / 60000)}分钟前`;
  } else if (diff < 86400000) {
    return `${Math.floor(diff / 3600000)}小时前`;
  } else if (diff < 604800000) {
    return `${Math.floor(diff / 86400000)}天前`;
  } else {
    return date.toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}

// 更新状态徽标
function updateStatusBadge(text, type = '') {
  elements.statusBadge.textContent = text;
  elements.statusBadge.className = 'status-badge ' + type;
}

// 显示错误信息
function showError(message) {
  elements.errorMessage.textContent = message;
  elements.errorMessage.style.display = 'block';
  setTimeout(() => {
    elements.errorMessage.style.display = 'none';
  }, 5000);
}

// 隐藏所有视图
function hideAllViews() {
  elements.inputForm.style.display = 'none';
  elements.loadingSkeleton.style.display = 'none';
  elements.taskCardsArea.style.display = 'none';
  elements.detailPage.classList.remove('active');
}

// ==================== API 调用 ====================

// 获取推荐任务
async function fetchRecommendations(mood, energy, timeOfDay, place) {
  try {
    const response = await fetch('/api/recommend', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        mood,
        energy,
        timeOfDay,
        place: place || ''
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Failed to fetch recommendations:', error);
    throw error;
  }
}

// 记录完成日志
async function logCompletion(title, ts, mood, energy) {
  try {
    // 非阻塞调用
    fetch('/api/log', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title,
        ts,
        mood,
        energy
      })
    }).catch(err => {
      console.error('Failed to log completion:', err);
      // 静默失败，不影响用户体验
    });
  } catch (error) {
    console.error('Failed to log completion:', error);
  }
}

// ==================== 任务选择逻辑 ====================

// 从候选任务中选择一个（避免近期重复）
function selectTask(tasks) {
  if (!tasks || tasks.length === 0) {
    return null;
  }

  const recentShown = getRecentShown();
  
  // 优先选择不在 recentShown 中的任务
  for (const task of tasks) {
    if (!recentShown.includes(task.title)) {
      return task;
    }
  }
  
  // 如果都在 recentShown 中，返回第一个
  return tasks[0];
}

// ==================== 渲染函数 ====================

// 渲染任务卡片
function renderTaskCard(task) {
  const card = document.createElement('div');
  card.className = 'task-card';
  card.innerHTML = `
    <div class="task-card-title">${escapeHtml(task.title)}</div>
    <div class="task-card-action">点击查看详情</div>
  `;
  card.addEventListener('click', () => {
    showTaskDetail(task);
  });
  return card;
}

// 显示任务详情
function showTaskDetail(task) {
  currentSelectedTask = task;
  hideAllViews();
  elements.detailPage.classList.add('active');
  
  elements.detailTitle.textContent = task.title;
  elements.detailMinAction.textContent = task.min_action;
  elements.detailFeedback.textContent = task.feedback;
}

// 渲染历史列表
function renderHistoryList() {
  const history = getHistoryList();
  const container = elements.historyList;
  
  if (history.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📝</div>
        <div>暂无完成记录</div>
      </div>
    `;
    return;
  }
  
  container.innerHTML = history.map(item => `
    <div class="history-item">
      <div class="history-title">${escapeHtml(item.title)}</div>
      <div class="history-time">${formatTimestamp(item.ts)}</div>
    </div>
  `).join('');
}

// HTML 转义
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ==================== 事件处理 ====================

// 获取推荐
async function handleGetRecommend() {
  const mood = parseInt(elements.moodInput.value);
  const energy = parseInt(elements.energyInput.value);
  const timeOfDay = elements.timeOfDayInput.value;
  const place = elements.placeInput.value.trim();
  
  // 保存当前输入
  currentMood = mood;
  currentEnergy = energy;
  currentTimeOfDay = timeOfDay;
  currentPlace = place;
  
  // 显示加载状态
  hideAllViews();
  elements.loadingSkeleton.style.display = 'block';
  elements.getRecommendBtn.disabled = true;
  updateStatusBadge('正在获取推荐...', '');
  
  try {
    const data = await fetchRecommendations(mood, energy, timeOfDay, place);
    currentTasks = data.tasks || [];
    
    if (currentTasks.length === 0) {
      throw new Error('未获取到任务');
    }
    
    // 选择任务
    const selectedTask = selectTask(currentTasks);
    if (!selectedTask) {
      throw new Error('无法选择任务');
    }
    
    // 添加到近期已展示
    addRecentShown(selectedTask.title);
    
    // 显示任务卡片
    hideAllViews();
    elements.taskCardsArea.style.display = 'block';
    elements.taskCardsContainer.innerHTML = '';
    elements.taskCardsContainer.appendChild(renderTaskCard(selectedTask));
    
    // 更新状态徽标
    const sourceText = data.source === 'deepseek' ? 'DeepSeek 推荐' : '离线兜底';
    updateStatusBadge(`已获取 ${currentTasks.length} 条任务（${sourceText}）`, 
      data.source === 'deepseek' ? 'success' : 'fallback');
    
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

// 换一个任务
async function handleChangeTask() {
  // 显示加载状态
  elements.changeTaskBtn.disabled = true;
  elements.loadingSkeleton.style.display = 'block';
  elements.taskCardsArea.style.display = 'none';
  updateStatusBadge('正在获取新推荐...', '');
  
  try {
    // 重新获取推荐
    const data = await fetchRecommendations(currentMood, currentEnergy, currentTimeOfDay, currentPlace);
    currentTasks = data.tasks || [];
    
    if (currentTasks.length === 0) {
      throw new Error('未获取到任务');
    }
    
    // 选择任务（避免重复）
    const selectedTask = selectTask(currentTasks);
    if (!selectedTask) {
      throw new Error('无法选择任务');
    }
    
    // 添加到近期已展示
    addRecentShown(selectedTask.title);
    
    // 显示任务卡片
    elements.loadingSkeleton.style.display = 'none';
    elements.taskCardsArea.style.display = 'block';
    elements.taskCardsContainer.innerHTML = '';
    elements.taskCardsContainer.appendChild(renderTaskCard(selectedTask));
    
    // 更新状态徽标
    const sourceText = data.source === 'deepseek' ? 'DeepSeek 推荐' : '离线兜底';
    updateStatusBadge(`已获取 ${currentTasks.length} 条任务（${sourceText}）`, 
      data.source === 'deepseek' ? 'success' : 'fallback');
    
  } catch (error) {
    console.error('Failed to change task:', error);
    showError('获取新推荐失败，请稍后重试');
    updateStatusBadge('获取失败', 'error');
    elements.loadingSkeleton.style.display = 'none';
    elements.taskCardsArea.style.display = 'block';
  } finally {
    elements.changeTaskBtn.disabled = false;
  }
}

// 确认完成
async function handleComplete() {
  if (!currentSelectedTask) {
    return;
  }
  
  const ts = Date.now();
  const title = currentSelectedTask.title;
  
  // 添加到历史记录
  addHistoryItem(title, ts, currentMood, currentEnergy);
  
  // 调用日志 API（非阻塞）
  logCompletion(title, ts, currentMood, currentEnergy);
  
  // 更新历史列表显示
  renderHistoryList();
  
  // 返回首页
  hideAllViews();
  elements.inputForm.style.display = 'block';
  currentSelectedTask = null;
  currentTasks = [];
  updateStatusBadge('任务已完成！', 'success');
  
  // 3秒后恢复默认状态
  setTimeout(() => {
    updateStatusBadge('等待获取推荐');
  }, 3000);
}

// ==================== 初始化 ====================

// 绑定事件
elements.moodInput.addEventListener('input', (e) => {
  elements.moodValue.textContent = e.target.value;
});

elements.energyInput.addEventListener('input', (e) => {
  elements.energyValue.textContent = e.target.value;
});

elements.getRecommendBtn.addEventListener('click', handleGetRecommend);
elements.changeTaskBtn.addEventListener('click', handleChangeTask);
elements.clearRecentBtn.addEventListener('click', () => {
  clearRecentShown();
  alert('已清空近期已看记录');
});

elements.backBtn.addEventListener('click', () => {
  hideAllViews();
  if (currentTasks.length > 0) {
    elements.taskCardsArea.style.display = 'block';
    const selectedTask = selectTask(currentTasks);
    if (selectedTask) {
      elements.taskCardsContainer.innerHTML = '';
      elements.taskCardsContainer.appendChild(renderTaskCard(selectedTask));
    }
  } else {
    elements.inputForm.style.display = 'block';
  }
});

elements.completeBtn.addEventListener('click', handleComplete);
elements.clearHistoryBtn.addEventListener('click', () => {
  if (confirm('确定要清空所有历史记录吗？')) {
    clearHistoryList();
    renderHistoryList();
  }
});

// 初始化历史列表
renderHistoryList();

