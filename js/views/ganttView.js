// ===================================
// GANTT VIEW — ganttView.js
// ガントチャートビュー
// ===================================

const GanttView = {
  startDate: new Date(), // 中心となる日付（初期値は今日）
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

    // 開始日でソート（開始日がない場合は作成日で代用）
    tasks.sort((a, b) => {
      const dateA = new Date(a.startDate || a.createdAt).getTime();
      const dateB = new Date(b.startDate || b.createdAt).getTime();
      return dateA - dateB;
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
              <button class="gantt-nav-btn" onclick="GanttView.moveDate(-7)" title="1週間戻る">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="15 18 9 12 15 6"/>
                </svg>
              </button>
              <button class="gantt-nav-btn" onclick="GanttView.moveDate(-1)" title="1日戻る">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="14 18 10 12 14 6"/>
                </svg>
              </button>
              <span class="gantt-month-title">${monthName}</span>
              <button class="gantt-nav-btn" onclick="GanttView.moveDate(1)" title="1日進む">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="10 18 14 12 10 6"/>
                </svg>
              </button>
              <button class="gantt-nav-btn" onclick="GanttView.moveDate(7)" title="1週間進む">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </button>
            </div>
            <button class="gantt-today-btn" onclick="GanttView.goToToday()">今日</button>
          </div>

          <!-- 本体 -->
          <div class="gantt-body">
            <!-- 左サイドバー（タスクリスト） -->
            <div class="gantt-sidebar">
              <div class="gantt-sidebar-header">タスク名</div>
              <div class="gantt-task-list" id="gantt-sidebar-list">
                ${tasks.map(t => `
                  <div class="gantt-task-item ${t.status === 'done' ? 'completed' : ''}" 
                       onclick="TaskModal.open(store.getTask('${t.id}'))" title="${t.title}">
                    ${t.title}
                  </div>
                `).join('')}
              </div>
            </div>

            <!-- 右タイムライン -->
            <div class="gantt-timeline-container" id="gantt-timeline-container">
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
                  ${tasks.map(t => {
                    // バーの位置と幅を計算
                    // 開始日がない場合は作成日、期限がない場合は開始日と同じにする
                    let taskStart = t.startDate ? new Date(t.startDate) : new Date(t.createdAt.split('T')[0]);
                    let taskEnd = t.dueDate ? new Date(t.dueDate) : new Date(taskStart);
                    
                    // 日付のみで比較するため時間をリセット
                    taskStart.setHours(0,0,0,0);
                    taskEnd.setHours(0,0,0,0);
                    
                    // 終了日が開始日より前にならないように
                    if (taskEnd < taskStart) taskEnd = new Date(taskStart);

                    const viewStart = new Date(this.startDate);
                    viewStart.setHours(0,0,0,0);

                    // 日数差を計算
                    const startDiffDays = Math.round((taskStart - viewStart) / (1000 * 60 * 60 * 24));
                    const durationDays = Math.round((taskEnd - taskStart) / (1000 * 60 * 60 * 24)) + 1;

                    let left = startDiffDays * this.cellWidth;
                    let width = durationDays * this.cellWidth;

                    // 表示範囲外の処理
                    let isVisible = true;
                    if (startDiffDays + durationDays <= 0 || startDiffDays >= this.daysToShow) {
                      isVisible = false;
                    }

                    // 色の決定（ステータスカラー）
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
      const timeline = document.getElementById('gantt-timeline-container');
      const sidebar = document.getElementById('gantt-sidebar-list');
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
