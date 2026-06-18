'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { apiGet } from '@/lib/api';
import { SailNumberDisplay } from '@/components/ui/SailNumberDisplay';
import { compareBySailThenCountry } from '@/lib/sailNumberSort';

type PublishedBoat = {
  sail_number: string | null;
  boat_country_code?: string | null;
  boat_name: string | null;
  helm_name: string | null;
};

type PublishedFleet = {
  id: number;
  name: string;
  order_index: number;
  boats: PublishedBoat[];
};

type PublishedFleetSet = {
  id: number;
  title: string;
  phase: 'qualifying' | 'finals';
  created_at: string;
  fleets: PublishedFleet[];
};

type Props = {
  regattaId: number;
};

export default function FleetsPublic({ regattaId }: Props) {
  const t = useTranslations('noticeSections.fleets');
  const [sets, setSets] = useState<PublishedFleetSet[]>([]);
  const [selectedSetId, setSelectedSetId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!regattaId || Number.isNaN(regattaId)) return;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await apiGet<PublishedFleetSet[]>(`/public/regattas/${regattaId}/fleets`);
        const list = data || [];
        list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        setSets(list);
        if (list.length > 0) {
          setSelectedSetId(list[0].id);
        }
      } catch (e: any) {
        console.error('Failed to load published fleets:', e);
        setError(e?.message || t('loadFailed'));
      } finally {
        setLoading(false);
      }
    })();
  }, [regattaId, t]);

  if (loading && sets.length === 0) {
    return <p className="text-sm text-gray-600">{t('loading')}</p>;
  }

  if (error && sets.length === 0) {
    return <p className="text-sm text-red-600">{error}</p>;
  }

  if (sets.length === 0) {
    return <p className="text-sm text-gray-600">{t('nonePublished')}</p>;
  }

  const current = sets.find((s) => s.id === selectedSetId) ?? sets[0];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-gray-700">{t('publishedFleets')}</span>
        <select
          className="border rounded px-3 py-1 text-sm"
          value={current.id}
          onChange={(e) => setSelectedSetId(Number(e.target.value))}
        >
          {sets.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title} — {s.phase === 'qualifying' ? t('phaseQualifying') : t('phaseFinals')}
            </option>
          ))}
        </select>
        <span className="text-xs text-gray-500">
          {t('publishedAt', { date: new Date(current.created_at).toLocaleString('en-GB') })}
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {current.fleets
          .slice()
          .sort((a, b) => a.order_index - b.order_index)
          .map((fleet) => (
            <div key={fleet.id} className="border rounded-2xl p-3 bg-white shadow-sm">
              <div className="flex items-baseline justify-between mb-2">
                <h3 className="font-semibold text-sm">{t('fleetName', { name: fleet.name })}</h3>
                <span className="text-xs text-gray-500">
                  {t('boatsCount', { count: fleet.boats.length })}
                </span>
              </div>
              {fleet.boats.length === 0 ? (
                <p className="text-xs text-gray-500">{t('noBoatsInFleet')}</p>
              ) : (
                <table className="w-full text-xs border border-gray-200">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="border px-2 py-1 text-left">{t('sail')}</th>
                      <th className="border px-2 py-1 text-left">{t('boat')}</th>
                      <th className="border px-2 py-1 text-left">{t('helm')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fleet.boats
                      .slice()
                      .sort(compareBySailThenCountry)
                      .map((b, i) => (
                        <tr key={`${fleet.id}-${i}`}>
                          <td className="border px-2 py-1">
                            <SailNumberDisplay
                              countryCode={(b as any).boat_country_code}
                              sailNumber={b.sail_number}
                            />
                          </td>
                          <td className="border px-2 py-1">{b.boat_name ?? ''}</td>
                          <td className="border px-2 py-1">{b.helm_name ?? ''}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              )}
            </div>
          ))}
      </div>
    </div>
  );
}
