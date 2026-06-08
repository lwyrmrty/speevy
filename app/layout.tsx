import type { Metadata } from 'next';
import './globals.css';

import { ToastProvider } from '@/components/ui/toast';

export const metadata: Metadata = {
  title: 'Harpoon - Opportunities',
  description: 'Internal LP portal for Harpoon SPV opportunities.',
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
