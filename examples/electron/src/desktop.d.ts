// The API preload.cjs exposes on window.desktop.
interface DesktopApi {
  /** Shows a save dialog and writes the bytes; resolves with the path, or null when cancelled. */
  saveFile(name: string, bytes: Uint8Array): Promise<string | null>;
  /** Shows an open dialog; resolves with the file, or null when cancelled. */
  openFile(): Promise<{ name: string; bytes: Uint8Array } | null>;
  /** Menu commands (`open`, `save`); returns an unsubscribe function. */
  onMenu(callback: (command: 'open' | 'save') => void): () => void;
}

interface Window {
  desktop: DesktopApi;
}
