import { h, type VNode } from 'vue';

type Shape = [tag: string, attrs: Record<string, string | number>];

/** 20px stroke icons drawn on a 24×24 grid; they inherit `currentColor`. Same drawings as the React package. */
const svg = (shapes: Shape[]) => (): VNode =>
  h(
    'svg',
    { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' },
    shapes.map(([tag, attrs]) => h(tag, attrs)),
  );

const path = (d: string): Shape => ['path', { d }];
const line = (x1: number, y1: number, x2: number, y2: number): Shape => ['line', { x1, y1, x2, y2 }];
const circle = (cx: number, cy: number, r: number): Shape => ['circle', { cx, cy, r }];
const lines = (rows: [number, number][]): Shape[] => rows.map(([x1, x2], i) => line(x1, 6 + i * 4, x2, 6 + i * 4));

/** Icon render functions: `icons.bold()` returns a fresh SVG vnode. */
export const icons = {
  undo: svg([path('M9 14 4 9l5-5'), path('M4 9h10a6 6 0 0 1 0 12h-3')]),
  redo: svg([path('m15 14 5-5-5-5'), path('M20 9H10a6 6 0 0 0 0 12h3')]),
  bold: svg([path('M7 5h6a3.5 3.5 0 0 1 0 7H7zM7 12h7a3.5 3.5 0 0 1 0 7H7z')]),
  italic: svg([line(19, 4, 10, 4), line(14, 20, 5, 20), line(15, 4, 9, 20)]),
  underline: svg([path('M6 4v6a6 6 0 0 0 12 0V4'), line(4, 21, 20, 21)]),
  strike: svg([path('M16 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H7'), line(4, 12, 20, 12)]),
  blockquote: svg([path('M7 7H4v5h3v-1a4 4 0 0 1-3 4M17 7h-3v5h3v-1a4 4 0 0 1-3 4')]),
  bulletList: svg([line(9, 6, 20, 6), line(9, 12, 20, 12), line(9, 18, 20, 18), circle(4.5, 6, 1), circle(4.5, 12, 1), circle(4.5, 18, 1)]),
  orderedList: svg([line(10, 6, 20, 6), line(10, 12, 20, 12), line(10, 18, 20, 18), path('M4 4h1v4M4 8h2M4 14.5a1.5 1.5 0 0 1 3 0c0 1-3 2-3 3.5h3')]),
  sceneBreak: svg([circle(6, 12, 1), circle(12, 12, 1), circle(18, 12, 1)]),
  alignLeft: svg(lines([[4, 20], [4, 14], [4, 20], [4, 14]])),
  alignCenter: svg(lines([[4, 20], [7, 17], [4, 20], [7, 17]])),
  alignRight: svg(lines([[4, 20], [10, 20], [4, 20], [10, 20]])),
  alignJustify: svg(lines([[4, 20], [4, 20], [4, 20], [4, 20]])),
  flush: svg([line(4, 6, 20, 6), line(4, 10, 20, 10), line(4, 14, 20, 14), path('M4 18h9M4 3v3')]),
  comment: svg([path('M4 5h16v11H9l-5 4z')]),
  style: svg([path('M4 19h7M7.5 19 12 5l4.5 14M9 14h6'), path('m15 9 2 2 4-4')]),
  search: svg([circle(11, 11, 7), line(21, 21, 16, 16)]),
  chevronUp: svg([path('m6 15 6-6 6 6')]),
  chevronDown: svg([path('m6 9 6 6 6-6')]),
  close: svg([line(6, 6, 18, 18), line(18, 6, 6, 18)]),
  typewriter: svg([['rect', { x: 3, y: 10, width: 18, height: 10, rx: 2 }], path('M7 10V4h10v6M7 15h10')]),
  fullscreen: svg([path('M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5')]),
} as const;

export type IconName = keyof typeof icons;
