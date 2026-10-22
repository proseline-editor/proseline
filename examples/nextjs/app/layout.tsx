import type { ReactNode } from 'react';
import '@proseline-editor/react/theme.css';
import './globals.css';

export const metadata = { title: 'Proseline — Next.js example' };

const RootLayout = ({ children }: { children: ReactNode }) => (
  <html lang="en">
    <body>{children}</body>
  </html>
);

export default RootLayout;
