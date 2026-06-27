// ===================================
// APP — app.js
// アプリケーションエントリポイント
// ===================================

// ── Toast Notification System ──
const Toast = {
  container: null,

  init() {
    this.container = document.getElementById('toast-container');
  },

  show(message, type = 'info', duration = 3000) {
    if (!this.container) this.init();

    const icons = {
      success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
      error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
      info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
    };

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <span class="toast-icon">${icons[type] || icons.info}</span>
      <span class="toast-message">${message}</span>
      <button class="toast-close" onclick="this.parentElement.remove()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 6L6 18M6 6l12 12"/>
        </svg>
      </button>
    `;

    this.container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('removing');
      setTimeout(() => toast.remove(), 200);
    }, duration);
  },
};

// ── Context Menu ──
const ContextMenu = {
  el: null,

  init() {
    this.el = document.getElementById('context-menu');
    document.addEventListener('click', () => this.hide());
    document.addEventListener('contextmenu', () => this.hide());
  },

  show(x, y, items) {
    if (!this.el) this.init();

    this.el.innerHTML = items.map((item, i) => {
      if (item.divider) return '<div class="context-menu-divider"></div>';
      return `
        <div class="context-menu-item ${item.danger ? 'danger' : ''}" data-index="${i}">
          ${item.icon || ''}
          <span>${item.label}</span>
        </div>
      `;
    }).join('');

    // Bind actions
    this.el.querySelectorAll('.context-menu-item').forEach(el => {
      const index = parseInt(el.dataset.index);
      const item = items[index];
      if (item && item.action) {
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          this.hide();
          item.action();
        });
      }
    });

    // Position
    const maxX = window.innerWidth - 200;
    const maxY = window.innerHeight - (items.length * 40);
    this.el.style.left = Math.min(x, maxX) + 'px';
    this.el.style.top = Math.min(y, maxY) + 'px';

    requestAnimationFrame(() => {
      this.el.classList.add('active');
    });
  },

  hide() {
    if (this.el) this.el.classList.remove('active');
  },
};

// ── Admin Login Modal ──
const AdminLogin = {
  show() {
    const overlay = document.getElementById('admin-login-overlay');
    if (overlay) {
      overlay.classList.add('active');
      setTimeout(() => {
        document.getElementById('admin-password-input')?.focus();
      }, 100);
    }
  },

  hide() {
    const overlay = document.getElementById('admin-login-overlay');
    if (overlay) overlay.classList.remove('active');
  },

  async submit() {
    const input = document.getElementById('admin-password-input');
    const errorEl = document.getElementById('admin-login-error');
    if (!input) return;

    const password = input.value;
    if (!password) return;

    const success = await store.login(password);
    if (success) {
      this.hide();
      input.value = '';
      if (errorEl) errorEl.style.display = 'none';
      App.updateAuthUI();
      App.refreshCurrentView();
      Toast.show('管理者としてログインしました', 'success');
    } else {
      if (errorEl) {
        errorEl.style.display = 'block';
        errorEl.textContent = 'パスワードが正しくありません';
      }
      input.value = '';
      input.focus();
    }
  },
};

// ── Main App ──
const App = {
  currentView: 'dashboard',
  filters: {},
  _viewParams: {},

  async init() {
    // Initialize components
    Toast.init();
    ContextMenu.init();
    TaskModal.init();
    Header.init();

    // Initialize mode (admin or viewer)
    const mode = await store.initMode();

    Sidebar.init();

    // Apply theme
    this.applyTheme();

    // Update UI based on auth state
    this.updateAuthUI();

    // Handle hash routing
    this.handleRoute();
    window.addEventListener('hashchange', () => this.handleRoute());

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => this.handleKeyboard(e));

    // Admin login events
    document.getElementById('admin-login-submit')?.addEventListener('click', () => AdminLogin.submit());
    document.getElementById('admin-password-input')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') AdminLogin.submit();
      if (e.key === 'Escape') AdminLogin.hide();
    });
    document.getElementById('admin-login-overlay')?.addEventListener('click', (e) => {
      if (e.target === e.currentTarget) AdminLogin.hide();
    });

    // Update badges on task changes
    store.on('tasks', () => {
      Sidebar.updateBadges();
      Sidebar.renderProjects();
      if (this.currentView) this.showView(this.currentView);
    });

    store.on('auth', () => {
      this.updateAuthUI();
    });

    console.log(`✅ TaskDash initialized (mode: ${mode})`);
  },

  // ── Auth UI ──

  updateAuthUI() {
    const isAdmin = store.isAdmin;
    const body = document.body;

    if (isAdmin) {
      body.classList.remove('viewer-mode');
      body.classList.add('admin-mode');
    } else {
      body.classList.remove('admin-mode');
      body.classList.add('viewer-mode');
    }

    // Update admin/viewer indicator
    const adminIndicator = document.getElementById('admin-indicator');
    if (adminIndicator) {
      if (isAdmin) {
        adminIndicator.innerHTML = `
          <button class="btn btn-sm" style="background: rgba(16, 185, 129, 0.1); color: var(--color-success-500); border: 1px solid rgba(16, 185, 129, 0.2); gap: 6px;" onclick="App.showAdminMenu(event)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
            管理者
          </button>
        `;
      } else {
        adminIndicator.innerHTML = `
          <button class="btn btn-sm btn-ghost" style="gap: 6px; font-size: 12px;" onclick="AdminLogin.show()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0110 0v4"/>
            </svg>
            ログイン
          </button>
        `;
      }
    }

    // Update viewer banner
    const viewerBanner = document.getElementById('viewer-banner');
    if (viewerBanner) {
      viewerBanner.style.display = isAdmin ? 'none' : 'flex';
    }
  },

  showAdminMenu(e) {
    const items = [
      {
        label: 'データを公開用にエクスポート',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
        action: () => {
          store.exportForPublish();
          Toast.show('data.json をダウンロードしました。プロジェクトのルートに配置して git push してください。', 'info', 5000);
        },
      },
      { divider: true },
      {
        label: 'バックアップ (Export)',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
        action: () => App.exportData(),
      },
      {
        label: 'リストア (Import)',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>',
        action: () => App.importData(),
      },
      { divider: true },
      {
        label: 'ログアウト',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>',
        danger: true,
        action: () => {
          store.logout();
          App.refreshCurrentView();
          Toast.show('ログアウトしました', 'info');
        },
      },
    ];
    ContextMenu.show(e.clientX, e.clientY, items);
  },

  handleRoute() {
    const hash = window.location.hash.slice(1) || 'dashboard';
    const [view, ...params] = hash.split('/');

    const validViews = ['dashboard', 'list', 'progress', 'calendar', 'gantt'];
    if (validViews.includes(view)) {
      this.showView(view);
    } else {
      this.showView('dashboard');
    }
  },

  navigateTo(view, params = {}) {
    this.filters = { ...this.filters, ...params };
    const currentHash = window.location.hash.slice(1).split('/')[0] || 'dashboard';
    if (currentHash === view) {
      this.showView(view);
    } else {
      window.location.hash = view;
    }
  },

  showView(view) {
    this.currentView = view;

    const titles = {
      dashboard: 'ダッシュボード',
      list: 'タスク一覧',
      progress: '全体進捗管理',
      calendar: 'カレンダー',
      gantt: 'ガントチャート',
    };

    Header.setTitle(titles[view] || view);
    Sidebar.setActive(view);

    switch (view) {
      case 'dashboard':
        DashboardView.render();
        break;
      case 'list':
        ListView.render();
        break;
      case 'progress':
        ProgressView.render();
        break;
      case 'calendar':
        CalendarView.render();
        break;
      case 'gantt':
        GanttView.render();
        break;
      default:
        DashboardView.render();
    }
  },

  refreshCurrentView() {
    this.showView(this.currentView);
  },

  // ── Theme ──

  applyTheme() {
    const settings = store.getSettings();
    let theme = settings.theme;

    if (theme === 'system') {
      theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    document.documentElement.setAttribute('data-theme', theme);
    this.updateThemeIcon(theme);

    // Listen for system theme changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      if (store.getSettings().theme === 'system') {
        const newTheme = e.matches ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', newTheme);
        this.updateThemeIcon(newTheme);
      }
    });
  },

  toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const newTheme = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    store.updateSettings({ theme: newTheme });
    this.updateThemeIcon(newTheme);
  },

  updateThemeIcon(theme) {
    const btn = document.getElementById('theme-toggle');
    if (!btn) return;

    btn.innerHTML = theme === 'dark'
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>';
  },

  // ── Keyboard Shortcuts ──

  handleKeyboard(e) {
    // Don't trigger shortcuts when typing in inputs
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
      return;
    }

    // Check if modal is open
    const modalOpen = document.querySelector('.modal-overlay.active');

    if (e.key === 'Escape' && modalOpen) {
      TaskModal.close();
      AdminLogin.hide();
      return;
    }

    if (modalOpen) return;

    switch (e.key) {
      case 'n':
      case 'N':
        if (store.isAdmin) {
          e.preventDefault();
          TaskModal.open();
        }
        break;
      case '/':
        e.preventDefault();
        document.getElementById('search-input')?.focus();
        break;
      case '1':
        App.navigateTo('dashboard');
        break;
      case '2':
        App.navigateTo('list');
        break;
      case '3':
        App.navigateTo('progress');
        break;
      case '4':
        App.navigateTo('calendar');
        break;
      case '5':
        App.navigateTo('gantt');
        break;
    }
  },

  // ── Export/Import ──

  exportData() {
    const data = store.exportData();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `taskdash-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    Toast.show('データをエクスポートしました', 'success');
  },

  importData() {
    if (!store.isAdmin) {
      Toast.show('管理者のみがインポートできます', 'error');
      return;
    }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (e) => {
        const success = store.importData(e.target.result);
        if (success) {
          Toast.show('データをインポートしました', 'success');
          App.refreshCurrentView();
        } else {
          Toast.show('データの形式が正しくありません', 'error');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  },
};

// ── Initialize on DOM ready ──
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
