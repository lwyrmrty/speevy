type WatermarkProps = {
  email: string;
};

export function Watermark({ email }: WatermarkProps) {
  const timestamp = new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date());

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden rounded-[2rem] opacity-[0.055]"
    >
      <div className="grid h-full rotate-[-18deg] grid-cols-3 gap-10 text-3xl font-bold uppercase tracking-[0.22em] text-ink">
        {Array.from({ length: 15 }).map((_, index) => (
          <span key={index} className="whitespace-nowrap">
            {email} | {timestamp}
          </span>
        ))}
      </div>
    </div>
  );
}
