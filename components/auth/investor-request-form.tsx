'use client';

import type { PointerEvent as ReactPointerEvent } from 'react';
import { useActionState, useEffect, useRef, useState } from 'react';

import {
  INVESTMENT_RANGE_MAX,
  INVESTMENT_RANGE_MIN,
  INVESTMENT_RANGE_VALUES,
  INVESTOR_SECTORS,
  formatInvestmentRange,
  type InvestorSector,
} from '@/lib/investor-request';
import {
  submitInvestorRequest,
  type InvestorRequestActionState,
} from '@/app/join/[token]/actions';
import { WebflowSectorIcon } from '@/components/webflow/sector-icon';

const initialState: InvestorRequestActionState = {
  status: 'idle',
  message: '',
};

const maxRangeScaleIndex = INVESTMENT_RANGE_VALUES.length - 1;

type InvestorRequestFormProps = {
  token: string;
};

function CheckIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="64"
      height="64"
      className="checkicon"
    >
      <g fill="none" fillRule="evenodd">
        <path
          fill="currentColor"
          d="M21.546 5.111a1.5 1.5 0 0 1 0 2.121L10.303 18.475a1.6 1.6 0 0 1-2.263 0L2.454 12.89a1.5 1.5 0 1 1 2.121-2.121l4.596 4.596L19.424 5.111a1.5 1.5 0 0 1 2.122 0Z"
        />
      </g>
    </svg>
  );
}

