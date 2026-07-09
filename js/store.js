// ===================================
// STORE — store.js
// データストア（管理者: localStorage / 閲覧者: data.json）
// ===================================

const STORAGE_KEYS = {
  TASKS: 'taskdash_tasks',
  PROJECTS: 'taskdash_projects',
  TAGS: 'taskdash_tags',
  NOTES: 'taskdash_notes',
  SETTINGS: 'taskdash_settings',
  INITIALIZED: 'taskdash_initialized',
  ADMIN_SESSION: 'taskdash_admin_session',
};

// ── Admin Password Hash ──
// デフォルトパスワード: "admin"
// 変更する場合は、ブラウザのコンソールで以下を実行してハッシュを取得：
//   await crypto.subtle.digest('SHA-256', new TextEncoder().encode('あなたのパスワード'))
//     .then(h => Array.from(new Uint8Array(h)).map(b => b.toString(16).padStart(2,'0')).join(''));
const ADMIN_PASSWORD_HASH = '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918';

class Store {
  constructor() {
    this._listeners = {};
    this._cache = {};
    this._isAdmin = false;
    this._isViewerMode = false;
    this._loadCache();
  }

  // ── Internal ──

  _loadCache() {
    this._cache = {
      tasks: (this._read(STORAGE_KEYS.TASKS) || []).map(t => this._migrateTask(t)),
      projects: this._read(STORAGE_KEYS.PROJECTS) || [],
      tags: this._read(STORAGE_KEYS.TAGS) || [],
      notes: this._read(STORAGE_KEYS.NOTES) || '',
      settings: this._read(STORAGE_KEYS.SETTINGS) || {
        theme: 'system',
        sidebarCollapsed: false,
        defaultView: 'dashboard',
      },
    };
  }

  _migrateTask(task) {
    if (task.priority) {
      if (task.priority === 'urgent') {
        task.importance = 'high'; task.urgency = 'high';
      } else if (task.priority === 'high') {
        task.importance = 'high'; task.urgency = 'medium';
      } else if (task.priority === 'medium') {
        task.importance = 'medium'; task.urgency = 'medium';
      } else {
        task.importance = 'low'; task.urgency = 'low';
      }
      delete task.priority;
    }
    if (task.leadTime === undefined) {
      task.leadTime = 0;
    }
    if (!task.taskType) {
      task.taskType = 'personal';
    }
    return task;
  }

  _read(key) {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  _write(key, data) {
    if (this._isViewerMode) return; // 閲覧者モードでは書き込み禁止
    try {
      localStorage.setItem(key, JSON.stringify(data));
      this._syncToCloud();
    } catch (e) {
      console.error('Storage write error:', e);
    }
  }

  async _syncToCloud() {
    try {
       const isLocal = window.location.protocol === 'file:';
       const apiUrl = isLocal ? 'https://task-managememt.vercel.app/api/tasks' : '/api/tasks';
       await fetch(apiUrl, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({
            tasks: this._cache.tasks,
            projects: this._cache.projects,
            tags: this._cache.tags,
            notes: this._cache.notes,
            settings: this._cache.settings
         })
       });
    } catch(e) { console.error('Cloud sync error:', e); }
  }

  _saveTasks() {
    this._write(STORAGE_KEYS.TASKS, this._cache.tasks);
    this._emit('tasks');
  }

  _saveProjects() {
    this._write(STORAGE_KEYS.PROJECTS, this._cache.projects);
    this._emit('projects');
  }

  _saveTags() {
    this._write(STORAGE_KEYS.TAGS, this._cache.tags);
    this._emit('tags');
  }

  _saveNotes() {
    this._write(STORAGE_KEYS.NOTES, this._cache.notes);
    this._emit('notes');
  }

  _saveSettings() {
    this._write(STORAGE_KEYS.SETTINGS, this._cache.settings);
    this._emit('settings');
  }

  // ── Auth / Mode ──

  get isAdmin() {
    return this._isAdmin;
  }

  get isViewerMode() {
    return this._isViewerMode;
  }

