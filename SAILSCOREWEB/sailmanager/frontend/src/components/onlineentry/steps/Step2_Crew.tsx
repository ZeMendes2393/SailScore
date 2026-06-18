'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { COUNTRIES_UNIQUE } from '@/utils/countries';
import { useEntryFieldLabel } from '@/lib/useEntryFieldLabel';

function Field({
  label,
  required,
  children,
  hint,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {hint && <p className="text-xs text-gray-500 mb-1">{hint}</p>}
      {children}
    </div>
  );
}

export type CrewMember = {
  position?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  federation_license?: string;
  date_of_birth?: string;
  gender?: string;
  contact_phone_1?: string;
  contact_phone_2?: string;
  club?: string;
  helm_country?: string;
  helm_country_secondary?: string;
  territory?: string;
  address?: string;
  zip_code?: string;
  town?: string;
};

interface Step2CrewProps {
  data: CrewMember[];
  helm: { first_name?: string; last_name?: string; position?: string };
  sailorsPerBoat: number;
  onChange: (data: CrewMember[]) => void;
  onNext: () => void;
  onBack: () => void;
  isRequired: (fieldId: string) => boolean;
  isVisible: (fieldId: string) => boolean;
}

const inputClass =
  'w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500';

function sailorLabel(m: { first_name?: string; last_name?: string }, dash: string) {
  const n = [m.first_name, m.last_name].filter(Boolean).join(' ').trim();
  return n || dash;
}

