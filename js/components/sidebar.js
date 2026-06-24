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

    this.projectsList.innerHTML = projects.map(project => {
      const count = store.getProjectTaskCount(project.id);
      return `
        <div class="sidebar-item" data-view="project" data-project-id="${project.id}"
             oncontextmenu="Sidebar.showProjectContextMenu(event, '${project.id}')">
          <span class="sidebar-project-color" style="background: ${project.color}"></span>
          <span class="sidebar-item-text">${project.icon} ${project.name}</span>
          ${count > 0 ? `<span class="sidebar-item-badge">${count}</span>` : ''}
        </div>
      `;
    }).join('');

    // Bind click events to project items
    this.projectsList.querySelectorAll('.sidebar-item[data-project-id]').forEach(item => {
      item.addEventListener('click', (e) => {
        if (e.defaultPrevented) return;
        const projectId = item.dataset.projectId;
        App.navigateTo('list', { projectId });
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

    const items = [
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
