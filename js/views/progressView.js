// ===================================
// PROGRESS VIEW — progressView.js
// 全体進捗管理（担当者別ガントチャート）
// ===================================

const ProgressView = {
  startDate: new Date(), // 中心となる日付
  daysToShow: 30, // 表示する日数
  cellWidth: 40, // 1日あたりのピクセル幅

  init() {
    // 初回表示時は今日から3日前に設定
    const today = new Date();
    today.setDate(today.getDate() - 3);
    this.startDate = today;
  },

  render() {
    if (!this.startDate) this.init();

    const mainContent = document.getElementById('main-content');
    if (!mainContent) return;

    const tasks = store.getFilteredTasks(App.filters);

    // グループ化: 担当者(collaborator)別
    const groups = {};
    tasks.forEach(t => {
      const colName = t.collaborator ? t.collaborator.trim() : '担当者未定';
      if (!groups[colName]) groups[colName] = [];
      groups[colName].push(t);
    });

    const sortedColNames = Object.keys(groups).sort((a, b) => {
      if (a === '担当者未定') return 1;
      if (b === '担当者未定') return -1;
      return a.localeCompare(b);
    });

    const collaborators = sortedColNames.map(name => {
      // 各担当者内のタスクは開始日でソート
      const sortedTasks = groups[name].sort((a, b) => {
        const dateA = new Date(a.startDate || a.createdAt).getTime();
        const dateB = new Date(b.startDate || b.createdAt).getTime();
        return dateA - dateB;
      });
      return { name, tasks: sortedTasks };
    });

    // 描画用の日付配列を作成
    const dates = [];
    for (let i = 0; i < this.daysToShow; i++) {
      const d = new Date(this.startDate);
      d.setDate(d.getDate() + i);
      dates.push(d);
    }

    const monthName = dates[0].toLocaleDateString('ja-JP', { year: 'numeric', month: 'long' });
    const todayStr = new Date().toDateString();

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

        <div class="gantt-container">
          <!-- ヘッダーコントロール -->
          <div class="gantt-header-controls">
            <div class="gantt-nav">
              <button class="gantt-nav-btn" onclick="ProgressView.moveDate(-7)" title="1週間戻る">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="15 18 9 12 15 6"/>
                </svg>
              </button>
              <button class="gantt-nav-btn" onclick="ProgressView.moveDate(-1)" title="1日戻る">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="14 18 10 12 14 6"/>
                </svg>
              </button>
              <span class="gantt-month-title">${monthName}</span>
              <button class="gantt-nav-btn" onclick="ProgressView.moveDate(1)" title="1日進む">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="10 18 14 12 10 6"/>
                </svg>
              </button>
              <button class="gantt-nav-btn" onclick="ProgressView.moveDate(7)" title="1週間進む">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </button>
            </div>
            <button class="gantt-today-btn" onclick="ProgressView.goToToday()">今日</button>
          </div>

          <!-- 本体 -->
          <div class="gantt-body">
            <!-- 左サイドバー（担当者＆タスクリスト） -->
            <div class="gantt-sidebar">
              <div class="gantt-sidebar-header">担当者 / タスク名</div>
              <div class="gantt-task-list" id="progress-sidebar-list">
                ${collaborators.map(c => `
                  <!-- 担当者ヘッダー -->
                  <div style="height: 36px; display: flex; align-items: center; padding: 0 12px; background: var(--bg-surface-hover); border-bottom: 1px solid var(--border-subtle); border-top: 1px solid var(--border-subtle); font-weight: bold; font-size: 13px; color: var(--text-primary); gap: 8px;">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;color:var(--text-secondary)"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                    ${c.name} 
                    <span style="font-size: 11px; font-weight: normal; color: var(--text-tertiary); background: var(--bg-app); padding: 2px 6px; border-radius: 10px;">${c.tasks.length}件</span>
                  </div>
                  <!-- タスク一覧 -->
                  ${c.tasks.map(t => `
                    <div class="gantt-task-item ${t.status === 'done' ? 'completed' : ''}" 
                         style="padding-left: 28px;"
                         onclick="TaskModal.open(store.getTask('${t.id}'))" title="${t.title}">
                      <span class="status-badge-dot" style="background: ${getStatusInfo(t.status).color}; width: 6px; height: 6px; border-radius: 50%; display: inline-block; margin-right: 6px;"></span>
                      ${t.title}
                    </div>
                  `).join('')}
                `).join('')}
              </div>
            </div>

            <!-- 右タイムライン -->
            <div class="gantt-timeline-container" id="progress-timeline-container">
              <div class="gantt-timeline-header">
                ${dates.map(d => {
                  const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                  const isToday = d.toDateString() === todayStr;
                  const dayName = ['日', '月', '火', '水', '木', '金', '土'][d.getDay()];
                  return `
                    <div class="gantt-day-header ${isWeekend ? 'weekend' : ''} ${isToday ? 'today' : ''}">
                      <span>${dayName}</span>
                      <span class="gantt-day-number">${d.getDate()}</span>
                    </div>
                  `;
                }).join('')}
              </div>

              <div class="gantt-timeline-grid">
                <!-- 背景グリッド線 -->
                <div class="gantt-grid-bg">
                  ${dates.map(d => {
                    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                    const isToday = d.toDateString() === todayStr;
                    return `<div class="gantt-grid-col ${isWeekend ? 'weekend' : ''} ${isToday ? 'today' : ''}"></div>`;
                  }).join('')}
                </div>

                <!-- タスクバー -->
                <div class="gantt-timeline-rows">
                  ${collaborators.map(c => `
                    <!-- 担当者ヘッダー行のダミー -->
                    <div style="height: 36px; background: rgba(0,0,0,0.02); border-bottom: 1px solid var(--border-subtle); border-top: 1px solid var(--border-subtle);"></div>
                    <!-- タスク行 -->
                    ${c.tasks.map(t => {
                      let taskStart = t.startDate ? new Date(t.startDate) : new Date(t.createdAt.split('T')[0]);
                      let taskEnd = t.dueDate ? new Date(t.dueDate) : new Date(taskStart);
                      
                      taskStart.setHours(0,0,0,0);
                      taskEnd.setHours(0,0,0,0);
                      
                      if (taskEnd < taskStart) taskEnd = new Date(taskStart);

                      const viewStart = new Date(this.startDate);
                      viewStart.setHours(0,0,0,0);

                      const startDiffDays = Math.round((taskStart - viewStart) / (1000 * 60 * 60 * 24));
                      const durationDays = Math.round((taskEnd - taskStart) / (1000 * 60 * 60 * 24)) + 1;

                      let left = startDiffDays * this.cellWidth;
                      let width = durationDays * this.cellWidth;

                      let isVisible = true;
                      if (startDiffDays + durationDays <= 0 || startDiffDays >= this.daysToShow) {
                        isVisible = false;
                      }

                      const statusColor = getStatusInfo(t.status).color;
                      const isCompleted = t.status === 'done';

                      return `
                        <div class="gantt-timeline-row">
                          ${isVisible ? `
                            <div class="gantt-bar ${isCompleted ? 'completed' : ''}" 
                                 style="left: ${left}px; width: ${width}px; background: ${statusColor}; color: white;"
                                 onclick="TaskModal.open(store.getTask('${t.id}'))"
                                 title="${t.title} (${taskStart.toLocaleDateString()} - ${taskEnd.toLocaleDateString()})">
                              ${t.title}
                            </div>
                          ` : ''}
                        </div>
                      `;
                    }).join('')}
                  `).join('')}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    FilterBar.render('filter-bar-container');

    // スクロール同期
    setTimeout(() => {
      const timeline = document.getElementById('progress-timeline-container');
      const sidebar = document.getElementById('progress-sidebar-list');
      if (timeline && sidebar) {
        timeline.addEventListener('scroll', () => {
          sidebar.scrollTop = timeline.scrollTop;
        });
      }
    }, 0);
  },

  moveDate(days) {
    this.startDate.setDate(this.startDate.getDate() + days);
    this.render();
  },

  goToToday() {
    this.init();
    this.render();
  }
};
