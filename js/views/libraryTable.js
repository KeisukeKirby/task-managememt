// ===================================
// LIBRARY TABLE — libraryTable.js
// 資料庫の表。価格表・入荷記録・販売記録のような行数の多い資料を扱う
// ===================================

const LIBRARY_TABLE_PAGE_SIZE = 100;
const LIBRARY_COLLATOR = new Intl.Collator('ja', { numeric: true, sensitivity: 'base' });

// 引用符つきのセル(中に改行や区切り文字を含む)に対応した区切りテキストの解析
function parseLibraryDelimited(text, delimiter) {
  const out = [];
  let row = [];
  let cell = '';
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; } else { quoted = false; }
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"' && cell === '') { quoted = true; continue; }
    if (ch === delimiter) { row.push(cell); cell = ''; continue; }
    if (ch === '\r') continue;
    if (ch === '\n') { row.push(cell); out.push(row); row = []; cell = ''; continue; }
    cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); out.push(row); }
  return out;
}

// Excel からの貼り付けはタブ区切り、ファイルはカンマ区切りが多い
function detectLibraryDelimiter(text) {
  const firstLine = text.split(/\r?\n/)[0] || '';
  return firstLine.includes('\t') ? '\t' : ',';
}

// 数字だけのセルは数値にする。並べ替えと桁区切り表示のため。
// ただし 0 で始まる番号(品番・バーコード)と、丸められてしまう桁数の数字は文字のまま残す
function coerceLibraryCell(value) {
  if (value === undefined || value === null) return '';
  if (typeof value === 'number') return Number.isFinite(value) ? value : '';
  const text = String(value).trim();
  if (!text) return '';
  if (/^-?0\d/.test(text)) return text;

  const numeric = text.replace(/,/g, '');
  if (!/^-?\d+(\.\d+)?$/.test(numeric)) return text;
  // 12桁以上の数字はバーコードや伝票番号とみなす。桁区切りを付けても読みにくいだけ
  if (/^\d{12,}$/.test(numeric)) return text;
  const n = Number(numeric);
  if (!Number.isFinite(n)) return text;
  if (Number.isInteger(n) && !Number.isSafeInteger(n)) return text;
  return n;
}

// 二次元配列から表の中身を組み立てる。headerIndex が -1 なら見出しなし
function buildLibraryTable(matrix, headerIndex = 0) {
  if (!Array.isArray(matrix) || !matrix.length) return { columns: [], rows: [] };

  let width = 0;
  matrix.forEach(row => {
    for (let i = row.length - 1; i >= 0; i--) {
      if (String(row[i] === undefined || row[i] === null ? '' : row[i]).trim() !== '') {
        width = Math.max(width, i + 1);
        break;
      }
    }
  });
  if (!width) return { columns: [], rows: [] };

  const header = headerIndex >= 0 ? (matrix[headerIndex] || []) : [];
  const columns = Array.from({ length: width }, (_, i) => ({
    name: String(header[i] === undefined || header[i] === null ? '' : header[i]).trim() || `列${i + 1}`,
  }));

  const rows = matrix
    .slice(headerIndex >= 0 ? headerIndex + 1 : 0)
    .filter(row => row.some(c => String(c === undefined || c === null ? '' : c).trim() !== ''))
    .map(row => Array.from({ length: width }, (_, i) => coerceLibraryCell(row[i])));

  return { columns, rows };
}

