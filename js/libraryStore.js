// ===================================
// LIBRARY STORE — libraryStore.js
// 資料庫のデータ。タスク用の store とは別に library/ 以下へ保存する
// ===================================
//
// - 一覧 (index) は /api/library 経由で読み書きする。保存は rev を添えて送り、
//   ほかの端末が先に保存していたら (409) 読み直して同じ変更をやり直す
// - 表・メモの中身と添付ファイルは、毎回新しいパスへブラウザから直接アップロードする。
//   バケットが「JSON のみ・1ファイル 1MB まで」なので、大きいものは base64 にして分割する
// - localhost ではこの端末の localStorage だけに保存し、本番には一切書かない

const LIBRARY_LOCAL_KEYS = {
  INDEX: 'taskdash_library_index',
  OBJECT_PREFIX: 'taskdash_library_obj:',
};

const LIBRARY_PLAIN_LIMIT = 900 * 1000;       // これ以下の JSON は分割せずそのまま保存する
const LIBRARY_PART_CHARS = 700 * 1000;        // 分割時の 1 パートの base64 文字数 (4 の倍数)
const LIBRARY_MAX_BYTES = 20 * 1000 * 1000;   // 1 件あたりの上限 (API の分割数上限に合わせる)
const LIBRARY_DEFAULT_CATEGORIES = ['価格表', '入荷記録', 'イベント', '販売記録'];

