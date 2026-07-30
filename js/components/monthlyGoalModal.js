// ===================================
// MONTHLY GOAL MODAL COMPONENT
// 〇月の目標 編集モーダル
// ===================================

const MonthlyGoalModal = {
  editingId: null,

  open(goal = null) {
    if (!store.isAdmin) {
      alert('権限がありません。');
      return;
    }

    const modal = document.getElementById('monthly-goal-modal');
    const title = document.getElementById('monthly-goal-modal-title');
    const monthInput = document.getElementById('monthly-goal-month-input');
    const contentInput = document.getElementById('monthly-goal-content-input');
    const deleteBtn = document.getElementById('monthly-goal-delete-btn');

    this.editingId = goal ? goal.id : null;
    title.textContent = goal ? '月間目標を編集' : '新しい月間目標';

    monthInput.value = goal ? goal.month : '';
    contentInput.value = goal ? (goal.content || '') : '';
    
    deleteBtn.style.display = goal ? 'inline-block' : 'none';
    
    modal.classList.add('active');
    setTimeout(() => monthInput.focus(), 50);
  },

  close() {
    const modal = document.getElementById('monthly-goal-modal');
    modal.classList.remove('active');
    this.editingId = null;
  },

  save() {
    if (!store.isAdmin) return;

    const monthInput = document.getElementById('monthly-goal-month-input');
    const contentInput = document.getElementById('monthly-goal-content-input');
    
    const month = monthInput.value.trim();
    if (!month) {
      alert('月を数字で入力してください。');
      return;
    }

    if (this.editingId) {
      store.updateMonthlyGoal(this.editingId, {
        month: parseInt(month, 10),
        content: contentInput.value.trim()
      });
    } else {
      store.addMonthlyGoal(month, contentInput.value.trim());
    }

    this.close();
    
    if (App.currentView === 'dashboard') {
      App.refreshCurrentView();
    }
  },

  delete() {
    if (!store.isAdmin || !this.editingId) return;
    if (confirm('この目標を削除してもよろしいですか？')) {
      store.deleteMonthlyGoal(this.editingId);
      this.close();
      if (App.currentView === 'dashboard') {
        App.refreshCurrentView();
      }
    }
  }
};