  async hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  async login(password) {
    const hash = await this.hashPassword(password);
    if (hash === ADMIN_PASSWORD_HASH) {
      this._isAdmin = true;
      this._isViewerMode = false;
      sessionStorage.setItem(STORAGE_KEYS.ADMIN_SESSION, 'true');

      // 管理者モード: まずクラウドから最新をロードする
      const loaded = await this.loadSharedData();
      if (loaded && this._cache.tasks && this._cache.tasks.length > 0) {
          this._write(STORAGE_KEYS.TASKS, this._cache.tasks);
          this._write(STORAGE_KEYS.PROJECTS, this._cache.projects);
          this._write(STORAGE_KEYS.TAGS, this._cache.tags);
      } else if (!this._read(STORAGE_KEYS.TASKS)) {
        this.initSampleData();
      }
      this._loadCache();
      this._emit('auth');
      this._emit('tasks');
      this._emit('projects');
      this._emit('tags');
      return true;
    }
    return false;
  }

  logout() {
    this._isAdmin = false;
    this._isViewerMode = true;
    sessionStorage.removeItem(STORAGE_KEYS.ADMIN_SESSION);
    this._emit('auth');
    // Reload from data.json
    this.loadSharedData();
  }

  checkSession() {
    return sessionStorage.getItem(STORAGE_KEYS.ADMIN_SESSION) === 'true';
  }

  // ── Shared Data (data.json) ──

  async loadSharedData() {
    try {
      const isLocal = window.location.protocol === 'file:';
      const apiUrl = isLocal ? 'https://task-managememt.vercel.app/api/tasks?t=' : '/api/tasks?t=';
      const response = await fetch(apiUrl + Date.now());
      if (!response.ok) throw new Error('Failed to fetch data');
      const data = await response.json();

      if (data.tasks) this._cache.tasks = data.tasks.map(t => this._migrateTask(t));
      if (data.projects) this._cache.projects = data.projects;
      if (data.tags) this._cache.tags = data.tags;
      if (data.notes !== undefined) this._cache.notes = data.notes;

      this._emit('tasks');
      this._emit('projects');
      this._emit('tags');
      this._emit('notes');
      return true;
    } catch (e) {
      console.warn('data.json load failed, using empty data:', e.message);
      return false;
    }
  }

  async initMode() {
    // Check if returning admin session
    if (this.checkSession()) {
      this._isAdmin = true;
      this._isViewerMode = false;
      
      const loaded = await this.loadSharedData();
      if (loaded && this._cache.tasks && this._cache.tasks.length > 0) {
          this._write(STORAGE_KEYS.TASKS, this._cache.tasks);
          this._write(STORAGE_KEYS.PROJECTS, this._cache.projects);
          this._write(STORAGE_KEYS.TAGS, this._cache.tags);
      }
      
      this._loadCache();
      if (!this._read(STORAGE_KEYS.TASKS)) {
        this.initSampleData();
        this._loadCache();
      }
      return 'admin';
    }

    // Default: Viewer mode — load from data.json
    this._isViewerMode = true;
    this._isAdmin = false;
    const loaded = await this.loadSharedData();

    // If data.json is empty/failed and no localStorage data, show empty state
    if (!loaded || this._cache.tasks.length === 0) {
      // Check if there's localStorage data (someone who was admin before)
      const localTasks = this._read(STORAGE_KEYS.TASKS);
      if (localTasks && localTasks.length > 0) {
        this._cache.tasks = localTasks;
        this._cache.projects = this._read(STORAGE_KEYS.PROJECTS) || [];
        this._cache.tags = this._read(STORAGE_KEYS.TAGS) || [];
      }
    }

    return 'viewer';
  }

  // ── Export for publishing (admin → data.json) ──

  exportForPublish() {
    const data = JSON.stringify({
      version: 1,
      exportedAt: new Date().toISOString(),
      tasks: this._cache.tasks,
      projects: this._cache.projects,
      tags: this._cache.tags,
      notes: this._cache.notes,
    }, null, 2);

    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'data.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Event System ──

  on(event, callback) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(callback);
    return () => {
      this._listeners[event] = this._listeners[event].filter(cb => cb !== callback);
    };
  }