const LibraryStore = {
  mode: null,        // 'cloud' | 'local' | 'disabled'
  index: null,
  loaded: false,
  loadError: null,
  publicBase: '',
  _loading: null,
  _cache: new Map(),

  // file:// で開くと既存のタスク保存が本番 API を向くため、資料庫は使えないようにする
  detectMode() {
    if (window.location.protocol === 'file:') return 'disabled';
    if (this.isLocalHost) {
      return new URLSearchParams(window.location.search).has('library-cloud') ? 'cloud' : 'local';
    }
    return 'cloud';
  },

  // localhost だけでなく、同じLANの端末(スマホでの実機確認など)からも本番に書かないようにする
  get isLocalHost() {
    const host = String(window.location.hostname || '').replace(/^\[|\]$/g, '').toLowerCase();
    if (['localhost', '127.0.0.1', '::1', '0.0.0.0'].includes(host)) return true;
    if (host.endsWith('.local') || host.endsWith('.localhost')) return true;
    return /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host);
  },

  // 同時に呼ばれても読み込みは 1 回にまとめる
  load() {
    if (!this._loading) {
      this._loading = this._load().finally(() => { this._loading = null; });
    }
    return this._loading;
  },

  async _load() {
    this.mode = this.detectMode();
    this.loadError = null;

    if (this.mode === 'disabled') {
      this.index = null;
      this.loaded = true;
      return;
    }

    try {
      if (this.mode === 'local') {
        // 「保存がまだ無い」と「読めなかった」を分ける。壊れた内容を初期値で上書きしないため
        const stored = localStorage.getItem(LIBRARY_LOCAL_KEYS.INDEX);
        this.index = stored ? this._normalize(JSON.parse(stored)) : this._defaultIndex();
        if (!this.index) throw new Error('この端末に保存された資料一覧を読めませんでした');
      } else {
        const res = await fetch('/api/library?t=' + Date.now(), { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        this.publicBase = data.publicBase || '';
        this.index = data.exists ? this._normalize(data.index) : this._defaultIndex();
      }
    } catch (e) {
      // 読めなかったときに初期値で上書きしないよう、一覧を持たない = 編集できない状態にする
      console.error('Library load failed:', e);
      this.loadError = e.message || String(e);
      this.index = null;
    }
    this.loaded = true;
  },

  _defaultIndex() {
    return {
      version: 1,
      rev: null,
      categories: LIBRARY_DEFAULT_CATEGORIES.map(name => ({ id: generateId(), name })),
      items: [],
    };
  },

  _normalize(index) {
    if (!index || typeof index !== 'object') return null;
    if (!Array.isArray(index.categories)) index.categories = [];
    if (!Array.isArray(index.items)) index.items = [];
    return index;
  },

  canEdit() {
    return store.isAdmin && !!this.index && !this.loadError && this.mode !== 'disabled';
  },

  // ── Queries ──

  categories() {
    return this.index ? this.index.categories : [];
  },

  activeItems() {
    return this.index ? this.index.items.filter(i => !i.deleted) : [];
  },

  trashedItems() {
    return this.index ? this.index.items.filter(i => i.deleted) : [];
  },

  getItem(id) {
    return this.index ? this.index.items.find(i => i.id === id) || null : null;
  },

  getCategory(id) {
    return this.categories().find(c => c.id === id) || null;
  },

  // ── Index writes ──

  // fn は一覧の複製を受け取って書き換える。409 のときは最新の一覧に同じ fn を適用し直すので、
  // 「id が無ければ追加」のように何度適用しても同じ結果になる書き方にすること
  async mutate(fn) {
    if (!this.canEdit()) throw new Error('資料庫を編集できません');

    for (let attempt = 0; attempt < 3; attempt++) {
      const draft = JSON.parse(JSON.stringify(this.index));
      const result = fn(draft);

      if (this.mode === 'local') {
        draft.rev = (draft.rev || 0) + 1;
        this._writeLocal(LIBRARY_LOCAL_KEYS.INDEX, JSON.stringify(draft));
        this.index = draft;
        return result;
      }

      const res = await fetch('/api/library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'saveIndex', baseRev: this.index.rev ?? null, index: draft }),
      });

      if (res.ok) {
        const saved = await res.json();
        draft.rev = saved.rev;
        draft.savedAt = saved.savedAt;
        this.index = draft;
        return result;
      }

      if (res.status === 409) {
        await this.load();
        if (!this.index) throw new Error('最新の資料一覧を読み込めませんでした');
        continue;
      }

      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `保存に失敗しました (HTTP ${res.status})`);
    }
    throw new Error('ほかの端末の保存と重なりました。もう一度お試しください');
  },

  // ゴミ箱の資料を一覧から完全に外す。中身のファイルは保存先に残る。
  // 一覧が 1MB の上限に近づいたときの逃げ道でもある
  async purgeTrash() {
    if (!this.canEdit()) throw new Error('資料庫を編集できません');

    if (this.mode === 'local') {
      const draft = JSON.parse(JSON.stringify(this.index));
      draft.items = draft.items.filter(i => !i.deleted);
      draft.rev = (draft.rev || 0) + 1;
      this._writeLocal(LIBRARY_LOCAL_KEYS.INDEX, JSON.stringify(draft));
      this.index = draft;
      return;
    }

    const res = await fetch('/api/library', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'purgeTrash', baseRev: this.index.rev ?? null }),
    });
    if (res.status === 409) {
      await this.load();
      throw new Error('ほかの端末の保存と重なりました。もう一度お試しください');
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `削除に失敗しました (HTTP ${res.status})`);
    }
    await this.load();
  },

  // ── Contents (tables, memos, files) ──

  // 中身を保存し、一覧に書く参照 { paths, encoding, bytes } を返す。
  // payload がオブジェクトなら JSON として、Uint8Array ならファイルの中身として扱う
  async saveContent(kind, id, payload) {
    const isBinary = payload instanceof Uint8Array;
    const json = isBinary ? null : JSON.stringify(payload);
    if (!isBinary && typeof json !== 'string') throw new Error('保存する中身がありません');
    const bytes = isBinary ? payload : new TextEncoder().encode(json);
    if (bytes.length > LIBRARY_MAX_BYTES) {
      throw new Error(`大きすぎます(${formatLibraryBytes(bytes.length)})。20MB までです`);
    }

    let encoding;
    let parts;
    if (!isBinary && bytes.length <= LIBRARY_PLAIN_LIMIT) {
      encoding = 'json';
      parts = [json];
    } else {
      encoding = 'b64';
      const b64 = await this._toBase64(bytes);
      const count = Math.max(1, Math.ceil(b64.length / LIBRARY_PART_CHARS));
      parts = Array.from({ length: count }, (_, i) => JSON.stringify({
        format: 'b64-part',
        index: i,
        count,
        data: b64.slice(i * LIBRARY_PART_CHARS, (i + 1) * LIBRARY_PART_CHARS),
      }));
    }

    const paths = this.mode === 'local'
      ? this._saveLocalParts(kind, id, parts)
      : await this._uploadParts(kind, id, parts);

    const ref = { paths, encoding, bytes: bytes.length };
    if (!isBinary) this._cache.set(paths.join('|'), payload);
    return ref;
  },

  // as: 'json' (表・メモ) または 'bytes' (添付ファイル)
  async loadContent(ref, as = 'json') {
    if (!ref || !Array.isArray(ref.paths) || ref.paths.length === 0) return null;
    const key = ref.paths.join('|');
    if (as === 'json' && this._cache.has(key)) return this._cache.get(key);

    const texts = await Promise.all(ref.paths.map(p => this._readPart(p)));
    let value;
    if (ref.encoding === 'json') {
      value = JSON.parse(texts[0]);
    } else {
      // パートの順序はファイル名任せにせず、中に書いてある index / count で確かめる
      const parts = texts.map(t => JSON.parse(t));
      if (parts.some(p => !p || typeof p.data !== 'string')) throw new Error('中身のファイルが壊れています');
      const count = parts[0].count || parts.length;
      if (count !== parts.length) throw new Error('中身のファイルがそろっていません');
      parts.sort((a, b) => (a.index || 0) - (b.index || 0));
      const bytes = this._fromBase64(parts.map(p => p.data).join(''));
      value = as === 'bytes' ? bytes : JSON.parse(new TextDecoder().decode(bytes));
    }
    if (as === 'json') this._cache.set(key, value);
    return value;
  },

  async _uploadParts(kind, id, parts) {
    const res = await fetch('/api/library', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'sign', kind, id, count: parts.length }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `アップロードの準備に失敗しました (HTTP ${res.status})`);
    }
    const { uploads } = await res.json();

    // 同時送信は 4 本まで。1 本でも失敗したら、残りは送らずに止める
    let next = 0;
    let failure = null;
    const worker = async () => {
      while (next < uploads.length && !failure) {
        const i = next++;
        try {
          const r = await fetch(uploads[i].uploadUrl, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'cache-control': 'max-age=31536000, immutable' },
            body: parts[i],
          });
          if (!r.ok) throw new Error(`アップロードに失敗しました (HTTP ${r.status})`);
        } catch (e) {
          failure = failure || e;
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(4, uploads.length) }, worker));
    if (failure) throw failure;
    return uploads.map(u => u.path);
  },

  async _readPart(path) {
    if (this.mode === 'local') {
      const text = localStorage.getItem(LIBRARY_LOCAL_KEYS.OBJECT_PREFIX + path);
      if (text === null) throw new Error('この端末に中身がありません');
      return text;
    }
    const res = await fetch(this.publicBase + path);
    if (!res.ok) throw new Error(`中身を読み込めませんでした (HTTP ${res.status})`);
    return res.text();
  },

  _saveLocalParts(kind, id, parts) {
    const rev = Date.now().toString(36);
    const paths = parts.map((_, i) => `local/${kind}s/${id}/${rev}-${i}.json`);
    paths.forEach((p, i) => this._writeLocal(LIBRARY_LOCAL_KEYS.OBJECT_PREFIX + p, parts[i]));
    return paths;
  },

  _writeLocal(key, text) {
    try {
      localStorage.setItem(key, text);
    } catch (e) {
      throw new Error('この端末の保存容量が足りません(ローカルモードは数MBまで)');
    }
  },

  _toBase64(bytes) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(new Blob([bytes]));
    });
  },

  _fromBase64(b64) {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  },
};

function formatLibraryBytes(n) {
  if (!n && n !== 0) return '';
  if (n < 1000) return `${n} B`;
  if (n < 1000 * 1000) return `${(n / 1000).toFixed(0)} KB`;
  return `${(n / 1000 / 1000).toFixed(1)} MB`;
}
