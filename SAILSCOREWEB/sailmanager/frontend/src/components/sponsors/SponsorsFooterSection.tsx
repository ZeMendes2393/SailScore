'use client';

import SponsorsCategoryCarousel, { type SponsorItem } from './SponsorsCategoryCarousel';

export type { SponsorItem };

type SponsorsFooterSectionProps = {
  sponsors: SponsorItem[];
  imageClassName?: string;
};

export default function SponsorsFooterSection({
  sponsors,
  imageClassName = 'max-h-32 max-w-[280px] object-contain',
}: SponsorsFooterSectionProps) {
  const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') || 'http://127.0.0.1:8000';

  const sponsorsByCategory = sponsors.reduce<Record<string, SponsorItem[]>>((acc, s) => {
    const cat = s.category || 'Other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(s);
    return acc;
  }, {});

  const imageSrc = (url: string | null) =>
    !url ? null : url.startsWith('http') ? url : `${API_BASE}${url}`;

  if (Object.keys(sponsorsByCategory).length === 0) return null;

  return (
    <footer className="border-t bg-gray-50/80">
      <section className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-10 text-center">
        <div className="space-y-8 flex flex-col items-center">
          {Object.entries(sponsorsByCategory).map(([category, items]) => (
            <div key={category} className="w-full">
              <h3 className="text-sm font-semibold text-blue-700 uppercase tracking-wider mb-4">
                {category}
              </h3>
              <SponsorsCategoryCarousel
                category={category}
                items={items}
                imageSrc={imageSrc}
                imageClassName={imageClassName}
              />
            </div>
          ))}
        </div>
      </section>
    </footer>
  );
}
