// ===================================
// GOAL MODAL COMPONENT — goalModal.js
// 中期目標追加・編集モーダル
// ===================================

const GoalModal = {
  editingId: null,

  open(goal = null) {
    if (!store.isAdmin) {
      alert('権限がありません。');
      return;
    }

    const modal = document.getElementById('goal-modal');
    const title = document.getElementById('goal-modal-title');
    const titleInput = document.getElementById('goal-title-input');
    const deadlineInput = document.getElementById('goal-deadline-input');
    const descInput = document.getElementById('goal-desc-input');
    const deleteBtn = document.getElementById('goal-delete-btn');

    this.editingId = goal ? goal.id : null;
    title.textContent = goal ? '目標を編集' : '新しい中期目標';
    
    titleInput.value = goal ? goal.title : '';
    deadlineInput.value = goal ? (goal.deadline || '') : '';
    descInput.value = goal ? (goal.description || '') : '';
    
    deleteBtn.style.display = goal ? 'inline-block' : 'none';
    
    modal.classList.add('active');
    setTimeout(() => titleInput.focus(), 50);
  },

  close() {
    const modal = document.getElementById('goal-modal');
    modal.classList.remove('active');
    this.editingId = null;
  },

  save() {
    if (!store.isAdmin) return;

    const titleInput = document.getElementById('goal-title-input');
    const deadlineInput = document.getElementById('goal-deadline-input');
    const descInput = document.getElementById('goal-desc-input');
    
    const title = titleInput.value.trim();
    if (!title) {
      alert('タイトルを入力してください。');
      return;
    }

    const updates = {
      title,
      deadline: deadlineInput.value.trim(),
      description: descInput.value.trim()
    };

    if (this.editingId) {
      store.updateGoal(this.editingId, updates);
    } else {
      store.addGoal(updates);
    }
    
    this.close();
    
    // Refresh dashboard if it's the current view
    if (App.currentView === 'dashboard') {
      App.refreshCurrentView();
    }
  },

  deleteGoal() {
    if (!this.editingId || !store.isAdmin) return;
    
    if (confirm('この目標を削除してもよろしいですか？')) {
      store.deleteGoal(this.editingId);
      this.close();
      if (App.currentView === 'dashboard') {
        App.refreshCurrentView();
      }
    }
  }
};
