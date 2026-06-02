// 统一草稿 API — Electron > FS Access > localStorage+上传

import type { DraftJson, DraftEntry } from './types';
import {
  isFSAvailable,
  getStoredDir,
  fsListFresh,
  fsListSavedSelections,
  fsListProcessed,
  fsMoveToProcessed,
  fsRestoreFromProcessed,
  fsDeleteProcessed,
  fsDeleteDraft,
} from './fsaccess';
import { normalizeLaTeX } from '../utils';

// 判断当前环境
const isElectron = (): boolean =>
  typeof window !== 'undefined' &&
  !!(window as any).draftFS;

const isFSAccess = async (): Promise<boolean> =>
  isFSAvailable() && !!(await getStoredDir());

// ---- Electron API ----

async function electronListDrafts(): Promise<DraftEntry[]> {
  const fs = (window as any).draftFS;
  const files: Array<{ name: string; path: string }> = await fs.listDrafts();
  const entries: DraftEntry[] = [];
  for (const f of files) {
    try {
      const raw = await fs.readFile(f.path);
      const data: DraftJson = JSON.parse(raw);
      entries.push({ name: f.name, path: f.path, data, processed: false });
    } catch { /* 跳过解析失败的文件 */ }
  }
  return entries;
}

async function electronListProcessed(): Promise<DraftEntry[]> {
  const fs = (window as any).draftFS;
  const files: Array<{ name: string; path: string }> = await fs.listProcessed();
  const entries: DraftEntry[] = [];
  for (const f of files) {
    try {
      const raw = await fs.readFile(f.path);
      const data: DraftJson = JSON.parse(raw);
      entries.push({ name: f.name, path: f.path, data, processed: true });
    } catch { /* 跳过 */ }
  }
  return entries;
}

async function electronMoveToProcessed(filePath: string): Promise<void> {
  await (window as any).draftFS.moveToProcessed(filePath);
}

async function electronDeleteFile(filePath: string): Promise<void> {
  await (window as any).draftFS.deleteFile(filePath);
}

async function electronGetFreshDir(): Promise<string> {
  return await (window as any).draftFS.getFreshDir();
}

// ---- Web API (localStorage + 文件上传) ----

const WEB_STORAGE_KEY = 'draft_processed_files';

