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
            <button class="view-toggle-btn ${App.currentView === 'kanban' ? 'active' : ''}" onclick="App.navigateTo('kanban')" data-tooltip="カンバン">
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
            <button class="filter-chip ${currentFilters.status && currentFilters.status !== 'all' ? 'active' : ''}" 
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
              <div class="dropdown-item ${!currentFilters.status || currentFilters.status === 'all' ? 'active' : ''}" 
                   onclick="FilterBar.setFilter('status', 'all')">すべて</div>
              ${Object.values(STATUSES).map(s => `
                <div class="dropdown-item ${currentFilters.status === s.key ? 'active' : ''}"
                     onclick="FilterBar.setFilter('status', '${s.key}')">
                  <span class="status-badge-dot" style="background: ${s.color}; width: 8px; height: 8px; border-radius: 50%;"></span>
                  ${s.label}
                </div>
              `).join('')}
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
            <button class="filter-chip" onclick="FilterBar.toggleDropdown(this)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px;">
                <line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/>
              </svg>
              並び替え
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:10px;height:10px;">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>
            <div class="dropdown-menu" style="right: 0; left: auto; min-width: 160px;">
              <div class="dropdown-item" onclick="FilterBar.setSort('manual', 'asc')">手動ソート (ソートなし)</div>
              <div class="dropdown-item" onclick="FilterBar.setSort('createdAt', 'desc')">作成日（新しい順）</div>
              <div class="dropdown-item" onclick="FilterBar.setSort('createdAt', 'asc')">作成日（古い順）</div>
              <div class="dropdown-item" onclick="FilterBar.setSort('dueDate', 'asc')">期限（近い順）</div>
              <div class="dropdown-item" onclick="FilterBar.setSort('importance', 'asc')">重要度（高い順）</div>
              <div class="dropdown-item" onclick="FilterBar.setSort('urgency', 'asc')">緊急性（高い順）</div>
              <div class="dropdown-item" onclick="FilterBar.setSort('leadTime', 'desc')">リードタイム（長い順）</div>
              <div class="dropdown-item" onclick="FilterBar.setSort('title', 'asc')">タイトル（A→Z）</div>
            </div>
          </div>
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

  setSort(sortBy, sortDir) {
    App.filters.sortBy = sortBy;
    App.filters.sortDir = sortDir;
    document.querySelectorAll('.dropdown-menu.active').forEach(m => m.classList.remove('active'));
    App.refreshCurrentView();
  },
};