  _emit(event, data) {
    if (this._listeners[event]) {
      this._listeners[event].forEach(cb => cb(data));
    }
  }

  // ── Guard: check edit permission ──
  _guardEdit() {
    if (this._isViewerMode) {
      console.warn('Editing is not allowed in viewer mode');
      return false;
    }
    return true;
  }

  // ── Tasks CRUD ──

  getTasks() {
    return [...this._cache.tasks];
  }

  getTask(id) {
    return this._cache.tasks.find(t => t.id === id) || null;
  }

  addTask(taskData) {
    if (!this._guardEdit()) return null;
    const task = createTask(taskData);
    this._cache.tasks.unshift(task);
    this._saveTasks();
    return task;
  }

  updateTask(id, updates) {
    if (!this._guardEdit()) return null;
    const index = this._cache.tasks.findIndex(t => t.id === id);
    if (index === -1) return null;

    const task = { ...this._cache.tasks[index], ...updates, updatedAt: new Date().toISOString() };

    // Handle completion
    if (updates.status === STATUSES.DONE.key && this._cache.tasks[index].status !== STATUSES.DONE.key) {
      task.completedAt = new Date().toISOString();
    } else if (updates.status && updates.status !== STATUSES.DONE.key) {
      task.completedAt = null;
    }

    this._cache.tasks[index] = task;
    this._saveTasks();
    return task;
  }

  deleteTask(id) {
    if (!this._guardEdit()) return;
    this._cache.tasks = this._cache.tasks.filter(t => t.id !== id);
    this._saveTasks();
  }

  reorderTasks(draggedId, targetId, position = 'before') {
    if (!this._guardEdit()) return;

    const draggedIndex = this._cache.tasks.findIndex(t => t.id === draggedId);
    const targetIndex = this._cache.tasks.findIndex(t => t.id === targetId);

    if (draggedIndex === -1 || targetIndex === -1) return;

    const task = this._cache.tasks[draggedIndex];
    const targetTask = this._cache.tasks[targetIndex];

    // If grouped by project, dragging across groups changes the project
    if (task.projectId !== targetTask.projectId) {
      task.projectId = targetTask.projectId;
    }

    this._cache.tasks.splice(draggedIndex, 1);
    
    // Recalculate target index since the array changed
    const newTargetIndex = this._cache.tasks.findIndex(t => t.id === targetId);
    
    if (position === 'before') {
      this._cache.tasks.splice(newTargetIndex, 0, task);
    } else {
      this._cache.tasks.splice(newTargetIndex + 1, 0, task);
    }

    this._saveTasks();
  }

  toggleSubtask(taskId, subtaskId) {
    if (!this._guardEdit()) return null;
    const task = this.getTask(taskId);
    if (!task) return null;

    const subtask = task.subtasks.find(st => st.id === subtaskId);
    if (!subtask) return null;

    subtask.completed = !subtask.completed;
    return this.updateTask(taskId, { subtasks: task.subtasks });
  }

  addSubtask(taskId, title) {
    if (!this._guardEdit()) return null;
    const task = this.getTask(taskId);
    if (!task) return null;

    task.subtasks.push({
      id: generateId(),
      title,
      completed: false,
    });
    return this.updateTask(taskId, { subtasks: task.subtasks });
  }

  deleteSubtask(taskId, subtaskId) {
    if (!this._guardEdit()) return null;
    const task = this.getTask(taskId);
    if (!task) return null;

    task.subtasks = task.subtasks.filter(st => st.id !== subtaskId);
    return this.updateTask(taskId, { subtasks: task.subtasks });
  }

  // ── Task Queries ──

  getTasksByStatus(status) {
    return this._cache.tasks.filter(t => t.status === status);
  }

  getTasksByProject(projectId) {
    return this._cache.tasks.filter(t => t.projectId === projectId);
  }

  getTasksByImportance(importance) {
    return this._cache.tasks.filter(t => t.importance === importance);
  }