const LibraryTable = {
  container: null,
  item: null,
  content: null,      // 表示中の中身 { columns, rows }
  draft: null,        // 編集中の複製
  editing: false,
  sortCol: null,
  sortDir: 0,         // 0=元の順 1=昇順 -1=降順
  filter: '',
  page: 0,
  _search: null,
  _numeric: null,
  _filterTimer: null,

  mount(container, item, content, editing) {
    const sameItem = this.item && this.item.id === item.id;
    this.container = container;
    this.item = item;
    this.content = this._normalize(content);
    this.editing = !!editing;
    this.draft = editing ? JSON.parse(JSON.stringify(this.content)) : null;
    if (!sameItem) { this.sortCol = null; this.sortDir = 0; this.filter = ''; this.page = 0; }
    this._search = null;
    this._numeric = null;
    this._bindOnce();
    this._render();
  },

  _normalize(content) {
    const columns = Array.isArray(content && content.columns) ? content.columns : [];
    const rows = Array.isArray(content && content.rows) ? content.rows : [];
    return {
      columns: columns.map(c => ({ name: String((c && c.name) || '') })),
      rows: rows.map(r => (Array.isArray(r) ? r : [])),
    };
  },

  _data() {
    return this.editing ? this.draft : this.content;
  },

  // 絞り込み用の行文字列は読み込み後に一度だけ作る
  _searchStrings() {
    if (!this._search) {
      this._search = this._data().rows.map(r => r.map(v => String(v === null || v === undefined ? '' : v)).join(' ').toLowerCase());
    }
    return this._search;
  },

  // 数値だけの列は右寄せ・桁区切りで表示する
  _numericColumns() {
    if (!this._numeric) {
      const data = this._data();
      this._numeric = data.columns.map((_, c) => {
        let seen = false;
        for (const row of data.rows) {
          const v = row[c];
          if (v === '' || v === null || v === undefined) continue;
          if (typeof v !== 'number') return false;
          seen = true;
        }
        return seen;
      });
    }
    return this._numeric;
  },

  _visibleRows() {
    const data = this._data();
    let indexes = data.rows.map((_, i) => i);

    const query = this.filter.trim().toLowerCase();
    if (query) {
      const strings = this._searchStrings();
      indexes = indexes.filter(i => strings[i].includes(query));
    }

    if (this.sortDir && this.sortCol !== null) {
      const col = this.sortCol;
      const numeric = this._numericColumns()[col];
      indexes.sort((a, b) => this.sortDir * this._compare(data.rows[a][col], data.rows[b][col], numeric));
    }
    return indexes;
  },

  _compare(a, b, numeric) {
    const emptyA = a === '' || a === null || a === undefined;
    const emptyB = b === '' || b === null || b === undefined;
    if (emptyA && emptyB) return 0;
    if (emptyA) return 1;       // 空欄は常に後ろ
    if (emptyB) return -1;
    if (numeric) return Number(a) - Number(b);
    return LIBRARY_COLLATOR.compare(String(a), String(b));
  },

  _formatCell(value, numeric) {
    if (value === null || value === undefined || value === '') return '';
    if (numeric && typeof value === 'number') return value.toLocaleString('en-US');
    return String(value);
  },

  // ── Rendering ──

  _render() {
    if (!this.container) return;
    const data = this._data();
    const indexes = this._visibleRows();
    const pages = Math.max(1, Math.ceil(indexes.length / LIBRARY_TABLE_PAGE_SIZE));
    if (this.page >= pages) this.page = pages - 1;
    const start = this.page * LIBRARY_TABLE_PAGE_SIZE;
    const pageRows = indexes.slice(start, start + LIBRARY_TABLE_PAGE_SIZE);
    const numeric = this._numericColumns();

    this.container.innerHTML = `
      <div class="library-table-tools">
        ${this.editing ? `
          <button class="btn btn-sm btn-secondary" data-table="add-row">行を追加</button>
          <button class="btn btn-sm btn-secondary" data-table="add-col">列を追加</button>
          <span class="library-table-hint">セルをクリックすると直せます</span>
          <div class="library-edit-actions">
            <button class="btn btn-sm btn-secondary" data-table="cancel">キャンセル</button>
            <button class="btn btn-sm btn-primary" data-table="save">保存</button>
          </div>
        ` : `
          <input type="search" class="form-input library-table-filter" placeholder="この表の中を絞り込む..." value="${escapeHtml(this.filter)}">
          <span class="library-table-count">${indexes.length.toLocaleString('en-US')}行${this.filter.trim() ? ` / 全${data.rows.length.toLocaleString('en-US')}行` : ''}</span>
          <div class="library-edit-actions">
            <button class="btn btn-sm btn-secondary" data-table="csv">CSVで保存</button>
          </div>
        `}
      </div>

      ${data.columns.length === 0 ? `
        <div class="library-loading">この表には列がありません。「内容を編集」から列を追加できます。</div>
      ` : `
        <div class="library-table-wrap">
          <table class="library-table">
            <thead>
              <tr>
                ${this.editing ? '<th class="library-table-rowhead"></th>' : ''}
                ${data.columns.map((col, c) => `
                  <th data-col="${c}" class="${numeric[c] ? 'is-numeric' : ''} ${this.sortCol === c && this.sortDir ? 'is-sorted' : ''}"
                      title="${this.editing ? 'ダブルクリックで列名を変更' : 'クリックで並べ替え'}">
                    <span class="library-th-name">${escapeHtml(col.name)}</span>
                    ${!this.editing && this.sortCol === c && this.sortDir ? `<span class="library-th-sort">${this.sortDir > 0 ? '▲' : '▼'}</span>` : ''}
                    ${this.editing ? `<span class="library-th-del" data-table="del-col" data-col="${c}" title="この列を削除">✕</span>` : ''}
                  </th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${pageRows.map(r => `
                <tr>
                  ${this.editing ? `<td class="library-table-rowhead"><span class="library-row-del" data-table="del-row" data-row="${r}" title="この行を削除">✕</span></td>` : ''}
                  ${data.columns.map((_, c) => `
                    <td data-row="${r}" data-col="${c}" class="${numeric[c] ? 'is-numeric' : ''}"
                        ${this.editing ? 'contenteditable="true"' : ''}>${escapeHtml(this._formatCell(data.rows[r][c], numeric[c] && !this.editing))}</td>`).join('')}
                </tr>`).join('')}
            </tbody>
          </table>
          ${pageRows.length === 0 ? '<div class="library-loading">該当する行がありません</div>' : ''}
        </div>

        ${pages > 1 ? `
          <div class="library-table-pager">
            <button class="btn btn-sm btn-secondary" data-table="prev" ${this.page === 0 ? 'disabled' : ''}>← 前</button>
            <span>${(start + 1).toLocaleString('en-US')}〜${Math.min(start + LIBRARY_TABLE_PAGE_SIZE, indexes.length).toLocaleString('en-US')} / ${indexes.length.toLocaleString('en-US')}行</span>
            <button class="btn btn-sm btn-secondary" data-table="next" ${this.page >= pages - 1 ? 'disabled' : ''}>次 →</button>
          </div>` : ''}
      `}`;

    const filter = this.container.querySelector('.library-table-filter');
    if (filter && this._filterFocused) {
      filter.focus();
      filter.setSelectionRange(filter.value.length, filter.value.length);
    }
  },

  // 描き直しでも消えないよう、操作の受け口は入れ物に一度だけ付ける
  _bindOnce() {
    const root = this.container;
    if (!root || root._libraryTableBound) return;
    root._libraryTableBound = true;

    root.addEventListener('click', (e) => {
      const el = e.target.closest('[data-table]');
      if (el) {
        switch (el.dataset.table) {
          case 'add-row': this._addRow(); return;
          case 'add-col': this._addColumn(); return;
          case 'del-row': this._deleteRow(Number(el.dataset.row)); return;
          case 'del-col': e.stopPropagation(); this._deleteColumn(Number(el.dataset.col)); return;
          case 'save': this.save(); return;
          case 'cancel': this.cancel(); return;
          case 'csv': this.exportCsv(); return;
          case 'prev': this.page = Math.max(0, this.page - 1); this._render(); return;
          case 'next': this.page += 1; this._render(); return;
        }
      }

      // 並べ替えは閲覧時のみ。昇順 → 降順 → 元の順 の順で切り替わる
      const th = e.target.closest('th[data-col]');
      if (th && !this.editing) {
        const col = Number(th.dataset.col);
        if (this.sortCol !== col) { this.sortCol = col; this.sortDir = 1; }
        else if (this.sortDir === 1) { this.sortDir = -1; }
        else if (this.sortDir === -1) { this.sortDir = 0; this.sortCol = null; }
        else { this.sortDir = 1; }
        this.page = 0;
        this._render();
      }
    });

    root.addEventListener('dblclick', (e) => {
      const th = e.target.closest('th[data-col]');
      if (!th || !this.editing) return;
      const col = Number(th.dataset.col);
      const name = prompt('列の名前:', this.draft.columns[col].name);
      if (name === null) return;
      this.draft.columns[col].name = name.trim() || `列${col + 1}`;
      LibraryView.markDirty();
      this._render();
    });

    root.addEventListener('input', (e) => {
      if (e.target.classList && e.target.classList.contains('library-table-filter')) {
        const value = e.target.value;
        this._filterFocused = true;
        clearTimeout(this._filterTimer);
        this._filterTimer = setTimeout(() => {
          this.filter = value;
          this.page = 0;
          this._render();
        }, 200);
        return;
      }

      const td = e.target.closest && e.target.closest('td[data-row]');
      if (!td || !this.editing) return;
      this.draft.rows[Number(td.dataset.row)][Number(td.dataset.col)] = coerceLibraryCell(td.textContent);
      this._search = null;
      this._numeric = null;
      LibraryView.markDirty();
    });
  },

  // ── Editing ──

  _addRow() {
    this.draft.rows.push(this.draft.columns.map(() => ''));
    this._search = null;
    LibraryView.markDirty();
    this.page = Math.floor((this.draft.rows.length - 1) / LIBRARY_TABLE_PAGE_SIZE);
    this._render();
  },

  _addColumn() {
    const name = prompt('追加する列の名前:', `列${this.draft.columns.length + 1}`);
    if (name === null) return;
    this.draft.columns.push({ name: name.trim() || `列${this.draft.columns.length + 1}` });
    this.draft.rows.forEach(r => r.push(''));
    this._search = null;
    this._numeric = null;
    LibraryView.markDirty();
    this._render();
  },

  _deleteRow(index) {
    this.draft.rows.splice(index, 1);
    this._search = null;
    LibraryView.markDirty();
    this._render();
  },

  _deleteColumn(index) {
    if (!confirm(`列「${this.draft.columns[index].name}」を削除しますか？`)) return;
    this.draft.columns.splice(index, 1);
    this.draft.rows.forEach(r => r.splice(index, 1));
    this._search = null;
    this._numeric = null;
    LibraryView.markDirty();
    this._render();
  },

  cancel() {
    if (!LibraryView.confirmLeave()) return;
    this.draft = null;
    this.editing = false;
    LibraryView._draw();
  },

  async save() {
    const item = this.item;
    const draft = this.draft;
    if (!item || !draft) return;
    try {
      const ref = await LibraryStore.saveContent('item', item.id, draft);
      await LibraryView._updateItem(item.id, {
        content: ref,
        columns: draft.columns.map(c => c.name),
        summary: { rows: draft.rows.length, cols: draft.columns.length },
      });
      this.content = draft;
      this.draft = null;
      this.editing = false;
      LibraryView.finishEdit('保存しました');
    } catch (e) {
      Toast.show(escapeHtml(e.message || '保存できませんでした'), 'error');
    }
  },

  exportCsv() {
    const data = this.content;
    if (!data) return;
    // Excel が数式として実行しないように、記号で始まるセルの前に ' を付ける
    const cell = (value) => {
      let text = value === null || value === undefined ? '' : String(value);
      if (/^[=+\-@]/.test(text)) text = `'${text}`;
      return `"${text.replace(/"/g, '""')}"`;
    };
    const lines = [data.columns.map(c => cell(c.name)).join(',')];
    data.rows.forEach(row => lines.push(data.columns.map((_, c) => cell(row[c])).join(',')));

    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${String(this.item.title || '表').replace(/[\\/:*?"<>|]/g, '_')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    Toast.show('CSVを保存しました', 'success');
  },
};
