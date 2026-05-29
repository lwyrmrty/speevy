'use client';

import type { Key } from 'react';
import { useActionState, useMemo, useState } from 'react';
import type { Selection } from 'react-aria-components';

import {
  INVESTMENT_RANGE_MAX,
  INVESTMENT_RANGE_MIN,
  INVESTMENT_RANGE_STEP,
  INVESTOR_SECTORS,
  formatInvestmentRange,
  type InvestorSector,
} from '@/lib/investor-request';
import {
  submitInvestorRequest,
  type InvestorRequestActionState,
} from '@/app/join/[token]/actions';
import { Button } from '@/components/base/buttons/button';
import { Checkbox } from '@/components/base/checkbox/checkbox';
import { HintText } from '@/components/base/input/hint-text';
import { Input } from '@/components/base/input/input';
import { Label } from '@/components/base/input/label';
import { MultiSelect } from '@/components/base/select/multi-select';
import { type SelectItemType } from '@/components/base/select/select';
import { Slider } from '@/components/base/slider/slider';

const initialState: InvestorRequestActionState = {
  status: 'idle',
  message: '',
};

const sectorItems: SelectItemType[] = INVESTOR_SECTORS.map((sector) => ({
  id: sector,
  label: sector,
}));

type InvestorRequestFormProps = {
  token: string;
};

export function InvestorRequestForm({ token }: InvestorRequestFormProps) {
  const [state, action, pending] = useActionState(
    submitInvestorRequest,
    initialState,
  );
  const [investmentRange, setInvestmentRange] = useState<[number, number]>([
    INVESTMENT_RANGE_MIN,
    1_000_000,
  ]);
  const [selectedSectors, setSelectedSectors] = useState<InvestorSector[]>([]);

  const selectedSectorKeys = useMemo<Selection>(
    () => new Set(selectedSectors),
    [selectedSectors],
  );

  function updateSelectedSectors(keys: 'all' | Set<Key>) {
    if (keys === 'all') {
      setSelectedSectors([...INVESTOR_SECTORS]);
      return;
    }

    setSelectedSectors(
      Array.from(keys).filter((key): key is InvestorSector =>
        INVESTOR_SECTORS.includes(key as InvestorSector),
      ),
    );
  }

  const hasMessage = Boolean(state.message);
  const isError = state.status === 'error';

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="token" value={token} />
      {selectedSectors.map((sector) => (
        <input key={sector} type="hidden" name="sectors" value={sector} />
      ))}

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="First Name"
          name="firstName"
          autoComplete="given-name"
          isRequired
        />
        <Input
          label="Last Name"
          name="lastName"
          autoComplete="family-name"
          isRequired
        />
      </div>

      <Input
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        placeholder="you@example.com"
        isRequired
      />

      <Input
        label="Company Name"
        name="companyName"
        autoComplete="organization"
        isRequired
      />

      <MultiSelect
        isRequired
        size="sm"
        label="Sectors Interested"
        hint="Choose every sector you would like to hear about."
        placeholder="Select sectors"
        items={sectorItems}
        selectedKeys={selectedSectorKeys}
        onSelectionChange={updateSelectedSectors}
        onReset={() => setSelectedSectors([])}
        onSelectAll={() => setSelectedSectors([...INVESTOR_SECTORS])}
      >
        {(item) => (
          <MultiSelect.Item
            id={item.id}
            selectionIndicator="checkbox"
            selectionIndicatorAlign="left"
          >
            {item.label}
          </MultiSelect.Item>
        )}
      </MultiSelect>

      <div className="rounded-2xl border border-border bg-white/80 p-4 shadow-sm">
        <input
          type="hidden"
          name="investmentRangeMin"
          value={investmentRange[0]}
        />
        <input
          type="hidden"
          name="investmentRangeMax"
          value={investmentRange[1]}
        />
        <div className="mb-8">
          <Label>Per Opportunity Investment Range</Label>
          <HintText>Starts at $100k and increases in $50k increments.</HintText>
        </div>
        <Slider
          aria-label="Per Opportunity Investment Range"
          maxValue={INVESTMENT_RANGE_MAX}
          minValue={INVESTMENT_RANGE_MIN}
          step={INVESTMENT_RANGE_STEP}
          value={investmentRange}
          onChange={(value) => {
            if (Array.isArray(value) && value.length === 2) {
              setInvestmentRange([value[0], value[1]]);
            }
          }}
          labelPosition="top-floating"
          labelFormatter={(value) => formatInvestmentRange(value)}
        />
        <div className="mt-2 flex justify-between text-sm text-tertiary">
          <span>{formatInvestmentRange(INVESTMENT_RANGE_MIN)}</span>
          <span>{formatInvestmentRange(INVESTMENT_RANGE_MAX)}</span>
        </div>
      </div>

      <div className="space-y-3">
        <Checkbox
          name="accreditedInvestor"
          value="on"
          isRequired
          label="I confirm that I am an accredited investor"
          className="w-full rounded-2xl border border-border bg-white/80 p-4 shadow-sm"
        />
        <Checkbox
          name="priorHarpoonInvestor"
          value="on"
          isRequired
          label="I confirm that I know Harpoon Ventures and have invested with them before"
          className="w-full rounded-2xl border border-border bg-white/80 p-4 shadow-sm"
        />
      </div>

      <Button
        type="submit"
        size="lg"
        color="primary"
        className="w-full"
        isDisabled={pending}
        isLoading={pending}
      >
        {pending ? 'Submitting...' : 'Request access'}
      </Button>

      {hasMessage ? (
        <p
          className={`rounded-2xl px-4 py-3 text-sm ${
            isError
              ? 'bg-destructive/10 text-destructive'
              : 'bg-muted text-muted-foreground'
          }`}
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
