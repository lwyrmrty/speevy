type HeaderNavigationItem = {
  label: string;
  href: string;
  items?: HeaderNavigationItem[];
};

export const simpleItems: HeaderNavigationItem[] = [
  { label: 'Home', href: '/' },
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Projects', href: '/projects' },
  { label: 'Tasks', href: '/tasks' },
  { label: 'Reporting', href: '/reporting' },
  { label: 'Users', href: '/users' },
];

export const dashboardSubItems: HeaderNavigationItem[] = [
  { label: 'Overview', href: '/dashboard/overview' },
  { label: 'Notifications', href: '/dashboard/notifications' },
  { label: 'Analytics', href: '/dashboard/analytics' },
  { label: 'Saved reports', href: '/dashboard/saved-reports' },
  { label: 'Scheduled reports', href: '/dashboard/scheduled-reports' },
  { label: 'User reports', href: '/dashboard/user-reports' },
];
