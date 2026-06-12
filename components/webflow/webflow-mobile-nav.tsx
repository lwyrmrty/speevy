'use client';

import { useEffect, useId, useState, type ReactNode } from 'react';

export function WebflowMobileNavMenu({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  useEffect(() => {
    if (!open) {
      return;
    }

    const closeOnDesktop = () => {
      if (window.innerWidth > 991) {
        setOpen(false);
      }
    };

    window.addEventListener('resize', closeOnDesktop);
    return () => window.removeEventListener('resize', closeOnDesktop);
  }, [open]);

  return (
    <>
      <button
        type="button"
        className="speevy-mobile-nav-toggle"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? 'Close navigation menu' : 'Open navigation menu'}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="speevy-mobile-nav-toggle-bar" aria-hidden="true" />
        <span className="speevy-mobile-nav-toggle-bar" aria-hidden="true" />
        <span className="speevy-mobile-nav-toggle-bar" aria-hidden="true" />
      </button>
      <div
        id={panelId}
        className={`speevy-mobile-nav-panel${open ? ' is-open' : ''}`}
        onClick={(event) => {
          if (event.target instanceof HTMLAnchorElement) {
            setOpen(false);
          }
        }}
      >
        {children}
      </div>
    </>
  );
}
