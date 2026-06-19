'use client';

import { useEffect, useMemo, useState } from 'react';

export type SponsorItem = {
  id: number;
  category: string;
  image_url: string;
  link_url: string | null;
};

const PER_SLIDE = 4;
const ROTATION_MS = 5000;

function chunk<T>(items: T[], size: number): T[][] {
  if (items.length === 0) return [];
  const pages: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    pages.push(items.slice(i, i + size));
  }
  return pages;
}

type SponsorsCategoryCarouselProps = {
  category: string;
  items: SponsorItem[];
  imageSrc: (url: string | null) => string | null;
  imageClassName: string;
};

export default function SponsorsCategoryCarousel({
  category,
  items,
  imageSrc,
  imageClassName,
}: SponsorsCategoryCarouselProps) {
  const slides = useMemo(
    () => (items.length > PER_SLIDE ? chunk(items, PER_SLIDE) : [items]),
    [items]
  );
  const [activeSlide, setActiveSlide] = useState(0);

  useEffect(() => {
    setActiveSlide(0);
  }, [items]);

  useEffect(() => {
    if (slides.length <= 1) return;
    const timer = setInterval(() => {
      setActiveSlide((i) => (i + 1) % slides.length);
    }, ROTATION_MS);
    return () => clearInterval(timer);
  }, [slides.length]);

  const renderSponsor = (s: SponsorItem) => {
    const Wrapper = s.link_url ? 'a' : 'span';
    const props = s.link_url
      ? { href: s.link_url, target: '_blank', rel: 'noopener noreferrer' }
      : {};
    return (
      <Wrapper
        key={s.id}
        {...props}
        className={s.link_url ? 'hover:opacity-80 transition shrink-0' : 'shrink-0'}
      >
        <img
          src={imageSrc(s.image_url) ?? ''}
          alt={category}
          className={imageClassName}
        />
      </Wrapper>
    );
  };

  if (slides.length === 1) {
    return (
      <div className="flex flex-wrap justify-center gap-6 sm:gap-8 items-center">
        {slides[0].map(renderSponsor)}
      </div>
    );
  }

  return (
    <div className="relative w-full">
      <div className="relative min-h-[7rem] sm:min-h-[8rem] md:min-h-[9rem] flex items-center justify-center">
        {slides.map((slideItems, slideIndex) => (
          <div
            key={slideIndex}
            className={`absolute inset-0 flex flex-wrap justify-center gap-6 sm:gap-8 items-center px-2 transition-opacity duration-700 ease-in-out ${
              slideIndex === activeSlide
                ? 'opacity-100 z-10'
                : 'opacity-0 z-0 pointer-events-none'
            }`}
            aria-hidden={slideIndex !== activeSlide}
          >
            {slideItems.map(renderSponsor)}
          </div>
        ))}
      </div>
      <div className="mt-4 flex justify-center gap-2" role="tablist" aria-label={category}>
        {slides.map((_, i) => (
          <button
            key={i}
            type="button"
            role="tab"
            aria-selected={i === activeSlide}
            aria-label={`Slide ${i + 1}`}
            onClick={() => setActiveSlide(i)}
            className={`h-2 w-2 rounded-full transition ${
              i === activeSlide ? 'bg-blue-600 scale-125' : 'bg-gray-300 hover:bg-gray-400'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
