'use client';

import { useEffect, useId, useState } from 'react';

export type MediaGalleryImage = {
  src: string;
  description: string;
};

export type MediaGalleryLayout = 1 | 2 | 3 | 4 | 5 | 6;

const LAYOUT_ROWS: Record<MediaGalleryLayout, number[]> = {
  1: [1],
  2: [2],
  3: [1, 2],
  4: [2, 2],
  5: [2, 1, 2],
  6: [3, 3],
};

function clampLayout(value: number): MediaGalleryLayout {
  if (value === 1 || value === 2 || value === 3 || value === 4 || value === 5 || value === 6) {
    return value;
  }
  return 1;
}

export function MediaGallery({
  images,
  layout,
}: {
  images: MediaGalleryImage[];
  layout: number;
}) {
  const labelId = useId();
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const resolvedLayout = clampLayout(layout);
  const rows = LAYOUT_ROWS[resolvedLayout];
  const filledImages = images.filter((image) => image.src.trim().length > 0);

  useEffect(() => {
    if (activeIndex === null) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setActiveIndex(null);
        return;
      }

      if (event.key === 'ArrowRight') {
        setActiveIndex((current) => {
          if (current === null || filledImages.length === 0) return current;
          return (current + 1) % filledImages.length;
        });
        return;
      }

      if (event.key === 'ArrowLeft') {
        setActiveIndex((current) => {
          if (current === null || filledImages.length === 0) return current;
          return (current - 1 + filledImages.length) % filledImages.length;
        });
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [activeIndex, filledImages.length]);

  if (filledImages.length === 0) {
    return null;
  }

  const galleryRows = rows.flatMap((columns, rowIndex) => {
    const rowStartIndex = rows
      .slice(0, rowIndex)
      .reduce((total, rowColumns) => total + rowColumns, 0);
    const rowImages = filledImages.slice(rowStartIndex, rowStartIndex + columns);
    if (rowImages.length === 0) return [];

    return [{
      columns,
      rowIndex,
      rowStartIndex,
      rowImages,
    }];
  });

  const activeImage = activeIndex === null ? null : filledImages[activeIndex] ?? null;
  const activeDescription = activeImage?.description.trim() ?? '';

  return (
    <>
      <div className="speevy-media-gallery" data-layout={resolvedLayout}>
        {galleryRows.map((row) => (
          <div
            key={`media-row-${row.rowIndex}`}
            className="speevy-media-gallery-row"
            data-wide={row.columns === 1 ? 'true' : undefined}
            style={{ gridTemplateColumns: `repeat(${row.columns}, minmax(0, 1fr))` }}
          >
            {row.rowImages.map((image, offset) => {
              const imageIndex = row.rowStartIndex + offset;
              const description = image.description.trim();
              const alt = description || 'Media';

              return (
                <button
                  key={`${image.src}-${imageIndex}`}
                  type="button"
                  className="speevy-media-gallery-item"
                  onClick={() => setActiveIndex(imageIndex)}
                  aria-label={`Open ${alt}`}
                >
                  <img src={image.src} alt={alt} loading="lazy" className="speevy-media-gallery-image" />
                  {description ? (
                    <span className="speevy-media-gallery-hover">
                      <span className="speevy-media-gallery-hover-description">{description}</span>
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {activeImage ? (
        <div
          className="speevy-media-lightbox"
          role="dialog"
          aria-modal="true"
          aria-labelledby={activeDescription ? labelId : undefined}
          onClick={() => setActiveIndex(null)}
        >
          <button
            type="button"
            className="speevy-media-lightbox-close"
            aria-label="Close lightbox"
            onClick={() => setActiveIndex(null)}
          >
            ×
          </button>

          {filledImages.length > 1 ? (
            <>
              <button
                type="button"
                className="speevy-media-lightbox-nav speevy-media-lightbox-prev"
                aria-label="Previous image"
                onClick={(event) => {
                  event.stopPropagation();
                  setActiveIndex((current) => {
                    if (current === null) return current;
                    return (current - 1 + filledImages.length) % filledImages.length;
                  });
                }}
              >
                ‹
              </button>
              <button
                type="button"
                className="speevy-media-lightbox-nav speevy-media-lightbox-next"
                aria-label="Next image"
                onClick={(event) => {
                  event.stopPropagation();
                  setActiveIndex((current) => {
                    if (current === null) return current;
                    return (current + 1) % filledImages.length;
                  });
                }}
              >
                ›
              </button>
            </>
          ) : null}

          <figure
            className="speevy-media-lightbox-figure"
            onClick={(event) => event.stopPropagation()}
          >
            <img
              src={activeImage.src}
              alt={activeDescription || 'Media'}
              className="speevy-media-lightbox-image"
            />
            {activeDescription ? (
              <figcaption id={labelId} className="speevy-media-lightbox-caption">
                <div className="speevy-media-lightbox-caption-description">{activeDescription}</div>
              </figcaption>
            ) : null}
          </figure>
        </div>
      ) : null}
    </>
  );
}