  getTasksByUrgency(urgency) {
    return this._cache.tasks.filter(t => t.urgency === urgency);
  }

  getOverdueTasks() {
    return this._cache.tasks.filter(t => isOverdue(t));
  }

  getTodayTasks() {
    return this._cache.tasks.filter(t => isDueToday(t) && t.status !== STATUSES.DONE.key);
  }

  getUpcomingTasks() {
    return this._cache.tasks.filter(t => isDueSoon(t) && t.status !== STATUSES.DONE.key);
  }

  getTasksForDate(dateStr) {
    return this._cache.tasks.filter(t => {
      if (!t.dueDate) return false;
      return new Date(t.dueDate).toDateString() === new Date(dateStr).toDateString();
    });
  }

  getFilteredTasks(filters = {}) {
    let tasks = this.getTasks();

    // TaskType filter (default to 'personal' if not specified)
    const taskType = filters.taskType || 'personal';
    if (taskType !== 'all') {
      tasks = tasks.filter(t => t.taskType === taskType);
    }

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      tasks = tasks.filter(t =>
        t.title.toLowerCase().includes(searchLower) ||
        t.description.toLowerCase().includes(searchLower)
      );
    }

    if (filters.status && filters.status !== 'all') {
      tasks = tasks.filter(t => t.status === filters.status);
    }

    if (filters.importance && filters.importance !== 'all') {
      tasks = tasks.filter(t => t.importance === filters.importance);
    }
    
    if (filters.urgency && filters.urgency !== 'all') {
      tasks = tasks.filter(t => t.urgency === filters.urgency);
    }

    if (filters.projectId && filters.projectId !== 'all') {
      if (filters.projectId === 'none') {
        tasks = tasks.filter(t => !t.projectId);
      } else {
        tasks = tasks.filter(t => t.projectId === filters.projectId);
      }
    }

    if (filters.tags && filters.tags.length > 0) {
      tasks = tasks.filter(t =>
        filters.tags.some(tag => t.tags.includes(tag))
      );
    }

    if (filters.overdue) {
      tasks = tasks.filter(t => isOverdue(t));
    }

    if (filters.dueSoon) {
      tasks = tasks.filter(t => isDueSoon(t) && t.status !== STATUSES.DONE.key);
    }

