import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
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
        <Script id="speevy-isolate-turnstile" strategy="beforeInteractive">
          {`(function(){function g(e){try{var m=String(e&&(e.message||(e.error&&e.error.message)||""));var f=String(e&&e.filename||"");if(/turnstile|challenges\\.cloudflare\\.com/i.test(m+" "+f)){e.preventDefault();e.stopImmediatePropagation();}}catch(x){}}window.addEventListener("error",g,true);window.addEventListener("unhandledrejection",function(e){try{var r=e&&e.reason;var m=String((r&&r.message)||r||"");if(/turnstile|cloudflare/i.test(m)){e.preventDefault();e.stopImmediatePropagation();}}catch(x){}},true);})();`}
        </Script>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
