'use client';

import { usePathname } from 'next/navigation';

import { HeaderNavigationBase } from '@/components/application/app-navigation/header-navigation';
import { simpleItems } from '@/components/application/app-navigation/navigation-items';

export function MainNavigation() {
  const pathname = usePathname() ?? '/';

  return <HeaderNavigationBase activeUrl={pathname} items={simpleItems} />;
}

export const HeaderNavigationSimpleDemo = () => (
  <HeaderNavigationBase activeUrl="/dashboard" items={simpleItems} />
);
