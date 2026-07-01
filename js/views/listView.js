// ===================================
// LIST VIEW — listView.js
// リスト（テーブル）ビュー
// ===================================

const ListView = {
  selectedTasks: new Set(),

  render() {
    const mainContent = document.getElementById('main-content');
    if (!mainContent) return;

    // Reset selection on full re-render
    this.selectedTasks.clear();

    const tasks = store.getFilteredTasks(App.filters);

    mainContent.innerHTML = `
      <div class="view-container">
        <div class="list-view-header">
          <div class="list-view-actions">
            <button class="btn btn-primary admin-only" onclick="TaskModal.open()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 5v14M5 12h14"/>
              </svg>
              新しいタスク
            </button>
          </div>
        </div>

        <div id="filter-bar-container"></div>

        <!-- Bulk Actions Bar -->
        <div id="list-bulk-actions-bar" class="list-bulk-actions admin-only" style="display: none;">
          <span class="list-bulk-text" id="list-bulk-count">0件選択中</span>
          <div style="flex:1"></div>
          <button class="btn btn-danger btn-sm" onclick="ListView.bulkDelete()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;">
              <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
            </svg>
            一括削除
          </button>
        </div>

        ${tasks.length > 0 ? `
        <div class="task-table">
          <div class="task-table-header">
            <div style="display:flex; align-items:center;">
              <input type="checkbox" id="list-bulk-select-all" class="bulk-checkbox admin-only" onclick="ListView.toggleAll(event)">
            </div>
            <div></div>
            <div>タイトル</div>
            <div>ステータス</div>
            <div>重要度</div>
            <div>緊急性</div>
            <div>L/T(日)</div>
            <div>コラボレーター</div>
            <div>期限</div>
            <div>プロジェクト</div>
            <div></div>
          </div>
          ${tasks.map(t => TaskCard.renderTableRow(t)).join('')}        </div>
        ` : `
        <div class="empty-state">
          <div class="empty-state-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
              <polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/>
              <line x1="9" y1="15" x2="15" y2="15"/>
            </svg>
          </div>
          <h3 class="empty-state-title">タスクが見つかりません</h3>
          <p class="empty-state-desc">${App.filters.search ? '検索条件を変更してみてください' : '新しいタスクを作成しましょう'}</p>
          <button class="btn btn-primary admin-only" onclick="TaskModal.open()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 5v14M5 12h14"/>
            </svg>
            タスクを作成
          </button>
        </div>
        `}
      </div>
    `;

    FilterBar.render('filter-bar-container');
    this.updateBulkUI();
    this.bindDragEvents();
  },

  bindDragEvents() {
    let draggedTaskId = null;

    const rows = document.querySelectorAll('.task-table-row');
    rows.forEach(row => {
      row.addEventListener('dragstart', (e) => {
        if (!store.isAdmin || (App && App.filters && App.filters.sortBy !== 'manual')) {
          e.preventDefault();
          if (store.isAdmin) Toast.show('手動での並び替えは「ソートなし」の場合のみ可能です', 'info');
          return;
        }
        draggedTaskId = row.dataset.taskId;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', draggedTaskId);
        row.style.opacity = '0.5';
        
        // Add a class to body to prevent text selection during drag
        document.body.classList.add('is-dragging');
      });

      row.addEventListener('dragend', () => {
        row.style.opacity = '';
        rows.forEach(r => r.classList.remove('drag-over'));
        document.body.classList.remove('is-dragging');
      });

      row.addEventListener('dragenter', (e) => {
        if (!store.isAdmin) return;
        e.preventDefault();
      });

      row.addEventListener('dragover', (e) => {
        if (!store.isAdmin) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (draggedTaskId === row.dataset.taskId) return;
        
        row.classList.add('drag-over');
      });

      row.addEventListener('dragleave', () => {
        row.classList.remove('drag-over');
      });

      row.addEventListener('drop', (e) => {
        if (!store.isAdmin) return;
        e.preventDefault();
        e.stopPropagation();
        
        row.classList.remove('drag-over');
        
        const targetTaskId = row.dataset.taskId;
        if (draggedTaskId && draggedTaskId !== targetTaskId) {
          store.reorderTasks(draggedTaskId, targetTaskId, 'before');
        }
      });
    });
  },

  toggleTaskSelection(taskId) {
    if (this.selectedTasks.has(taskId)) {
      this.selectedTasks.delete(taskId);
    } else {
      this.selectedTasks.add(taskId);
    }
    this.updateBulkUI();
  },

  toggleAll(event) {
    const isChecked = event.target.checked;
    const checkboxes = document.querySelectorAll('.bulk-checkbox[data-bulk-id]');
    
    this.selectedTasks.clear();
    if (isChecked) {
      checkboxes.forEach(cb => {
        cb.checked = true;
        this.selectedTasks.add(cb.dataset.bulkId);
      });
    } else {
      checkboxes.forEach(cb => {
        cb.checked = false;
      });
    }
    this.updateBulkUI();
  },

  updateBulkUI() {
    const bar = document.getElementById('list-bulk-actions-bar');
    const countText = document.getElementById('list-bulk-count');
    const selectAllCheckbox = document.getElementById('list-bulk-select-all');
    
    if (!bar) return;

    const count = this.selectedTasks.size;
    
    if (count > 0 && store.isAdmin) {
      bar.style.display = 'flex';
      countText.textContent = `${count}件選択中`;
    } else {
      bar.style.display = 'none';
    }

    // Update 'Select All' checkbox state
    if (selectAllCheckbox) {
      const allCheckboxes = document.querySelectorAll('.bulk-checkbox[data-bulk-id]');
      if (allCheckboxes.length > 0 && count === allCheckboxes.length) {
        selectAllCheckbox.checked = true;
        selectAllCheckbox.indeterminate = false;
      } else if (count > 0) {
        selectAllCheckbox.checked = false;
        selectAllCheckbox.indeterminate = true;
      } else {
        selectAllCheckbox.checked = false;
        selectAllCheckbox.indeterminate = false;
      }
    }
  },

  bulkDelete() {
    if (!store.isAdmin) return;
    if (this.selectedTasks.size === 0) return;

    if (confirm(`選択した ${this.selectedTasks.size} 件のタスクを削除しますか？\nこの操作は元に戻せません。`)) {
      this.selectedTasks.forEach(taskId => {
        store.deleteTask(taskId);
      });
      Toast.show(`${this.selectedTasks.size} 件のタスクを削除しました`, 'success');
      this.selectedTasks.clear();
      App.refreshCurrentView();
      Sidebar.updateBadges();
    }
  }
};