export default function Step2Crew({
  data,
  helm,
  sailorsPerBoat,
  onChange,
  onNext,
  onBack,
  isRequired,
  isVisible,
}: Step2CrewProps) {
  const t = useTranslations('entryForm');
  const tCommon = useTranslations('common');
  const fieldLabel = useEntryFieldLabel();
  const crewList: CrewMember[] = Array.isArray(data) && data.length > 0 ? data : [];
  const maxCrew = Math.max(0, (sailorsPerBoat || 2) - 1);

  const [localCrew, setLocalCrew] = useState<CrewMember[]>(crewList);

  useEffect(() => {
    setLocalCrew(Array.isArray(data) && data.length > 0 ? data : []);
  }, [data]);

  const updateCrew = (next: CrewMember[]) => {
    setLocalCrew(next);
    onChange(next);
  };

  const addCrew = () => {
    if (localCrew.length >= maxCrew) return;
    updateCrew([...localCrew, { position: 'Crew' }]);
  };

  const removeCrew = (index: number) => {
    const next = localCrew.filter((_, i) => i !== index);
    updateCrew(next);
  };

  const updateCrewAt = (index: number, updates: Partial<CrewMember>) => {
    const next = localCrew.map((c, i) => (i === index ? { ...c, ...updates } : c));
    updateCrew(next);
  };

  const handleNext = (e: React.FormEvent) => {
    e.preventDefault();
    onNext();
  };

  return (
    <form onSubmit={handleNext} className="space-y-6">
      <h2 className="text-xl font-bold text-gray-900">{t('step2Crew.title')}</h2>
      <p className="text-sm text-gray-600">{t('step2Crew.description', { count: sailorsPerBoat })}</p>

      <section className="rounded-lg border border-gray-200 bg-gray-50 p-4">
        <h3 className="text-sm font-semibold text-gray-800 mb-2">{t('step2Crew.sailorsInEntry')}</h3>
        <ul className="space-y-1.5 text-sm">
          <li className="flex items-center gap-2">
            <span className="font-medium">{sailorLabel(helm, tCommon('dash'))}</span>
            <span className="text-gray-500">({helm.position || t('position.skipper')})</span>
          </li>
          {localCrew.map((c, i) => (
            <li key={i} className="flex items-center gap-2">
              <span className="font-medium">{sailorLabel(c, tCommon('dash'))}</span>
              <span className="text-gray-500">({c.position || t('position.crew')})</span>
            </li>
          ))}
          {localCrew.length === 0 && (
            <li className="text-gray-500">{t('step2Crew.addCrewBelow')}</li>
          )}
        </ul>
      </section>

      <div className="space-y-6">
        {localCrew.map((member, index) => (
          <div key={index} className="rounded-lg border border-gray-300 bg-white p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-gray-800">
                {t('step2Crew.crewMember', { index: index + 1 })}
              </h4>
              <button
                type="button"
                onClick={() => removeCrew(index)}
                className="text-sm text-red-600 hover:underline"
              >
                {tCommon('remove')}
              </button>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              {isVisible('crew_position') && (
                <Field label={fieldLabel('crew_position')}>
                  <select
                    value={member.position || 'Crew'}
                    onChange={(e) => updateCrewAt(index, { position: e.target.value })}
                    className={inputClass}
                  >
                    <option value="Skipper">{t('position.skipper')}</option>
                    <option value="Crew">{t('position.crew')}</option>
                  </select>
                </Field>
              )}
              {isVisible('crew_first_name') && (
                <Field label={fieldLabel('crew_first_name')} required={isRequired('crew_first_name')}>
                  <input
                    type="text"
                    value={member.first_name || ''}
                    onChange={(e) => updateCrewAt(index, { first_name: e.target.value })}
                    placeholder={t('placeholders.firstName')}
                    className={inputClass}
                    required={isRequired('crew_first_name')}
                  />
                </Field>
              )}
              {isVisible('crew_last_name') && (
                <Field label={fieldLabel('crew_last_name')} required={isRequired('crew_last_name')}>
                  <input
                    type="text"
                    value={member.last_name || ''}
                    onChange={(e) => updateCrewAt(index, { last_name: e.target.value })}
                    placeholder={t('placeholders.lastName')}
                    className={inputClass}
                    required={isRequired('crew_last_name')}
                  />
                </Field>
              )}
              {isVisible('crew_email') && (
                <Field label={fieldLabel('crew_email')} required={isRequired('crew_email')}>
                  <input
                    type="email"
                    value={member.email || ''}
                    onChange={(e) => updateCrewAt(index, { email: e.target.value })}
                    placeholder={t('placeholders.email')}
                    className={inputClass}
                    required={isRequired('crew_email')}
                  />
                </Field>
              )}
              {isVisible('crew_club') && (
                <Field label={fieldLabel('crew_club')} required={isRequired('crew_club')}>
                  <input
                    type="text"
                    value={member.club || ''}
                    onChange={(e) => updateCrewAt(index, { club: e.target.value })}
                    placeholder={t('placeholders.club')}
                    className={inputClass}
                    required={isRequired('crew_club')}
                  />
                </Field>
              )}
              {isVisible('crew_federation_license') && (
                <Field
                  label={fieldLabel('crew_federation_license')}
                  hint={t('hints.federationLicenseCrew')}
                  required={isRequired('crew_federation_license')}
                >
                  <input
                    type="text"
                    value={member.federation_license || ''}
                    onChange={(e) => updateCrewAt(index, { federation_license: e.target.value })}
                    placeholder={t('placeholders.federationLicense')}
                    className={inputClass}
                    required={isRequired('crew_federation_license')}
                  />
                </Field>
              )}
              {isVisible('crew_gender') && (
                <Field
                  label={fieldLabel('crew_gender')}
                  hint={t('hints.genderCrew')}
                  required={isRequired('crew_gender')}
                >
                  <select
                    value={member.gender || ''}
                    onChange={(e) => updateCrewAt(index, { gender: e.target.value })}
                    className={inputClass}
                    required={isRequired('crew_gender')}
                  >
                    <option value="">{tCommon('dash')}</option>
                    <option value="Male">{t('gender.male')}</option>
                    <option value="Female">{t('gender.female')}</option>
                  </select>
                </Field>
              )}
              {isVisible('crew_helm_country') && (
                <Field label={fieldLabel('crew_helm_country')} required={isRequired('crew_helm_country')}>
                  <select
                    value={member.helm_country || ''}
                    onChange={(e) => updateCrewAt(index, { helm_country: e.target.value })}
                    className={inputClass}
                    required={isRequired('crew_helm_country')}
                  >
                    <option value="">{tCommon('dash')}</option>
                    {COUNTRIES_UNIQUE.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.name} ({c.code})
                      </option>
                    ))}
                  </select>
                </Field>
              )}
            </div>
          </div>
        ))}

        {localCrew.length < maxCrew && (
          <button
            type="button"
            onClick={addCrew}
            className="w-full py-3 rounded-lg border-2 border-dashed border-gray-300 text-gray-600 hover:border-blue-500 hover:text-blue-600 font-medium"
          >
            {t('buttons.addCrew')}
          </button>
        )}
      </div>

      <div className="flex justify-between pt-2">
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50"
        >
          {t('buttons.back')}
        </button>
        <button type="submit" className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
          {t('buttons.next')}
        </button>
      </div>
    </form>
  );
}
