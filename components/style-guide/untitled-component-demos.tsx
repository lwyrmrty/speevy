'use client';

import { Dropdown } from '@/components/base/dropdown/dropdown';
import { HeaderNavigationBase } from '@/components/application/app-navigation/header-navigation';
import {
  dashboardSubItems,
  simpleItems,
} from '@/components/application/app-navigation/navigation-items';

export function DropdownDemo() {
  return (
    <Dropdown.Root>
      <Dropdown.DotsButton />
      <Dropdown.Popover>
        <Dropdown.Menu selectionMode="single" defaultSelectedKeys={['can-edit']}>
          <Dropdown.Item id="view" label="View opportunity" />
          <Dropdown.Item id="can-edit" label="Can edit" />
          <Dropdown.Item id="manage" label="Manage access" />
          <Dropdown.Separator />
          <Dropdown.Item id="archive" label="Archive" />
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown.Root>
  );
}

export function HeaderNavigationDemo() {
  return (
    <HeaderNavigationBase
      activeUrl="/dashboard/analytics"
      items={simpleItems}
      subItems={dashboardSubItems}
    />
  );
}
