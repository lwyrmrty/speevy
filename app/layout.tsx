import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Speevy | Harpoon Ventures',
  description: 'Internal LP portal for Harpoon SPV opportunities.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
