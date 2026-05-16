'use client';

import React, { useRef, useState } from 'react';
import Step1 from './steps/Step1_Class';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:8000').replace(/\/$/, '');
import Step2 from './steps/Step2_Helm';
import Step2Crew from './steps/Step2_Crew';
import Step3 from './steps/Step3_Boat';
import { boatClasses } from '@/utils/boatClasses';
import notify from '@/lib/notify';

export interface MultiStepEntryFormProps {
  regattaId: number;
}

const MultiStepEntryForm: React.FC<MultiStepEntryFormProps> = ({ regattaId }) => {
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitLockRef = useRef(false);

  const [formData, setFormData] = useState<{
    [key: string]: any;
    regatta_id: number;
    class_name: string;
    class_type?: string;
    sailors_per_boat?: number;
    helm: Record<string, any>;
    crew: any[];
    boat: Record<string, any>;
  }>({
    regatta_id: regattaId,
    class_name: '',
    class_type: undefined,
    sailors_per_boat: undefined,
    helm: {},
    crew: [],
    boat: {},
  });

  const nextStep = () => setStep((s) => s + 1);
  const prevStep = () => setStep((s) => s - 1);

  const handleChange = (section: string, data: any) => {
    setFormData((prev) => ({
      ...prev,
      [section]: section === 'crew' && Array.isArray(data) ? data : { ...prev[section], ...data },
    }));
  };

  const handleBaseChange = (data: any) => {
    setFormData((prev) => ({ ...prev, ...data }));
  };

  const handleFinalSubmit = async () => {
    if (isSubmitting || submitLockRef.current) return;

    const helm = formData.helm || {};
    const boat = formData.boat || {};

    if (!(boat.sail_number || '').trim()) {
      notify.warning('Sail number is required.');
      return;
    }
    if (!(boat.boat_country_code || '').trim()) {
      notify.warning('Sail country code is required.');
      return;
    }

    const crewList = Array.isArray(formData.crew) ? formData.crew : [];
    const crew_members = crewList
      .filter(
        (c: any) =>
          (c?.first_name && c.first_name.trim()) ||
          (c?.last_name && c.last_name.trim()) ||
          (c?.email && c.email.trim())
      )
      .map((c: any) => ({ ...c, position: c.position || 'Crew' }));
    const helm_position = (formData.helm && formData.helm.position) || 'Skipper';

    const payload = {
      regatta_id: formData.regatta_id,
      class_name: formData.class_name,
      // Guardar sempre um código (ISO alpha-3) em boat_country,
      // usando o campo dedicado boat_country_code como fallback.
      boat_country: (boat.boat_country || boat.boat_country_code || '').trim(),
      boat_country_code: (boat.boat_country_code || '').trim(),
      sail_number: (boat.sail_number || '').trim(),
      boat_name: boat.boat_name || '',
      boat_model: boat.boat_model || undefined,
      rating: boat.rating != null && boat.rating !== '' ? Number(boat.rating) : undefined,
      category:
        formData.class_type === 'handicap'
          ? undefined
          : (boat.category || ''),
      owner_first_name: boat.owner_first_name || undefined,
      owner_last_name: boat.owner_last_name || undefined,
      owner_email: boat.owner_email || undefined,
      crew_members,
      helm_position,
      // helm/skipper data
      first_name: helm.first_name || '',
      last_name: helm.last_name || '',
      date_of_birth: helm.date_of_birth || '',
      gender: helm.gender || '',
      email: helm.email || '',
      contact_phone_1: helm.contact_phone_1 || '',
      contact_phone_2: helm.contact_phone_2 || '',
      helm_country: helm.helm_country || '',
      helm_country_secondary: helm.helm_country_secondary || '',
      address: helm.address || '',
      zip_code: helm.zip_code || '',
      town: helm.town || '',
      club: helm.club || '',
      territory: helm.territory || '',
      federation_license: (helm.federation_license || '').trim() || undefined,
    };

    submitLockRef.current = true;
    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/entries/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = await res.json().catch(() => null);
        const waiting = !!data?.waiting_list;
        if (waiting) {
          notify.warning({
            title: 'Added to waiting list',
            description:
              'Your entry was received, but the championship limit was reached. You have been placed on the waiting list.',
          });
        } else {
          notify.success('Entry submitted successfully!');
        }
        setStep(1);
        setFormData({
          regatta_id: regattaId,
          class_name: '',
          class_type: undefined,
          sailors_per_boat: undefined,
          helm: {},
          crew: [],
          boat: {},
        });
      } else {
        const errorData = await res.json().catch(() => ({}));
        console.error('Backend error:', errorData);
        const detail =
          typeof errorData?.detail === 'string'
            ? errorData.detail
            : 'Please review the form and try again.';
        notify.error({
          title: res.status === 409 ? 'Entry already submitted' : 'Failed to submit entry',
          description:
            res.status === 409
              ? 'This sail number is already registered in this class. If you already submitted, check your email for confirmation.'
              : detail,
        });
      }
    } catch (error) {
      console.error('Unexpected error:', error);
      notify.error({
        title: 'Submission error',
        description: 'Something went wrong while submitting. Please try again.',
      });
    } finally {
      setIsSubmitting(false);
      submitLockRef.current = false;
    }
  };

  const crewCount =
    formData.class_type === 'one_design' && formData.sailors_per_boat != null && formData.sailors_per_boat > 0
      ? formData.sailors_per_boat
      : (boatClasses[formData.class_name] ?? 1);
  const showCrewStep = crewCount >= 2;

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <Step1
            data={{
              class_name: formData.class_name,
              class_type: formData.class_type,
              sailors_per_boat: formData.sailors_per_boat,
              regatta_id: regattaId,
            }}
            onChange={handleBaseChange}
            onNext={nextStep}
          />
        );
      case 2:
        return (
          <Step2
            data={formData.helm}
            onChange={(data) => handleChange('helm', data)}
            onNext={() => {
              if (showCrewStep) nextStep();
              else setStep(4);
            }}
            onBack={prevStep}
          />
        );
      case 3:
        return (
          <Step2Crew
            data={Array.isArray(formData.crew) ? formData.crew : []}
            helm={formData.helm || {}}
            sailorsPerBoat={formData.sailors_per_boat ?? 2}
            onChange={(data) => handleChange('crew', data)}
            onNext={nextStep}
            onBack={prevStep}
          />
        );
      case 4:
        return (
          <Step3
            data={{ ...formData.boat, fullForm: formData, class_type: formData.class_type }}
            onChange={(data) => handleChange('boat', data)}
            onSubmit={handleFinalSubmit}
            isSubmitting={isSubmitting}
            onBack={() => {
              if (showCrewStep) setStep(3);
              else setStep(2);
            }}
          />
        );
      default:
        return null;
    }
  };

  const sailorsSummary =
    step >= 2 && formData.helm
      ? [
          { name: [formData.helm.first_name, formData.helm.last_name].filter(Boolean).join(' ').trim() || '—', pos: formData.helm.position || 'Skipper' },
          ...(Array.isArray(formData.crew) ? formData.crew : []).map((c: any) => ({
            name: [c.first_name, c.last_name].filter(Boolean).join(' ').trim() || '—',
            pos: c.position || 'Crew',
          })),
        ]
      : [];

  return (
    <div className="relative p-6 bg-white rounded shadow max-w-3xl mx-auto">
      {isSubmitting && (
        <div
          className="absolute inset-0 z-20 flex flex-col items-center justify-center rounded bg-white/95 px-6 text-center"
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <div
            className="h-12 w-12 rounded-full border-4 border-blue-200 border-t-blue-600 animate-spin"
            aria-hidden="true"
          />
          <p className="mt-4 text-lg font-semibold text-gray-900">Submitting your entry…</p>
          <p className="mt-2 max-w-sm text-sm text-gray-600">
            Please wait while we process your registration and send your confirmation email. Do not
            close this page or click submit again.
          </p>
        </div>
      )}
      {sailorsSummary.length > 0 && (
        <div className="mb-4 p-3 rounded-lg border border-gray-200 bg-gray-50 text-sm">
          <span className="font-semibold text-gray-700">Sailors in this entry: </span>
          {sailorsSummary.map((s, i) => (
            <span key={i} className="mr-2">
              {s.name} <span className="text-gray-500">({s.pos})</span>
              {i < sailorsSummary.length - 1 ? ', ' : ''}
            </span>
          ))}
        </div>
      )}
      {renderStep()}
    </div>
  );
};

export default MultiStepEntryForm;
