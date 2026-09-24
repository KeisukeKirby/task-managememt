// ===================================
// LIBRARY API — api/library.js
// 資料庫の保存窓口。tasks.json とは別に library/ 以下へ保存する
// ===================================
//
// 保存の考え方:
// - 一覧 (index.json) だけをこの API 経由で読み書きする。rev による楽観ロックで、
//   古いタブや別端末の保存が他の変更を消さないようにする
// - 表・メモの中身と添付ファイルは、毎回新しいパスへブラウザから直接アップロードする
//   (4.5MB の送信上限を避けるため)。この API は署名付き URL を発行するだけ
// - バケットは application/json のみ・1ファイル 1MB までの設定。大きな中身や
//   添付ファイルはブラウザ側で 1MB 未満の JSON に分割してから送る

const SUPABASE_URL = 'https://fwrorriteghwshgmcacn.supabase.co';
const STORAGE = `${SUPABASE_URL}/storage/v1`;
const BUCKET = 'dashboard-data';

// api/tasks.js と同じキー。環境変数が設定されていればそちらを使う
const k1 = "sb_secret_VIprhVacPO";
const k2 = "ictF8g5PFh-w_IbTCL45Z";
const API_KEY = process.env.SUPABASE_SECRET_KEY || (k1 + k2);

const ID_RE = /^[0-9a-z]{4,40}$/;
const MAX_PARTS = 40;             // 1 パート 1MB 未満 × 40 ≒ 添付 20MB 程度まで
const MAX_INDEX_BYTES = 700000;   // バケットの 1MB 制限より手前で止めて、保存不能になるのを防ぐ

// 検証時は LIBRARY_PREFIX=library-test/ にして本番の library/ に触れない
function libraryPrefix() {
  const prefix = process.env.LIBRARY_PREFIX || 'library/';
  if (!/^[0-9a-z_-]+\/$/.test(prefix)) throw new Error('invalid LIBRARY_PREFIX');
  return prefix;
}

async function storageFetch(pathname, init = {}) {
  const response = await fetch(STORAGE + pathname, {
    ...init,
    headers: { apikey: API_KEY, Authorization: 'Bearer ' + API_KEY, ...(init.headers || {}) },
  });
  const text = await response.text();
  return { ok: response.ok, status: response.status, text };
}

// 保存先の応答はログにだけ残す。ブラウザにはバケット名や内部エラーを返さない
function storageError(action, r) {
  console.error(`[library] ${action} failed: ${r.status} ${String(r.text).slice(0, 500)}`);
  return new Error(`${action} failed (HTTP ${r.status})`);
}

// Supabase はオブジェクトが無いとき 400 か 404 で not_found を返す。
// ステータスだけで判定すると一時的な失敗を「空」と誤認するので本文も見る
function isNotFound(status, text) {
  if (status !== 400 && status !== 404) return false;
  return /not_found|not found/i.test(text || '');
}

async function readIndex(prefix) {
  const r = await storageFetch(`/object/${BUCKET}/${prefix}index.json`);
  if (r.ok) return { exists: true, index: JSON.parse(r.text) };
  if (isNotFound(r.status, r.text)) return { exists: false, index: null };
  throw storageError('Index read', r);
}

function validateIndex(index) {
  if (!index || typeof index !== 'object') return 'index is missing';
  if (!Array.isArray(index.categories) || !Array.isArray(index.items)) return 'categories and items must be arrays';
  if (index.categories.some(c => !c || !ID_RE.test(c.id))) return 'invalid category id';
  const seen = new Set();
  for (const item of index.items) {
    if (!item || !ID_RE.test(item.id)) return 'invalid item id';
    if (seen.has(item.id)) return 'duplicate item id';
    seen.add(item.id);
  }
  return null;
}

// 一覧を実際に書く。呼ぶ前に rev の確認を済ませておくこと
async function commitIndex(prefix, current, index) {
  const currentRev = current.exists ? (current.index.rev || 0) : null;

  if (current.exists) {
    const backup = await storageFetch('/object/copy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bucketId: BUCKET,
        sourceKey: `${prefix}index.json`,
        destinationKey: `${prefix}backups/index-${currentRev}-${Date.now()}.json`,
      }),
    });
    if (!backup.ok) throw storageError('Index backup', backup);
  }

  // writer は書き戻し確認用の印。同時に書かれたときに「勝ったのが自分か」を判定する
  const writer = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const next = { ...index, rev: (currentRev || 0) + 1, savedAt: new Date().toISOString(), writer };
  const body = JSON.stringify(next);
  if (Buffer.byteLength(body) > MAX_INDEX_BYTES) {
    return { status: 400, body: { error: '一覧が大きくなりすぎました。ゴミ箱を空にしてください' } };
  }

  // 初回は上書き禁止で作る。同時に別の端末が作っていたら 409 にする
  const write = await storageFetch(`/object/${BUCKET}/${prefix}index.json`, {
    method: current.exists ? 'PUT' : 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-upsert': current.exists ? 'true' : 'false',
      'cache-control': 'no-cache',
    },
    body,
  });
  if (!write.ok) {
    if (!current.exists && /duplicate|already exists/i.test(write.text)) {
      return { status: 409, body: { error: 'conflict', rev: null } };
    }
    throw storageError('Index write', write);
  }

  // 保存先に If-Match が無いので、書けたあとに読み直して自分の書き込みが残っているか確かめる。
  // 別の端末と重なって上書きされていたら 409 にして、呼び出し側にやり直させる
  const verify = await readIndex(prefix);
  if (!verify.exists || verify.index.writer !== writer) {
    return { status: 409, body: { error: 'conflict', rev: verify.exists ? (verify.index.rev || 0) : null } };
  }

  return { status: 200, body: { rev: next.rev, savedAt: next.savedAt } };
}

