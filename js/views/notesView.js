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

        <div class="notes-layout">
          <div class="notes-sidebar">
            <div class="notes-tabs" id="notes-tabs">
              ${this._tabsHtml(notesData)}
            </div>
            ${!store.isViewerMode ? `
              <button class="notes-add-tab-btn" title="新しいメモ" onclick="NotesView.addTab()">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                <span class="notes-add-tab-label">新しいメモ</span>
              </button>
            ` : ''}
          </div>

          <div class="notes-main">
            ${store.isViewerMode ? '' : `
              <div class="notes-toolbar">
                <button type="button" class="notes-tool-btn" data-cmd="bold" title="太字 (Ctrl+B)" aria-label="太字"><b>B</b></button>
                <button type="button" class="notes-tool-btn" data-cmd="strikeThrough" title="取り消し線 (Ctrl+Shift+X)" aria-label="取り消し線"><s>S</s></button>
              </div>
            `}
            <div
              id="notes-editor"
              class="notes-textarea"
              contenteditable="${store.isViewerMode ? 'false' : 'true'}"
              data-placeholder="ここに自由にメモを記入してください..."
            >${NotesContent.toHtml(activeTab)}</div>
          </div>
        </div>
      </div>
    `;

    this._updatePlaceholder();

    if (!store.isViewerMode) {
      const editor = document.getElementById('notes-editor');
      editor.addEventListener('input', () => {
        this.handleInput();
        this._syncToolbar();
      });
      editor.addEventListener('keyup', () => this._syncToolbar());
      editor.addEventListener('mouseup', () => this._syncToolbar());
      editor.addEventListener('keydown', (e) => this._handleShortcut(e));
      editor.addEventListener('paste', (e) => this._handlePaste(e));

      document.querySelectorAll('.notes-tool-btn').forEach(btn => {
        // mousedown を止めないと、押した瞬間に本文の選択が外れて書式が付かない
        btn.addEventListener('mousedown', (e) => e.preventDefault());
        btn.addEventListener('click', () => this.applyFormat(btn.dataset.cmd));
      });
    }

    this._bindTabDrag();
  },

  // 選択範囲に太字・取り消し線を付け外しする
  applyFormat(command) {
    if (store.isViewerMode) return;
    const editor = document.getElementById('notes-editor');
    if (!editor) return;

    editor.focus();
    // CSS ではなく <b>/<strike> タグで書式を付ける。
    // サニタイズで style 属性を落とすため、CSS だと書式が保存されない
    try {
      document.execCommand('styleWithCSS', false, false);
    } catch (e) {
      // 未対応のブラウザは既定の挙動に任せる
    }
    document.execCommand(command, false, null);

    this._syncToolbar();
    this.handleInput();
  },

  // カーソル位置の書式をボタンの見た目に反映する
  _syncToolbar() {
    document.querySelectorAll('.notes-tool-btn').forEach(btn => {
      let active = false;
      try {
        active = document.queryCommandState(btn.dataset.cmd);
      } catch (e) {
        active = false;
      }
      btn.classList.toggle('active', active);
    });
  },

  _handleShortcut(e) {
    if (!e.ctrlKey && !e.metaKey) return;
    const key = e.key.toLowerCase();

    if (key === 'b' && !e.shiftKey) {
      e.preventDefault();
      this.applyFormat('bold');
    } else if (key === 'x' && e.shiftKey) {
      e.preventDefault();
      this.applyFormat('strikeThrough');
    }
  },

  // 貼り付けはプレーンテキストにする。
  // 外部サイトの書式やスクリプトを本文に持ち込まないため
  _handlePaste(e) {
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData).getData('text/plain');
    document.execCommand('insertText', false, text);
  },

  _updatePlaceholder() {
    const editor = document.getElementById('notes-editor');
    if (!editor) return;
    editor.classList.toggle('is-empty', editor.textContent.trim() === '');
  },

  _tabsHtml(notesData) {
    return notesData.tabs.map((tab, index) => `
      <div class="notes-tab ${tab.id === notesData.activeTabId ? 'active' : ''}"
           data-tab-id="${tab.id}" data-index="${index}"
           ${store.isViewerMode ? '' : 'draggable="true" title="ドラッグして並び替え"'}
           onclick="NotesView.switchTab('${tab.id}')"
           ondblclick="NotesView.renameTab('${tab.id}', '${this._escape(tab.name)}')">
        <span class="notes-tab-name">${this._escape(tab.name)}</span>
        ${notesData.tabs.length > 1 && !store.isViewerMode ? `
          <span class="notes-tab-close" onclick="NotesView.deleteTab(event, '${tab.id}')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </span>
        ` : ''}
      </div>
    `).join('');
  },

  // 本文（textarea）を作り直すと入力中の内容と選択位置が失われるため、タブ列だけを再描画する
  _refreshTabs() {
    const container = document.getElementById('notes-tabs');
    if (!container) return;
    container.innerHTML = this._tabsHtml(store.getNotes());
    this._bindTabDrag();
  },

  // タブをドラッグして順番を入れ替える
  _bindTabDrag() {
    if (store.isViewerMode) return;
    const container = document.getElementById('notes-tabs');
    if (!container) return;

    const tabs = container.querySelectorAll('.notes-tab');
    let draggedIndex = null;

    const cleanup = () => {
      tabs.forEach(t => t.classList.remove('dragging', 'drag-over-before', 'drag-over-after'));
      document.body.classList.remove('is-dragging');
    };

    // 並びの向きは実際の座標から判定する。
    // 2つ目が1つ目と同じ行にあれば横並び（狭い画面）、なければ縦並び
    const isHorizontal = () => {
      if (tabs.length < 2) return false;
      return tabs[1].getBoundingClientRect().top < tabs[0].getBoundingClientRect().bottom - 1;
    };

    // 挿入位置の判定。縦並びなら上下、横並びなら左右で見る
    const insertAfter = (tab, e) => {
      const rect = tab.getBoundingClientRect();
      return isHorizontal()
        ? e.clientX > rect.left + rect.width / 2
        : e.clientY > rect.top + rect.height / 2;
    };

    tabs.forEach(tab => {
      tab.addEventListener('dragstart', (e) => {
        draggedIndex = parseInt(tab.dataset.index, 10);
        e.dataTransfer.effectAllowed = 'move';
        // text/plain だとメモ本文にタブ名が挿入されてしまうため独自タイプを使う
        e.dataTransfer.setData('application/x-notes-tab', tab.dataset.tabId);
        tab.classList.add('dragging');
        document.body.classList.add('is-dragging');
      });

      tab.addEventListener('dragend', cleanup);

      tab.addEventListener('dragenter', (e) => {
        if (draggedIndex === null) return;
        e.preventDefault();
      });

      tab.addEventListener('dragover', (e) => {
        if (draggedIndex === null) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        tabs.forEach(t => t.classList.remove('drag-over-before', 'drag-over-after'));
        tab.classList.add(insertAfter(tab, e) ? 'drag-over-after' : 'drag-over-before');
      });

      tab.addEventListener('dragleave', () => {
        tab.classList.remove('drag-over-before', 'drag-over-after');
      });

      tab.addEventListener('drop', (e) => {
        if (draggedIndex === null) return;
        e.preventDefault();
        e.stopPropagation();

        const targetIndex = parseInt(tab.dataset.index, 10);
        let insertIndex = insertAfter(tab, e) ? targetIndex + 1 : targetIndex;
        // 取り除いた分だけ後ろの挿入位置がずれる
        if (draggedIndex < insertIndex) insertIndex--;

        const from = draggedIndex;
        draggedIndex = null;
        cleanup();

        if (insertIndex !== from && store.reorderNoteTabs(from, insertIndex)) {
          this._refreshTabs();
        }
      });
    });
  },

  handleInput() {
    const status = document.getElementById('notes-save-status');
    if (status) status.textContent = '保存中...';
    this._updatePlaceholder();

    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }

    this.saveTimeout = setTimeout(() => {
      this.saveTimeout = null;
      this._save();
    }, 1000);
  },

  // 保存待ちの内容を今すぐ書き込む。
  // 編集欄を作り直す操作（タブ切替・追加・改名・削除）の前に呼ぶこと
  _flushSave() {
    if (!this.saveTimeout) return;
    clearTimeout(this.saveTimeout);
    this.saveTimeout = null;
    this._save();
  },

  _save() {
    const editor = document.getElementById('notes-editor');
    if (!editor) return;

    const notesData = store.getNotes();
    const activeTab = notesData.tabs.find(t => t.id === notesData.activeTabId);
    if (!activeTab) return;

    activeTab.content = NotesContent.sanitize(editor.innerHTML);
    activeTab.format = 'html';
    store.updateNotes(notesData);

    const status = document.getElementById('notes-save-status');
    if (status) {
      status.textContent = '保存しました';
      setTimeout(() => {
        if (status.textContent === '保存しました') status.textContent = '';
      }, 2000);
    }
  },

  switchTab(tabId) {
    this._flushSave();
    const notesData = store.getNotes();
    if (notesData.activeTabId !== tabId) {
      notesData.activeTabId = tabId;
      store.updateNotes(notesData);
      this.render();
    }
  },

  addTab() {
    if (store.isViewerMode) return;
    this._flushSave();
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
    this._flushSave();
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
    this._flushSave();
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