    // No on-the-fly sorting. Drag-and-drop order (manual order) is always preserved.
    return tasks;
  }

  sortTasksBy(criteria) {
    if (!this._guardEdit()) return;

    this._cache.tasks.sort((a, b) => {
      let valA, valB;
      switch (criteria) {
        case 'dueDate':
          valA = a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
          valB = b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
          return valA - valB;
        case 'importance':
          const impOrder = { 'high': 3, 'medium': 2, 'low': 1 };
          return (impOrder[b.importance] || 0) - (impOrder[a.importance] || 0);
        case 'urgency':
          const urgOrder = { 'high': 3, 'medium': 2, 'low': 1 };
          return (urgOrder[b.urgency] || 0) - (urgOrder[a.urgency] || 0);
        case 'createdAt':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'title':
          return a.title.localeCompare(b.title);
        case 'status':
          const statusOrder = { 'todo': 1, 'in-progress': 2, 'review': 3, 'done': 4 };
          return (statusOrder[a.status] || 0) - (statusOrder[b.status] || 0);
        case 'leadTime':
          return parseInt(b.leadTime || 0) - parseInt(a.leadTime || 0);
        case 'collaborator':
          return (a.collaborator || '').localeCompare(b.collaborator || '');
        case 'project':
          return (a.projectId || '').localeCompare(b.projectId || '');
        default:
          return 0;
      }
    });

    this._saveTasks();
  }

  getStats() {
    const tasks = this.getTasks().filter(t => t.taskType === 'personal');
    const total = tasks.length;
    const completed = tasks.filter(t => t.status === STATUSES.DONE.key).length;
    const inProgress = tasks.filter(t => t.status === STATUSES.IN_PROGRESS.key).length;
    const overdue = tasks.filter(t => isOverdue(t)).length;
    const todayCount = tasks.filter(t => isDueToday(t) && t.status !== STATUSES.DONE.key).length;
    const dueSoonCount = tasks.filter(t => isDueSoon(t) && t.status !== STATUSES.DONE.key).length;

    return {
      total,
      completed,
      inProgress,
      todo: tasks.filter(t => t.status === STATUSES.TODO.key).length,
      review: tasks.filter(t => t.status === STATUSES.REVIEW.key).length,
      overdue,
      today: todayCount,
      dueSoon: dueSoonCount,
      completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
    };
  }

  // ── Projects CRUD ──

  getProjects() {
    return [...this._cache.projects];
  }

  getProject(id) {
    return this._cache.projects.find(p => p.id === id) || null;
  }

  addProject(projectData) {
    if (!this._guardEdit()) return null;
    const project = createProject(projectData);
    this._cache.projects.push(project);
    this._saveProjects();
    return project;
  }

  updateProject(id, updates) {
    if (!this._guardEdit()) return null;
    const index = this._cache.projects.findIndex(p => p.id === id);
    if (index === -1) return null;
    this._cache.projects[index] = { ...this._cache.projects[index], ...updates };
    this._saveProjects();
    return this._cache.projects[index];
  }

  deleteProject(id) {
    if (!this._guardEdit()) return;
    this._cache.projects = this._cache.projects.filter(p => p.id !== id);
    // Remove project reference from tasks
    this._cache.tasks.forEach(t => {
      if (t.projectId === id) t.projectId = null;
    });
    this._saveProjects();
    this._saveTasks();
  }

  getProjectTaskCount(projectId) {
    return this._cache.tasks.filter(t => t.projectId === projectId).length;
  }

  reorderProjects(startIndex, endIndex) {
    if (!this._guardEdit()) return;
    const project = this._cache.projects[startIndex];
    this._cache.projects.splice(startIndex, 1);
    this._cache.projects.splice(endIndex, 0, project);
    this._saveProjects();
  }

  // ── Tags CRUD ──

  getTags() {
    return [...this._cache.tags];
  }

  getTag(id) {
    return this._cache.tags.find(t => t.id === id) || null;
  }

  getTagByName(name) {
    return this._cache.tags.find(t => t.name.toLowerCase() === name.toLowerCase()) || null;
  }

  addTag(tagData) {
    if (this._isViewerMode) return this.getTagByName(tagData.name); // Silent fail for viewer
    // Check for duplicates
    if (this.getTagByName(tagData.name)) return this.getTagByName(tagData.name);
    const tag = createTag(tagData);
    this._cache.tags.push(tag);
    this._saveTags();
    return tag;
  }

  deleteTag(id) {
    if (!this._guardEdit()) return;
    this._cache.tags = this._cache.tags.filter(t => t.id !== id);
    // Remove tag from tasks
    this._cache.tasks.forEach(t => {
      t.tags = t.tags.filter(tagId => tagId !== id);
    });
    this._saveTags();
    this._saveTasks();
  }

  // ── Settings ──

  getSettings() {
    return { ...this._cache.settings };
  }

  updateSettings(updates) {
    this._cache.settings = { ...this._cache.settings, ...updates };
    this._saveSettings();
    return this._cache.settings;
  }

  // ── Notes ──

  getNotes() {
    return this._cache.notes || '';
  }

  updateNotes(text) {
    if (!this._guardEdit()) return false;
    this._cache.notes = text;
    this._saveNotes();
    return true;
  }

  // ── Export / Import ──

  exportData() {
    return JSON.stringify({
      version: 1,
      exportedAt: new Date().toISOString(),
      tasks: this._cache.tasks,
      projects: this._cache.projects,
      tags: this._cache.tags,
      notes: this._cache.notes,
      settings: this._cache.settings,
    }, null, 2);
  }

  importData(jsonString) {
    if (!this._guardEdit()) return false;
    try {
      const data = JSON.parse(jsonString);
      if (!data.version) throw new Error('Invalid data format');

      if (data.tasks) {
        this._cache.tasks = data.tasks;
        this._write(STORAGE_KEYS.TASKS, data.tasks);
      }
      if (data.projects) {
        this._cache.projects = data.projects;
        this._write(STORAGE_KEYS.PROJECTS, data.projects);
      }
      if (data.tags) {
        this._cache.tags = data.tags;
        this._write(STORAGE_KEYS.TAGS, data.tags);
      }
      if (data.notes !== undefined) {
        this._cache.notes = data.notes;
        this._write(STORAGE_KEYS.NOTES, data.notes);
      }
      if (data.settings) {
        this._cache.settings = { ...this._cache.settings, ...data.settings };
        this._write(STORAGE_KEYS.SETTINGS, this._cache.settings);
      }

      this._emit('tasks');
      this._emit('projects');
      this._emit('tags');
      this._emit('notes');
      this._emit('settings');

      return true;
    } catch (e) {
      console.error('Import error:', e);
      return false;
    }
  }

  // ── Sample Data ──

  initSampleData() {
    if (localStorage.getItem(STORAGE_KEYS.INITIALIZED)) return false;

    // Temporarily allow writes for initialization
    const wasViewer = this._isViewerMode;
    this._isViewerMode = false;

    // Create projects
    const projectDesign = this.addProject({ name: 'ウェブサイトリデザイン', color: '#6366f1', icon: '🎨' });
    const projectApp = this.addProject({ name: 'モバイルアプリ開発', color: '#10b981', icon: '📱' });
    const projectMarketing = this.addProject({ name: 'マーケティング施策', color: '#f59e0b', icon: '📣' });

    // Create tags
    const tagDesign = this.addTag({ name: 'デザイン', colorIndex: 0 });
    const tagDev = this.addTag({ name: '開発', colorIndex: 1 });
    const tagBug = this.addTag({ name: 'バグ', colorIndex: 3 });
    const tagFeature = this.addTag({ name: '機能追加', colorIndex: 5 });
    const tagDoc = this.addTag({ name: 'ドキュメント', colorIndex: 6 });
    const tagMeeting = this.addTag({ name: 'ミーティング', colorIndex: 4 });

    const today = new Date();
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
    const dayAfter = new Date(today); dayAfter.setDate(today.getDate() + 2);
    const nextWeek = new Date(today); nextWeek.setDate(today.getDate() + 7);
    const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
    const lastWeek = new Date(today); lastWeek.setDate(today.getDate() - 5);

    const fmt = d => d.toISOString().split('T')[0];

    // Create tasks
    this.addTask({
      title: 'ランディングページのデザイン修正',
      description: 'ヒーローセクションのレイアウトを更新し、新しいブランドカラーを適用する。CTAボタンの配置も見直す。',
      status: 'in-progress',
      importance: 'high', urgency: 'high', leadTime: 3,
      projectId: projectDesign.id,
      tags: [tagDesign.id],
      startDate: fmt(today),
      dueDate: fmt(tomorrow),
      subtasks: [
        { title: 'ヒーロー画像の差し替え', completed: true },
        { title: 'カラーパレット更新', completed: true },
        { title: 'CTAボタンのA/Bテスト用デザイン', completed: false },
        { title: 'レスポンシブ確認', completed: false },
      ],
    });

    this.addTask({
      title: 'APIエンドポイントの認証機能実装',
      description: 'JWT認証をAPIに実装する。リフレッシュトークンの仕組みも含める。',
      status: 'todo',
      importance: 'high', urgency: 'high', leadTime: 5,
      projectId: projectApp.id,
      tags: [tagDev.id, tagFeature.id],
      startDate: fmt(yesterday),
      dueDate: fmt(tomorrow),
      subtasks: [
        { title: 'JWT生成ロジック', completed: false },
        { title: 'ミドルウェア作成', completed: false },
        { title: 'リフレッシュトークン', completed: false },
        { title: 'テスト作成', completed: false },
      ],
    });

    this.addTask({
      title: 'Q3マーケティング計画書作成',
      description: '第3四半期のマーケティング戦略と予算案を作成。SNS広告とコンテンツマーケティングを中心に。',
      status: 'review',
      importance: 'high', urgency: 'medium', leadTime: 7,
      projectId: projectMarketing.id,
      tags: [tagDoc.id],
      startDate: fmt(tomorrow),
      dueDate: fmt(nextWeek),
    });

    this.addTask({
      title: 'ユーザーダッシュボードのパフォーマンス改善',
      description: '読み込み速度を50%改善する。バンドルサイズの削減とレイジーロードの導入。',
      status: 'in-progress', importance: 'medium', urgency: 'medium', leadTime: 4, projectId: projectDesign.id,
      tags: [tagDev.id], dueDate: fmt(nextWeek),
      subtasks: [
        { title: 'パフォーマンス計測', completed: true },
        { title: 'コード分割', completed: false },
        { title: 'レイジーロード導入', completed: false },
      ],
    });

    this.addTask({ title: '週次チームミーティング準備', description: '先週の振り返りと今週の目標設定のスライド準備。', status: 'todo', importance: 'medium', urgency: 'medium', tags: [tagMeeting.id], dueDate: fmt(tomorrow) });
    this.addTask({ title: 'モバイルナビゲーションのバグ修正', description: 'ハンバーガーメニューが特定のiOSバージョンで動作しない問題の修正。', status: 'todo', importance: 'high', urgency: 'high', projectId: projectApp.id, tags: [tagBug.id], dueDate: fmt(yesterday) });

    this.addTask({
      title: 'SNS投稿コンテンツ作成（6月分）',
      description: 'Instagram・Twitter用の投稿画像と文章を20件分作成。',
      status: 'in-progress', importance: 'medium', urgency: 'low', leadTime: 2, projectId: projectMarketing.id,
      tags: [tagDesign.id], dueDate: fmt(nextWeek),
      subtasks: [
        { title: '投稿カレンダー作成', completed: true },
        { title: '画像デザイン 10件', completed: true },
        { title: '画像デザイン 残り10件', completed: false },
        { title: 'コピーライティング', completed: false },
      ],
    });

    this.addTask({ title: 'データベーススキーマの最適化', description: 'クエリパフォーマンスの改善のためインデックスの見直しとテーブル構造の最適化。', status: 'done', importance: 'high', urgency: 'medium', projectId: projectApp.id, tags: [tagDev.id], dueDate: fmt(lastWeek) });
    this.addTask({ title: 'ユーザーインタビュー（5名分）', description: '新機能のフィードバックを得るためのユーザーインタビューを実施。', status: 'done', importance: 'medium', urgency: 'medium', projectId: projectDesign.id, tags: [tagMeeting.id], dueDate: fmt(lastWeek) });
    this.addTask({ title: 'CI/CDパイプライン構築', description: 'GitHub Actionsを使用した自動テスト・デプロイパイプラインの構築。', status: 'todo', importance: 'low', urgency: 'low', projectId: projectApp.id, tags: [tagDev.id], dueDate: fmt(nextWeek) });
    this.addTask({ title: 'コンペティター分析レポート', description: '主要競合3社のプロダクト分析と市場ポジショニングのレポート作成。', status: 'todo', importance: 'low', urgency: 'low', projectId: projectMarketing.id, tags: [tagDoc.id], dueDate: null });
    this.addTask({ title: 'アクセシビリティ監査', description: 'WCAG 2.1 AAレベルへの準拠状況を確認し、改善点をリストアップ。', status: 'todo', importance: 'medium', urgency: 'low', projectId: projectDesign.id, tags: [tagDev.id, tagDoc.id], dueDate: null });

    localStorage.setItem(STORAGE_KEYS.INITIALIZED, 'true');
    this._isViewerMode = wasViewer;
    return true;
  }

  clearAllData() {
    if (!this._guardEdit()) return;
    Object.values(STORAGE_KEYS).forEach(key => localStorage.removeItem(key));
    this._loadCache();
    this._emit('tasks');
    this._emit('projects');
    this._emit('tags');
    this._emit('settings');
  }
}

// Global store instance
const store = new Store();
