// ===================================
// DASHBOARD VIEW — dashboard.js
// ダッシュボードホーム画面
// ===================================

const DashboardView = {
  render() {
    const mainContent = document.getElementById('main-content');
    if (!mainContent) return;

    const stats = store.getStats();
    const overdueTasks = store.getOverdueTasks();
    const todayTasks = store.getTodayTasks();
    const thisWeekTasks = store.getThisWeekTasks();
    const inProgressTasks = store.getTasksByStatus(STATUSES.IN_PROGRESS.key);
    const recentTasks = store.getTasks().slice(0, 6);

    const hour = new Date().getHours();
    let greeting = 'こんにちは';
    if (hour < 6) greeting = 'お疲れ様です';
    else if (hour < 12) greeting = 'おはようございます';
    else if (hour < 18) greeting = 'こんにちは';
    else greeting = 'こんばんは';

    const todayStr = new Date().toLocaleDateString('ja-JP', {
      year: 'numeric', month: 'long', day: 'numeric', weekday: 'long'
    });

    mainContent.innerHTML = `
      <div class="view-container">
        <!-- Greeting -->
        <div class="dashboard-greeting">
          <h1 class="dashboard-greeting-text">${greeting} 👋</h1>
          <p class="dashboard-greeting-sub">${todayStr}</p>
        </div>

        <!-- External Links -->
        <div class="dashboard-links" style="display: flex; gap: var(--space-3); margin-bottom: var(--space-6); flex-wrap: wrap;">
          <a href="https://shimada-dashboard.vercel.app/" target="_blank" rel="noopener noreferrer" class="btn" style="background: var(--bg-surface); border: 1px solid var(--border-default); font-size: var(--text-sm); font-weight: var(--weight-medium); box-shadow: var(--shadow-sm);">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 16px; height: 16px;">
              <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"></path>
              <polyline points="15 3 21 3 21 9"></polyline>
              <line x1="10" y1="14" x2="21" y2="3"></line>
            </svg>
            経営ダッシュボード
          </a>
          <a href="https://antigravity-hub-two.vercel.app/" target="_blank" rel="noopener noreferrer" class="btn" style="background: var(--bg-surface); border: 1px solid var(--border-default); font-size: var(--text-sm); font-weight: var(--weight-medium); box-shadow: var(--shadow-sm);">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 16px; height: 16px;">
              <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"></path>
              <polyline points="15 3 21 3 21 9"></polyline>
              <line x1="10" y1="14" x2="21" y2="3"></line>
            </svg>
            プロジェクト管理ダッシュボード
          </a>
          <a href="https://project-task-delta.vercel.app/" target="_blank" rel="noopener noreferrer" class="btn" style="background: var(--bg-surface); border: 1px solid var(--border-default); font-size: var(--text-sm); font-weight: var(--weight-medium); box-shadow: var(--shadow-sm);">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 16px; height: 16px;">
              <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
              <path d="M2 17l10 5 10-5M2 12l10 5 10-5"></path>
            </svg>
            チームタスク管理dash board
          </a>
        </div>

        <!-- Top Row: Stats and Progress -->
        <div class="dashboard-top-row">
          
          <!-- 2x2 Stats Grid -->
          <div class="dashboard-stats-grid">
            <div class="stat-card">
              <div class="stat-card-icon" style="background: rgba(99, 102, 241, 0.1); color: var(--color-primary-500);">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
                </svg>
              </div>
              <div class="stat-card-value">${stats.total}</div>
              <div class="stat-card-label">全タスク</div>
            </div>
            <div class="stat-card">
              <div class="stat-card-icon" style="background: rgba(16, 185, 129, 0.1); color: var(--color-success-500);">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>
              <div class="stat-card-value">${stats.completed}</div>
              <div class="stat-card-label">完了済み</div>
            </div>
            <div class="stat-card">
              <div class="stat-card-icon" style="background: rgba(99, 102, 241, 0.1); color: var(--color-primary-500);">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                </svg>
              </div>
              <div class="stat-card-value">${stats.inProgress}</div>
              <div class="stat-card-label">進行中</div>
            </div>
            <div class="stat-card">
              <div class="stat-card-icon" style="background: ${stats.overdue > 0 ? 'rgba(244, 63, 94, 0.1)' : 'rgba(148, 163, 184, 0.1)'}; color: ${stats.overdue > 0 ? 'var(--color-danger-500)' : 'var(--text-tertiary)'};">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
              </div>
              <div class="stat-card-value" style="${stats.overdue > 0 ? 'color: var(--color-danger-500)' : ''}">${stats.overdue}</div>
              <div class="stat-card-label">期限超過</div>
            </div>
          </div>

          <!-- Circular Progress Square -->
          <div class="dashboard-progress-square">
            <h3 class="dashboard-progress-square-title">全体の進捗</h3>
            <div class="dashboard-progress-circle-wrap">
              <svg viewBox="0 0 100 100" class="circular-chart">
                <circle class="circle-bg" cx="50" cy="50" r="40"></circle>
                <circle class="circle-fg" cx="50" cy="50" r="40" stroke-dasharray="${(stats.completionRate / 100) * 251.2} 251.2"></circle>
              </svg>
              <div class="circle-percent">${stats.completionRate}%</div>
            </div>
            <div class="dashboard-progress-stats">
              <div class="dashboard-progress-stat">
                <div class="dashboard-progress-stat-value" style="color: var(--status-todo)">${stats.todo}</div>
                <div class="dashboard-progress-stat-label">未着手</div>
              </div>
              <div class="dashboard-progress-stat">
                <div class="dashboard-progress-stat-value" style="color: var(--status-in-progress)">${stats.inProgress}</div>
                <div class="dashboard-progress-stat-label">進行中</div>
              </div>
              <div class="dashboard-progress-stat">
                <div class="dashboard-progress-stat-value" style="color: var(--status-review)">${stats.review}</div>
                <div class="dashboard-progress-stat-label">レビュー</div>
              </div>
              <div class="dashboard-progress-stat">
                <div class="dashboard-progress-stat-value" style="color: var(--status-done)">${stats.completed}</div>
                <div class="dashboard-progress-stat-label">完了</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Overdue Tasks -->
        ${overdueTasks.length > 0 ? `
        <div class="dashboard-section">
          <div class="dashboard-section-header">
            <h2 class="dashboard-section-title"><span>🔴</span> 期限超過のタスク</h2>
            <span class="dashboard-section-link" onclick="App.navigateTo('list', { overdue: true })">すべて表示</span>
          </div>
          <div class="dashboard-tasks-grid">
            ${overdueTasks.slice(0, 4).map(t => TaskCard.render(t)).join('')}
          </div>
        </div>
        ` : ''}

        <!-- Goals Section -->
        <div class="dashboard-section">
          <div class="dashboard-section-header">
            <h2 class="dashboard-section-title"><span>🎯</span> 中期目標</h2>
            <button class="btn btn-primary admin-only" onclick="GoalModal.open()" style="padding: 4px 12px; font-size: var(--text-sm);">＋ 新しい目標を追加</button>
          </div>
          <div class="dashboard-goals-list">
            ${store.getGoals().length === 0 ? '<p style="color: var(--text-tertiary); font-size: var(--text-sm);">設定された中期目標はありません。</p>' : store.getGoals().map(g => `
              <div class="dashboard-goal-item" onclick="if(store.isAdmin) GoalModal.open(store.getGoals().find(x => x.id === '${g.id}'))" style="cursor: ${store.isAdmin ? 'pointer' : 'default'}">
                <div class="dashboard-goal-content">
                  <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: var(--space-1);">
                    <h4 class="dashboard-goal-title" style="margin-bottom: 0;">${g.title}</h4>
                    ${g.deadline ? `<span style="font-size: var(--text-xs); color: var(--text-tertiary); background: var(--bg-app); padding: 2px 6px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">${g.deadline}</span>` : ''}
                  </div>
                  ${g.description ? `<p class="dashboard-goal-desc">${g.description}</p>` : ''}
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Today's Tasks -->
        ${todayTasks.length > 0 ? `
        <div class="dashboard-section">
          <div class="dashboard-section-header">
            <h2 class="dashboard-section-title"><span>📌</span> 今日のタスク (進行中も含む)</h2>
            <span class="dashboard-section-link" onclick="App.navigateTo('list')">すべて表示</span>
          </div>
          <div class="dashboard-tasks-grid">
            ${todayTasks.slice(0, 4).map(t => TaskCard.render(t)).join('')}
          </div>
        </div>
        ` : ''}

        <!-- This Week's Tasks -->
        ${thisWeekTasks.length > 0 ? `
        <div class="dashboard-section">
          <div class="dashboard-section-header">
            <h2 class="dashboard-section-title"><span>📅</span> 今週締め切りのタスク</h2>
            <span class="dashboard-section-link" onclick="App.navigateTo('list')">すべて表示</span>
          </div>
          <div class="dashboard-tasks-grid">
            ${thisWeekTasks.slice(0, 4).map(t => TaskCard.render(t)).join('')}
          </div>
        </div>
        ` : ''}

        <!-- In Progress -->
        ${inProgressTasks.length > 0 ? `
        <div class="dashboard-section">
          <div class="dashboard-section-header">
            <h2 class="dashboard-section-title"><span>🔵</span> 進行中のタスク</h2>
            <span class="dashboard-section-link" onclick="App.navigateTo('list', { status: 'in-progress' })">すべて表示</span>
          </div>
          <div class="dashboard-tasks-grid">
            ${inProgressTasks.slice(0, 4).map(t => TaskCard.render(t)).join('')}
          </div>
        </div>
        ` : ''}

        <!-- Recent Tasks (only if no specific sections above) -->
        ${overdueTasks.length === 0 && todayTasks.length === 0 && inProgressTasks.length === 0 ? `
        <div class="dashboard-section">
          <div class="dashboard-section-header">
            <h2 class="dashboard-section-title"><span>📋</span> 最近のタスク</h2>
            <span class="dashboard-section-link" onclick="App.navigateTo('list')">すべて表示</span>
          </div>
          ${recentTasks.length > 0 ? `
            <div class="dashboard-tasks-grid">
              ${recentTasks.map(t => TaskCard.render(t)).join('')}
            </div>
          ` : `
            <div class="empty-state">
              <div class="empty-state-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 5v14M5 12h14"/>
                </svg>
              </div>
              <h3 class="empty-state-title">タスクがありません</h3>
              <p class="empty-state-desc">新しいタスクを作成して始めましょう</p>
              <button class="btn btn-primary admin-only" onclick="TaskModal.open()">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 5v14M5 12h14"/>
                </svg>
                タスクを作成
              </button>
            </div>
          `}
        </div>
        ` : ''}
      </div>
    `;
  },
};
