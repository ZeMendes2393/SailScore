'use client';

import { useEffect, useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') || 'http://127.0.0.1:8000';

type Sponsor = {
  id: number;
  category: string;
  image_url: string;
  link_url: string | null;
};

export default function RegattaSponsorsFooter({ regattaId }: { regattaId: number }) {
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);

  useEffect(() => {
    if (!regattaId) return;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/regattas/${regattaId}/sponsors`, { cache: 'no-store' });
        if (res.ok) {
          const data = (await res.json()) as Sponsor[];
          setSponsors(Array.isArray(data) ? data : []);
        }
      } catch {
        setSponsors([]);
      }
    })();
  }, [regattaId]);

  const sponsorsByCategory = sponsors.reduce<Record<string, Sponsor[]>>((acc, s) => {
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
              <div className="flex flex-wrap justify-center gap-8 items-center">
                {items.map((s) => {
                  const Wrapper = s.link_url ? 'a' : 'span';
                  const props = s.link_url
                    ? { href: s.link_url, target: '_blank', rel: 'noopener noreferrer' }
                    : {};
                  return (
                    <Wrapper
                      key={s.id}
                      {...props}
                      className={s.link_url ? 'hover:opacity-80 transition' : ''}
                    >
                      <img
                        src={imageSrc(s.image_url) ?? ''}
                        alt={category}
                        className="max-h-32 max-w-[280px] object-contain"
                      />
                    </Wrapper>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>
    </footer>
  );
}
