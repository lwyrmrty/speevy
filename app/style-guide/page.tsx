import type { Metadata } from 'next';
import type { CSSProperties, ReactNode } from 'react';

import { Input, InputFile, InputGroup, InputBase } from '@/components/base/input';
import { Toggle } from '@/components/base/toggle/toggle';
import {
  DropdownDemo,
  HeaderNavigationDemo,
} from '@/components/style-guide/untitled-component-demos';

export const metadata: Metadata = {
  title: 'Untitled UI Style Guide | Speevy',
  description: 'Visual map of Untitled UI tokens used by Speevy.',
};

const brandScale = [
  'brand-50',
  'brand-100',
  'brand-200',
  'brand-300',
  'brand-400',
  'brand-500',
  'brand-600',
  'brand-700',
  'brand-800',
  'brand-900',
  'brand-950',
];

const neutralScale = [
  'gray-50',
  'gray-100',
  'gray-200',
  'gray-300',
  'gray-400',
  'gray-500',
  'gray-600',
  'gray-700',
  'gray-800',
  'gray-900',
  'gray-950',
];

const semanticScales = [
  {
    name: 'Error',
    tokens: ['error-50', 'error-100', 'error-500', 'error-600', 'error-700'],
  },
  {
    name: 'Warning',
    tokens: ['warning-50', 'warning-100', 'warning-500', 'warning-600', 'warning-700'],
  },
  {
    name: 'Success',
    tokens: ['success-50', 'success-100', 'success-500', 'success-600', 'success-700'],
  },
];

const surfaceTokens = [
  'primary',
  'primary_hover',
  'secondary',
  'secondary_hover',
  'tertiary',
  'quaternary',
  'brand-primary',
  'brand-solid',
  'brand-solid_hover',
  'error-primary',
];

const textTokens = [
  'primary',
  'secondary',
  'tertiary',
  'quaternary',
  'placeholder',
  'brand-primary',
  'brand-secondary',
  'brand-tertiary',
  'error-primary',
  'success-primary',
];

const borderTokens = [
  'primary',
  'secondary',
  'tertiary',
  'brand',
  'brand-solid',
  'error',
  'error_subtle',
  'disabled',
];

const radii = ['none', 'xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl', 'full'];
const shadows = ['xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl'];
const typeRows = [
  ['display-2xl', 'Display 2XL'],
  ['display-xl', 'Display XL'],
  ['display-lg', 'Display LG'],
  ['display-md', 'Display MD'],
  ['display-sm', 'Display SM'],
  ['display-xs', 'Display XS'],
  ['xl', 'Text XL'],
  ['lg', 'Text LG'],
  ['md', 'Text MD'],
  ['sm', 'Text SM'],
  ['xs', 'Text XS'],
];

