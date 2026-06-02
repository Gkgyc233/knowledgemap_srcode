// Electron 主进程
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const http = require('http');
const fs = require('fs');

// ---- 单实例锁 ----
// 防止用户同时打开多个程序导致端口冲突
const gotSingleLock = app.requestSingleInstanceLock();
if (!gotSingleLock) {
  // 已有实例在运行，直接退出（让系统激活已有窗口）
  app.quit();
  return;
}

// ---- GPU 兼容（Win11 常见问题：窗口显示但输入框无响应） ----
// 部分 Windows 11 机器（尤其 Intel 核显）的 GPU 驱动与 Chromium 渲染不兼容
// 窗口能显示画面，但不处理鼠标/键盘事件。关闭硬件加速可以解决。
app.disableHardwareAcceleration();

let mainWindow = null;
let server = null;

// ---- 配置存储 ----
let configPath = null;
function getConfigPath() {
  if (!configPath) configPath = path.join(app.getPath('userData'), 'config.json');
  return configPath;
}
function loadConfig() {
  try { return JSON.parse(fs.readFileSync(getConfigPath(), 'utf-8')); } catch { return {}; }
}
function saveConfig(cfg) {
  fs.writeFileSync(getConfigPath(), JSON.stringify(cfg, null, 2), 'utf-8');
}

// ---- IPC 处理器 ----
function setupIPC() {
  ipcMain.handle('draft:getFreshDir', () => {
    const cfg = loadConfig();
    const downloads = app.getPath('downloads');
    return cfg.freshDir || path.join(downloads, 'fresh');
  });

  ipcMain.handle('draft:getDownloadsDir', () => {
    return app.getPath('downloads');
  });

  ipcMain.handle('draft:listDrafts', () => {
    const cfg = loadConfig();
    const downloads = app.getPath('downloads');
    const freshDir = cfg.freshDir || path.join(downloads, 'fresh');
    try {
      if (!fs.existsSync(freshDir)) return [];
      return fs.readdirSync(freshDir)
        .filter(f => f.endsWith('.json'))
        .map(f => ({ name: f, path: path.join(freshDir, f) }));
    } catch { return []; }
  });

  ipcMain.handle('draft:listProcessed', () => {
    const cfg = loadConfig();
    const downloads = app.getPath('downloads');
    const freshDir = cfg.freshDir || path.join(downloads, 'fresh');
    const processedDir = path.join(freshDir, 'processed');
    try {
      if (!fs.existsSync(processedDir)) return [];
      return fs.readdirSync(processedDir)
        .filter(f => f.endsWith('.json'))
        .map(f => ({ name: f, path: path.join(processedDir, f) }));
    } catch { return []; }
  });

  ipcMain.handle('draft:readFile', (_event, filePath) => {
    return fs.readFileSync(filePath, 'utf-8');
  });

  ipcMain.handle('draft:moveToProcessed', (_event, filePath) => {
    const cfg = loadConfig();
    const downloads = app.getPath('downloads');
    const freshDir = cfg.freshDir || path.join(downloads, 'fresh');
    const processedDir = path.join(freshDir, 'processed');
    if (!fs.existsSync(processedDir)) fs.mkdirSync(processedDir, { recursive: true });
    const dest = path.join(processedDir, path.basename(filePath));
    fs.renameSync(filePath, dest);
    return dest;
  });

  ipcMain.handle('draft:deleteFile', (_event, filePath) => {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    return true;
  });

  ipcMain.handle('config:get', (_event, key) => {
    const cfg = loadConfig();
    return cfg[key] ?? null;
  });
  ipcMain.handle('config:set', (_event, key, value) => {
    const cfg = loadConfig();
    cfg[key] = value;
    saveConfig(cfg);
  });
}

// ---- 静态文件服务器 ----
function startServer(distPath, port) {
  const mimeTypes = {
    '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
    '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
    '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml',
  };
  server = http.createServer((req, res) => {
    let filePath = path.join(distPath, req.url === '/' ? 'index.html' : req.url.split('?')[0]);
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      if (req.url.startsWith('/assets/')) {
        const assetName = path.basename(req.url.split('?')[0]);
        const candidates = fs.readdirSync(path.join(distPath, 'assets'));
        const match = candidates.find((f) => f.startsWith(assetName.split('.')[0]));
        if (match) filePath = path.join(distPath, 'assets', match);
      }
      if (!fs.existsSync(filePath)) filePath = path.join(distPath, 'index.html');
    }
    const ext = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    try {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(fs.readFileSync(filePath));
    } catch {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(fs.readFileSync(path.join(distPath, 'index.html')));
    }
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve(port)));
}

async function createWindow() {
  const distPath = path.join(__dirname, '..', 'dist');
  const port = 21843;
  await startServer(distPath, port);

  mainWindow = new BrowserWindow({
    width: 1400, height: 900,
    minWidth: 900, minHeight: 600,
    title: '知识导图 - Knowledge MindMap',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });
  mainWindow.loadURL(`http://127.0.0.1:${port}`);
  mainWindow.setMenuBarVisibility(false);
  mainWindow.on('closed', () => { mainWindow = null; });
}

setupIPC();

// 再次打开程序时，激活已有窗口而不是新建
app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.whenReady().then(createWindow);
app.on('window-all-closed', () => {
  if (server) server.close();
  if (process.platform !== 'darwin') app.quit();
});
app.on('activate', () => {
  if (mainWindow === null) createWindow();
});
