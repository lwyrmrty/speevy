type PageWatermarkProps = {
  email: string;
};

export function PageWatermark({ email }: PageWatermarkProps) {
  const watermarkText = email.trim();

  if (!watermarkText) {
    return null;
  }

  return (
    <div className="page-watermark" aria-hidden="true">
      <div className="page-watermark-grid">
        {Array.from({ length: 64 }).map((_, index) => (
          <span key={index}>{watermarkText}</span>
        ))}
      </div>
    </div>
  );
}
