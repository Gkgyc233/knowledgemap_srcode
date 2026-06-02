// File System Access API — 浏览器本地文件夹读写
// 用 IndexedDB 持久化目录句柄

const DB_NAME = 'knowledge-mindmap-fs';
const DB_VERSION = 1;
const STORE_NAME = 'handles';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => { req.result.createObjectStore(STORE_NAME); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function dbPut(key: string, value: any): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function dbGet(key: string): Promise<any> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** 检查 File System Access API 是否可用 */
export function isFSAvailable(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

/** 弹出文件夹选择器，返回句柄并持久化 */
export async function pickFreshDir(): Promise<FileSystemDirectoryHandle | null> {
  if (!isFSAvailable()) {
    alert('你的浏览器不支持 File System Access API（需 Chrome/Edge 86+）');
    return null;
  }
  try {
    const dirHandle = await (window as any).showDirectoryPicker({ mode: 'readwrite' });
    await dbPut('freshDir', dirHandle);
    await dbPut('freshDirName', dirHandle.name);
    return dirHandle;
  } catch (err: any) {
    if (err.name !== 'AbortError') console.error('目录选择失败:', err);
    return null;
  }
}

/** 获取已存储的目录句柄 */
export async function getStoredDir(): Promise<FileSystemDirectoryHandle | null> {
  if (!isFSAvailable()) return null;
  try {
    const handle = await dbGet('freshDir');
    if (!handle) return null;
    // 验证权限
    const opts: any = { mode: 'readwrite' };
    const ok = await handle.queryPermission(opts) === 'granted' ||
               await handle.requestPermission(opts) === 'granted';
    return ok ? handle : null;
  } catch {
    return null;
  }
}

/** 获取已存储的目录名称 */
export async function getStoredDirName(): Promise<string | null> {
  return await dbGet('freshDirName') || null;
}

/** 清除存储的目录句柄 */
export async function clearStoredDir(): Promise<void> {
  await dbPut('freshDir', null);
  await dbPut('freshDirName', null);
}

/** 获取 fresh/ 子目录句柄 */
async function getFreshSubDir(dirHandle: FileSystemDirectoryHandle): Promise<FileSystemDirectoryHandle> {
  try {
    return await dirHandle.getDirectoryHandle('fresh');
  } catch {
    // 如果 fresh/ 不存在，创建它
    return await dirHandle.getDirectoryHandle('fresh', { create: true });
  }
}

/** 获取 fresh/processed/ 子目录句柄 */
async function getProcessedSubDir(dirHandle: FileSystemDirectoryHandle): Promise<FileSystemDirectoryHandle> {
  const freshDir = await getFreshSubDir(dirHandle);
  try {
    return await freshDir.getDirectoryHandle('processed');
  } catch {
    return await freshDir.getDirectoryHandle('processed', { create: true });
  }
}

/** 获取 fresh/SavedSelections/ 子目录句柄 */
async function getSavedSelectionsDir(dirHandle: FileSystemDirectoryHandle): Promise<FileSystemDirectoryHandle | null> {
  try {
    const freshDir = await getFreshSubDir(dirHandle);
    return await freshDir.getDirectoryHandle('SavedSelections');
  } catch {
    return null;
  }
}

/** 读取目录中所有 JSON 文件的文本内容 */
async function readJsonFiles(
  dirHandle: FileSystemDirectoryHandle
): Promise<Array<{ name: string; text: string }>> {
  const results: Array<{ name: string; text: string }> = [];
  for await (const [name, handle] of (dirHandle as any).entries()) {
    if (handle.kind === 'file' && name.endsWith('.json')) {
      try {
        const file = await (handle as FileSystemFileHandle).getFile();
        const text = await file.text();
        results.push({ name, text });
      } catch { /* 跳过无法读取的文件 */ }
    }
  }
  return results;
}

/** 读取文件内容 */
async function readFileContent(subDir: FileSystemDirectoryHandle, fileName: string): Promise<string> {
  const fileHandle = await subDir.getFileHandle(fileName);
  const file = await fileHandle.getFile();
  return await file.text();
}

/** 写入文件 */
async function writeFile(subDir: FileSystemDirectoryHandle, fileName: string, content: string): Promise<void> {
  const fileHandle = await subDir.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(content);
  await writable.close();
}

/** 删除文件 */
async function deleteFile(subDir: FileSystemDirectoryHandle, fileName: string): Promise<void> {
  await subDir.removeEntry(fileName);
}

// ---- 导出的高级 API ----

export interface FSEntry {
  name: string;
  text: string;
}

/** 列出 fresh/ 中的所有 JSON 文件 */
export async function fsListFresh(dirHandle: FileSystemDirectoryHandle): Promise<FSEntry[]> {
  const freshDir = await getFreshSubDir(dirHandle);
  return readJsonFiles(freshDir);
}

/** 列出 fresh/SavedSelections/ 中的所有 JSON 文件 */
export async function fsListSavedSelections(dirHandle: FileSystemDirectoryHandle): Promise<FSEntry[]> {
  const ssDir = await getSavedSelectionsDir(dirHandle);
  if (!ssDir) return [];
  return readJsonFiles(ssDir);
}

/** 列出 fresh/processed/ 中的所有 JSON 文件 */
export async function fsListProcessed(dirHandle: FileSystemDirectoryHandle): Promise<FSEntry[]> {
  const processedDir = await getProcessedSubDir(dirHandle);
  return readJsonFiles(processedDir);
}

/** 移动到已处理（从 fresh/ 到 fresh/processed/） */
export async function fsMoveToProcessed(dirHandle: FileSystemDirectoryHandle, fileName: string): Promise<void> {
  const freshDir = await getFreshSubDir(dirHandle);
  const processedDir = await getProcessedSubDir(dirHandle);
  const content = await readFileContent(freshDir, fileName);
  await writeFile(processedDir, fileName, content);
  await deleteFile(freshDir, fileName);
}

/** 从已处理移回草稿 */
export async function fsRestoreFromProcessed(dirHandle: FileSystemDirectoryHandle, fileName: string): Promise<void> {
  const freshDir = await getFreshSubDir(dirHandle);
  const processedDir = await getProcessedSubDir(dirHandle);
  const content = await readFileContent(processedDir, fileName);
  await writeFile(freshDir, fileName, content);
  await deleteFile(processedDir, fileName);
}

/** 从已处理删除 */
export async function fsDeleteProcessed(dirHandle: FileSystemDirectoryHandle, fileName: string): Promise<void> {
  const processedDir = await getProcessedSubDir(dirHandle);
  await deleteFile(processedDir, fileName);
}

/** 从草稿箱删除 */
export async function fsDeleteDraft(dirHandle: FileSystemDirectoryHandle, fileName: string): Promise<void> {
  const freshDir = await getFreshSubDir(dirHandle);
  await deleteFile(freshDir, fileName);
}
