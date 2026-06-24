// ===================================
// KANBAN VIEW — kanbanView.js
// カンバンボード
// ===================================

const KanbanView = {
  draggedTaskId: null,

  render() {
    const mainContent = document.getElementById('main-content');
    if (!mainContent) return;

    const tasks = store.getFilteredTasks({
      ...App.filters,
      status: 'all', // Kanban shows all statuses as columns
    });

    const columns = Object.values(STATUSES).map(status => ({
      ...status,
      tasks: tasks.filter(t => t.status === status.key),
    }));

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

        <div class="kanban-container">
          ${columns.map(col => `
            <div class="kanban-column" data-status="${col.key}">
              <div class="kanban-column-header">
                <div class="kanban-column-title">
                  <span class="kanban-column-dot" style="background: ${col.color}"></span>
                  ${col.label}
                  <span class="kanban-column-count">${col.tasks.length}</span>
                </div>
                <button class="kanban-column-add" onclick="KanbanView.addTaskToColumn('${col.key}')">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 5v14M5 12h14"/>
                  </svg>
                </button>
              </div>
              <div class="kanban-cards" 
                   data-status="${col.key}"
                   ondragover="KanbanView.handleDragOver(event)"
                   ondragleave="KanbanView.handleDragLeave(event)"
                   ondrop="KanbanView.handleDrop(event, '${col.key}')">
                ${col.tasks.length > 0 ? 
                  col.tasks.map(t => TaskCard.render(t, { draggable: true })).join('') :
                  `<div class="kanban-placeholder"
                        ondragover="KanbanView.handleDragOver(event)"
                        ondrop="KanbanView.handleDrop(event, '${col.key}')">
                    タスクをドロップ
                  </div>`
                }
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    FilterBar.render('filter-bar-container', { hideStatusFilter: true });
  },

  addTaskToColumn(status) {
    TaskModal.open();
    // Set default status after modal opens
    setTimeout(() => {
      const statusInput = document.getElementById('task-status-input');
      if (statusInput) statusInput.value = status;
    }, 50);
  },

  // ── Drag & Drop ──

  handleDragStart(e, taskId) {
    this.draggedTaskId = taskId;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', taskId);

    const card = e.target.closest('.task-card');
    if (card) {
      card.classList.add('dragging');
      // Create a nicer drag image
      setTimeout(() => card.style.opacity = '0.4', 0);
    }
  },

  handleDragEnd(e) {
    const card = e.target.closest('.task-card');
    if (card) {
      card.classList.remove('dragging');
      card.style.opacity = '';
    }

    // Clean up all drag-over states
    document.querySelectorAll('.drag-over').forEach(el => {
      el.classList.remove('drag-over');
    });

    this.draggedTaskId = null;
  },

  handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    const target = e.target.closest('.kanban-cards, .kanban-placeholder');
    if (target) {
      target.classList.add('drag-over');
    }
  },

  handleDragLeave(e) {
    const target = e.target.closest('.kanban-cards, .kanban-placeholder');
    if (target && !target.contains(e.relatedTarget)) {
      target.classList.remove('drag-over');
    }
  },

  handleDrop(e, status) {
    e.preventDefault();

    const taskId = e.dataTransfer.getData('text/plain') || this.draggedTaskId;
    if (!taskId) return;

    const task = store.getTask(taskId);
    if (!task || task.status === status) return;

    store.updateTask(taskId, { status });

    // Clean up
    document.querySelectorAll('.drag-over').forEach(el => {
      el.classList.remove('drag-over');
    });

    Toast.show(`ステータスを「${getStatusInfo(status).label}」に変更しました`, 'success');
    this.render();
    Sidebar.updateBadges();
  },
};
