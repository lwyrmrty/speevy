import type { Metadata, Viewport } from 'next';
import './globals.css';

import { ToastProvider } from '@/components/ui/toast';

export const metadata: Metadata = {
  title: 'Harpoon - Opportunities',
  description: 'Internal LP portal for Harpoon SPV opportunities.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
