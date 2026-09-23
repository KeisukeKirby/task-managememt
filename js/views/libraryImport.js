// ===================================
// LIBRARY IMPORT — libraryImport.js
// Excel (.xlsx/.xls) と CSV を資料庫の表として取り込む
// ===================================
//
// 梱包明細のようなファイルは 1 行目が見出しとは限らないので、
// 取り込む前にシートと見出し行を選べるようにしている

const LIBRARY_SHEETJS_URL = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';
const LIBRARY_SPREADSHEET_EXT = ['xlsx', 'xlsm', 'xlsb', 'xls', 'csv', 'tsv'];
const LIBRARY_PREVIEW_ROWS = 6;
const LIBRARY_PREVIEW_COLS = 8;

const LibraryImport = {
  _sheetJs: null,
  _queue: [],
  _state: null,

  isSpreadsheet(name) {
    return LIBRARY_SPREADSHEET_EXT.includes(String(name || '').split('.').pop().toLowerCase());
  },

  // Excel の読み込み部品は取り込むときだけ読み込む (普段の表示を重くしない)
  loadSheetJs() {
    if (window.XLSX) return Promise.resolve(window.XLSX);
    if (!this._sheetJs) {
      this._sheetJs = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = LIBRARY_SHEETJS_URL;
        script.onload = () => {
          if (window.XLSX) resolve(window.XLSX);
          else { this._sheetJs = null; reject(new Error('Excelを読む部品を準備できませんでした')); }
        };
        script.onerror = () => {
          this._sheetJs = null;
          reject(new Error('Excelを読む部品を取得できませんでした(通信環境をご確認ください)'));
        };
        document.head.appendChild(script);
      });
    }
    return this._sheetJs;
  },

  // タイ語の CSV は UTF-8 でないことがある。文字化けしたら windows-874 で読み直す
  async _readText(file) {
    const buffer = await file.arrayBuffer();
    const utf8 = new TextDecoder('utf-8').decode(buffer);
    if (!utf8.includes('�')) return utf8.replace(/^﻿/, '');
    try {
      return new TextDecoder('windows-874').decode(buffer);
    } catch {
      return utf8;
    }
  },

  async readSheets(file) {
    const ext = String(file.name || '').split('.').pop().toLowerCase();

    if (ext === 'csv' || ext === 'tsv') {
      const text = await this._readText(file);
      const delimiter = ext === 'tsv' ? '\t' : detectLibraryDelimiter(text);
      return [{ name: file.name, matrix: parseLibraryDelimited(text, delimiter) }];
    }

    const XLSX = await this.loadSheetJs();
    const workbook = XLSX.read(new Uint8Array(await file.arrayBuffer()), { type: 'array', cellDates: true, dense: true });
    const sheets = [];

    workbook.SheetNames.forEach((name, i) => {
      const meta = workbook.Workbook && workbook.Workbook.Sheets && workbook.Workbook.Sheets[i];
      if (meta && meta.Hidden) return;                 // 非表示シートは取り込まない
      const worksheet = workbook.Sheets[name];
      if (!worksheet) return;
      // raw:false で日付などを見たままに、rawNumbers:true で数値は数値のままにする
      const matrix = XLSX.utils.sheet_to_json(worksheet, {
        header: 1, raw: false, rawNumbers: true, dateNF: 'yyyy-mm-dd', defval: '', blankrows: false,
      });
      if (matrix.length) sheets.push({ name, matrix });
    });
    return sheets;
  },

  // 見出しらしい行を推測する。埋まっていて、次の行も同じくらい埋まっている行
  guessHeaderIndex(matrix) {
    const filled = row => (row || []).filter(c => String(c === undefined || c === null ? '' : c).trim() !== '').length;
    let best = 0;
    let bestScore = -1;
    for (let i = 0; i < Math.min(matrix.length, 10); i++) {
      const count = filled(matrix[i]);
      const next = filled(matrix[i + 1]);
      const score = (count >= 2 && next >= Math.max(2, count - 1)) ? count : count / 4;
      if (score > bestScore) { bestScore = score; best = i; }
    }
    return best;
  },

  // ドロップされたファイルを 1 つずつダイアログにかける
  queue(files) {
    this._queue.push(...files);
    if (!this._state) this._next();
  },

  async _next() {
    const file = this._queue.shift();
    if (!file) { this._state = null; LibraryView._draw(); return; }

    try {
      Toast.show(`${escapeHtml(file.name)} を読み込んでいます...`, 'info', 4000);
      const sheets = await this.readSheets(file);
      if (!sheets.length) throw new Error('表が見つかりませんでした');
      this._state = { file, sheets, sheetIndex: 0, headerIndex: this.guessHeaderIndex(sheets[0].matrix) };
      this._openDialog();
    } catch (e) {
      Toast.show(`${escapeHtml(file.name)}: ${escapeHtml(e.message || '読み込めませんでした')}`, 'error', 6000);
      this._state = null;
      this._next();
    }
  },

  _openDialog() {
    const state = this._state;
    const baseTitle = String(state.file.name || '表').replace(/\.[^.]+$/, '');

    LibraryView._openModal('Excel・CSVを取り込む', `
      <div class="form-group">
        <label class="form-label">タイトル</label>
        <input type="text" name="title" class="form-input" value="${escapeHtml(baseTitle)}" required>
      </div>
      ${state.sheets.length > 1 ? `
        <div class="form-group">
          <label class="form-label">シート</label>
          <select name="sheet" class="form-input" id="library-import-sheet">
            ${state.sheets.map((s, i) => `<option value="${i}">${escapeHtml(s.name)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group library-check-row">
          <label><input type="checkbox" name="allSheets"> すべてのシートを別々の表として取り込む</label>
        </div>` : ''}
      <div class="form-group">
        <label class="form-label">見出しの行</label>
        <select name="headerIndex" class="form-input" id="library-import-header">${this._headerOptions()}</select>
      </div>
      <div class="form-group">
        <label class="form-label">取り込み後のイメージ</label>
        <div id="library-import-preview" class="library-import-preview">${this._previewHtml()}</div>
      </div>
      <div class="form-group library-check-row">
        <label><input type="checkbox" name="keepSource" checked> 元のファイルも残す</label>
      </div>
      ${LibraryView._categoryFieldHtml(LibraryView._defaultCategoryId())}
    `, (form) => this._submit(form), '取り込む', () => this.onDialogClosed());

    const sheetSelect = document.getElementById('library-import-sheet');
    if (sheetSelect) {
      sheetSelect.addEventListener('change', () => {
        state.sheetIndex = Number(sheetSelect.value);
        state.headerIndex = this.guessHeaderIndex(state.sheets[state.sheetIndex].matrix);
        document.getElementById('library-import-header').innerHTML = this._headerOptions();
        this._refreshPreview();
      });
    }
    const headerSelect = document.getElementById('library-import-header');
    headerSelect.addEventListener('change', () => {
      state.headerIndex = Number(headerSelect.value);
      this._refreshPreview();
    });
  },

  _headerOptions() {
    const state = this._state;
    const matrix = state.sheets[state.sheetIndex].matrix;
    const options = [`<option value="-1" ${state.headerIndex < 0 ? 'selected' : ''}>見出しなし(列1・列2…)</option>`];
    for (let i = 0; i < Math.min(matrix.length, 10); i++) {
      const label = (matrix[i] || []).slice(0, 4).map(c => String(c === undefined || c === null ? '' : c)).join(' / ').slice(0, 40);
      options.push(`<option value="${i}" ${i === state.headerIndex ? 'selected' : ''}>${i + 1}行目: ${escapeHtml(label)}</option>`);
    }
    return options.join('');
  },

  _refreshPreview() {
    const preview = document.getElementById('library-import-preview');
    if (preview) preview.innerHTML = this._previewHtml();
  },

  _previewHtml() {
    const state = this._state;
    const content = buildLibraryTable(state.sheets[state.sheetIndex].matrix, state.headerIndex);
    if (!content.columns.length) return '<div class="library-loading">表として読み取れませんでした</div>';

    const columns = content.columns.slice(0, LIBRARY_PREVIEW_COLS);
    const rows = content.rows.slice(0, LIBRARY_PREVIEW_ROWS);
    return `
      <table class="library-table library-preview-table">
        <thead><tr>${columns.map(c => `<th>${escapeHtml(c.name)}</th>`).join('')}</tr></thead>
        <tbody>
          ${rows.map(r => `<tr>${columns.map((_, c) => `<td>${escapeHtml(r[c] === null || r[c] === undefined ? '' : String(r[c]))}</td>`).join('')}</tr>`).join('')}
        </tbody>
      </table>
      <div class="library-import-note">
        ${content.rows.length.toLocaleString('en-US')}行 × ${content.columns.length}列
        ${content.columns.length > LIBRARY_PREVIEW_COLS ? '(先頭8列のみ表示)' : ''}
      </div>`;
  },

  async _submit(form) {
    const state = this._state;
    const title = form.title.value.trim();
    if (!title) { Toast.show('タイトルを入力してください', 'error'); return false; }

    const categoryId = form.categoryId.value || null;
    const allSheets = !!(form.allSheets && form.allSheets.checked);
    const targets = allSheets
      ? state.sheets.map((sheet, i) => ({ sheet, headerIndex: this.guessHeaderIndex(sheet.matrix), title: `${title} - ${sheet.name}` }))
      : [{ sheet: state.sheets[state.sheetIndex], headerIndex: state.headerIndex, title }];

    // 元ファイルは 1 つだけ保存し、取り込んだ表から共有で参照する
    let source = null;
    if (form.keepSource.checked) {
      const bytes = new Uint8Array(await state.file.arrayBuffer());
      const ref = await LibraryStore.saveContent('file', generateId(), bytes);
      source = { ...ref, name: state.file.name, mime: state.file.type || guessLibraryMime(state.file.name) };
    }

    let created = 0;
    let lastId = null;
    for (const target of targets) {
      const content = buildLibraryTable(target.sheet.matrix, target.headerIndex);
      if (!content.columns.length) continue;
      const id = generateId();
      const ref = await LibraryStore.saveContent('item', id, content);
      await LibraryView._pushItem({
        id, type: 'table', title: target.title, categoryId,
        content: ref,
        columns: content.columns.map(c => c.name),
        summary: { rows: content.rows.length, cols: content.columns.length },
        source,
      });
      created++;
      lastId = id;
    }

    if (!created) { Toast.show('表として読み取れませんでした', 'error'); return false; }
    Toast.show(created > 1 ? `${created}個の表を取り込みました` : '表を取り込みました', 'success');
    this._state = null;
    if (created === 1 && lastId) LibraryView._go(lastId);
    setTimeout(() => this._next(), 0);
  },

  // ダイアログを閉じただけのとき (取り込まなかった) も次のファイルへ進む
  onDialogClosed() {
    if (!this._state) return;
    this._state = null;
    setTimeout(() => this._next(), 0);
  },
};
