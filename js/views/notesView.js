// ===================================
// NOTES VIEW — notesView.js
// 自由にメモを記入できるセクション
// ===================================

const NotesView = {
  saveTimeout: null,

  render() {
    const mainContent = document.getElementById('main-content');
    if (!mainContent) return;

    const notesContent = store.getNotes();

    mainContent.innerHTML = `
      <div class="view-container animate-fade-in" style="height: 100%; display: flex; flex-direction: column;">
        <div class="list-view-header" style="flex-shrink: 0;">
          <div class="dashboard-section-title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:24px;height:24px;margin-right:8px;color:var(--primary);">
              <path d="M14 2H6a2 2 0 0 0-2 2v16c0 1.1.9 2 2 2h12a2 2 0 0 0 2-2V8l-6-6z"/>
              <path d="M14 3v5h5M16 13H8M16 17H8M10 9H8"/>
            </svg>
            メモ
          </div>
          <div id="notes-save-status" style="font-size: var(--text-sm); color: var(--text-tertiary);"></div>
        </div>

        <div style="flex: 1; position: relative; display: flex; flex-direction: column; background: var(--bg-surface); border: 1px solid var(--border-default); border-radius: var(--radius-xl); overflow: hidden;">
          <textarea 
            id="notes-textarea" 
            class="notes-textarea" 
            placeholder="ここに自由にメモを記入してください..."
            ${store.isViewerMode ? 'readonly' : ''}
          >${this._escape(notesContent)}</textarea>
        </div>
      </div>
    `;

    if (!store.isViewerMode) {
      const textarea = document.getElementById('notes-textarea');
      textarea.addEventListener('input', (e) => this.handleInput(e.target.value));
    }
  },

  handleInput(value) {
    const status = document.getElementById('notes-save-status');
    if (status) status.textContent = '保存中...';

    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }

    this.saveTimeout = setTimeout(() => {
      store.updateNotes(value);
      if (status) {
        status.textContent = '保存しました';
        setTimeout(() => {
          if (status.textContent === '保存しました') status.textContent = '';
        }, 2000);
      }
    }, 1000);
  },

  _escape(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
};