function getProcessedSet(): Set<string> {
  try {
    const raw = localStorage.getItem(WEB_STORAGE_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch { return new Set(); }
}

function saveProcessedSet(s: Set<string>) {
  localStorage.setItem(WEB_STORAGE_KEY, JSON.stringify([...s]));
}

async function webLoadFromFiles(files: File[]): Promise<{ drafts: DraftEntry[]; processed: DraftEntry[] }> {
  const processedSet = getProcessedSet();
  const drafts: DraftEntry[] = [];
  const processed: DraftEntry[] = [];

  for (const file of files) {
    try {
      const raw = await file.text();
      const data: DraftJson = JSON.parse(raw);
      const entry: DraftEntry = {
        name: file.name,
        path: file.name,
        data,
        processed: processedSet.has(file.name),
      };
      if (entry.processed) processed.push(entry);
      else drafts.push(entry);
    } catch { /* 跳过 */ }
  }
  return { drafts, processed };
}

function webMarkProcessed(name: string) {
  const s = getProcessedSet();
  s.add(name);
  saveProcessedSet(s);
}

function webUnmarkProcessed(name: string) {
  const s = getProcessedSet();
  s.delete(name);
  saveProcessedSet(s);
}

function webDeleteFromProcessed(name: string) {
  const s = getProcessedSet();
  s.delete(name);
  saveProcessedSet(s);
}

// ---- FS Access API - 浏览器直接读写文件夹 ----

async function fsListDrafts(): Promise<DraftEntry[]> {
  const dirHandle = await getStoredDir();
  if (!dirHandle) return [];
  const freshFiles = await fsListFresh(dirHandle);
  const ssFiles = await fsListSavedSelections(dirHandle);
  // fresh/ 根目录文件
  const entries: DraftEntry[] = freshFiles.map(f => ({
    name: f.name,
    path: f.name,
    data: JSON.parse(f.text) as DraftJson,
    processed: false,
  }));
  // fresh/SavedSelections/ 文件（标记来源）
  for (const f of ssFiles) {
    entries.push({
      name: `[SavedSelections] ${f.name}`,
      path: `SavedSelections/${f.name}`,
      data: JSON.parse(f.text) as DraftJson,
      processed: false,
    });
  }
  return entries;
}

async function fsListProcessedEntries(): Promise<DraftEntry[]> {
  const dirHandle = await getStoredDir();
  if (!dirHandle) return [];
  const files = await fsListProcessed(dirHandle);
  return files.map(f => ({
    name: f.name,
    path: f.name,
    data: JSON.parse(f.text) as DraftJson,
    processed: true,
  }));
}

async function fsMarkProcessed(fileName: string): Promise<void> {
  const dirHandle = await getStoredDir();
  if (!dirHandle) return;
  await fsMoveToProcessed(dirHandle, fileName);
}

async function fsRestoreProcessed(fileName: string): Promise<void> {
  const dirHandle = await getStoredDir();
  if (!dirHandle) return;
  await fsRestoreFromProcessed(dirHandle, fileName);
}

async function fsDeleteProcessedFile(fileName: string, isProcessed: boolean): Promise<void> {
  const dirHandle = await getStoredDir();
  if (!dirHandle) return;
  if (isProcessed) await fsDeleteProcessed(dirHandle, fileName);
  else await fsDeleteDraft(dirHandle, fileName);
}

// ---- 统一导出 ----

export async function listDrafts(existingFiles?: File[]): Promise<DraftEntry[]> {
  if (isElectron()) return electronListDrafts();
  if (await isFSAccess()) return fsListDrafts();
  if (existingFiles) {
    const { drafts } = await webLoadFromFiles(existingFiles);
    return drafts;
  }
  return [];
}

export async function listProcessed(existingFiles?: File[]): Promise<DraftEntry[]> {
  if (isElectron()) return electronListProcessed();
  if (await isFSAccess()) return fsListProcessedEntries();
  if (existingFiles) {
    const { processed } = await webLoadFromFiles(existingFiles);
    return processed;
  }
  return [];
}

export async function markProcessed(entry: DraftEntry): Promise<void> {
  if (isElectron()) {
    await electronMoveToProcessed(entry.path);
  } else if (await isFSAccess()) {
    await fsMarkProcessed(entry.name);
  } else {
    webMarkProcessed(entry.name);
  }
}

export async function unmarkProcessed(entry: DraftEntry): Promise<void> {
  if (isElectron()) {
    // Electron: 暂不实现反向移动
  } else if (await isFSAccess()) {
    await fsRestoreProcessed(entry.name);
  } else {
    webUnmarkProcessed(entry.name);
  }
}

export async function deleteDraftFile(entry: DraftEntry): Promise<void> {
  if (isElectron()) {
    await electronDeleteFile(entry.path);
  } else if (await isFSAccess()) {
    await fsDeleteProcessedFile(entry.name, entry.processed);
  } else {
    webDeleteFromProcessed(entry.name);
  }
}

export async function getFreshDir(): Promise<string | null> {
  if (isElectron()) return electronGetFreshDir();
  return null;
}

export function isElectronEnv(): boolean {
  return isElectron();
}

export { isFSAvailable, pickFreshDir, getStoredDir, getStoredDirName, clearStoredDir } from './fsaccess';

/** 从草稿生成笔记「内容」字段：优先使用 html（含 \(...\) 公式），规范化后用于 KaTeX 渲染 */
export function entryToNoteContent(entry: DraftEntry): string {
  const { data } = entry;
  const parts: string[] = [];
  if (data.title) parts.push(`来源: ${data.title}`);
  if (data.url) parts.push(`URL: ${data.url}`);
  if (data.savedAt) parts.push(`保存时间: ${data.savedAt}`);
  // 优先使用 html 字段（含 \(...\) 公式标记），规范化后转 $...$ 供 KaTeX
  const body = data.html
    ? normalizeLaTeX(data.html)
    : data.text || '';
  if (body) parts.push(`\n原文:\n${body}`);
  return parts.join('\n');
}

/** 从草稿生成笔记「批注」字段：仅 annotation */
export function entryToNoteAnnotation(entry: DraftEntry): string {
  return entry.data.annotation || '';
}

/** @deprecated 使用 entryToNoteContent + entryToNoteAnnotation 替代 */
export function entryToNoteText(entry: DraftEntry): string {
  const parts: string[] = [entryToNoteContent(entry)];
  const ann = entryToNoteAnnotation(entry);
  if (ann) parts.push(`\n批注:\n${ann}`);
  return parts.join('\n');
}
