'use client';

import { useEffect, useState } from 'react';

export type GalleryLightboxItem = {
  imageUrl: string;
  caption: string;
};

export function GalleryLightbox({
  items,
  layout,
  title,
}: {
  items: GalleryLightboxItem[];
  layout: string;
  title: string;
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const activeItem = activeIndex == null ? null : items[activeIndex] ?? null;
  const hasGroup = items.length > 1;

  useEffect(() => {
    if (activeIndex == null) return undefined;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setActiveIndex(null);
        return;
      }

      if (!hasGroup) return;

      if (event.key === 'ArrowRight') {
        event.preventDefault();
        setActiveIndex((current) => (current == null ? 0 : (current + 1) % items.length));
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        setActiveIndex((current) => (
          current == null ? 0 : (current - 1 + items.length) % items.length
        ));
      }
    }

    document.documentElement.classList.add('w-lightbox-noscroll');
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.documentElement.classList.remove('w-lightbox-noscroll');
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeIndex, hasGroup, items.length]);

  return (
    <>
      <div className={`gallerygrid layout-${layout}`}>
        {items.map((item, index) => (
          <div className="galleryitem" key={`${item.imageUrl}-${index}`}>
            <button
              type="button"
              className="pagecard nopadding galleryitem-trigger w-inline-block"
              onClick={() => setActiveIndex(index)}
              aria-label={item.caption || `Open ${title} image ${index + 1}`}
            >
              <div className="cardthumbnail">
                <img
                  src={item.imageUrl}
                  alt={item.caption || title}
                  loading="lazy"
                  className="fullimage"
                />
                {item.caption ? <div className="gallerycaption">{item.caption}</div> : null}
              </div>
            </button>
          </div>
        ))}
      </div>

      {activeItem ? (
        <div
          className="w-lightbox-backdrop is-open"
          role="dialog"
          aria-modal="true"
          aria-label={activeItem.caption || title}
          onClick={() => setActiveIndex(null)}
        >
          <div className="w-lightbox-container">
            <div className={`w-lightbox-content${hasGroup ? ' w-lightbox-group' : ''}`}>
              <div className="w-lightbox-view">
                <div className="w-lightbox-frame">
                  <figure className="w-lightbox-figure" onClick={(event) => event.stopPropagation()}>
                    <img
                      src={activeItem.imageUrl}
                      alt={activeItem.caption || title}
                      className="w-lightbox-img w-lightbox-image"
                    />
                    {activeItem.caption ? (
                      <figcaption className="w-lightbox-caption">{activeItem.caption}</figcaption>
                    ) : null}
                  </figure>
                </div>
              </div>
              {hasGroup ? (
                <>
                  <div className="w-lightbox-strip" onClick={(event) => event.stopPropagation()}>
                    {items.map((item, index) => (
                      <button
                        type="button"
                        key={`${item.imageUrl}-thumb-${index}`}
                        className={`w-lightbox-item${index === activeIndex ? ' w-lightbox-active' : ''}`}
                        aria-label={item.caption || `View ${title} image ${index + 1}`}
                        aria-current={index === activeIndex ? 'true' : undefined}
                        onClick={() => setActiveIndex(index)}
                      >
                        <div className="w-lightbox-thumbnail">
                          <img
                            src={item.imageUrl}
                            alt=""
                            className="w-lightbox-thumbnail-image w-lightbox-wide"
                          />
                        </div>
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="w-lightbox-control w-lightbox-left"
                    aria-label="Previous image"
                    onClick={(event) => {
                      event.stopPropagation();
                      setActiveIndex((current) => (
                        current == null ? 0 : (current - 1 + items.length) % items.length
                      ));
                    }}
                  />
                  <button
                    type="button"
                    className="w-lightbox-control w-lightbox-right"
                    aria-label="Next image"
                    onClick={(event) => {
                      event.stopPropagation();
                      setActiveIndex((current) => (
                        current == null ? 0 : (current + 1) % items.length
                      ));
                    }}
                  />
                </>
              ) : null}
              <button
                type="button"
                className="w-lightbox-control w-lightbox-close"
                aria-label="Close"
                onClick={(event) => {
                  event.stopPropagation();
                  setActiveIndex(null);
                }}
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