function DropdownIcon({ open }: { open: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="64"
      height="64"
      viewBox="0 0 24 24"
      fill="none"
      className={`dropdowntoggle${open ? ' open' : ''}`}
    >
      <path d="M10 8L14 12L10 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function InvestorRequestForm({ token }: InvestorRequestFormProps) {
  const [state, action, pending] = useActionState(
    submitInvestorRequest,
    initialState,
  );
  const [investmentRange, setInvestmentRange] = useState<[number, number]>([
    INVESTMENT_RANGE_MIN,
    INVESTMENT_RANGE_MAX,
  ]);
  const sectorDropdownRef = useRef<HTMLDivElement>(null);
  const sliderTrackRef = useRef<HTMLDivElement>(null);
  const [selectedSectors, setSelectedSectors] = useState<InvestorSector[]>([]);
  const [sectorsOpen, setSectorsOpen] = useState(false);
  const [draggingRangeHandle, setDraggingRangeHandle] = useState<0 | 1 | null>(null);
  const [accreditedInvestor, setAccreditedInvestor] = useState(true);
  const [priorHarpoonInvestor, setPriorHarpoonInvestor] = useState(true);

  const hasMessage = Boolean(state.message);
  const isError = state.status === 'error';
  const selectedSectorCount = selectedSectors.length;
  const minRangeIndex = rangeValueToIndex(investmentRange[0]);
  const maxRangeIndex = rangeValueToIndex(investmentRange[1]);
  const minRangePercent = rangeIndexToPercent(minRangeIndex);
  const maxRangePercent = rangeIndexToPercent(maxRangeIndex);

  useEffect(() => {
    if (!sectorsOpen) return;

    function handlePointerDown(event: PointerEvent) {
      if (
        event.target instanceof Node
        && !sectorDropdownRef.current?.contains(event.target)
      ) {
        setSectorsOpen(false);
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [sectorsOpen]);

  function toggleSector(sector: InvestorSector) {
    setSelectedSectors((current) =>
      current.includes(sector)
        ? current.filter((item) => item !== sector)
        : [...current, sector],
    );
  }

  function rangeIndexToValue(index: number) {
    return INVESTMENT_RANGE_VALUES[index] ?? INVESTMENT_RANGE_MAX;
  }

  function rangeValueToIndex(value: number) {
    const exactIndex = INVESTMENT_RANGE_VALUES.indexOf(value as (typeof INVESTMENT_RANGE_VALUES)[number]);

    if (exactIndex >= 0) {
      return exactIndex;
    }

    return INVESTMENT_RANGE_VALUES.reduce(
      (nearestIndex, option, optionIndex) =>
        Math.abs(option - value) < Math.abs(INVESTMENT_RANGE_VALUES[nearestIndex] - value)
          ? optionIndex
          : nearestIndex,
      0,
    );
  }

  function rangeIndexToPercent(index: number) {
    return (index / maxRangeScaleIndex) * 100;
  }

  function updateRange(index: 0 | 1, value: number) {
    setInvestmentRange((current) => {
      const next: [number, number] = [...current];
      next[index] = rangeIndexToValue(value);

      if (next[0] >= next[1]) {
        if (index === 0) {
          next[1] = rangeIndexToValue(Math.min(maxRangeScaleIndex, value + 1));
        } else {
          next[0] = rangeIndexToValue(Math.max(0, value - 1));
        }
      }

      return next;
    });
  }

  function rangeIndexFromPointer(event: ReactPointerEvent<HTMLDivElement>) {
    const rect = sliderTrackRef.current?.getBoundingClientRect();

    if (!rect) {
      return 0;
    }

    const percent = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    return Math.round(percent * maxRangeScaleIndex);
  }

  function nearestRangeHandle(index: number) {
    const distanceToMin = Math.abs(index - minRangeIndex);
    const distanceToMax = Math.abs(index - maxRangeIndex);
    return distanceToMin <= distanceToMax ? 0 : 1;
  }

  function handleSliderPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    event.preventDefault();

    const index = rangeIndexFromPointer(event);
    const handle = nearestRangeHandle(index);
    setDraggingRangeHandle(handle);
    updateRange(handle, index);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleSliderPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (draggingRangeHandle === null) {
      return;
    }

    updateRange(draggingRangeHandle, rangeIndexFromPointer(event));
  }

  function handleSliderPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    setDraggingRangeHandle(null);

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  return (
    <form action={action} className="loginform">
      <input type="hidden" name="token" value={token} />
      {selectedSectors.map((sector) => (
        <input key={sector} type="hidden" name="sectors" value={sector} />
      ))}
      <input type="hidden" name="investmentRangeMin" value={investmentRange[0]} />
      <input type="hidden" name="investmentRangeMax" value={investmentRange[1]} />
      {accreditedInvestor ? <input type="hidden" name="accreditedInvestor" value="on" /> : null}
      {priorHarpoonInvestor ? <input type="hidden" name="priorHarpoonInvestor" value="on" /> : null}

      <div>
        <div className="loginheader">View opportunities from Harpoon Ventures</div>
        <div className="loginsubheader">
          Already have access? <a href="/login" className="inlinelink">Log in here</a>.
        </div>
      </div>

      <div className="fieldblock">
        <label htmlFor="Email" className="fieldlabel">Email</label>
        <input className="textfield w-input" maxLength={256} name="email" type="email" id="Email" required />
      </div>

      <div className="fieldrow">
        <div className="fieldblock">
          <label htmlFor="First-Name" className="fieldlabel">First Name</label>
          <input className="textfield w-input" maxLength={256} name="firstName" type="text" id="First-Name" required />
        </div>
        <div className="fieldblock">
          <label htmlFor="Last-Name" className="fieldlabel">Last Name</label>
          <input className="textfield w-input" maxLength={256} name="lastName" type="text" id="Last-Name" required />
        </div>
      </div>

      <div className="fieldblock">
        <label htmlFor="Fund-Company-Name" className="fieldlabel">Fund / Company Name</label>
        <input className="textfield w-input" maxLength={256} name="companyName" type="text" id="Fund-Company-Name" required />
      </div>

      <div className="fieldblock">
        <label className="fieldlabel">Sectors Interested</label>
        <div ref={sectorDropdownRef} className="dropdownblocks full">
          <button
            type="button"
            className="dropdownbuttons _100 signup-sector-dropdown-button w-inline-block"
            aria-expanded={sectorsOpen}
            onClick={() => setSectorsOpen((current) => !current)}
          >
            <div className="align-row">
              <div>{selectedSectorCount} Selected</div>
            </div>
            <DropdownIcon open={sectorsOpen} />
          </button>
          <div className={`dropdownmodal signup-dropdown${sectorsOpen ? ' open' : ''}`}>
            <div className="widgetsmodal-block">
              <div className="pillswrapper">
                {INVESTOR_SECTORS.map((sector) => {
                  const selected = selectedSectors.includes(sector);

                  return (
                    <button
                      key={sector}
                      type="button"
                      className={`selectpill w-inline-block${selected ? ' selected' : ''}`}
                      onClick={() => toggleSector(sector)}
                    >
                      <div className="alignrow aligncenter">
                        <div className={`selectlink-icon${selected ? ' selected' : ''}`}>
                          <WebflowSectorIcon sector={sector} />
                        </div>
                        <div>{sector}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="pagecard">
        <div className="cardblock">
          <div>
            <label className="fieldlabel">Per-Deal Capital Allocation (Estimate)</label>
            <div className="fieldblock">
              <div className="sliderwrapper">
                <div
                  ref={sliderTrackRef}
                  className="sliderrow signup-sliderrow"
                  onPointerDown={handleSliderPointerDown}
                  onPointerMove={handleSliderPointerMove}
                  onPointerUp={handleSliderPointerUp}
                  onPointerCancel={handleSliderPointerUp}
                >
                  <div
                    className="sliderfill signup-sliderfill"
                    style={{
                      left: `${minRangePercent}%`,
                      right: `${100 - maxRangePercent}%`,
                    }}
                  />
                  <div
                    className={`slidercircle signup-slider-circle${minRangeIndex === 0 ? ' at-start' : ''}`}
                    style={{ left: `${minRangePercent}%` }}
                  >
                    <div className="sliderlabel">
                      <div>{formatInvestmentRange(investmentRange[0])}</div>
                    </div>
                  </div>
                  <div
                    className={`slidercircle signup-slider-circle${maxRangeIndex === maxRangeScaleIndex ? ' at-end' : ''}`}
                    style={{ left: `${maxRangePercent}%` }}
                  >
                    <div className="sliderlabel">
                      <div>{formatInvestmentRange(investmentRange[1])}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="pagecard">
        <div className="cardblock">
          <label className="fieldlabel">Qualifications</label>
          <div className="fieldblock">
            <button
              type="button"
              className="checkboxrow signup-checkbox"
              onClick={() => setAccreditedInvestor((current) => !current)}
            >
              <div className="interestchecks-row">
                <div className={`checkboxtoggle${accreditedInvestor ? ' checked' : ''}`}>
                  {accreditedInvestor ? <CheckIcon /> : null}
                </div>
              </div>
              <div>
                <div>I confirm that I am an accredited investor</div>
              </div>
            </button>
          </div>
          <div className="fieldblock">
            <button
              type="button"
              className="checkboxrow signup-checkbox"
              onClick={() => setPriorHarpoonInvestor((current) => !current)}
            >
              <div className="interestchecks-row">
                <div className={`checkboxtoggle${priorHarpoonInvestor ? ' checked' : ''}`}>
                  {priorHarpoonInvestor ? <CheckIcon /> : null}
                </div>
              </div>
              <div>
                <div>I confirm that I know Harpoon Ventures and have a pre-existing investing relationship with them</div>
              </div>
            </button>
          </div>
        </div>
      </div>

      <button type="submit" className="button w-button" disabled={pending}>
        {pending ? 'Please wait...' : 'Create account'}
      </button>

      {hasMessage && isError ? (
        <div className="w-form-fail signup-message visible">
          <div>{state.message}</div>
        </div>
      ) : null}

      {hasMessage && !isError ? (
        <div className="signup-success-modal" role="dialog" aria-modal="true" aria-labelledby="signup-success-title">
          <div className="signup-success-card">
            <div className="checkboxtoggle checked signup-success-icon">
              <CheckIcon />
            </div>
            <div id="signup-success-title" className="sideheading large">Request submitted</div>
            <div className="sidesubheading signup-success-copy">{state.message}</div>
            <a href="/login" className="button w-button signup-success-button">
              Log in
            </a>
          </div>
        </div>
      ) : null}
    </form>
  );
}
