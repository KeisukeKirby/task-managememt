// ===================================
// CALENDAR VIEW — calendarView.js
// カレンダービュー
// ===================================

const CalendarView = {
  currentDate: new Date(),

  render() {
    const mainContent = document.getElementById('main-content');
    if (!mainContent) return;

    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();
    const monthName = this.currentDate.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long' });

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - startDate.getDay()); // Start from Sunday

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Build calendar days
    const days = [];
    const current = new Date(startDate);
    while (days.length < 42) { // 6 weeks
      days.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }

    // Get all tasks with due dates for this month view
    const allTasks = store.getTasks();

    const statusColors = {
      'todo': { bg: 'rgba(148, 163, 184, 0.15)', text: '#64748b' },
      'in-progress': { bg: 'rgba(99, 102, 241, 0.15)', text: '#6366f1' },
      'review': { bg: 'rgba(245, 158, 11, 0.15)', text: '#d97706' },
      'done': { bg: 'rgba(16, 185, 129, 0.15)', text: '#059669' },
    };

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

        <div class="calendar-container">
          <div class="calendar-header">
            <div class="calendar-nav">
              <button class="calendar-nav-btn" onclick="CalendarView.prevMonth()">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="15 18 9 12 15 6"/>
                </svg>
              </button>
              <span class="calendar-month-title">${monthName}</span>
              <button class="calendar-nav-btn" onclick="CalendarView.nextMonth()">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </button>
            </div>
            <button class="calendar-today-btn" onclick="CalendarView.goToToday()">今日</button>
          </div>

          <div class="calendar-weekdays">
            ${['日', '月', '火', '水', '木', '金', '土'].map(d => 
              `<div class="calendar-weekday">${d}</div>`
            ).join('')}
          </div>

          <div class="calendar-grid">
            ${days.map(day => {
              const isOtherMonth = day.getMonth() !== month;
              const isToday = day.toDateString() === today.toDateString();
              const dateStr = day.toISOString().split('T')[0];
              const dayTasks = allTasks.filter(t => {
                if (!t.dueDate) return false;
                const d = new Date(day);
                d.setHours(0,0,0,0);
                const due = new Date(t.dueDate);
                due.setHours(0,0,0,0);
                
                if (t.startDate) {
                   const start = new Date(t.startDate);
                   start.setHours(0,0,0,0);
                   return d >= start && d <= due;
                } else {
                   return due.getTime() === d.getTime();
                }
              });

              const maxShow = 3;
              const visibleTasks = dayTasks.slice(0, maxShow);
              const remaining = dayTasks.length - maxShow;

              return `
                <div class="calendar-day ${isOtherMonth ? 'other-month' : ''} ${isToday ? 'today' : ''}"
                     onclick="CalendarView.onDayClick('${dateStr}')">
                  <div class="calendar-day-number">${day.getDate()}</div>
                  <div class="calendar-day-tasks">
                    ${visibleTasks.map(t => {
                      const colors = statusColors[t.status] || statusColors['todo'];
                      return `
                        <div class="calendar-task-item" 
                             style="background: ${colors.bg}; color: ${colors.text};"
                             onclick="event.stopPropagation(); TaskModal.open(store.getTask('${t.id}'))"
                             title="${t.title}">
                          ${t.title}
                        </div>
                      `;
                    }).join('')}
                    ${remaining > 0 ? `<span class="calendar-task-more">+${remaining} 件</span>` : ''}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>
    `;

    FilterBar.render('filter-bar-container');
  },

  prevMonth() {
    this.currentDate.setMonth(this.currentDate.getMonth() - 1);
    this.render();
  },

  nextMonth() {
    this.currentDate.setMonth(this.currentDate.getMonth() + 1);
    this.render();
  },

  goToToday() {
    this.currentDate = new Date();
    this.render();
  },

  onDayClick(dateStr) {
    // Open new task modal with pre-filled date
    TaskModal.open();
    setTimeout(() => {
      const dueInput = document.getElementById('task-due-input');
      if (dueInput) dueInput.value = dateStr;
    }, 50);
  },
};
