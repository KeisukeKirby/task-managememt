// ===================================
// TASK CARD — taskCard.js
// タスクカードコンポーネント
// ===================================

const TaskCard = {
  render(task, options = {}) {
    const importance = getImportanceInfo(task.importance);
    const urgency = getUrgencyInfo(task.urgency);
    const isCompleted = task.status === STATUSES.DONE.key;
    const overdue = isOverdue(task);
    const subtaskProgress = getSubtaskProgress(task);
    const project = task.projectId ? store.getProject(task.projectId) : null;

    const showPriorityBar = task.importance === 'high' || task.urgency === 'high';

    return `
      <div class="task-card animate-card-in ${showPriorityBar ? 'has-priority' : ''}"
           data-task-id="${task.id}" 
           onclick="TaskModal.open(store.getTask('${task.id}'))"
           draggable="${options.draggable !== false ? 'true' : 'false'}">
        ${showPriorityBar ? `<div class="task-card-priority-bar" style="background: ${urgency.color}"></div>` : ''}
        <div class="task-card-header">
          <div class="task-card-checkbox ${isCompleted ? 'checked' : ''}" 
               onclick="event.stopPropagation(); TaskCard.toggleComplete('${task.id}')">
            ${isCompleted ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
          </div>
          <span class="task-card-title ${isCompleted ? 'completed' : ''}">${this._escape(task.title)}</span>
        </div>
        ${task.description ? `<p class="task-card-description">${this._escape(task.description)}</p>` : ''}
        <div class="task-card-meta">
          ${task.dueDate ? `
            <span class="task-card-date ${overdue ? 'overdue' : ''}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              ${formatDate(task.dueDate)}
            </span>
          ` : ''}
          ${subtaskProgress ? `
            <span class="task-card-subtask-count">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 11l3 3L22 4"/>
                <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
              </svg>
              ${subtaskProgress.completed}/${subtaskProgress.total}
            </span>
          ` : ''}
          <span class="priority-badge priority-${task.importance}">${importance.icon} 重:${importance.label}</span>
          <span class="priority-badge priority-${task.urgency}">${urgency.icon} 緊:${urgency.label}</span>
          ${task.leadTime ? `
            <span class="task-card-date" style="margin-left:4px;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
              </svg>
              ${task.leadTime}日
            </span>
          ` : ''}
          ${task.collaborator ? `
            <span class="tag" style="background: rgba(148, 163, 184, 0.1); color: var(--text-secondary); border: 1px solid var(--border-subtle);">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px;margin-right:2px;">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
              ${task.collaborator}
            </span>
          ` : ''}
          ${project ? `
            <span class="tag" style="background: ${project.color}15; color: ${project.color};">
              <span class="tag-dot" style="background: ${project.color}"></span>
              ${project.icon} ${project.name}
            </span>
          ` : ''}
          <div class="task-card-tags">
            ${task.tags.map(tagId => {
              const tag = store.getTag(tagId);
              if (!tag) return '';
              return `<span class="tag" style="background: ${tag.bgColor}; color: ${tag.color};">${tag.name}</span>`;
            }).join('')}
          </div>
        </div>
      </div>
    `;
  },

  renderTableRow(task) {
    const importance = getImportanceInfo(task.importance);
    const urgency = getUrgencyInfo(task.urgency);
    const statusInfo = getStatusInfo(task.status);
    const isCompleted = task.status === STATUSES.DONE.key;
    const overdue = isOverdue(task);
    const project = task.projectId ? store.getProject(task.projectId) : null;

    return `
      <div class="task-table-row" data-task-id="${task.id}" onclick="TaskModal.open(store.getTask('${task.id}'))" draggable="true">
        <div class="task-table-cell" style="display:flex; align-items:center; gap: 8px;">
          <div class="drag-handle admin-only" style="cursor: grab; color: var(--text-muted); display: flex; align-items: center;" title="ドラッグして並び替え">
            <svg viewBox="0 0 24 24" fill="currentColor" style="width: 14px; height: 14px; opacity: 0.5;">
              <circle cx="9" cy="5" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="9" cy="19" r="1.5"/>
              <circle cx="15" cy="5" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="15" cy="19" r="1.5"/>
            </svg>
          </div>
          <input type="checkbox" class="bulk-checkbox admin-only" data-bulk-id="${task.id}" onclick="event.stopPropagation(); ListView.toggleTaskSelection('${task.id}')">
        </div>
        <div class="task-table-cell">
          <div class="task-card-checkbox ${isCompleted ? 'checked' : ''}"
               onclick="event.stopPropagation(); TaskCard.toggleComplete('${task.id}')">
            ${isCompleted ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
          </div>
        </div>
        <div class="task-table-cell task-table-title-cell">
          <span class="task-table-title ${isCompleted ? 'completed' : ''}">${this._escape(task.title)}</span>
        </div>
        <div class="task-table-cell">
          <span class="status-badge status-${task.status}">
            <span class="status-badge-dot"></span>
            ${statusInfo.label}
          </span>
        </div>
        <div class="task-table-cell">
          <span class="priority-badge priority-${task.importance}">${importance.icon} ${importance.label}</span>
        </div>
        <div class="task-table-cell">
          <span class="priority-badge priority-${task.urgency}">${urgency.icon} ${urgency.label}</span>
        </div>
        <div class="task-table-cell" style="color: var(--text-secondary); font-size: 13px;">
          ${task.leadTime ? task.leadTime + '日' : '-'}
        </div>
        <div class="task-table-cell">
          ${task.collaborator ? `<span style="font-size:12px;color:var(--text-secondary);display:flex;align-items:center;gap:4px;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px;"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>${task.collaborator}</span>` : '<span style="color:var(--text-muted);font-size:12px;">-</span>'}
        </div>
        <div class="task-table-cell" style="color: var(--text-secondary); font-size: 13px;">
          ${task.dueDate ? `<span class="task-card-date ${overdue ? 'overdue' : ''}">${formatDate(task.dueDate)}</span>` : '<span style="color:var(--text-tertiary)">—</span>'}
        </div>
        <div class="task-table-cell">
          ${project ? `<span style="color: ${project.color}; font-size: var(--text-xs);">${project.icon} ${project.name}</span>` : '<span style="color:var(--text-tertiary)">—</span>'}
        </div>
        <div class="task-table-cell task-table-more">
          <button class="icon-btn" onclick="event.stopPropagation(); TaskCard.showContextMenu(event, '${task.id}')" style="width:28px;height:28px;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;">
              <circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/>
            </svg>
          </button>
        </div>
      </div>
    `;
  },

  toggleComplete(taskId) {
    const task = store.getTask(taskId);
    if (!task) return;

    const newStatus = task.status === STATUSES.DONE.key ? STATUSES.TODO.key : STATUSES.DONE.key;
    store.updateTask(taskId, { status: newStatus });

    // Add visual feedback
    const card = document.querySelector(`[data-task-id="${taskId}"]`);
    if (card) {
      const checkbox = card.querySelector('.task-card-checkbox');
      if (checkbox) checkbox.classList.add('just-checked');
    }

    App.refreshCurrentView();
    Sidebar.updateBadges();
  },

  showContextMenu(e, taskId) {
    e.preventDefault();
    const items = [
      {
        label: '編集',
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
        action: () => TaskModal.open(store.getTask(taskId)),
      },
      {
        label: '削除',
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>`,
        danger: true,
        action: () => {
          if (confirm('このタスクを削除しますか？')) {
            store.deleteTask(taskId);
            Toast.show('タスクを削除しました', 'success');
            App.refreshCurrentView();
            Sidebar.updateBadges();
          }
        }
      }
    ];
    ContextMenu.show(e.clientX, e.clientY, items);
  },

  _escape(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },
};
