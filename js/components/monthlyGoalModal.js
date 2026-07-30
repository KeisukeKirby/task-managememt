// ===================================
// MONTHLY GOAL MODAL COMPONENT
// 〇月の目標 編集モーダル
// ===================================

const MonthlyGoalModal = {
  open() {
    if (!store.isAdmin) {
      alert('権限がありません。');
      return;
    }

    const modal = document.getElementById('monthly-goal-modal');
    const monthInput = document.getElementById('monthly-goal-month-input');
    const contentInput = document.getElementById('monthly-goal-content-input');

    const currentGoal = store.getMonthlyGoal();
    monthInput.value = currentGoal.month || '';
    contentInput.value = currentGoal.content || '';
    
    modal.classList.add('active');
    setTimeout(() => monthInput.focus(), 50);
  },

  close() {
    const modal = document.getElementById('monthly-goal-modal');
    modal.classList.remove('active');
  },

  save() {
    if (!store.isAdmin) return;

    const monthInput = document.getElementById('monthly-goal-month-input');
    const contentInput = document.getElementById('monthly-goal-content-input');
    
    const month = monthInput.value.trim();
    if (!month) {
      alert('〇月を入力してください。');
      return;
    }

    store.updateMonthlyGoal(month, contentInput.value.trim());
    this.close();
    
    if (App.currentView === 'dashboard') {
      App.refreshCurrentView();
    }
  }
};
