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

// 提取任务标题的核心关键词（用于相似度比较）
function extractKeywords(title) {
  if (!title) return [];
  
  // 移除常见的修饰词和量词（但保留核心对象）
  const modifiers = ['一杯', '一口', '半杯', '一', '两', '三', '几', '一些', 
                     '慢慢', '快速', '轻轻', '用力',
                     '30秒', '10秒', '3次', '5次', '一次'];
  
  // 温度修饰词（移除但记住核心对象）
  const tempModifiers = ['热', '冷', '温', '凉', '开'];
  
  let text = title;
  
  // 先移除温度修饰词，但保留后面的核心词
  tempModifiers.forEach(mod => {
    text = text.replace(new RegExp(mod, 'g'), '');
  });
  
  // 再移除其他修饰词
  modifiers.forEach(mod => {
    text = text.replace(new RegExp(mod, 'g'), '');
  });
  
  // 提取核心动作词和对象（简单的中文分词）
  // 常见动作词：喝、吃、站、走、看、做、整理、洗、开、关、呼吸、伸展等
  const actionWords = ['喝', '吃', '站', '走', '看', '做', '整理', '洗', '开', '关', 
                       '呼吸', '伸展', '转', '拍', '擦', '装', '收拾', '倒', '拿', '起身'];
  
  const keywords = [];
  for (const action of actionWords) {
    if (text.includes(action)) {
      keywords.push(action);
      // 提取动作后的对象（通常是1-4个字符）
      const actionIndex = text.indexOf(action);
      const afterAction = text.substring(actionIndex + action.length).trim();
      if (afterAction.length > 0) {
        // 提取对象（去除标点和空格，取前2-3个字符）
        const obj = afterAction.replace(/[，。！？、\s]/g, '').substring(0, 3);
        if (obj && obj.length > 0) {
          // 移除常见的后缀词
          const suffixWords = ['并', '然后', '之后', '后'];
          let cleanObj = obj;
          suffixWords.forEach(suffix => {
            if (cleanObj.includes(suffix)) {
              cleanObj = cleanObj.replace(suffix, '');
            }
          });
          if (cleanObj.length > 0) {
            keywords.push(cleanObj);
          }
        }
      }
    }
  }
  
  // 如果没有找到动作词，返回前2-3个字符作为关键词
  if (keywords.length === 0) {
    const cleaned = text.replace(/[，。！？、\s]/g, '').trim();
    if (cleaned.length > 0) {
      keywords.push(cleaned.substring(0, Math.min(3, cleaned.length)));
    }
  }
  
  return keywords.filter(k => k.length > 0);
}

// 计算两个任务标题的相似度（0-1）
function calculateSimilarity(title1, title2) {
  if (title1 === title2) return 1.0;
  
  const keywords1 = extractKeywords(title1);
  const keywords2 = extractKeywords(title2);
  
  // 如果关键词完全相同，返回高相似度
  if (keywords1.length > 0 && keywords2.length > 0) {
    const set1 = new Set(keywords1);
    const set2 = new Set(keywords2);
    if (set1.size === set2.size && keywords1.every(k => set2.has(k))) {
      return 0.95; // 关键词完全相同，高度相似
    }
  }
  
  if (keywords1.length === 0 || keywords2.length === 0) {
    // 如果无法提取关键词，使用简单的字符串包含检查
    const longer = title1.length > title2.length ? title1 : title2;
    const shorter = title1.length > title2.length ? title2 : title1;
    return longer.includes(shorter) ? 0.7 : 0;
  }
  
  // 计算共同关键词的比例（Jaccard 相似度）
  const commonKeywords = keywords1.filter(k => keywords2.includes(k));
  const totalKeywords = new Set([...keywords1, ...keywords2]).size;
  
  if (totalKeywords === 0) return 0;
  
  let similarity = commonKeywords.length / totalKeywords;
  
  // 如果核心动作词相同，提高相似度
  if (keywords1[0] && keywords2[0] && keywords1[0] === keywords2[0]) {
    similarity = Math.max(similarity, 0.6);
    
    // 如果动作词相同，且都有对象词，且对象词也相同或相似，进一步提高相似度
    if (keywords1.length > 1 && keywords2.length > 1) {
      const obj1 = keywords1[1];
      const obj2 = keywords2[1];
      // 如果对象词相同或一个包含另一个
      if (obj1 === obj2 || obj1.includes(obj2) || obj2.includes(obj1)) {
        similarity = Math.max(similarity, 0.85);
      }
    }
  }
  
  return similarity;
}

// 检查任务是否与近期展示的任务相似
function isSimilarToRecent(title, recentShown, threshold = 0.6) {
  for (const recentTitle of recentShown) {
    const similarity = calculateSimilarity(title, recentTitle);
    if (similarity >= threshold) {
      return true;
    }
  }
  return false;
}

// 从候选任务中选择一个（避免近期重复，包括语义相似）
function selectTask(tasks) {
  if (!tasks || tasks.length === 0) {
    return null;
  }

  const recentShown = getRecentShown();
  
  // 第一优先级：完全不在 recentShown 中，且语义不相似
  for (const task of tasks) {
    if (!recentShown.includes(task.title) && !isSimilarToRecent(task.title, recentShown, 0.6)) {
      return task;
    }
  }
  
  // 第二优先级：不在 recentShown 中，但可能语义相似（降低阈值）
  for (const task of tasks) {
    if (!recentShown.includes(task.title) && !isSimilarToRecent(task.title, recentShown, 0.8)) {
      return task;
    }
  }
  
  // 第三优先级：语义相似度较低的任务
  let bestTask = tasks[0];
  let minSimilarity = 1.0;
  
  for (const task of tasks) {
    let maxSim = 0;
    for (const recentTitle of recentShown) {
      const sim = calculateSimilarity(task.title, recentTitle);
      maxSim = Math.max(maxSim, sim);
    }
    if (maxSim < minSimilarity) {
      minSimilarity = maxSim;
      bestTask = task;
    }
  }
  
  // 如果所有任务都很相似，返回相似度最低的
  return bestTask;
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

