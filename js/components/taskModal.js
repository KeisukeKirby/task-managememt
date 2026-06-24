// ===================================
// TASK MODAL — taskModal.js
// タスク作成/編集モーダル
// ===================================

const TaskModal = {
  currentTask: null,

  init() {
    this.overlay = document.getElementById('task-modal-overlay');
    this.modal = document.getElementById('task-modal');
  },

  open(task = null) {
    this.currentTask = task;
    this.render();
    this.overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
    setTimeout(() => {
      document.getElementById('task-title-input')?.focus();
    }, 100);
  },

  close() {
    this.overlay.classList.remove('active');
    document.body.style.overflow = '';
    this.currentTask = null;
  },

  render() {
    const isEdit = !!this.currentTask;
    const task = this.currentTask || {};
    const projects = store.getProjects();
    const tags = store.getTags();

    this.modal.innerHTML = `
      <div class="modal-header">
        <h2 class="modal-title">${isEdit ? 'タスクを編集' : '新しいタスク'}</h2>
        <button class="modal-close" onclick="TaskModal.close()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">タイトル</label>
          <input type="text" id="task-title-input" class="form-input" 
                 placeholder="タスクのタイトルを入力..." value="${this._escape(task.title || '')}">
        </div>
        <div class="form-group">
          <label class="form-label">説明</label>
          <textarea id="task-desc-input" class="form-textarea" 
                    placeholder="タスクの詳細を入力...">${this._escape(task.description || '')}</textarea>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">ステータス</label>
            <select id="task-status-input" class="form-select">
              ${Object.values(STATUSES).map(s => `
                <option value="${s.key}" ${task.status === s.key ? 'selected' : ''}>${s.label}</option>
              `).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">優先度</label>
            <select id="task-priority-input" class="form-select">
              ${Object.values(PRIORITIES).map(p => `
                <option value="${p.key}" ${task.priority === p.key ? 'selected' : ''}>${p.icon} ${p.label}</option>
              `).join('')}
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">開始日</label>
            <input type="date" id="task-start-input" class="form-input" value="${task.startDate || ''}">
          </div>
          <div class="form-group">
            <label class="form-label">期限</label>
            <input type="date" id="task-due-input" class="form-input" value="${task.dueDate || ''}">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">プロジェクト</label>
            <select id="task-project-input" class="form-select">
              <option value="">なし</option>
              ${projects.map(p => `
                <option value="${p.id}" ${task.projectId === p.id ? 'selected' : ''}>${p.icon} ${p.name}</option>
              `).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">コラボレーター</label>
            <select id="task-collaborator-input" class="form-select">
              <option value="">なし</option>
              ${COLLABORATORS.map(c => `
                <option value="${c}" ${task.collaborator === c ? 'selected' : ''}>${c}</option>
              `).join('')}
            </select>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">タグ</label>
          <div class="tag-input-wrapper" id="tag-input-wrapper">
            ${(task.tags || []).map(tagId => {
              const tag = store.getTag(tagId);
              if (!tag) return '';
              return `
                <span class="tag tag-removable" style="background: ${tag.bgColor}; color: ${tag.color};" 
                      data-tag-id="${tag.id}" onclick="TaskModal.removeTag('${tag.id}')">
                  ${tag.name} ×
                </span>
              `;
            }).join('')}
            <input type="text" id="tag-text-input" class="tag-input" 
                   placeholder="タグを入力（Enter で追加）">
          </div>
          <div id="tag-suggestions" style="display: flex; gap: 4px; margin-top: 8px; flex-wrap: wrap;">
            ${tags.filter(t => !(task.tags || []).includes(t.id)).map(t => `
              <span class="tag" style="background: ${t.bgColor}; color: ${t.color}; cursor: pointer;" 
                    onclick="TaskModal.addExistingTag('${t.id}')">${t.name}</span>
            `).join('')}
          </div>
        </div>
        ${isEdit ? `
        <div class="form-group">
          <label class="form-label">サブタスク</label>
          <div id="subtask-list">
            ${(task.subtasks || []).map(st => `
              <div class="subtask-item" data-subtask-id="${st.id}">
                <div class="checkbox ${st.completed ? 'checked' : ''}" onclick="TaskModal.toggleSubtask('${st.id}')">
                  ${st.completed ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
                </div>
                <span class="subtask-title ${st.completed ? 'completed' : ''}">${this._escape(st.title)}</span>
                <button class="subtask-delete" onclick="TaskModal.deleteSubtask('${st.id}')">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M18 6L6 18M6 6l12 12"/>
                  </svg>
                </button>
              </div>
            `).join('')}
          </div>
          <div class="subtask-add" onclick="TaskModal.addSubtaskInput()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 5v14M5 12h14"/>
            </svg>
            サブタスクを追加
          </div>
        </div>
        ` : ''}
      </div>
      <div class="modal-footer">
        ${isEdit ? `<button class="btn btn-danger btn-sm" onclick="TaskModal.deleteTask()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px">
            <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
          </svg>
          削除
        </button>` : ''}
        <div style="flex:1"></div>
        <button class="btn btn-secondary" onclick="TaskModal.close()">キャンセル</button>
        <button class="btn btn-primary" onclick="TaskModal.save()">
          ${isEdit ? '更新' : '作成'}
        </button>
      </div>
    `;

    // Tag input events
    const tagInput = document.getElementById('tag-text-input');
    if (tagInput) {
      tagInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && tagInput.value.trim()) {
          e.preventDefault();
          this.addNewTag(tagInput.value.trim());
          tagInput.value = '';
        }
      });
    }
  },

  save() {
    const title = document.getElementById('task-title-input')?.value.trim();
    if (!title) {
      Toast.show('タイトルを入力してください', 'error');
      return;
    }

    const taskData = {
      title,
      description: document.getElementById('task-desc-input')?.value.trim() || '',
      status: document.getElementById('task-status-input')?.value || 'todo',
      priority: document.getElementById('task-priority-input')?.value || 'medium',
      startDate: document.getElementById('task-start-input')?.value || null,
      dueDate: document.getElementById('task-due-input')?.value || null,
      projectId: document.getElementById('task-project-input')?.value || null,
      collaborator: document.getElementById('task-collaborator-input')?.value || null,
      tags: this._getSelectedTags(),
    };

    if (this.currentTask) {
      store.updateTask(this.currentTask.id, taskData);
      Toast.show('タスクを更新しました', 'success');
    } else {
      store.addTask(taskData);
      Toast.show('タスクを作成しました', 'success');
    }

    this.close();
  },

  deleteTask() {
    if (!this.currentTask) return;
    if (confirm('このタスクを削除しますか？')) {
      store.deleteTask(this.currentTask.id);
      Toast.show('タスクを削除しました', 'success');
      this.close();
    }
  },

  _getSelectedTags() {
    const wrapper = document.getElementById('tag-input-wrapper');
    if (!wrapper) return [];
    return Array.from(wrapper.querySelectorAll('.tag[data-tag-id]'))
      .map(el => el.dataset.tagId);
  },

  addNewTag(name) {
    let tag = store.getTagByName(name);
    if (!tag) {
      const colorIndex = store.getTags().length % TAG_COLORS.length;
      tag = store.addTag({ name, colorIndex });
    }
    this.addExistingTag(tag.id);
  },

  addExistingTag(tagId) {
    const tag = store.getTag(tagId);
    if (!tag) return;

    const wrapper = document.getElementById('tag-input-wrapper');
    const input = document.getElementById('tag-text-input');
    if (!wrapper || !input) return;

    // Check if already added
    if (wrapper.querySelector(`[data-tag-id="${tagId}"]`)) return;

    const span = document.createElement('span');
    span.className = 'tag tag-removable';
    span.style.background = tag.bgColor;
    span.style.color = tag.color;
    span.dataset.tagId = tag.id;
    span.textContent = `${tag.name} ×`;
    span.onclick = () => this.removeTag(tag.id);

    wrapper.insertBefore(span, input);

    // Remove from suggestions
    const suggestion = document.querySelector(`#tag-suggestions .tag[onclick*="${tagId}"]`);
    if (suggestion) suggestion.remove();
  },

  removeTag(tagId) {
    const wrapper = document.getElementById('tag-input-wrapper');
    const el = wrapper?.querySelector(`[data-tag-id="${tagId}"]`);
    if (el) el.remove();
  },

  toggleSubtask(subtaskId) {
    if (!this.currentTask) return;
    store.toggleSubtask(this.currentTask.id, subtaskId);
    this.currentTask = store.getTask(this.currentTask.id);
    this.render();
  },

  deleteSubtask(subtaskId) {
    if (!this.currentTask) return;
    store.deleteSubtask(this.currentTask.id, subtaskId);
    this.currentTask = store.getTask(this.currentTask.id);
    this.render();
  },

  addSubtaskInput() {
    const title = prompt('サブタスクのタイトル:');
    if (!title || !title.trim()) return;
    if (!this.currentTask) return;
    store.addSubtask(this.currentTask.id, title.trim());
    this.currentTask = store.getTask(this.currentTask.id);
    this.render();
  },

  _escape(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },
};
