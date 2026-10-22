// The only bridge between the sandboxed renderer and the main process (CommonJS: sandboxed preloads
// cannot be ES modules).
// eslint-disable-next-line @typescript-eslint/no-require-imports -- sandboxed preloads are CommonJS
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktop', {
  saveFile: (name, bytes) => ipcRenderer.invoke('file:save', { name, bytes }),
  openFile: () => ipcRenderer.invoke('file:open'),
  onMenu: (callback) => {
    const listener = (_event, command) => callback(command);
    ipcRenderer.on('menu', listener);
    return () => ipcRenderer.off('menu', listener);
  },
});