export default function StyleGuidePage() {
  return (
    <main className="min-h-screen bg-secondary px-6 py-8 text-primary sm:px-10 lg:px-12">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="rounded-3xl border border-secondary bg-primary p-8 shadow-lg">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-secondary">
            Untitled UI visual ID
          </p>
          <h1 className="mt-3 text-display-md font-semibold tracking-tight text-primary">
            Speevy style guide
          </h1>
          <p className="mt-4 max-w-3xl text-md leading-7 text-tertiary">
            This page renders the tokens from <code>styles/theme.css</code> and
            a few real Untitled UI components. Edit the token file and use this
            page to see global changes to colors, radius, shadows, type, inputs,
            and toggles.
          </p>
        </header>

        <Section
          title="Brand Scale"
          description="Primary Untitled brand tokens. These drive selected states, primary buttons, focus treatment, and brand text."
        >
          <ColorGrid tokens={brandScale} prefix="bg-" />
        </Section>

        <Section
          title="Neutral Scale"
          description="Core grayscale foundation used by surfaces, borders, text, disabled states, and table rows."
        >
          <ColorGrid tokens={neutralScale} prefix="bg-" />
        </Section>

        <Section
          title="Semantic Scales"
          description="Error, warning, and success palettes for validation, alerts, badges, and status states."
        >
          <div className="grid gap-6 lg:grid-cols-3">
            {semanticScales.map((scale) => (
              <div key={scale.name}>
                <h3 className="mb-3 text-sm font-semibold text-secondary">
                  {scale.name}
                </h3>
                <ColorGrid tokens={scale.tokens} prefix="bg-" compact />
              </div>
            ))}
          </div>
        </Section>

        <div className="grid gap-8 lg:grid-cols-3">
          <Section
            title="Surface Tokens"
            description="These map to classes like bg-primary, bg-secondary, and bg-brand-solid."
          >
            <TokenStack tokens={surfaceTokens} prefix="bg-" />
          </Section>

          <Section
            title="Text Tokens"
            description="These map to text-primary, text-tertiary, text-brand-secondary, and related text utilities."
          >
            <div className="space-y-3">
              {textTokens.map((token) => (
                <div
                  key={token}
                  className="rounded-xl border border-secondary bg-primary px-4 py-3"
                >
                  <p
                    className="text-sm font-medium"
                    style={textColorStyle(token)}
                  >
                    text-{token}
                  </p>
                </div>
              ))}
            </div>
          </Section>

          <Section
            title="Border Tokens"
            description="These map to border-primary, border-secondary, border-brand, and validation borders."
          >
            <div className="space-y-3">
              {borderTokens.map((token) => (
                <div
                  key={token}
                  className="rounded-xl border bg-primary px-4 py-3 text-sm text-secondary"
                  style={borderStyle(token)}
                >
                  border-{token}
                </div>
              ))}
            </div>
          </Section>
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          <Section
            title="Radius"
            description="Global radius tokens used by inputs, cards, menus, buttons, and tables."
          >
            <div className="grid grid-cols-3 gap-4 sm:grid-cols-5">
              {radii.map((radius) => (
                <div key={radius} className="space-y-2">
                  <div
                    className="h-20 border border-brand bg-brand-primary_alt"
                    style={radiusStyle(radius)}
                  />
                  <p className="text-xs font-medium text-tertiary">
                    rounded-{radius}
                  </p>
                </div>
              ))}
            </div>
          </Section>

          <Section
            title="Shadows"
            description="Elevation tokens for cards, overlays, menus, sidepanels, and buttons."
          >
            <div className="grid grid-cols-2 gap-4">
              {shadows.map((shadow) => (
                <div
                  key={shadow}
                  className="rounded-xl border border-secondary bg-primary p-5"
                  style={shadowStyle(shadow)}
                >
                  <p className="text-sm font-semibold text-primary">
                    shadow-{shadow}
                  </p>
                  <p className="mt-1 text-xs text-tertiary">Elevation sample</p>
                </div>
              ))}
            </div>
          </Section>
        </div>

        <Section
          title="Typography"
          description="Untitled UI type scale. These are useful when matching Webflow typography to component copy."
        >
          <div className="space-y-4">
            {typeRows.map(([token, label]) => (
              <div
                key={token}
                className="grid gap-3 rounded-xl border border-secondary bg-primary p-4 md:grid-cols-[12rem_1fr]"
              >
                <div>
                  <p className="text-sm font-semibold text-secondary">{label}</p>
                  <p className="font-mono text-xs text-tertiary">text-{token}</p>
                </div>
                <p
                  className="font-semibold tracking-tight text-primary"
                  style={typeStyle(token)}
                >
                  The quick brown fox
                </p>
              </div>
            ))}
          </div>
        </Section>

        <Section
          title="Live Untitled Components"
          description="These are real Untitled UI components using the global tokens above, not recreated lookalikes."
        >
          <div className="grid gap-8 lg:grid-cols-2">
            <div className="space-y-5">
              <Input
                label="Email"
                placeholder="avery@example.com"
                hint="Default input with hint text."
                size="md"
              />
              <Input
                label="Search"
                placeholder="Search LPs or opportunities"
                shortcut
                size="md"
              />
              <Input
                label="Invalid input"
                placeholder="Something went wrong"
                hint="This is an error message."
                isInvalid
                size="md"
              />
              <InputGroup label="Website" prefix="https://" hint="Input group with a leading text prefix.">
                <InputBase placeholder="speevy.com" />
              </InputGroup>
            </div>

            <div className="space-y-6">
              <InputFile
                label="Upload file"
                hint="PDF, PNG, JPG or GIF."
                placeholder="Choose a document"
                buttonText="Upload"
                acceptedFileTypes={['application/pdf', 'image/png', 'image/jpeg']}
              />
              <div className="space-y-4 rounded-2xl border border-secondary bg-secondary p-5">
                <Toggle
                  label="Remember me"
                  hint="Save my login details for next time."
                  size="sm"
                />
                <Toggle
                  label="Visible to all approved LPs"
                  hint="Use this for broadly available opportunities."
                  size="md"
                  defaultSelected
                />
                <Toggle
                  label="NDA required"
                  hint="Gate document and section viewing until signed."
                  slim
                  size="md"
                />
              </div>
            </div>
          </div>
        </Section>

        <Section
          title="Dropdowns"
          description="Real Untitled UI dropdown primitives. Use these for account menus, row actions, filters, and compact action menus."
        >
          <div className="grid gap-8 lg:grid-cols-[18rem_1fr]">
            <div className="flex min-h-40 items-center justify-center rounded-2xl border border-secondary bg-secondary">
              <DropdownDemo />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <ComponentNote
                title="Common Uses"
                items={[
                  'Opportunity row actions',
                  'LP table actions',
                  'Document menu actions',
                  'Filter and export menus',
                ]}
              />
              <ComponentNote
                title="Global Tokens To Tune"
                items={[
                  'bg-primary / bg-primary_hover',
                  'text-secondary / text-quaternary',
                  'ring-secondary_alt',
                  'shadow-lg',
                ]}
              />
            </div>
          </div>
        </Section>

        <Section
          title="Header Navigation"
          description="Real Untitled UI header navigation component. This is useful for admin/app shells when we do not use a Webflow static header."
        >
          <div className="overflow-hidden rounded-2xl border border-secondary">
            <HeaderNavigationDemo />
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <ComponentNote
              title="Common Uses"
              items={['Admin shell', 'Investor portal shell', 'Settings areas']}
            />
            <ComponentNote
              title="Token Areas"
              items={[
                'bg-primary surfaces',
                'border-secondary dividers',
                'focus ring tokens',
                'nav hover backgrounds',
              ]}
            />
            <ComponentNote
              title="Implementation Rule"
              items={[
                'Use actual Untitled source',
                'Keep Webflow page headers static unless asked',
                'Make Speevy styling adjustments via tokens first',
              ]}
            />
          </div>
        </Section>

        <Section
          title="Component Roadmap"
          description="Potential Untitled UI components to add as we need them. Use this as a menu of likely building blocks."
        >
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <ComponentCard
              title="Tables"
              command="pnpm dlx untitledui@latest add table --yes"
              useCase="LP management, documents, interest dashboards"
            />
            <ComponentCard
              title="Tabs"
              command="pnpm dlx untitledui@latest add tabs --yes"
              useCase="Admin sections, opportunity editor panels"
            />
            <ComponentCard
              title="Section Headers"
              command="pnpm dlx untitledui@latest add section-headers --yes"
              useCase="Admin page headers with search/actions"
            />
            <ComponentCard
              title="Modals"
              command="pnpm dlx untitledui@latest add modal --yes"
              useCase="Confirmations, document preview shells"
            />
          </div>
        </Section>
      </div>
    </main>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-secondary bg-primary p-6 shadow-sm">
      <div className="mb-6 max-w-3xl">
        <h2 className="text-display-xs font-semibold tracking-tight text-primary">
          {title}
        </h2>
        <p className="mt-2 text-sm leading-6 text-tertiary">{description}</p>
      </div>
      {children}
    </section>
  );
}

