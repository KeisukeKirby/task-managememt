// ===================================
// MODELS — models.js
// タスク管理ダッシュボード
// ===================================

const IMPORTANCE_LEVELS = {
  HIGH:   { key: 'high',   label: '高', color: '#f43f5e', icon: '🔴', order: 0 },
  MEDIUM: { key: 'medium', label: '中', color: '#f59e0b', icon: '🟡', order: 1 },
  LOW:    { key: 'low',    label: '低', color: '#6366f1', icon: '🔵', order: 2 },
};

const URGENCY_LEVELS = {
  HIGH:   { key: 'high',   label: '高', color: '#f43f5e', icon: '🔥', order: 0 },
  MEDIUM: { key: 'medium', label: '中', color: '#f59e0b', icon: '⚡', order: 1 },
  LOW:    { key: 'low',    label: '低', color: '#6366f1', icon: '⏳', order: 2 },
};

const COLLABORATORS = [
  'Shimada', 'Bew', 'Aod', 'Ying', 'Poo', 'Nut', 'Nee', 'Pong', 'Beer'
];

const STATUSES = {
  TODO:        { key: 'todo',        label: '未着手',   color: '#94a3b8', order: 0 },
  IN_PROGRESS: { key: 'in-progress', label: '進行中',   color: '#6366f1', order: 1 },
  REVIEW:      { key: 'review',      label: 'レビュー', color: '#f59e0b', order: 2 },
  DONE:        { key: 'done',        label: '完了',     color: '#10b981', order: 3 },
};

const PROJECT_COLORS = [
  '#6366f1', '#8b5cf6', '#a855f7', '#ec4899', '#f43f5e',
  '#f59e0b', '#10b981', '#06b6d4', '#3b82f6', '#f97316',
];

const TAG_COLORS = [
  { bg: 'rgba(99, 102, 241, 0.1)',  text: '#6366f1', name: 'indigo' },
  { bg: 'rgba(168, 85, 247, 0.1)',  text: '#a855f7', name: 'purple' },
  { bg: 'rgba(236, 72, 153, 0.1)',  text: '#ec4899', name: 'pink' },
  { bg: 'rgba(244, 63, 94, 0.1)',   text: '#f43f5e', name: 'rose' },
  { bg: 'rgba(245, 158, 11, 0.1)',  text: '#f59e0b', name: 'amber' },
  { bg: 'rgba(16, 185, 129, 0.1)',  text: '#10b981', name: 'emerald' },
  { bg: 'rgba(6, 182, 212, 0.1)',   text: '#06b6d4', name: 'cyan' },
  { bg: 'rgba(59, 130, 246, 0.1)',  text: '#3b82f6', name: 'blue' },
];

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

function createTask({
  title = '',
  description = '',
  status = STATUSES.TODO.key,
  importance = IMPORTANCE_LEVELS.MEDIUM.key,
  urgency = URGENCY_LEVELS.MEDIUM.key,
  leadTime = 0,
  projectId = null,
  tags = [],
  startDate = null,
  dueDate = null,
  subtasks = [],
  parentId = null,
  collaborator = null,
  taskType = 'personal',
} = {}) {
  return {
    id: generateId(),
    title,
    description,
    status,
    importance,
    urgency,
    leadTime,
    projectId,
    tags,
    startDate,
    dueDate,
    collaborator,
    taskType,
    subtasks: subtasks.map(st => ({
      id: generateId(),
      title: typeof st === 'string' ? st : st.title,
      completed: typeof st === 'string' ? false : (st.completed || false),
    })),
    parentId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completedAt: null,
  };
}

function createProject({
  name = '',
  color = PROJECT_COLORS[0],
  icon = '📁',
  description = '',
} = {}) {
  return {
    id: generateId(),
    name,
    color,
    icon,
    description,
    createdAt: new Date().toISOString(),
  };
}

function createTag({
  name = '',
  colorIndex = 0,
} = {}) {
  const colorSet = TAG_COLORS[colorIndex % TAG_COLORS.length];
  return {
    id: generateId(),
    name,
    color: colorSet.text,
    bgColor: colorSet.bg,
    colorIndex,
  };
}

// ── Helper Functions ──

function getImportanceInfo(key) {
  return Object.values(IMPORTANCE_LEVELS).find(i => i.key === key) || IMPORTANCE_LEVELS.MEDIUM;
}

function getUrgencyInfo(key) {
  return Object.values(URGENCY_LEVELS).find(u => u.key === key) || URGENCY_LEVELS.MEDIUM;
}

function getStatusInfo(statusKey) {
  return Object.values(STATUSES).find(s => s.key === statusKey) || STATUSES.TODO;
}

function isOverdue(task) {
  if (!task.dueDate || task.status === STATUSES.DONE.key) return false;
  const due = new Date(task.dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return due < today;
}

function isDueToday(task) {
  if (!task.dueDate) return false;
  const due = new Date(task.dueDate);
  const today = new Date();
  return due.toDateString() === today.toDateString();
}

function isDueSoon(task) {
  if (!task.dueDate || task.status === STATUSES.DONE.key) return false;
  const due = new Date(task.dueDate);
  const today = new Date();
  const threeDays = new Date(today);
  threeDays.setDate(threeDays.getDate() + 3);
  today.setHours(0, 0, 0, 0);
  return due >= today && due <= threeDays;
}

function getSubtaskProgress(task) {
  if (!task.subtasks || task.subtasks.length === 0) return null;
  const completed = task.subtasks.filter(st => st.completed).length;
  return {
    completed,
    total: task.subtasks.length,
    percent: Math.round((completed / task.subtasks.length) * 100),
  };
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return '今日';
  if (date.toDateString() === tomorrow.toDateString()) return '明日';
  if (date.toDateString() === yesterday.toDateString()) return '昨日';

  const month = date.getMonth() + 1;
  const day = date.getDate();
  const year = date.getFullYear();

  if (year === today.getFullYear()) {
    return `${month}月${day}日`;
  }
  return `${year}年${month}月${day}日`;
}

function formatRelativeDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now - date;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'たった今';
  if (minutes < 60) return `${minutes}分前`;
  if (hours < 24) return `${hours}時間前`;
  if (days < 7) return `${days}日前`;
  return formatDate(dateStr);
}
