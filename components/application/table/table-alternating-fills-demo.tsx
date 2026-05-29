'use client';

import { useMemo, useState } from 'react';
import { Edit01, Trash01 } from '@untitledui/icons';
import type { SortDescriptor } from 'react-aria-components';

import { PaginationPageMinimalCenter } from '@/components/application/pagination/pagination';
import { Table, TableCard } from '@/components/application/table/table';
import { Avatar } from '@/components/base/avatar/avatar';
import type { BadgeColors } from '@/components/base/badges/badge-types';
import { Badge, BadgeWithDot } from '@/components/base/badges/badges';
import { Button } from '@/components/base/buttons/button';
import { Dropdown } from '@/components/base/dropdown/dropdown';

type Team = {
  name: string;
  color: BadgeColors;
};

type TeamMember = {
  username: string;
  name: string;
  initials: string;
  status: 'active' | 'inactive';
  role: string;
  email: string;
  teams: Team[];
};

type SortableColumn = 'name' | 'status' | 'role' | 'email';

const teamMembers: TeamMember[] = [
  {
    username: '@avery',
    name: 'Avery Brooks',
    initials: 'AB',
    status: 'active',
    role: 'Managing partner',
    email: 'avery@harpoon.vc',
    teams: [
      { name: 'Admin', color: 'brand' },
      { name: 'SPVs', color: 'blue' },
      { name: 'Legal', color: 'purple' },
    ],
  },
  {
    username: '@morgan',
    name: 'Morgan Chen',
    initials: 'MC',
    status: 'active',
    role: 'Investor relations',
    email: 'morgan@harpoon.vc',
    teams: [
      { name: 'LPs', color: 'success' },
      { name: 'Docs', color: 'orange' },
      { name: 'Ops', color: 'gray' },
      { name: 'Email', color: 'pink' },
    ],
  },
  {
    username: '@jamie',
    name: 'Jamie Patel',
    initials: 'JP',
    status: 'inactive',
    role: 'Finance lead',
    email: 'jamie@harpoon.vc',
    teams: [
      { name: 'Finance', color: 'warning' },
      { name: 'Audit', color: 'slate' },
    ],
  },
  {
    username: '@taylor',
    name: 'Taylor Reed',
    initials: 'TR',
    status: 'active',
    role: 'Platform associate',
    email: 'taylor@harpoon.vc',
    teams: [
      { name: 'Platform', color: 'sky' },
      { name: 'SPVs', color: 'blue' },
      { name: 'LPs', color: 'success' },
    ],
  },
  {
    username: '@casey',
    name: 'Casey Nguyen',
    initials: 'CN',
    status: 'inactive',
    role: 'Operations',
    email: 'casey@harpoon.vc',
    teams: [
      { name: 'Ops', color: 'gray' },
      { name: 'KYC', color: 'indigo' },
    ],
  },
];

const sortAccessors: Record<SortableColumn, (member: TeamMember) => string> = {
  name: (member) => member.name,
  status: (member) => member.status,
  role: (member) => member.role,
  email: (member) => member.email,
};

function isSortableColumn(column: unknown): column is SortableColumn {
  return (
    column === 'name' ||
    column === 'status' ||
    column === 'role' ||
    column === 'email'
  );
}

export function TableAlternatingFillsDemo() {
  const [sortDescriptor, setSortDescriptor] = useState<SortDescriptor>({
    column: 'status',
    direction: 'ascending',
  });

  const sortedItems = useMemo(() => {
    const column = isSortableColumn(sortDescriptor.column)
      ? sortDescriptor.column
      : 'status';
    const accessor = sortAccessors[column];

    return [...teamMembers].sort((first, second) => {
      const result = accessor(first).localeCompare(accessor(second));

      return sortDescriptor.direction === 'descending' ? result * -1 : result;
    });
  }, [sortDescriptor]);

  return (
    <TableCard.Root>
      <TableCard.Header
        title="Team members"
        badge="100 users"
        contentTrailing={
          <div className="absolute top-5 right-4 md:right-6">
            <Dropdown.Root>
              <Dropdown.DotsButton />
              <Dropdown.Popover className="w-min">
                <Dropdown.Menu>
                  <Dropdown.Item id="export" label="Export users" />
                  <Dropdown.Item id="invite" label="Invite member" />
                </Dropdown.Menu>
              </Dropdown.Popover>
            </Dropdown.Root>
          </div>
        }
      />
      <Table
        aria-label="Team members"
        selectionMode="multiple"
        sortDescriptor={sortDescriptor}
        onSortChange={setSortDescriptor}
      >
        <Table.Header className="bg-primary">
          <Table.Head
            id="name"
            label="Name"
            isRowHeader
            allowsSorting
            className="w-full max-w-1/4"
          />
          <Table.Head id="status" label="Status" allowsSorting />
          <Table.Head
            id="role"
            label="Role"
            allowsSorting
            tooltip="This is a tooltip"
          />
          <Table.Head
            id="email"
            label="Email address"
            allowsSorting
            className="md:hidden xl:table-cell"
          />
          <Table.Head id="teams" label="Teams" />
          <Table.Head id="actions" />
        </Table.Header>
        <Table.Body items={sortedItems}>
          {(item) => (
            <Table.Row id={item.username} className="odd:bg-secondary">
              <Table.Cell>
                <div className="flex items-center gap-3">
                  <Avatar initials={item.initials} alt={item.name} size="md" />
                  <div className="whitespace-nowrap">
                    <p className="text-sm font-medium text-primary">
                      {item.name}
                    </p>
                    <p className="text-sm text-tertiary">{item.username}</p>
                  </div>
                </div>
              </Table.Cell>
              <Table.Cell>
                <BadgeWithDot
                  size="sm"
                  color={item.status === 'active' ? 'success' : 'gray'}
                  type="modern"
                >
                  {item.status === 'active' ? 'Active' : 'Inactive'}
                </BadgeWithDot>
              </Table.Cell>
              <Table.Cell className="whitespace-nowrap">{item.role}</Table.Cell>
              <Table.Cell className="whitespace-nowrap md:hidden xl:table-cell">
                {item.email}
              </Table.Cell>
              <Table.Cell>
                <div className="flex gap-1">
                  {item.teams.slice(0, 3).map((team) => (
                    <Badge key={team.name} color={team.color} size="sm">
                      {team.name}
                    </Badge>
                  ))}

                  {item.teams.length > 3 && (
                    <Badge color="gray" size="sm">
                      +{item.teams.length - 3}
                    </Badge>
                  )}
                </div>
              </Table.Cell>
              <Table.Cell className="px-4">
                <div className="flex justify-end gap-0.5">
                  <Button
                    size="xs"
                    color="tertiary"
                    iconLeading={Trash01}
                    aria-label={`Delete ${item.name}`}
                  />
                  <Button
                    size="xs"
                    color="tertiary"
                    iconLeading={Edit01}
                    aria-label={`Edit ${item.name}`}
                  />
                </div>
              </Table.Cell>
            </Table.Row>
          )}
        </Table.Body>
      </Table>

      <PaginationPageMinimalCenter
        page={1}
        total={10}
        className="px-4 py-3 md:px-6 md:pt-3 md:pb-4"
      />
    </TableCard.Root>
  );
}
