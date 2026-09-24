// ===================================
// HEADER — header.js
// ヘッダー・検索バー
// ===================================

const Header = {
  init() {
    this.el = document.getElementById('header');
    this.titleEl = document.getElementById('header-title');
    this.searchInput = document.getElementById('search-input');
    this.bindEvents();
  },

  bindEvents() {
    // Mobile menu toggle
    document.getElementById('mobile-menu-toggle')?.addEventListener('click', () => {
      const sidebar = document.getElementById('sidebar');
      const overlay = document.getElementById('mobile-sidebar-overlay');
      sidebar.classList.toggle('mobile-open');
      overlay.classList.toggle('active');
    });

    document.getElementById('mobile-sidebar-overlay')?.addEventListener('click', () => {
      document.getElementById('sidebar').classList.remove('mobile-open');
      document.getElementById('mobile-sidebar-overlay').classList.remove('active');
    });

    // Search
    if (this.searchInput) {
      let debounceTimer;
      this.searchInput.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          const query = this.searchInput.value.trim();
          if (App.currentView === 'library') {
            LibraryView.searchFromHeader(query);
          } else if (App.currentView === 'list' || App.currentView === 'progress') {
            App.filters.search = query;
            App.refreshCurrentView();
          } else if (query) {
            App.navigateTo('list', { search: query });
          }
        }, 300);
      });

      this.searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          this.searchInput.value = '';
          this.searchInput.blur();
          if (App.currentView === 'library') {
            LibraryView.searchFromHeader('');
            return;
          }
          App.filters.search = '';
          App.refreshCurrentView();
        }
      });
    }

    // Theme toggle
    document.getElementById('theme-toggle')?.addEventListener('click', () => {
      App.toggleTheme();
    });

    // New task button
    document.getElementById('new-task-btn')?.addEventListener('click', () => {
      TaskModal.open();
    });
  },

  setTitle(title) {
    if (this.titleEl) this.titleEl.textContent = title;
  },

  // 検索欄が何を探すのかは画面によって変わる。表示中の語もその画面のものに合わせる
  setSearchMode(view) {
    if (!this.searchInput) return;
    this.searchInput.placeholder = view === 'library' ? '資料を検索...' : 'タスクを検索...';
    this.setSearchValue(view === 'library' ? LibraryView.query : (App.filters.search || ''));
  },

  setSearchValue(value) {
    if (this.searchInput && this.searchInput.value !== value) this.searchInput.value = value || '';
  },

  clearSearch() {
    if (this.searchInput) this.searchInput.value = '';
  },
};
