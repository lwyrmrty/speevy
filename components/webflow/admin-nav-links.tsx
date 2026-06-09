'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

function isNavLinkActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminNavLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const active = isNavLinkActive(pathname, href);

  return (
    <Link
      href={href}
      className={`navlink w-inline-block${active ? ' active' : ''}`}
      aria-current={active ? 'page' : undefined}
    >
      <div>{children}</div>
    </Link>
  );
}
