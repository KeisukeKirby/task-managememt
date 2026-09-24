// ===================================
// LIBRARY VIEW — libraryView.js
// 資料庫: 価格表・入荷記録・イベント予定・販売記録などを保存して閲覧する
// ===================================

const LIBRARY_TYPES = {
  table: { label: '表', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/></svg>' },
  memo: { label: 'メモ', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16c0 1.1.9 2 2 2h12a2 2 0 0 0 2-2V8l-6-6z"/><path d="M14 3v5h5M16 13H8M16 17H8M10 9H8"/></svg>' },
  link: { label: 'リンク', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>' },
  file: { label: 'ファイル', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>' },
};

// その場で表示してよい種類だけを許可する。ほかは中身を octet-stream 扱いにして
// ダウンロードだけにする (公開バケットに誰でも置ける以上、HTML などを開かせない)
// SVG は入れない。画像として表示はできても、右クリックから開かれると
// このアプリと同じ資格でスクリプトが動いてしまう
const LIBRARY_PREVIEW_IMAGES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/bmp'];

// 検索のために中身まで読む表の上限。これより大きい表は見出し・列名で探す
const LIBRARY_SEARCH_MAX_BYTES = 1000 * 1000;

const LIBRARY_MIME_BY_EXT = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp',
  svg: 'image/svg+xml', pdf: 'application/pdf', csv: 'text/csv', tsv: 'text/tab-separated-values',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', xls: 'application/vnd.ms-excel',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  zip: 'application/zip', txt: 'text/plain', md: 'text/markdown',
};

function guessLibraryMime(name) {
  const ext = String(name || '').split('.').pop().toLowerCase();
  return LIBRARY_MIME_BY_EXT[ext] || 'application/octet-stream';
}

// 資料庫で開いてよいのは http/https のリンクだけ (javascript: などを弾く)
function safeLibraryUrl(url) {
  try {
    const parsed = new URL(String(url || ''));
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : null;
  } catch {
    return null;
  }
}

const LibraryView = {
  categoryId: 'all',       // 'all' | 'trash' | 'uncategorized' | 分類ID
  itemId: null,
  query: '',
  editing: null,           // 編集中 { itemId, dirty }
  _detailToken: 0,
  _searchTimer: null,
  _guardBound: false,
  _blobUrls: [],
  _contentSearch: new Map(),   // 表の中身の検索用テキスト
  _searchLoading: false,

  // params は #library/<id> の解析結果。省略時は「状態を保ったまま描き直す」
  render(params) {
    const main = document.getElementById('main-content');
    if (!main) return;

    if (Array.isArray(params)) {
      const nextId = params[0] || null;
      // 編集中の資料から離れるときだけ確認する (同じ資料を開き直すときは編集を続ける)
      if (this.editing && this.editing.itemId !== nextId && !this.confirmLeave()) return;
      this.itemId = nextId;
    } else if (this.editing && document.getElementById('library-root')) {
      // タスク側の保存などで呼ばれた再描画。編集中の入力を消さないよう描き直さない
      return;
    }

    if (!this._guardBound) {
      window.addEventListener('beforeunload', (e) => {
        if (this.editing && this.editing.dirty) { e.preventDefault(); e.returnValue = ''; }
      });
      this._guardBound = true;
    }

    if (!LibraryStore.loaded) {
      main.innerHTML = `
        <div class="view-container animate-fade-in">
          <div class="empty-state"><div class="empty-state-title">資料庫を読み込んでいます...</div></div>
        </div>`;
      LibraryStore.load().then(() => {
        if (App.currentView === 'library') this._draw();
      });
      return;
    }

    this._draw();
  },

  // 編集中にほかの資料・ほかの画面へ移るときの確認。中断したらアドレスを戻す
  confirmLeave() {
    if (!this.editing || !this.editing.dirty) {
      this.editing = null;
      return true;
    }
    if (confirm('保存していない変更があります。破棄して移動しますか？')) {
      this.editing = null;
      return true;
    }
    const back = this.editing.itemId ? `#library/${this.editing.itemId}` : '#library';
    if (window.location.hash !== back) history.replaceState(null, '', back);
    return false;
  },

  // ── Drawing ──

  _draw() {
    // 通信の完了待ちの間にほかの画面へ移っていることがある。その画面を資料庫で上書きしない
    if (App.currentView !== 'library') return;
    const main = document.getElementById('main-content');
    if (!main) return;
    main.innerHTML = `
      <div class="view-container animate-fade-in library-view" id="library-root">
        ${this._headerHtml()}
        ${this._bodyHtml()}
      </div>`;
    this._bindRoot();
    if (this._ready() && this.itemId) this._renderDetail();
  },

  _drawMain() {
    if (App.currentView !== 'library') return;
    // 編集中の入力を消さない。破棄してよいかは confirmLeave だけが決める
    if (this.editing && this.editing.itemId === this.itemId) return;
    const main = document.getElementById('library-main');
    if (!main) return;
    main.innerHTML = this.itemId ? this._detailShellHtml() : this._listHtml();
    if (this.itemId) this._renderDetail();
  },

  _ready() {
    return LibraryStore.mode !== 'disabled' && !LibraryStore.loadError && !!LibraryStore.index;
  },

  _headerHtml() {
    const badge = LibraryStore.mode === 'local'
      ? '<span class="library-mode-badge">ローカルモード(この端末だけに保存)</span>'
      : (LibraryStore.isLocalHost ? '<span class="library-mode-badge">テスト用の保存先</span>' : '');

    return `
      <div class="list-view-header library-header">
        <div class="dashboard-section-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:24px;height:24px;margin-right:8px;color:var(--color-primary-500);">
            <rect x="2" y="3" width="20" height="5" rx="1"/><path d="M4 8v11a2 2 0 002 2h12a2 2 0 002-2V8"/><line x1="10" y1="12" x2="14" y2="12"/>
          </svg>
          資料庫
          ${badge}
        </div>
        ${this._ready() ? `
          <div class="library-header-actions">
            <input type="search" id="library-search" class="form-input library-search" placeholder="資料を検索..." value="${escapeHtml(this.query)}">
            ${LibraryStore.canEdit() ? `
              <button class="btn btn-primary btn-sm" data-action="add">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
                <span>追加</span>
              </button>` : ''}
          </div>` : ''}
      </div>`;
  },

  _bodyHtml() {
    if (LibraryStore.mode === 'disabled') {
      return this._noticeHtml('資料庫はウェブサイトから開いてください', 'ファイルを直接開いた状態では使えません。');
    }
    if (LibraryStore.loadError) {
      return this._noticeHtml('資料庫を読み込めませんでした', escapeHtml(LibraryStore.loadError),
        '<button class="btn btn-primary btn-sm" data-action="reload">もう一度読み込む</button>');
    }
    if (!LibraryStore.index) {
      return this._noticeHtml('資料庫を読み込めませんでした', '', '<button class="btn btn-primary btn-sm" data-action="reload">もう一度読み込む</button>');
    }
    return `
      <div class="notes-layout library-layout">
        <div class="notes-sidebar library-sidebar">${this._sidebarHtml()}</div>
        <div class="notes-main library-main" id="library-main">${this.itemId ? this._detailShellHtml() : this._listHtml()}</div>
      </div>`;
  },

  _noticeHtml(title, desc, actionHtml = '') {
    return `
      <div class="empty-state library-notice">
        <div class="empty-state-title">${title}</div>
        <div class="empty-state-desc">${desc}</div>
        ${actionHtml}
      </div>`;
  },

  _sidebarHtml() {
    const active = LibraryStore.activeItems();
    const categories = LibraryStore.categories();
    const known = new Set(categories.map(c => c.id));
    const canEdit = LibraryStore.canEdit();

    const rows = [{ id: 'all', name: 'すべて', count: active.length }];
    categories.forEach(c => rows.push({ id: c.id, name: c.name, count: active.filter(i => i.categoryId === c.id).length, real: true }));

    const uncategorized = active.filter(i => !known.has(i.categoryId)).length;
    if (uncategorized) rows.push({ id: 'uncategorized', name: '未分類', count: uncategorized });
    if (canEdit) rows.push({ id: 'trash', name: 'ゴミ箱', count: LibraryStore.trashedItems().length });

    return `
      <div class="notes-tabs">
        ${rows.map(r => `
          <div class="notes-tab library-cat ${r.id === this.categoryId ? 'active' : ''}" data-action="category" data-id="${escapeHtml(r.id)}">
            <span class="notes-tab-name">${escapeHtml(r.name)}</span>
            <span class="library-cat-count">${r.count}</span>
            ${canEdit && r.real ? `
              <span class="library-cat-menu" data-action="category-menu" data-id="${escapeHtml(r.id)}" title="名前の変更・削除">
                <svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg>
              </span>` : ''}
          </div>`).join('')}
      </div>
      ${canEdit ? `
        <button class="notes-add-tab-btn" data-action="add-category">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          <span class="notes-add-tab-label">分類を追加</span>
        </button>` : ''}`;
  },

  // ── List ──

  _visibleItems() {
    const query = this.query.trim().toLowerCase();
    const known = new Set(LibraryStore.categories().map(c => c.id));

    let items = this.categoryId === 'trash' ? LibraryStore.trashedItems() : LibraryStore.activeItems();
    if (query) {
      // 検索中は分類をまたいで探す
      items = LibraryStore.activeItems().filter(i => this._matches(i, query));
    } else if (this.categoryId === 'uncategorized') {
      items = items.filter(i => !known.has(i.categoryId));
    } else if (this.categoryId !== 'all' && this.categoryId !== 'trash') {
      items = items.filter(i => i.categoryId === this.categoryId);
    }

    return items.slice().sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
  },

  _matches(item, query) {
    const category = LibraryStore.getCategory(item.categoryId);
    const haystack = [
      item.title, category && category.name, item.text, item.description, item.url,
      item.file && item.file.name, Array.isArray(item.columns) ? item.columns.join(' ') : '',
    ].filter(Boolean).join(' ').toLowerCase();
    if (haystack.includes(query)) return true;

    const content = this._contentSearch.get(item.id);
    return !!(content && content.text.includes(query));
  },

  // 表の中身も検索対象にする。読み込みは初回の検索時だけ、小さい表に限る
  async _runContentSearch() {
    const query = this.query.trim().toLowerCase();
    if (!query || this._searchLoading) return;

    const pending = LibraryStore.activeItems().filter(item => {
      if (item.type !== 'table' || !item.content) return false;
      if ((item.content.bytes || 0) > LIBRARY_SEARCH_MAX_BYTES) return false;
      const cached = this._contentSearch.get(item.id);
      return !cached || cached.key !== item.content.paths.join('|');
    });
    if (!pending.length) return;

    this._searchLoading = true;
    if (!this.itemId) this._drawMain();
    try {
      for (const item of pending) {
        try {
          const content = await LibraryStore.loadContent(item.content);
          const text = (content.rows || []).map(row => row.join(' ')).join('\n').toLowerCase();
          this._contentSearch.set(item.id, { key: item.content.paths.join('|'), text });
        } catch (e) {
          // 読めない表は検索対象から外すだけにする
          this._contentSearch.set(item.id, { key: item.content.paths.join('|'), text: '' });
        }
      }
    } finally {
      this._searchLoading = false;
    }

    if (this.query.trim().toLowerCase() === query && !this.itemId) this._drawMain();
  },

  // ヘッダーの検索欄から呼ばれる。編集中なら破棄の確認を通してから一覧に切り替える
  searchFromHeader(query) {
    if (!this.confirmLeave()) {
      Header.setSearchValue(this.query);
      return;
    }
    this.query = query || '';
    this.itemId = null;
    const input = document.getElementById('library-search');
    if (input && input.value !== this.query) input.value = this.query;
    this._drawMain();
    this._runContentSearch();
  },

  _listHtml() {
    const items = this._visibleItems();
    const note = this.query.trim()
      ? `<div class="library-result-note">「${escapeHtml(this.query.trim())}」の検索結果 ${items.length}件(すべての分類から${this._searchLoading ? '・表の中身を読み込み中...' : '・表の中身も含む'})</div>`
      : '';

    if (!items.length) {
      const desc = this.query.trim() ? '別の言葉で探してみてください。'
        : (LibraryStore.canEdit() ? '右上の「追加」から、価格表・入荷記録・イベント予定などを登録できます。' : 'まだ資料がありません。');
      return note + this._noticeHtml(this.categoryId === 'trash' ? 'ゴミ箱は空です' : '資料がありません', desc);
    }

    const trashBar = (this.categoryId === 'trash' && !this.query.trim() && LibraryStore.canEdit()) ? `
      <div class="library-trash-bar">
        <span>一覧からは消えますが、保存先のデータは残ります。</span>
        <button class="btn btn-sm btn-danger" data-action="empty-trash">ゴミ箱を空にする</button>
      </div>` : '';

    return note + trashBar + `<div class="library-grid">${items.map(i => this._cardHtml(i)).join('')}</div>`;
  },

  _cardHtml(item) {
    const type = LIBRARY_TYPES[item.type] ? item.type : 'memo';
    const category = LibraryStore.getCategory(item.categoryId);
    const snippet = this._snippet(item);

    return `
      <div class="library-card" data-action="open" data-id="${escapeHtml(item.id)}" tabindex="0" role="button">
        <div class="library-card-icon library-type-${type}">${LIBRARY_TYPES[type].icon}</div>
        <div class="library-card-body">
          <div class="library-card-title">${escapeHtml(item.title || '無題')}</div>
          <div class="library-card-meta">
            ${escapeHtml(category ? category.name : '未分類')} · ${escapeHtml(this._summary(item))} · ${escapeHtml(formatRelativeDate(item.updatedAt))}
          </div>
          ${snippet ? `<div class="library-card-snippet">${escapeHtml(snippet)}</div>` : ''}
        </div>
        ${item.deleted && LibraryStore.canEdit() ? `
          <button class="btn btn-sm btn-secondary library-card-restore" data-action="restore" data-id="${escapeHtml(item.id)}">元に戻す</button>` : ''}
      </div>`;
  },

  _summary(item) {
    if (item.type === 'table') return item.summary ? `${item.summary.rows}行 × ${item.summary.cols}列` : '表';
    if (item.type === 'link') { const url = safeLibraryUrl(item.url); return url ? new URL(url).hostname : 'リンク'; }
    if (item.type === 'file') return `${(item.file && item.file.name) || 'ファイル'}(${formatLibraryBytes(item.file && item.file.bytes)})`;
    return 'メモ';
  },

  _snippet(item) {
    if (item.type === 'link') return item.description || item.url || '';
    if (item.type === 'table') return Array.isArray(item.columns) ? item.columns.join(' / ') : '';
    return (item.text || '').slice(0, 90);
  },

  // ── Detail ──

  _detailShellHtml() {
    const item = LibraryStore.getItem(this.itemId);
    if (!item) {
      return `<div class="library-detail">
        <div class="library-detail-head"><button class="btn btn-ghost btn-sm" data-action="back">← 一覧へ戻る</button></div>
        ${this._noticeHtml('資料が見つかりません', '削除されたか、リンクが古い可能性があります。')}
      </div>`;
    }

    const type = LIBRARY_TYPES[item.type] ? item.type : 'memo';
    const category = LibraryStore.getCategory(item.categoryId);

    return `
      <div class="library-detail">
        <div class="library-detail-head">
          <button class="btn btn-ghost btn-sm" data-action="back">← 一覧へ戻る</button>
          <div class="library-detail-titles">
            <div class="library-detail-title">${escapeHtml(item.title || '無題')}</div>
            <div class="library-detail-meta">
              ${escapeHtml(LIBRARY_TYPES[type].label)} · ${escapeHtml(category ? category.name : '未分類')} ·
              更新 ${escapeHtml(formatRelativeDate(item.updatedAt))}
              ${item.deleted ? ' · <span class="library-trash-flag">ゴミ箱</span>' : ''}
            </div>
          </div>
          <div class="library-detail-actions">${this._actionsHtml(item)}</div>
        </div>
        <div class="library-detail-body" id="library-detail-body">
          <div class="library-loading">読み込み中...</div>
        </div>
      </div>`;
  },

  _actionsHtml(item) {
    if (!LibraryStore.canEdit()) return '';
    const id = escapeHtml(item.id);
    if (item.deleted) return `<button class="btn btn-sm btn-primary" data-action="restore" data-id="${id}">元に戻す</button>`;

    const editing = this.editing && this.editing.itemId === item.id;
    if (editing) return '';   // 編集中の操作は本文側に出す

    const buttons = [];
    if (item.type === 'memo' || item.type === 'table') {
      buttons.push(`<button class="btn btn-sm btn-secondary" data-action="edit-content" data-id="${id}">内容を編集</button>`);
    }
    if (item.source) buttons.push(`<button class="btn btn-sm btn-secondary" data-action="source" data-id="${id}">元ファイル</button>`);
    buttons.push(`<button class="btn btn-sm btn-secondary" data-action="edit-info" data-id="${id}">名前・分類</button>`);
    buttons.push(`<button class="btn btn-sm btn-danger" data-action="delete" data-id="${id}">削除</button>`);
    return buttons.join('');
  },

  async _renderDetail() {
    if (App.currentView !== 'library') return;
    const item = LibraryStore.getItem(this.itemId);
    const body = document.getElementById('library-detail-body');
    if (!item || !body) return;

    const token = ++this._detailToken;
    // 前に表示していたファイルの一時URLは、新しい中身を描いたあとに解放する
    const stale = this._blobUrls.splice(0);
    const release = () => stale.forEach(url => URL.revokeObjectURL(url));

    try {
      if (item.type === 'link') {
        body.innerHTML = this._linkBodyHtml(item);
        release();
        return;
      }
      if (item.type === 'memo') {
        const content = item.content ? await LibraryStore.loadContent(item.content) : { format: 'html', content: '' };
        if (token !== this._detailToken) return;
        body.innerHTML = this._memoBodyHtml(content);
        if (this.editing && this.editing.itemId === item.id) this._bindMemoEditor();
        release();
        return;
      }
      if (item.type === 'table') {
        const content = item.content ? await LibraryStore.loadContent(item.content) : { columns: [], rows: [] };
        if (token !== this._detailToken) return;
        LibraryTable.mount(body, item, content, !!(this.editing && this.editing.itemId === item.id));
        release();
        return;
      }
      if (item.type === 'file') {
        const bytes = await LibraryStore.loadContent(item.file, 'bytes');
        if (token !== this._detailToken) return;
        body.innerHTML = this._fileBodyHtml(item, bytes);
        release();
        return;
      }
      body.innerHTML = this._noticeHtml('この種類はまだ表示できません', escapeHtml(item.type));
      release();
    } catch (e) {
      if (token !== this._detailToken) return;
      body.innerHTML = this._noticeHtml('中身を読み込めませんでした', escapeHtml(e.message || String(e)));
      release();
    }
  },

  _linkBodyHtml(item) {
    const url = safeLibraryUrl(item.url);
    return `
      <div class="library-link-body">
        ${url
          ? `<a class="btn btn-primary" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">リンクを開く</a>
             <div class="library-link-url">${escapeHtml(url)}</div>`
          : '<div class="library-link-url">開けないURLです</div>'}
        ${item.description ? `<div class="library-link-desc">${escapeHtml(item.description)}</div>` : ''}
      </div>`;
  },

  // ── Files ──

  _fileBodyHtml(item, bytes) {
    const info = item.file || {};
    const mime = String(info.mime || '');
    const isImage = LIBRARY_PREVIEW_IMAGES.includes(mime);
    const isPdf = mime === 'application/pdf';

    // 表示できる種類だけ本来の種類で渡す。ほかは実行されない形にしてダウンロード専用にする
    const blob = new Blob([bytes], { type: isImage || isPdf ? mime : 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    this._blobUrls.push(url);

    let preview;
    if (isImage) {
      preview = `<img class="library-file-image" src="${url}" alt="${escapeHtml(info.name || '')}">`;
    } else if (isPdf) {
      preview = `
        <iframe class="library-file-pdf" src="${url}" title="${escapeHtml(info.name || 'PDF')}"></iframe>
        <a class="library-file-newtab" href="${url}" target="_blank" rel="noopener noreferrer">別のタブで開く</a>`;
    } else {
      preview = '<div class="library-loading">この種類はここでは表示できません。ダウンロードして開いてください。</div>';
    }

    return `
      <div class="library-file-body">
        <div class="library-file-bar">
          <span class="library-file-meta">${escapeHtml(info.name || 'ファイル')} · ${escapeHtml(formatLibraryBytes(info.bytes))}</span>
          <a class="btn btn-sm btn-primary" href="${url}" download="${escapeHtml(info.name || 'file')}">ダウンロード</a>
        </div>
        ${preview}
      </div>`;
  },

  // 取り込み元のExcel・CSVを保存してある場合に、そのまま取り出す
  async downloadSource(id) {
    const item = LibraryStore.getItem(id);
    if (!item || !item.source) return;
    try {
      const bytes = await LibraryStore.loadContent(item.source, 'bytes');
      const url = URL.createObjectURL(new Blob([bytes], { type: 'application/octet-stream' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = item.source.name || 'file';
      a.click();
      // すぐ解放するとブラウザによってはダウンロードが始まらない
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (e) {
      Toast.show(escapeHtml(e.message || '元ファイルを取り出せませんでした'), 'error');
    }
  },

  pickFiles() {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.addEventListener('change', () => this.ingestFiles(Array.from(input.files || [])));
    input.click();
  },

  async ingestFiles(files) {
    if (!files.length || !LibraryStore.canEdit()) return;
    let lastId = null;

    // Excel・CSV はシートと見出し行を選んでもらうため、1件ずつダイアログにかける
    const spreadsheets = files.filter(f => LibraryImport.isSpreadsheet(f.name));
    files = files.filter(f => !LibraryImport.isSpreadsheet(f.name));

    for (const file of files) {
      try {
        Toast.show(`${escapeHtml(file.name)} を取り込んでいます...`, 'info', 4000);
        lastId = await this._ingestFile(file);
        Toast.show(`${escapeHtml(file.name)} を取り込みました`, 'success');
      } catch (e) {
        Toast.show(`${escapeHtml(file.name)}: ${escapeHtml(e.message || '取り込めませんでした')}`, 'error', 6000);
      }
    }

    if (spreadsheets.length) {
      LibraryImport.queue(spreadsheets);
      return;
    }
    if (files.length === 1 && lastId) this._go(lastId);
    else this._draw();
  },

  async _ingestFile(file) {
    const name = file.name || 'ファイル';
    const ext = (name.split('.').pop() || '').toLowerCase();
    const title = name.replace(/\.[^.]+$/, '') || name;
    const categoryId = this._defaultCategoryId();
    const id = generateId();

    // テキストはメモに、それ以外は添付ファイルとして保存する
    if (['txt', 'md'].includes(ext)) {
      const text = await file.text();
      const ref = await LibraryStore.saveContent('item', id, { format: 'html', content: NotesContent.plainToHtml(text) });
      await this._pushItem({ id, type: 'memo', title, categoryId, content: ref, text: text.slice(0, 2000) });
      return id;
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const ref = await LibraryStore.saveContent('file', id, bytes);
    await this._pushItem({
      id, type: 'file', title, categoryId,
      file: { ...ref, name, mime: file.type || guessLibraryMime(name) },
    });
    return id;
  },

  // ── Memo ──

  _memoBodyHtml(content) {
    const editing = !!(this.editing && this.editing.itemId === this.itemId);
    const html = NotesContent.toHtml({ format: content && content.format, content: content && content.content });
    return `
      ${editing ? `
        <div class="notes-toolbar library-memo-toolbar">
          <button type="button" class="notes-tool-btn" data-format="bold" title="太字 (Ctrl+B)" aria-label="太字"><b>B</b></button>
          <button type="button" class="notes-tool-btn" data-format="strikeThrough" title="取り消し線 (Ctrl+Shift+X)" aria-label="取り消し線"><s>S</s></button>
          <div class="library-edit-actions">
            <button class="btn btn-sm btn-secondary" data-action="cancel-edit">キャンセル</button>
            <button class="btn btn-sm btn-primary" data-action="save-memo">保存</button>
          </div>
        </div>` : ''}
      <div id="library-memo-editor" class="notes-textarea library-memo" contenteditable="${editing}"
           data-placeholder="ここに自由に書けます...">${html}</div>`;
  },

  _bindMemoEditor() {
    const editor = document.getElementById('library-memo-editor');
    if (!editor) return;

    editor.addEventListener('input', () => { if (this.editing) this.editing.dirty = true; });
    editor.addEventListener('keydown', (e) => {
      if (!e.ctrlKey && !e.metaKey) return;
      const key = e.key.toLowerCase();
      if (key === 'b' && !e.shiftKey) { e.preventDefault(); this._applyFormat('bold'); }
      else if (key === 'x' && e.shiftKey) { e.preventDefault(); this._applyFormat('strikeThrough'); }
    });
    // 貼り付けは書式を落とす。外部サイトの HTML を本文に持ち込まないため
    editor.addEventListener('paste', (e) => {
      e.preventDefault();
      const text = (e.clipboardData || window.clipboardData).getData('text/plain');
      document.execCommand('insertText', false, text);
    });

    document.querySelectorAll('.library-memo-toolbar .notes-tool-btn').forEach(btn => {
      // mousedown を止めないと、押した瞬間に選択が外れて書式が付かない
      btn.addEventListener('mousedown', (e) => e.preventDefault());
      btn.addEventListener('click', () => this._applyFormat(btn.dataset.format));
    });
    editor.focus();
  },

  _applyFormat(command) {
    const editor = document.getElementById('library-memo-editor');
    if (!editor) return;
    editor.focus();
    // CSS ではなくタグで書式を付ける。サニタイズで style 属性は落とされるため
    try { document.execCommand('styleWithCSS', false, false); } catch (e) { /* 未対応は既定の挙動 */ }
    document.execCommand(command, false, null);
    if (this.editing) this.editing.dirty = true;
  },

  async _saveMemo() {
    const item = LibraryStore.getItem(this.itemId);
    const editor = document.getElementById('library-memo-editor');
    if (!item || !editor) return;

    const html = NotesContent.sanitize(editor.innerHTML);
    const text = NotesContent.toPlainText({ format: 'html', content: html });
    try {
      const ref = await LibraryStore.saveContent('item', item.id, { format: 'html', content: html });
      await this._updateItem(item.id, { content: ref, text: text.slice(0, 2000) });
      this.editing = null;
      Toast.show('保存しました', 'success');
      this._draw();
    } catch (e) {
      Toast.show(escapeHtml(e.message || '保存できませんでした'), 'error');
    }
  },

  // ── Items ──

  async _createItem(data) {
    const id = generateId();
    await this._pushItem({ id, ...data });
    return id;
  },

  // 409 で同じ変更をやり直すことがあるので、id が既にあれば足さない
  async _pushItem(data) {
    const now = new Date().toISOString();
    await LibraryStore.mutate(draft => {
      if (draft.items.some(i => i.id === data.id)) return;
      draft.items.push({ createdAt: now, updatedAt: now, deleted: false, ...data });
    });
  },

  async _updateItem(id, patch) {
    await LibraryStore.mutate(draft => {
      const item = draft.items.find(i => i.id === id);
      if (item) Object.assign(item, patch, { updatedAt: new Date().toISOString() });
    });
  },

  _defaultCategoryId() {
    const categories = LibraryStore.categories();
    if (categories.some(c => c.id === this.categoryId)) return this.categoryId;
    return categories.length ? categories[0].id : null;
  },

  newMemo() {
    this._openModal('メモを作る', `
      ${this._titleFieldHtml('')}
      ${this._categoryFieldHtml(this._defaultCategoryId())}
    `, async (form) => {
      const title = form.title.value.trim();
      if (!title) { Toast.show('タイトルを入力してください', 'error'); return false; }
      const id = await this._createItem({ type: 'memo', title, categoryId: form.categoryId.value || null, text: '' });
      this.editing = { itemId: id, dirty: false };
      this._go(id);
    });
  },

  newTableFromPaste() {
    this._openModal('Excelから貼り付けて表を作る', `
      ${this._titleFieldHtml('')}
      <div class="form-group">
        <label class="form-label">貼り付け (Excelやスプレッドシートで範囲をコピーして、ここに貼り付け)</label>
        <textarea name="pasted" class="form-input library-paste-area" rows="8" placeholder="品番	サイズ	価格&#10;VFF-KSO-EVO	40	5900" required></textarea>
      </div>
      <div class="form-group library-check-row">
        <label><input type="checkbox" name="hasHeader" checked> 1行目を見出しにする</label>
      </div>
      ${this._categoryFieldHtml(this._defaultCategoryId())}
    `, async (form) => {
      const title = form.title.value.trim();
      const pasted = form.pasted.value;
      if (!title) { Toast.show('タイトルを入力してください', 'error'); return false; }
      if (!pasted.trim()) { Toast.show('表を貼り付けてください', 'error'); return false; }

      const matrix = parseLibraryDelimited(pasted, detectLibraryDelimiter(pasted));
      const content = buildLibraryTable(matrix, form.hasHeader.checked ? 0 : -1);
      if (!content.columns.length) { Toast.show('表として読み取れませんでした', 'error'); return false; }

      const id = generateId();
      const ref = await LibraryStore.saveContent('item', id, content);
      const now = new Date().toISOString();
      await LibraryStore.mutate(draft => {
        if (draft.items.some(i => i.id === id)) return;
        draft.items.push({
          id, type: 'table', title, categoryId: form.categoryId.value || null,
          createdAt: now, updatedAt: now, deleted: false,
          content: ref,
          columns: content.columns.map(c => c.name),
          summary: { rows: content.rows.length, cols: content.columns.length },
        });
      });
      Toast.show(`${content.rows.length}行の表を作成しました`, 'success');
      this._go(id);
    });
  },

  newLink() {
    this._openModal('リンクを登録', `
      ${this._titleFieldHtml('')}
      <div class="form-group">
        <label class="form-label">URL</label>
        <input type="url" name="url" class="form-input" placeholder="https://..." required>
      </div>
      <div class="form-group">
        <label class="form-label">説明 (任意)</label>
        <textarea name="description" class="form-input" rows="3" placeholder="何のリンクかメモしておけます"></textarea>
      </div>
      ${this._categoryFieldHtml(this._defaultCategoryId())}
    `, async (form) => {
      const title = form.title.value.trim();
      const url = safeLibraryUrl(form.url.value.trim());
      if (!title) { Toast.show('タイトルを入力してください', 'error'); return false; }
      if (!url) { Toast.show('http:// または https:// で始まるURLを入力してください', 'error'); return false; }
      const id = await this._createItem({
        type: 'link', title, url,
        description: form.description.value.trim(),
        categoryId: form.categoryId.value || null,
      });
      Toast.show('リンクを登録しました', 'success');
      this._go(id);
    });
  },

  editInfo(id) {
    const item = LibraryStore.getItem(id);
    if (!item) return;
    const isLink = item.type === 'link';

    this._openModal('名前・分類', `
      ${this._titleFieldHtml(item.title)}
      ${isLink ? `
        <div class="form-group">
          <label class="form-label">URL</label>
          <input type="url" name="url" class="form-input" value="${escapeHtml(item.url || '')}" required>
        </div>
        <div class="form-group">
          <label class="form-label">説明 (任意)</label>
          <textarea name="description" class="form-input" rows="3">${escapeHtml(item.description || '')}</textarea>
        </div>` : ''}
      ${this._categoryFieldHtml(item.categoryId)}
    `, async (form) => {
      const title = form.title.value.trim();
      if (!title) { Toast.show('タイトルを入力してください', 'error'); return false; }
      const patch = { title, categoryId: form.categoryId.value || null };
      if (isLink) {
        const url = safeLibraryUrl(form.url.value.trim());
        if (!url) { Toast.show('http:// または https:// で始まるURLを入力してください', 'error'); return false; }
        patch.url = url;
        patch.description = form.description.value.trim();
      }
      await this._updateItem(id, patch);
      Toast.show('保存しました', 'success');
      this._draw();
    });
  },

  async deleteItem(id) {
    const item = LibraryStore.getItem(id);
    if (!item) return;
    if (!confirm(`「${item.title || '無題'}」をゴミ箱に入れますか？\n(ゴミ箱から元に戻せます)`)) return;
    try {
      await this._updateItem(id, { deleted: true, deletedAt: new Date().toISOString() });
      Toast.show('ゴミ箱に入れました', 'info');
      if (this.itemId === id) this._go(null); else this._draw();
    } catch (e) {
      Toast.show(escapeHtml(e.message || '削除できませんでした'), 'error');
    }
  },

  async restoreItem(id) {
    const known = new Set(LibraryStore.categories().map(c => c.id));
    const item = LibraryStore.getItem(id);
    if (!item) return;
    try {
      await this._updateItem(id, {
        deleted: false,
        deletedAt: null,
        categoryId: known.has(item.categoryId) ? item.categoryId : null,
      });
      Toast.show('元に戻しました', 'success');
      this._draw();
    } catch (e) {
      Toast.show(escapeHtml(e.message || '戻せませんでした'), 'error');
    }
  },

  async emptyTrash() {
    const count = LibraryStore.trashedItems().length;
    if (!count) return;
    if (!confirm(`ゴミ箱の${count}件を一覧から消しますか？\n(保存先のデータは残るので、必要なら取り戻せます)`)) return;
    try {
      await LibraryStore.purgeTrash();
      Toast.show('ゴミ箱を空にしました', 'success');
      this.categoryId = 'all';
      this._draw();
    } catch (e) {
      Toast.show(escapeHtml(e.message || '空にできませんでした'), 'error');
    }
  },

  // ── Categories ──

  async addCategory() {
    const name = prompt('分類の名前を入力してください:');
    if (!name || !name.trim()) return;
    const id = generateId();
    try {
      await LibraryStore.mutate(draft => {
        if (!draft.categories.some(c => c.id === id)) draft.categories.push({ id, name: name.trim() });
      });
      this.categoryId = id;
      this._draw();
    } catch (e) {
      Toast.show(escapeHtml(e.message || '追加できませんでした'), 'error');
    }
  },

  showCategoryMenu(e, id) {
    const category = LibraryStore.getCategory(id);
    if (!category) return;

    ContextMenu.show(e.clientX, e.clientY, [
      {
        label: '名前を変更',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>',
        action: async () => {
          const name = prompt('分類の名前を変更:', category.name);
          if (!name || !name.trim()) return;
          try {
            await LibraryStore.mutate(draft => {
              const target = draft.categories.find(c => c.id === id);
              if (target) target.name = name.trim();
            });
            this._draw();
          } catch (err) { Toast.show(escapeHtml(err.message), 'error'); }
        },
      },
      {
        label: '削除',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>',
        danger: true,
        action: async () => {
          const used = LibraryStore.activeItems().filter(i => i.categoryId === id).length;
          if (used) { Toast.show(`資料が${used}件入っています。先に移動するか削除してください`, 'error'); return; }
          if (!confirm(`分類「${category.name}」を削除しますか？`)) return;
          try {
            await LibraryStore.mutate(draft => { draft.categories = draft.categories.filter(c => c.id !== id); });
            if (this.categoryId === id) this.categoryId = 'all';
            this._draw();
          } catch (err) { Toast.show(escapeHtml(err.message), 'error'); }
        },
      },
    ]);
  },

  // ── Modal ──

  _titleFieldHtml(value) {
    return `
      <div class="form-group">
        <label class="form-label">タイトル</label>
        <input type="text" name="title" class="form-input" value="${escapeHtml(value || '')}" placeholder="例: 2026年 卸価格表" required>
      </div>`;
  },

  _categoryFieldHtml(selectedId) {
    const categories = LibraryStore.categories();
    return `
      <div class="form-group">
        <label class="form-label">分類</label>
        <select name="categoryId" class="form-input">
          <option value="">未分類</option>
          ${categories.map(c => `<option value="${escapeHtml(c.id)}" ${c.id === selectedId ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}
        </select>
      </div>`;
  },

  _openModal(title, bodyHtml, onSubmit, submitLabel = '保存', onClose = null) {
    this._modalClose = onClose;
    const overlay = document.getElementById('library-modal-overlay');
    const modal = document.getElementById('library-modal');
    if (!overlay || !modal) return;

    modal.innerHTML = `
      <form id="library-modal-form">
        <div class="modal-header">
          <h2 class="modal-title">${escapeHtml(title)}</h2>
          <button type="button" class="modal-close" data-modal="close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div class="modal-body">${bodyHtml}</div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" data-modal="close">キャンセル</button>
          <button type="submit" class="btn btn-primary">${escapeHtml(submitLabel)}</button>
        </div>
      </form>`;
    overlay.classList.add('active');

    const form = document.getElementById('library-modal-form');
    modal.querySelectorAll('[data-modal="close"]').forEach(btn => btn.addEventListener('click', () => this.closeModal()));
    // Escape の受け口はダイアログの入れ物に一度だけ付ける (開くたびに増やさない)
    if (!modal._libraryEscBound) {
      modal._libraryEscBound = true;
      modal.addEventListener('keydown', (e) => { if (e.key === 'Escape') this.closeModal(); });
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submit = form.querySelector('button[type="submit"]');
      submit.disabled = true;
      try {
        const result = await onSubmit(form);
        if (result !== false) this.closeModal();
      } catch (err) {
        Toast.show(escapeHtml(err.message || '保存できませんでした'), 'error');
      } finally {
        submit.disabled = false;
      }
    });

    setTimeout(() => { const first = form.querySelector('input, textarea, select'); if (first) first.focus(); }, 50);
  },

  closeModal() {
    const overlay = document.getElementById('library-modal-overlay');
    if (overlay) overlay.classList.remove('active');
    const onClose = this._modalClose;
    this._modalClose = null;
    if (onClose) onClose();
  },

  // ── Navigation & events ──

  _go(itemId) {
    const target = itemId ? `#library/${itemId}` : '#library';
    if (window.location.hash === target) this.render(itemId ? [itemId] : []);
    else window.location.hash = target.slice(1);
  },

  _bindRoot() {
    const root = document.getElementById('library-root');
    if (!root) return;

    root.addEventListener('click', (e) => {
      const el = e.target.closest('[data-action]');
      if (!el) return;
      const id = el.dataset.id || '';

      switch (el.dataset.action) {
        case 'reload':
          LibraryStore.loaded = false;
          this.render();
          break;
        case 'add':
          this.showAddMenu(e);
          break;
        case 'add-category':
          this.addCategory();
          break;
        case 'category-menu':
          e.stopPropagation();
          this.showCategoryMenu(e, id);
          break;
        case 'category':
          this.categoryId = id;
          this.query = '';
          this.itemId = null;
          this._draw();
          break;
        case 'open':
          this._go(id);
          break;
        case 'back':
          this._go(null);
          break;
        case 'edit-info':
          this.editInfo(id);
          break;
        case 'edit-content':
          this.editing = { itemId: id, dirty: false };
          this._draw();
          break;
        case 'cancel-edit':
          if (!this.confirmLeave()) return;
          this._draw();
          break;
        case 'save-memo':
          this._saveMemo();
          break;
        case 'source':
          this.downloadSource(id);
          break;
        case 'delete':
          this.deleteItem(id);
          break;
        case 'restore':
          e.stopPropagation();
          this.restoreItem(id);
          break;
        case 'empty-trash':
          this.emptyTrash();
          break;
      }
    });

    root.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      const card = e.target.closest('.library-card[data-action="open"]');
      if (card) { e.preventDefault(); this._go(card.dataset.id); }
    });

    // 画面にファイルを落として取り込む
    if (LibraryStore.canEdit()) {
      root.addEventListener('dragover', (e) => {
        if (!e.dataTransfer || !Array.from(e.dataTransfer.types || []).includes('Files')) return;
        e.preventDefault();
        root.classList.add('is-dropping');
      });
      root.addEventListener('dragleave', (e) => { if (e.target === root) root.classList.remove('is-dropping'); });
      root.addEventListener('drop', (e) => {
        if (!e.dataTransfer || !e.dataTransfer.files.length) return;
        e.preventDefault();
        root.classList.remove('is-dropping');
        this.ingestFiles(Array.from(e.dataTransfer.files));
      });
    }

    const search = root.querySelector('#library-search');
    if (search) {
      search.addEventListener('input', () => {
        clearTimeout(this._searchTimer);
        this._searchTimer = setTimeout(() => {
          this.query = search.value;
          this.itemId = null;
          this._drawMain();
          this._runContentSearch();
        }, 200);
      });
    }
  },

  showAddMenu(e) {
    ContextMenu.show(e.clientX, e.clientY, [
      { label: 'ファイルを取り込む', icon: LIBRARY_TYPES.file.icon, action: () => this.pickFiles() },
      { label: 'Excelから貼り付けて表を作る', icon: LIBRARY_TYPES.table.icon, action: () => this.newTableFromPaste() },
      { label: 'メモを作る', icon: LIBRARY_TYPES.memo.icon, action: () => this.newMemo() },
      { label: 'リンクを登録', icon: LIBRARY_TYPES.link.icon, action: () => this.newLink() },
    ]);
  },

  // 編集の終了 (LibraryTable からも呼ぶ)
  finishEdit(message) {
    this.editing = null;
    if (message) Toast.show(message, 'success');
    this._draw();
  },

  markDirty() {
    if (this.editing) this.editing.dirty = true;
  },
};
