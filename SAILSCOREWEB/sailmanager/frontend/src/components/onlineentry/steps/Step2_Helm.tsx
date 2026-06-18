'use client';

import { useState } from 'react';
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

interface Step2Props {
  data: any;
  onChange: (data: any) => void;
  onNext: () => void;
  onBack: () => void;
  isRequired: (fieldId: string) => boolean;
  isVisible: (fieldId: string) => boolean;
}

export default function Step2({ data, onChange, onNext, onBack, isRequired, isVisible }: Step2Props) {
  const t = useTranslations('entryForm');
  const tCommon = useTranslations('common');
  const fieldLabel = useEntryFieldLabel();
  const [localData, setLocalData] = useState(data || {});

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    const updated = { ...localData, [name]: value };
    setLocalData(updated);
    onChange(updated);
  };

  const handleNext = (e: React.FormEvent) => {
    e.preventDefault();
    onNext();
  };

  const inputClass =
    'w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500';

  return (
    <form onSubmit={handleNext} className="space-y-6">
      <h2 className="text-xl font-bold text-gray-900">{t('step2.title')}</h2>
      <p className="text-sm text-gray-600">{t('step2.description')}</p>

      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-800 border-b border-gray-200 pb-1">
          {t('step2.sectionIdentification')}
        </h3>
        <div className="grid sm:grid-cols-2 gap-4">
          {isVisible('helm_position') && (
            <Field label={fieldLabel('helm_position')} hint={t('step2.positionHint')}>
              <select
                name="position"
                value={localData.position || 'Skipper'}
                onChange={handleChange}
                className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="Skipper">{t('position.skipper')}</option>
                <option value="Crew">{t('position.crew')}</option>
              </select>
            </Field>
          )}
          {isVisible('first_name') && (
            <Field label={fieldLabel('first_name')} required={isRequired('first_name')}>
              <input
                type="text"
                name="first_name"
                placeholder={t('placeholders.firstName')}
                value={localData.first_name || ''}
                onChange={handleChange}
                className={inputClass}
                required={isRequired('first_name')}
              />
            </Field>
          )}
          {isVisible('last_name') && (
            <Field label={fieldLabel('last_name')} required={isRequired('last_name')}>
              <input
                type="text"
                name="last_name"
                placeholder={t('placeholders.lastName')}
                value={localData.last_name || ''}
                onChange={handleChange}
                className={inputClass}
                required={isRequired('last_name')}
              />
            </Field>
          )}
          {isVisible('date_of_birth') && (
            <Field
              label={fieldLabel('date_of_birth')}
              hint={t('hints.dateOfBirth')}
              required={isRequired('date_of_birth')}
            >
              <input
                type="date"
                lang="en-GB"
                name="date_of_birth"
                value={localData.date_of_birth || ''}
                onChange={handleChange}
                className={inputClass}
                required={isRequired('date_of_birth')}
              />
            </Field>
          )}
          {isVisible('gender') && (
            <Field label={fieldLabel('gender')} required={isRequired('gender')}>
              <select
                name="gender"
                value={localData.gender || ''}
                onChange={handleChange}
                className={inputClass}
                required={isRequired('gender')}
              >
                <option value="">{tCommon('selectEllipsis')}</option>
                <option value="Male">{t('gender.male')}</option>
                <option value="Female">{t('gender.female')}</option>
              </select>
            </Field>
          )}
          {isVisible('federation_license') && (
            <Field
              label={fieldLabel('federation_license')}
              hint={t('hints.federationLicense')}
              required={isRequired('federation_license')}
            >
              <input
                type="text"
                name="federation_license"
                placeholder={t('placeholders.federationLicense')}
                value={localData.federation_license || ''}
                onChange={handleChange}
                className={inputClass}
                required={isRequired('federation_license')}
              />
            </Field>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-800 border-b border-gray-200 pb-1">
          {t('step2.sectionContact')}
        </h3>
        {isVisible('email') && (
          <Field label={fieldLabel('email')} required={isRequired('email')}>
            <input
              type="email"
              name="email"
              placeholder={t('placeholders.email')}
              value={localData.email || ''}
              onChange={handleChange}
              className={inputClass}
              required={isRequired('email')}
            />
          </Field>
        )}
        <div className="grid sm:grid-cols-2 gap-4">
          {isVisible('contact_phone_1') && (
            <Field label={fieldLabel('contact_phone_1')} required={isRequired('contact_phone_1')}>
              <input
                type="text"
                name="contact_phone_1"
                placeholder={t('placeholders.phone1')}
                value={localData.contact_phone_1 || ''}
                onChange={handleChange}
                className={inputClass}
                required={isRequired('contact_phone_1')}
              />
            </Field>
          )}
          {isVisible('contact_phone_2') && (
            <Field label={fieldLabel('contact_phone_2')} required={isRequired('contact_phone_2')}>
              <input
                type="text"
                name="contact_phone_2"
                placeholder={t('placeholders.phone2')}
                value={localData.contact_phone_2 || ''}
                onChange={handleChange}
                className={inputClass}
                required={isRequired('contact_phone_2')}
              />
            </Field>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-800 border-b border-gray-200 pb-1">
          {t('step2.sectionClubCountry')}
        </h3>
        <div className="grid sm:grid-cols-2 gap-4">
          {isVisible('club') && (
            <Field label={fieldLabel('club')} required={isRequired('club')}>
              <input
                type="text"
                name="club"
                placeholder={t('placeholders.club')}
                value={localData.club || ''}
                onChange={handleChange}
                className={inputClass}
                required={isRequired('club')}
              />
            </Field>
          )}
          {isVisible('helm_country') && (
            <Field label={fieldLabel('helm_country')} required={isRequired('helm_country')}>
              <select
                name="helm_country"
                value={localData.helm_country || ''}
                onChange={handleChange}
                className={inputClass}
                required={isRequired('helm_country')}
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
          {isVisible('helm_country_secondary') && (
            <Field
              label={fieldLabel('helm_country_secondary')}
              hint={t('hints.dualNationality')}
              required={isRequired('helm_country_secondary')}
            >
              <select
                name="helm_country_secondary"
                value={localData.helm_country_secondary || ''}
                onChange={handleChange}
                className={inputClass}
                required={isRequired('helm_country_secondary')}
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
          {isVisible('territory') && (
            <Field label={fieldLabel('territory')} required={isRequired('territory')}>
              <input
                type="text"
                name="territory"
                placeholder={t('placeholders.territory')}
                value={localData.territory || ''}
                onChange={handleChange}
                className={inputClass}
                required={isRequired('territory')}
              />
            </Field>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-800 border-b border-gray-200 pb-1">
          {t('step2.sectionAddress')}
        </h3>
        {isVisible('address') && (
          <Field label={fieldLabel('address')} required={isRequired('address')}>
            <input
              type="text"
              name="address"
              placeholder={t('placeholders.address')}
              value={localData.address || ''}
              onChange={handleChange}
              className={inputClass}
              required={isRequired('address')}
            />
          </Field>
        )}
        <div className="grid sm:grid-cols-2 gap-4">
          {isVisible('zip_code') && (
            <Field label={fieldLabel('zip_code')} required={isRequired('zip_code')}>
              <input
                type="text"
                name="zip_code"
                placeholder={t('placeholders.postcode')}
                value={localData.zip_code || ''}
                onChange={handleChange}
                className={inputClass}
                required={isRequired('zip_code')}
              />
            </Field>
          )}
          {isVisible('town') && (
            <Field label={fieldLabel('town')} required={isRequired('town')}>
              <input
                type="text"
                name="town"
                placeholder={t('placeholders.town')}
                value={localData.town || ''}
                onChange={handleChange}
                className={inputClass}
                required={isRequired('town')}
              />
            </Field>
          )}
        </div>
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
