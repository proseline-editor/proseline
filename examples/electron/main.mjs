// Electron main process: one window, a File menu, and file access for the renderer over IPC.
// The renderer never touches Node: it asks for "save these bytes" / "open a file" through the
// preload's contextBridge API (see preload.cjs).
import { app, BrowserWindow, dialog, ipcMain, Menu } from 'electron';
import { readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

const createWindow = () => {
  const window = new BrowserWindow({
    width: 1100,
    height: 760,
    title: 'Proseline',
    webPreferences: { preload: join(here, 'preload.cjs'), contextIsolation: true, sandbox: true },
  });
  void window.loadFile(join(here, 'dist/index.html'));
  return window;
};

ipcMain.handle('file:save', async (event, { name, bytes }) => {
  const owner = BrowserWindow.fromWebContents(event.sender);
  const { canceled, filePath } = await dialog.showSaveDialog(owner, { defaultPath: name });
  if (canceled || !filePath) return null;
  await writeFile(filePath, bytes);
  return filePath;
});

ipcMain.handle('file:open', async (event) => {
  const owner = BrowserWindow.fromWebContents(event.sender);
  const { canceled, filePaths } = await dialog.showOpenDialog(owner, {
    properties: ['openFile'],
    filters: [{ name: 'Manuscripts', extensions: ['docx', 'md', 'markdown', 'html', 'htm'] }],
  });
  if (canceled || !filePaths[0]) return null;
  return { name: basename(filePaths[0]), bytes: new Uint8Array(await readFile(filePaths[0])) };
});

const menu = (window) => {
  const send = (command) => () => window.webContents.send('menu', command);
  return Menu.buildFromTemplate([
    ...(process.platform === 'darwin' ? [{ role: 'appMenu' }] : []),
    {
      label: 'File',
      submenu: [
        { label: 'Open…', accelerator: 'CmdOrCtrl+O', click: send('open') },
        { label: 'Save as Word…', accelerator: 'CmdOrCtrl+S', click: send('save') },
        { type: 'separator' },
        process.platform === 'darwin' ? { role: 'close' } : { role: 'quit' },
      ],
    },
    { role: 'editMenu' },
    { role: 'viewMenu' },
  ]);
};

// A promise chain, not a top-level `await`: with `await app.whenReady()` at the top level,
// Playwright's Electron launcher (used by the e2e tests) timed out waiting for the app.
void app.whenReady().then(() => Menu.setApplicationMenu(menu(createWindow())));
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) Menu.setApplicationMenu(menu(createWindow()));
});
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
