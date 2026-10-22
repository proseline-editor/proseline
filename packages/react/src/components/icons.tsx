import type { ReactNode } from 'react';

/** 20px stroke icons drawn on a 24×24 grid; they inherit `currentColor`. */
const Svg = ({ children }: { children: ReactNode }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);

const lines = (rows: [number, number][]) => rows.map(([x1, x2], i) => <line key={i} x1={x1} x2={x2} y1={6 + i * 4} y2={6 + i * 4} />);

export const icons = {
  undo: <Svg><path d="M9 14 4 9l5-5" /><path d="M4 9h10a6 6 0 0 1 0 12h-3" /></Svg>,
  redo: <Svg><path d="m15 14 5-5-5-5" /><path d="M20 9H10a6 6 0 0 0 0 12h3" /></Svg>,
  bold: <Svg><path d="M7 5h6a3.5 3.5 0 0 1 0 7H7zM7 12h7a3.5 3.5 0 0 1 0 7H7z" /></Svg>,
  italic: <Svg><line x1="19" y1="4" x2="10" y2="4" /><line x1="14" y1="20" x2="5" y2="20" /><line x1="15" y1="4" x2="9" y2="20" /></Svg>,
  underline: <Svg><path d="M6 4v6a6 6 0 0 0 12 0V4" /><line x1="4" y1="21" x2="20" y2="21" /></Svg>,
  strike: <Svg><path d="M16 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H7" /><line x1="4" y1="12" x2="20" y2="12" /></Svg>,
  blockquote: <Svg><path d="M7 7H4v5h3v-1a4 4 0 0 1-3 4M17 7h-3v5h3v-1a4 4 0 0 1-3 4" /></Svg>,
  bulletList: <Svg><line x1="9" y1="6" x2="20" y2="6" /><line x1="9" y1="12" x2="20" y2="12" /><line x1="9" y1="18" x2="20" y2="18" /><circle cx="4.5" cy="6" r="1" /><circle cx="4.5" cy="12" r="1" /><circle cx="4.5" cy="18" r="1" /></Svg>,
  orderedList: <Svg><line x1="10" y1="6" x2="20" y2="6" /><line x1="10" y1="12" x2="20" y2="12" /><line x1="10" y1="18" x2="20" y2="18" /><path d="M4 4h1v4M4 8h2M4 14.5a1.5 1.5 0 0 1 3 0c0 1-3 2-3 3.5h3" /></Svg>,
  sceneBreak: <Svg><circle cx="6" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="18" cy="12" r="1" /></Svg>,
  alignLeft: <Svg>{lines([[4, 20], [4, 14], [4, 20], [4, 14]])}</Svg>,
  alignCenter: <Svg>{lines([[4, 20], [7, 17], [4, 20], [7, 17]])}</Svg>,
  alignRight: <Svg>{lines([[4, 20], [10, 20], [4, 20], [10, 20]])}</Svg>,
  alignJustify: <Svg>{lines([[4, 20], [4, 20], [4, 20], [4, 20]])}</Svg>,
  flush: <Svg><line x1="4" y1="6" x2="20" y2="6" /><line x1="4" y1="10" x2="20" y2="10" /><line x1="4" y1="14" x2="20" y2="14" /><path d="M4 18h9M4 3v3" /></Svg>,
  comment: <Svg><path d="M4 5h16v11H9l-5 4z" /></Svg>,
  style: <Svg><path d="M4 19h7M7.5 19 12 5l4.5 14M9 14h6" /><path d="m15 9 2 2 4-4" /></Svg>,
  search: <Svg><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16" y2="16" /></Svg>,
  chevronUp: <Svg><path d="m6 15 6-6 6 6" /></Svg>,
  chevronDown: <Svg><path d="m6 9 6 6 6-6" /></Svg>,
  close: <Svg><line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" /></Svg>,
  typewriter: <Svg><rect x="3" y="10" width="18" height="10" rx="2" /><path d="M7 10V4h10v6M7 15h10" /></Svg>,
  fullscreen: <Svg><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></Svg>,
} as const;

export type IconName = keyof typeof icons;
