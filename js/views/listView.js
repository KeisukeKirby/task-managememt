// ===================================
// LIST VIEW — listView.js
// リスト（テーブル）ビュー
// ===================================

const ListView = {
  render() {
    const mainContent = document.getElementById('main-content');
    if (!mainContent) return;

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

        ${tasks.length > 0 ? `
        <div class="task-table">
          <div class="task-table-header">
            <div></div>
            <div>タイトル</div>
            <div>ステータス</div>
            <div>優先度</div>
            <div>期限</div>
            <div>プロジェクト</div>
            <div></div>
          </div>
          ${tasks.map(t => TaskCard.renderTableRow(t)).join('')}
        </div>
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
  },
};