async function writeIndex({ baseRev = null, index }, prefix) {
  const invalid = validateIndex(index);
  if (invalid) return { status: 400, body: { error: invalid } };

  const current = await readIndex(prefix);
  const currentRev = current.exists ? (current.index.rev || 0) : null;
  if (baseRev !== currentRev) {
    return { status: 409, body: { error: 'conflict', rev: currentRev } };
  }

  if (current.exists) {
    // 削除はゴミ箱フラグで行う。一覧から消えた資料があれば、古い一覧による上書きとみなして拒否する
    const ids = new Set(index.items.map(i => i.id));
    const missing = (current.index.items || []).map(i => i.id).filter(id => !ids.has(id));
    if (missing.length) return { status: 400, body: { error: 'items cannot be removed', missing } };
  }

  return commitIndex(prefix, current, index);
}

// ゴミ箱を空にする。消せるのは今ゴミ箱に入っている資料の一覧行だけで、
// 中身のファイルは保存先に残る(あとから取り戻せる)
async function purgeTrash({ baseRev = null, ids }, prefix) {
  const current = await readIndex(prefix);
  if (!current.exists) return { status: 400, body: { error: 'index not found' } };

  const currentRev = current.index.rev || 0;
  if (baseRev !== currentRev) return { status: 409, body: { error: 'conflict', rev: currentRev } };

  const trashed = new Set((current.index.items || []).filter(i => i.deleted).map(i => i.id));
  const targets = Array.isArray(ids) ? ids.filter(id => trashed.has(id)) : Array.from(trashed);
  if (!targets.length) return { status: 400, body: { error: 'nothing to purge' } };

  const remove = new Set(targets);
  const index = { ...current.index, items: current.index.items.filter(i => !remove.has(i.id)) };
  const result = await commitIndex(prefix, current, index);
  if (result.status === 200) result.body.purged = targets.length;
  return result;
}

// 保存先のパスはクライアントから受け取らず、ここで組み立てる。
// 毎回新しいパスにして上書き不可で署名するので、既存の中身は書き換えられない
async function signUpload({ kind, id, count = 1 }, prefix) {
  if (kind !== 'item' && kind !== 'file') return { status: 400, body: { error: 'invalid kind' } };
  if (!ID_RE.test(id || '')) return { status: 400, body: { error: 'invalid id' } };
  if (!Number.isInteger(count) || count < 1 || count > MAX_PARTS) {
    return { status: 400, body: { error: 'invalid count' } };
  }

  const rev = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const dir = `${prefix}${kind === 'item' ? 'items' : 'files'}/${id}/`;
  const paths = count === 1
    ? [`${dir}${rev}.json`]
    : Array.from({ length: count }, (_, i) => `${dir}${rev}-${i}.json`);

  const uploads = await Promise.all(paths.map(async path => {
    const r = await storageFetch(`/object/upload/sign/${BUCKET}/${path}`, {
      method: 'POST',
      headers: { 'x-upsert': 'false' },
    });
    if (!r.ok) throw storageError('Sign', r);
    return { path, uploadUrl: STORAGE + JSON.parse(r.text).url };
  }));
  return { status: 200, body: { uploads } };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const prefix = libraryPrefix();

    if (req.method === 'GET') {
      const { exists, index } = await readIndex(prefix);
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      return res.status(200).json({ exists, index, publicBase: `${STORAGE}/object/public/${BUCKET}/` });
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      let out;
      if (body.action === 'saveIndex') out = await writeIndex(body, prefix);
      else if (body.action === 'purgeTrash') out = await purgeTrash(body, prefix);
      else if (body.action === 'sign') out = await signUpload(body, prefix);
      else out = { status: 400, body: { error: 'unknown action' } };
      return res.status(out.status).json(out.body);
    }

    return res.status(405).end();
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
