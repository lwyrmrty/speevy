'use client';

import { useEffect, useState } from 'react';

type SectionMiniNavItem = {
  href: string;
  label: string;
};

export function SectionMiniNav({
  items,
  className = 'innernav',
  linkClassName = 'innerpage-links w-inline-block',
}: {
  items: SectionMiniNavItem[];
  className?: string;
  linkClassName?: string;
}) {
  const [activeHref, setActiveHref] = useState(items[0]?.href ?? '');

  useEffect(() => {
    if (items.length === 0) {
      return undefined;
    }

    const sectionIds = items.map((item) => item.href.replace(/^#/, ''));
    const sections = sectionIds
      .map((id) => document.getElementById(id))
      .filter((section): section is HTMLElement => Boolean(section));

    if (window.location.hash && items.some((item) => item.href === window.location.hash)) {
      setActiveHref(window.location.hash);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntry = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];

        if (visibleEntry?.target.id) {
          setActiveHref(`#${visibleEntry.target.id}`);
        }
      },
      {
        rootMargin: '-20% 0px -70% 0px',
        threshold: 0,
      },
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [items]);

  return (
    <div className={className}>
      {items.map((item) => (
        <a
          key={item.href}
          href={item.href}
          className={`${linkClassName}${activeHref === item.href ? ' w--current' : ''}`}
          onClick={() => setActiveHref(item.href)}
        >
          <div>{item.label}</div>
        </a>
      ))}
    </div>
  );
}
