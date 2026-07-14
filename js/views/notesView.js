// ===================================
// NOTES VIEW — notesView.js
// 自由にメモを記入できるセクション（タブ機能付き）
// ===================================

const NotesView = {
  saveTimeout: null,

  render() {
    const mainContent = document.getElementById('main-content');
    if (!mainContent) return;

    const notesData = store.getNotes();
    const activeTab = notesData.tabs.find(t => t.id === notesData.activeTabId) || notesData.tabs[0];

    // Safety check in case tabs array is corrupted
    if (!activeTab) {
      notesData.tabs = [{ id: 'tab-' + Date.now(), name: 'メモ', content: '' }];
      notesData.activeTabId = notesData.tabs[0].id;
      store.updateNotes(notesData);
      return this.render();
    }

    mainContent.innerHTML = `
      <div class="view-container animate-fade-in" style="height: 100%; display: flex; flex-direction: column;">
        <div class="list-view-header" style="flex-shrink: 0; margin-bottom: 16px;">
          <div class="dashboard-section-title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:24px;height:24px;margin-right:8px;color:var(--primary);">
              <path d="M14 2H6a2 2 0 0 0-2 2v16c0 1.1.9 2 2 2h12a2 2 0 0 0 2-2V8l-6-6z"/>
              <path d="M14 3v5h5M16 13H8M16 17H8M10 9H8"/>
            </svg>
            メモ
          </div>
          <div id="notes-save-status" style="font-size: var(--text-sm); color: var(--text-tertiary);"></div>
        </div>

        <div class="notes-tabs-container">
          <div class="notes-tabs" id="notes-tabs">
            ${notesData.tabs.map(tab => `
              <div class="notes-tab ${tab.id === notesData.activeTabId ? 'active' : ''}" 
                   onclick="NotesView.switchTab('${tab.id}')"
                   ondblclick="NotesView.renameTab('${tab.id}', '${this._escape(tab.name)}')">
                <span class="notes-tab-name">${this._escape(tab.name)}</span>
                ${notesData.tabs.length > 1 && !store.isViewerMode ? `
                  <span class="notes-tab-close" onclick="NotesView.deleteTab(event, '${tab.id}')">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                  </span>
                ` : ''}
              </div>
            `).join('')}
          </div>
          ${!store.isViewerMode ? `
            <button class="notes-add-tab-btn tooltip" data-tooltip="新しいメモ" onclick="NotesView.addTab()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </button>
          ` : ''}
        </div>

        <div style="flex: 1; position: relative; display: flex; flex-direction: column; background: var(--bg-surface); border: 1px solid var(--border-default); border-radius: 0 0 var(--radius-xl) var(--radius-xl); overflow: hidden; margin-top: -1px;">
          <textarea 
            id="notes-textarea" 
            class="notes-textarea" 
            placeholder="ここに自由にメモを記入してください..."
            ${store.isViewerMode ? 'readonly' : ''}
          >${this._escape(activeTab.content)}</textarea>
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
      const notesData = store.getNotes();
      const activeTab = notesData.tabs.find(t => t.id === notesData.activeTabId);
      if (activeTab) {
        activeTab.content = value;
        store.updateNotes(notesData);
        if (status) {
          status.textContent = '保存しました';
          setTimeout(() => {
            if (status.textContent === '保存しました') status.textContent = '';
          }, 2000);
        }
      }
    }, 1000);
  },

  switchTab(tabId) {
    const notesData = store.getNotes();
    if (notesData.activeTabId !== tabId) {
      notesData.activeTabId = tabId;
      store.updateNotes(notesData);
      this.render();
    }
  },

  addTab() {
    if (store.isViewerMode) return;
    const name = prompt('新しいメモの名前を入力してください:', '新しいメモ');
    if (!name || !name.trim()) return;

    const notesData = store.getNotes();
    const newId = 'tab-' + Date.now();
    notesData.tabs.push({ id: newId, name: name.trim(), content: '' });
    notesData.activeTabId = newId;
    store.updateNotes(notesData);
    this.render();
  },

  renameTab(tabId, oldName) {
    if (store.isViewerMode) return;
    const name = prompt('メモの名前を変更:', oldName);
    if (!name || !name.trim()) return;

    const notesData = store.getNotes();
    const tab = notesData.tabs.find(t => t.id === tabId);
    if (tab) {
      tab.name = name.trim();
      store.updateNotes(notesData);
      this.render();
    }
  },

  deleteTab(e, tabId) {
    e.stopPropagation();
    if (store.isViewerMode) return;
    if (!confirm('このメモを削除しますか？')) return;

    const notesData = store.getNotes();
    if (notesData.tabs.length <= 1) return; // Prevent deleting last tab

    const index = notesData.tabs.findIndex(t => t.id === tabId);
    if (index !== -1) {
      notesData.tabs.splice(index, 1);
      if (notesData.activeTabId === tabId) {
        notesData.activeTabId = notesData.tabs[Math.max(0, index - 1)].id;
      }
      store.updateNotes(notesData);
      this.render();
    }
  },

  _escape(str) {
    if (str === null || str === undefined) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
};
