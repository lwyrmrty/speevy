import Script from 'next/script';

const GLANCE_WIDGET_SRC = 'https://glancethis.com/widget.js';
const GLANCE_WIDGET_ID = '098bfae3-e051-40ea-95cb-75c556d4aacb';

/**
 * Glance support chat widget. Render only on logged-in pages (admin + LP);
 * never on login, join/invite, or guest shared-link views.
 */
export function GlanceChatWidget() {
  return (
    <Script
      src={GLANCE_WIDGET_SRC}
      strategy="lazyOnload"
      data-widget-id={GLANCE_WIDGET_ID}
    />
  );
}