function ColorGrid({
  tokens,
  prefix,
  compact = false,
}: {
  tokens: string[];
  prefix: string;
  compact?: boolean;
}) {
  return (
    <div
      className={`grid gap-3 ${
        compact ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6'
      }`}
    >
      {tokens.map((token) => (
        <div key={token} className="overflow-hidden rounded-xl border border-secondary bg-primary">
          <div className="h-20" style={colorStyle(token)} />
          <div className="p-3">
            <p className="font-mono text-xs font-medium text-secondary">
              {prefix}
              {token}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

function TokenStack({ tokens, prefix }: { tokens: string[]; prefix: string }) {
  return (
    <div className="space-y-3">
      {tokens.map((token) => (
        <div
          key={token}
          className="rounded-xl border border-secondary px-4 py-3"
          style={backgroundStyle(token)}
        >
          <p className="font-mono text-xs font-medium text-primary">
            {prefix}
            {token}
          </p>
        </div>
      ))}
    </div>
  );
}

function ComponentNote({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-2xl border border-secondary bg-primary p-4">
      <h3 className="text-sm font-semibold text-primary">{title}</h3>
      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li key={item} className="text-sm leading-5 text-tertiary">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ComponentCard({
  title,
  command,
  useCase,
}: {
  title: string;
  command: string;
  useCase: string;
}) {
  return (
    <div className="rounded-2xl border border-secondary bg-secondary p-4">
      <h3 className="text-md font-semibold text-primary">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-tertiary">{useCase}</p>
      <code className="mt-4 block rounded-lg bg-primary px-3 py-2 text-xs leading-5 text-secondary">
        {command}
      </code>
    </div>
  );
}

function colorStyle(token: string): CSSProperties {
  return { backgroundColor: `var(--color-${token})` };
}

function backgroundStyle(token: string): CSSProperties {
  return { backgroundColor: `var(--background-color-${token})` };
}

function textColorStyle(token: string): CSSProperties {
  return { color: `var(--text-color-${token})` };
}

function borderStyle(token: string): CSSProperties {
  return { borderColor: `var(--border-color-${token})` };
}

function radiusStyle(token: string): CSSProperties {
  return { borderRadius: `var(--radius-${token})` };
}

function shadowStyle(token: string): CSSProperties {
  return { boxShadow: `var(--shadow-${token})` };
}

function typeStyle(token: string): CSSProperties {
  return {
    fontSize: `var(--text-${token})`,
    lineHeight: `var(--text-${token}--line-height)`,
    letterSpacing: `var(--text-${token}--letter-spacing, normal)`,
  };
}
