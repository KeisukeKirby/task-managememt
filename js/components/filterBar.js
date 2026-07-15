// ===================================
// FILTER BAR — filterBar.js
// フィルターバー
// ===================================

const FilterBar = {
  render(containerId, options = {}) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const projects = store.getProjects();
    const currentFilters = App.filters || {};

    container.innerHTML = `
      <div class="filter-bar">
        <div class="filter-bar-group">
          <div class="view-toggle">
            <button class="view-toggle-btn ${App.currentView === 'list' ? 'active' : ''}" onclick="App.navigateTo('list')" data-tooltip="リスト">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/>
                <line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/>
                <line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
              </svg>
              リスト
            </button>
            <button class="view-toggle-btn ${App.currentView === 'progress' ? 'active' : ''}" onclick="App.navigateTo('progress')" data-tooltip="全体進捗管理">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="7" height="18" rx="1"/><rect x="14" y="3" width="7" height="10" rx="1"/>
              </svg>
              ボード
            </button>
            <button class="view-toggle-btn ${App.currentView === 'calendar' ? 'active' : ''}" onclick="App.navigateTo('calendar')" data-tooltip="カレンダー">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              カレンダー
            </button>
          </div>
        </div>

        <div class="filter-bar-group" style="flex: 1; justify-content: flex-end;">
          ${!options.hideStatusFilter ? `
          <div class="dropdown">
            <button class="filter-chip ${currentFilters.status && currentFilters.status.length > 0 && currentFilters.status !== 'all' ? 'active' : ''}" 
                    onclick="FilterBar.toggleDropdown(this)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px;">
                <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
              </svg>
              ステータス
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:10px;height:10px;">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>
            <div class="dropdown-menu" id="status-dropdown">
              <div class="dropdown-item ${!currentFilters.status || currentFilters.status === 'all' || currentFilters.status.length === 0 ? 'active' : ''}" 
                   onclick="FilterBar.setFilter('status', 'all')">
                   <div style="width: 16px;"></div> すべて
              </div>
              <div class="context-menu-divider"></div>
              ${Object.values(STATUSES).map(s => {
                const isChecked = Array.isArray(currentFilters.status) && currentFilters.status.includes(s.key);
                return `
                  <div class="dropdown-item" onclick="FilterBar.toggleStatusFilter(event, '${s.key}')">
                    <input type="checkbox" ${isChecked ? 'checked' : ''} style="margin-right: 8px; pointer-events: none;">
                    <span class="status-badge-dot" style="background: ${s.color}; width: 8px; height: 8px; border-radius: 50%; margin-right: 4px;"></span>
                    ${s.label}
                  </div>
                `;
              }).join('')}
            </div>
          </div>
          ` : ''}

          <div class="dropdown">
            <button class="filter-chip ${currentFilters.importance && currentFilters.importance !== 'all' ? 'active' : ''}"
                    onclick="FilterBar.toggleDropdown(this)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px;">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
              </svg>
              重要度
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:10px;height:10px;">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>
            <div class="dropdown-menu">
              <div class="dropdown-item ${!currentFilters.importance || currentFilters.importance === 'all' ? 'active' : ''}"
                   onclick="FilterBar.setFilter('importance', 'all')">すべて</div>
              ${Object.values(IMPORTANCE_LEVELS).map(i => `
                <div class="dropdown-item ${currentFilters.importance === i.key ? 'active' : ''}"
                     onclick="FilterBar.setFilter('importance', '${i.key}')">${i.icon} ${i.label}</div>
              `).join('')}
            </div>
          </div>

          <div class="dropdown">
            <button class="filter-chip ${currentFilters.urgency && currentFilters.urgency !== 'all' ? 'active' : ''}"
                    onclick="FilterBar.toggleDropdown(this)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px;">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
              </svg>
              緊急性
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:10px;height:10px;">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>
            <div class="dropdown-menu">
              <div class="dropdown-item ${!currentFilters.urgency || currentFilters.urgency === 'all' ? 'active' : ''}"
                   onclick="FilterBar.setFilter('urgency', 'all')">すべて</div>
              ${Object.values(URGENCY_LEVELS).map(u => `
                <div class="dropdown-item ${currentFilters.urgency === u.key ? 'active' : ''}"
                     onclick="FilterBar.setFilter('urgency', '${u.key}')">${u.icon} ${u.label}</div>
              `).join('')}
            </div>
          </div>

          ${projects.length > 0 ? `
          <div class="dropdown">
            <button class="filter-chip ${currentFilters.projectId && currentFilters.projectId !== 'all' ? 'active' : ''}"
                    onclick="FilterBar.toggleDropdown(this)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px;">
                <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
              </svg>
              プロジェクト
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:10px;height:10px;">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>
            <div class="dropdown-menu">
              <div class="dropdown-item ${!currentFilters.projectId || currentFilters.projectId === 'all' ? 'active' : ''}"
                   onclick="FilterBar.setFilter('projectId', 'all')">すべて</div>
              <div class="dropdown-item ${currentFilters.projectId === 'none' ? 'active' : ''}"
                   onclick="FilterBar.setFilter('projectId', 'none')">プロジェクトなし</div>
              <div class="context-menu-divider"></div>
              ${projects.map(p => `
                <div class="dropdown-item ${currentFilters.projectId === p.id ? 'active' : ''}"
                     onclick="FilterBar.setFilter('projectId', '${p.id}')">
                  <span style="color: ${p.color}">${p.icon}</span> ${p.name}
                </div>
              `).join('')}
            </div>
          </div>
          ` : ''}

          <div class="dropdown">
            <button class="filter-chip ${currentFilters.sortBy ? 'active' : ''}"
                    onclick="FilterBar.toggleDropdown(this)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px;">
                <path d="M3 15l4 4 4-4M7 19V5M21 9l-4-4-4 4M17 5v14"/>
              </svg>
              並び替え
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:10px;height:10px;">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>
            <div class="dropdown-menu">
              <div class="dropdown-item ${!currentFilters.sortBy ? 'active' : ''}"
                   onclick="FilterBar.setSort('', '')">プロジェクト別（標準）</div>
              <div class="dropdown-item ${currentFilters.sortBy === 'startDate' ? 'active' : ''}"
                   onclick="FilterBar.setSort('startDate', 'asc')">開始日順</div>
              <div class="dropdown-item ${currentFilters.sortBy === 'dueDate' ? 'active' : ''}"
                   onclick="FilterBar.setSort('dueDate', 'asc')">締め切り日順</div>
            </div>
          </div>

          <button class="filter-chip tooltip" data-tooltip="現在のフィルター状態を初期表示に設定" onclick="FilterBar.saveDefaultFilters()" style="margin-left: 8px;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px;margin-right:2px;">
              <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/>
              <polyline points="17 21 17 13 7 13 7 21"/>
              <polyline points="7 3 7 8 15 8"/>
            </svg>
            デフォルトに設定
          </button>

        </div>
      </div>
    `;
  },

  toggleDropdown(btn) {
    const menu = btn.nextElementSibling;
    if (!menu) return;

    // Close all other dropdowns
    document.querySelectorAll('.dropdown-menu.active').forEach(m => {
      if (m !== menu) m.classList.remove('active');
    });

    menu.classList.toggle('active');

    // Close on outside click
    const close = (e) => {
      if (!btn.contains(e.target) && !menu.contains(e.target)) {
        menu.classList.remove('active');
        document.removeEventListener('click', close);
      }
    };
    setTimeout(() => document.addEventListener('click', close), 0);
  },

  setFilter(key, value) {
    App.filters[key] = value;
    document.querySelectorAll('.dropdown-menu.active').forEach(m => m.classList.remove('active'));
    App.refreshCurrentView();
  },

  toggleStatusFilter(e, statusKey) {
    e.stopPropagation(); // メニューを閉じない
    
    if (!App.filters.status || App.filters.status === 'all') {
      App.filters.status = [];
    } else if (!Array.isArray(App.filters.status)) {
      App.filters.status = [App.filters.status];
    }

    const index = App.filters.status.indexOf(statusKey);
    if (index > -1) {
      App.filters.status.splice(index, 1);
    } else {
      App.filters.status.push(statusKey);
    }

    if (App.filters.status.length === 0) {
      App.filters.status = 'all';
    }

    // 画面の再描画（メニューは開いたままにするため、まずはDOMを更新）
    // render()を呼ぶとすべて再描画されてドロップダウンが閉じるので注意
    const currentMenu = e.target.closest('.dropdown-menu');
    const wasActive = currentMenu ? currentMenu.classList.contains('active') : false;
    
    App.refreshCurrentView();

    // 再描画後にメニューを再度開く（簡易的な対応）
    if (wasActive) {
      setTimeout(() => {
        const btn = document.querySelector('#status-dropdown')?.previousElementSibling;
        if (btn) FilterBar.toggleDropdown(btn);
      }, 0);
    }
  },

  setSort(sortBy, sortDir) {
    App.filters.sortBy = sortBy;
    App.filters.sortDir = sortDir;
    document.querySelectorAll('.dropdown-menu.active').forEach(m => m.classList.remove('active'));
    App.refreshCurrentView();
  },

  saveDefaultFilters() {
    if (!store.isAdmin) {
      Toast.show('デフォルト設定の保存は管理者のみ可能です', 'error');
      return;
    }
    store.updateSettings({ defaultFilters: { ...App.filters } });
    Toast.show('現在の絞り込み状態をデフォルトに設定しました', 'success');
  },
};
