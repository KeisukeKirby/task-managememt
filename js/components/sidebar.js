// ===================================
// SIDEBAR — sidebar.js
// サイドバーナビゲーション
// ===================================

const Sidebar = {
  init() {
    this.el = document.getElementById('sidebar');
    this.projectsList = document.getElementById('sidebar-projects-list');
    this.bindEvents();
    this.render();

    store.on('projects', () => this.renderProjects());
    store.on('tasks', () => this.renderProjects());
  },

  bindEvents() {
    // Toggle sidebar collapse
    document.getElementById('sidebar-toggle')?.addEventListener('click', () => {
      this.el.classList.toggle('collapsed');
      store.updateSettings({ sidebarCollapsed: this.el.classList.contains('collapsed') });
    });

    // Navigation items
    this.el.querySelectorAll('.sidebar-item[data-view]').forEach(item => {
      item.addEventListener('click', () => {
        const view = item.dataset.view;
        App.navigateTo(view);
      });
    });

    // Add project button
    document.getElementById('sidebar-add-project')?.addEventListener('click', () => {
      this.showAddProjectDialog();
    });
  },

  render() {
    const settings = store.getSettings();
    if (settings.sidebarCollapsed) {
      this.el.classList.add('collapsed');
    }
    this.renderProjects();
    this.updateBadges();
  },

  renderProjects() {
    if (!this.projectsList) return;
    const projects = store.getProjects();

    this.projectsList.innerHTML = projects.map((project, index) => {
      const count = store.getProjectTaskCount(project.id);
      return `
        <div class="sidebar-item" data-view="project" data-project-id="${project.id}" data-index="${index}" draggable="true"
             oncontextmenu="Sidebar.showProjectContextMenu(event, '${project.id}')"
             style="padding-left: 8px;">
          <div class="drag-handle" style="cursor: grab; margin-right: 8px; color: var(--text-muted); display: flex; align-items: center;" title="ドラッグして並び替え">
            <svg viewBox="0 0 24 24" fill="currentColor" style="width: 14px; height: 14px; opacity: 0.5;">
              <circle cx="9" cy="5" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="9" cy="19" r="1.5"/>
              <circle cx="15" cy="5" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="15" cy="19" r="1.5"/>
            </svg>
          </div>
          <span class="sidebar-project-color" style="background: ${project.color}"></span>
          <span class="sidebar-item-text">${project.icon} ${project.name}</span>
          ${count > 0 ? `<span class="sidebar-item-badge">${count}</span>` : ''}
        </div>
      `;
    }).join('');

    let draggedIndex = null;

    // Bind click events to project items
    this.projectsList.querySelectorAll('.sidebar-item[data-project-id]').forEach(item => {
      item.addEventListener('click', (e) => {
        if (e.defaultPrevented) return;
        const projectId = item.dataset.projectId;
        App.navigateTo('list', { projectId });
      });

      // Drag and Drop events
      item.addEventListener('dragstart', (e) => {
        draggedIndex = parseInt(item.dataset.index, 10);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', item.dataset.projectId);
        item.style.opacity = '0.5';
      });

      item.addEventListener('dragend', () => {
        item.style.opacity = '';
        this.projectsList.querySelectorAll('.sidebar-item').forEach(el => el.classList.remove('drag-over'));
      });

      item.addEventListener('dragenter', (e) => {
        e.preventDefault();
      });

      item.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        item.classList.add('drag-over');
      });

      item.addEventListener('dragleave', () => {
        item.classList.remove('drag-over');
      });

      item.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        item.classList.remove('drag-over');
        const targetIndex = parseInt(item.dataset.index, 10);
        if (draggedIndex !== null && draggedIndex !== targetIndex) {
          store.reorderProjects(draggedIndex, targetIndex);
        }
      });
    });
  },

  updateBadges() {
    const stats = store.getStats();
    const todayBadge = document.getElementById('badge-today');
    const overdueBadge = document.getElementById('badge-overdue');

    if (todayBadge) {
      todayBadge.textContent = stats.today;
      todayBadge.style.display = stats.today > 0 ? '' : 'none';
    }
    if (overdueBadge) {
      overdueBadge.textContent = stats.overdue;
      overdueBadge.style.display = stats.overdue > 0 ? '' : 'none';
    }
  },

  setActive(view, projectId = null) {
    this.el.querySelectorAll('.sidebar-item').forEach(item => {
      item.classList.remove('active');

      if (projectId && item.dataset.projectId === projectId) {
        item.classList.add('active');
      } else if (!projectId && item.dataset.view === view) {
        item.classList.add('active');
      }
    });
  },

  showAddProjectDialog() {
    const name = prompt('プロジェクト名を入力してください:');
    if (!name || !name.trim()) return;

    const icons = ['📁', '🚀', '💼', '🎯', '📱', '🌐', '🔧', '📊', '🎨', '📝'];
    const randomIcon = icons[Math.floor(Math.random() * icons.length)];
    const randomColor = PROJECT_COLORS[Math.floor(Math.random() * PROJECT_COLORS.length)];

    store.addProject({
      name: name.trim(),
      icon: randomIcon,
      color: randomColor,
    });
    Toast.show('プロジェクトを作成しました', 'success');
  },

  showProjectContextMenu(e, projectId) {
    e.preventDefault();
    e.stopPropagation();

    const project = store.getProject(projectId);
    if (!project) return;

    const items = [
      {
        label: '編集する',
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>`,
        action: () => {
          const newName = prompt('プロジェクト名を編集:', project.name);
          if (newName !== null && newName.trim() !== '') {
            store.updateProject(projectId, { name: newName.trim() });
            Toast.show('プロジェクト名を更新しました', 'success');
          }
        }
      },
      {
        label: '削除',
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>`,
        danger: true,
        action: () => {
          if (confirm('このプロジェクトを削除しますか？（タスクは保持されます）')) {
            store.deleteProject(projectId);
            Toast.show('プロジェクトを削除しました', 'success');
            App.navigateTo('dashboard');
          }
        }
      }
    ];

    ContextMenu.show(e.clientX, e.clientY, items);
  },
};
