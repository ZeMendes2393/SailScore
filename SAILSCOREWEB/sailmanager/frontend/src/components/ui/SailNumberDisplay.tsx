'use client';

import { getAlpha2ForFlag } from '@/utils/countries';

interface SailNumberDisplayProps {
  countryCode?: string | null;
  sailNumber?: string | null;
  className?: string;
}

/**
 * Renders sail number in the format: [Flag image] [Country Code] [Sail Number]
 * e.g. 🇵🇹 POR 47, 🇬🇧 GBR 375. Uses flag image so the flag displays correctly on all systems.
 */
export function SailNumberDisplay({ countryCode, sailNumber, className = '' }: SailNumberDisplayProps) {
  const code = (countryCode || '').toString().trim().toUpperCase();
  const num = (sailNumber || '').toString().trim();
  const alpha2 = getAlpha2ForFlag(code);

  if (!code && !num) return <span className={className}>—</span>;
  if (!num) {
    return (
      <span className={`inline-flex items-center gap-1 ${className}`}>
        {alpha2 && (
          <img
            src={`https://flagcdn.com/w40/${alpha2}.png`}
            alt=""
            className="inline-block w-5 h-[0.75rem] object-cover align-middle"
            loading="lazy"
          />
        )}
        <span>{code || '—'}</span>
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      {alpha2 && (
        <img
          src={`https://flagcdn.com/w40/${alpha2}.png`}
          alt=""
          className="inline-block w-5 h-[0.75rem] object-cover align-middle"
          loading="lazy"
        />
      )}
      <span>{code ? `${code} ${num}` : num}</span>
    </span>
  );
}
