// Electron preload — 通过 contextBridge 安全暴露文件系统 API 给渲染进程

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('draftFS', {
  /** 获取 fresh/ 文件夹路径（从设置读取，默认 Downloads/fresh） */
  getFreshDir: () => ipcRenderer.invoke('draft:getFreshDir'),

  /** 列出 fresh/ 下所有 .json 文件（未处理） */
  listDrafts: () => ipcRenderer.invoke('draft:listDrafts'),

  /** 列出 fresh/processed/ 下所有 .json 文件（已处理） */
  listProcessed: () => ipcRenderer.invoke('draft:listProcessed'),

  /** 读取单个 .json 文件的完整内容 */
  readFile: (filePath) => ipcRenderer.invoke('draft:readFile', filePath),

  /** 将文件从 fresh/ 移动到 fresh/processed/（标记已处理） */
  moveToProcessed: (filePath) => ipcRenderer.invoke('draft:moveToProcessed', filePath),

  /** 删除文件 */
  deleteFile: (filePath) => ipcRenderer.invoke('draft:deleteFile', filePath),

  /** 获取默认下载目录 */
  getDownloadsDir: () => ipcRenderer.invoke('draft:getDownloadsDir'),
});

contextBridge.exposeInMainWorld('appConfig', {
  /** 读取/写入程序设置（freshDir 等） */
  getSetting: (key) => ipcRenderer.invoke('config:get', key),
  setSetting: (key, value) => ipcRenderer.invoke('config:set', key, value),
});
