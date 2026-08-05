'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { COUNTRIES_UNIQUE } from '@/utils/countries';
import { sanitizeSailNumberInput } from '@/lib/sailNumberInput';
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

interface Step3Props {
  data: any;
  onChange: (data: any) => void;
  onSubmit: () => void;
  onBack: () => void;
  isSubmitting?: boolean;
  isRequired: (fieldId: string) => boolean;
  isVisible: (fieldId: string) => boolean;
  termsAcceptance?: {
    title: string;
    text: string;
    accepted: boolean;
    onAcceptedChange: (accepted: boolean) => void;
  } | null;
  dataOptOut?: {
    text: string;
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
  } | null;
}

export default function Step3({
  data,
  onChange,
  onSubmit,
  onBack,
  isSubmitting = false,
  isRequired,
  isVisible,
  termsAcceptance = null,
  dataOptOut = null,
}: Step3Props) {
  const t = useTranslations('entryForm');
  const tCommon = useTranslations('common');
  const fieldLabel = useEntryFieldLabel();
  const [localData, setLocalData] = useState(data || {});
  const isHandicap = (data?.fullForm?.class_type || data?.class_type) === 'handicap';

  useEffect(() => {
    setLocalData(data || {});
  }, [data]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    const nextValue = name === 'sail_number' ? sanitizeSailNumberInput(value) : value;
    const updated = { ...localData, [name]: nextValue };
    setLocalData(updated);
    onChange(updated);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    onSubmit();
  };

  const inputClass =
    'w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500';

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <h2 className="text-xl font-bold text-gray-900">{t('step3.title')}</h2>
      <p className="text-sm text-gray-600">{t('step3.description')}</p>

      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-800 border-b border-gray-200 pb-1">
          {t('step3.sectionBoatId')}
        </h3>
        {isVisible('boat_name') && (
          <Field
            label={fieldLabel('boat_name')}
            required={isRequired('boat_name')}
            hint={t('hints.boatName')}
          >
            <input
              type="text"
              name="boat_name"
              placeholder={t('placeholders.boatName')}
              value={localData.boat_name || ''}
              onChange={handleChange}
              className={inputClass}
              required={isRequired('boat_name')}
            />
          </Field>
        )}
        {isVisible('boat_country_code') && (
          <Field
            label={fieldLabel('boat_country_code')}
            required={isRequired('boat_country_code')}
            hint={t('hints.boatCountry')}
          >
            <select
              name="boat_country_code"
              value={localData.boat_country_code || ''}
              onChange={handleChange}
              className={inputClass}
              required={isRequired('boat_country_code')}
            >
              <option value="">{tCommon('select')}</option>
              {COUNTRIES_UNIQUE.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name} ({c.code})
                </option>
              ))}
            </select>
          </Field>
        )}
        {isVisible('sail_number') && (
          <Field
            label={fieldLabel('sail_number')}
            required={isRequired('sail_number')}
            hint={t('hints.sailNumber')}
          >
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              name="sail_number"
              placeholder={t('placeholders.sailNumber')}
              value={localData.sail_number || ''}
              onChange={handleChange}
              className={inputClass}
              required={isRequired('sail_number')}
            />
          </Field>
        )}

        {isVisible('advertising_license') && (
          <Field
            label={fieldLabel('advertising_license')}
            required={isRequired('advertising_license')}
            hint={t('hints.advertisingLicense')}
          >
            <input
              type="text"
              name="advertising_license"
              placeholder={t('placeholders.advertisingLicense')}
              value={localData.advertising_license || ''}
              onChange={handleChange}
              className={inputClass}
              required={isRequired('advertising_license')}
            />
          </Field>
        )}

        {isHandicap && (
          <>
            {isVisible('boat_model') && (
              <Field
                label={fieldLabel('boat_model')}
                hint={t('hints.boatModel')}
                required={isRequired('boat_model')}
              >
                <input
                  type="text"
                  name="boat_model"
                  placeholder={t('placeholders.boatModel')}
                  value={localData.boat_model || ''}
                  onChange={handleChange}
                  className={inputClass}
                  required={isRequired('boat_model')}
                />
              </Field>
            )}
            {(isVisible('owner_first_name') || isVisible('owner_last_name') || isVisible('owner_email')) && (
              <>
                <h3 className="text-sm font-semibold text-gray-800 border-b border-gray-200 pb-1 mt-4">
                  {t('step3.sectionOwner')}
                </h3>
                <p className="text-xs text-gray-600">{t('step3.ownerHint')}</p>
                <div className="grid sm:grid-cols-2 gap-4">
                  {isVisible('owner_first_name') && (
                    <Field label={fieldLabel('owner_first_name')} required={isRequired('owner_first_name')}>
                      <input
                        type="text"
                        name="owner_first_name"
                        placeholder={t('placeholders.firstName')}
                        value={localData.owner_first_name || ''}
                        onChange={handleChange}
                        className={inputClass}
                        required={isRequired('owner_first_name')}
                      />
                    </Field>
                  )}
                  {isVisible('owner_last_name') && (
                    <Field label={fieldLabel('owner_last_name')} required={isRequired('owner_last_name')}>
                      <input
                        type="text"
                        name="owner_last_name"
                        placeholder={t('placeholders.lastName')}
                        value={localData.owner_last_name || ''}
                        onChange={handleChange}
                        className={inputClass}
                        required={isRequired('owner_last_name')}
                      />
                    </Field>
                  )}
                  {isVisible('owner_email') && (
                    <Field label={fieldLabel('owner_email')} required={isRequired('owner_email')}>
                      <input
                        type="email"
                        name="owner_email"
                        placeholder={t('placeholders.email')}
                        value={localData.owner_email || ''}
                        onChange={handleChange}
                        className={inputClass}
                        required={isRequired('owner_email')}
                      />
                    </Field>
                  )}
                </div>
              </>
            )}
          </>
        )}

        {!isHandicap && isVisible('category') && (
          <Field label={fieldLabel('category')} hint={t('hints.category')} required={isRequired('category')}>
            <input
              type="text"
              name="category"
              placeholder={t('placeholders.category')}
              value={localData.category || ''}
              onChange={handleChange}
              className={inputClass}
              required={isRequired('category')}
            />
          </Field>
        )}
      </div>

      {(dataOptOut || termsAcceptance) && (
        <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-4 space-y-3">
          {termsAcceptance && (
            <div>
              <h3 className="text-base font-semibold text-gray-900">{termsAcceptance.title}</h3>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-gray-700">
                {termsAcceptance.text}
              </p>
            </div>
          )}
          {dataOptOut && (
            <label className="flex items-start gap-3 text-sm font-medium text-gray-800">
              <input
                type="checkbox"
                checked={dataOptOut.checked}
                onChange={(event) => dataOptOut.onCheckedChange(event.target.checked)}
                className="mt-1 rounded border-gray-300"
              />
              <span>{dataOptOut.text}</span>
            </label>
          )}
          {termsAcceptance && (
            <label className="flex items-start gap-3 text-sm font-medium text-gray-800">
              <input
                type="checkbox"
                checked={termsAcceptance.accepted}
                onChange={(event) => termsAcceptance.onAcceptedChange(event.target.checked)}
                className="mt-1 rounded border-gray-300"
                required
              />
              <span>{t('terms.acceptLabel')}</span>
            </label>
          )}
        </div>
      )}

      <div className="flex justify-between pt-2">
        <button
          type="button"
          onClick={onBack}
          disabled={isSubmitting}
          className="px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {t('buttons.back')}
        </button>
        <button
          type="submit"
          disabled={isSubmitting || (!!termsAcceptance && !termsAcceptance.accepted)}
          className="px-5 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isSubmitting ? t('buttons.submitting') : t('buttons.submit')}
        </button>
      </div>
    </form>
  );
}
