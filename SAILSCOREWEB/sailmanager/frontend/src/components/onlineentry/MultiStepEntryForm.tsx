'use client';

import React, { useState } from 'react';
import Step1 from './steps/Step1_Class';
import Step2 from './steps/Step2_Helm';
import Step2Crew from './steps/Step2_Crew';
import Step3 from './steps/Step3_Boat';
import { boatClasses } from '@/utils/boatClasses';

export interface MultiStepEntryFormProps {
  regattaId: number;
}

const MultiStepEntryForm: React.FC<MultiStepEntryFormProps> = ({ regattaId }) => {
  const [step, setStep] = useState(1);

  const [formData, setFormData] = useState<{
    [key: string]: any;
    regatta_id: number;
    class_name: string;
    helm: Record<string, any>;
    crew: Record<string, any>;
    boat: Record<string, any>;
  }>({
    regatta_id: regattaId,
    class_name: '',
    helm: {},
    crew: {},
    boat: {},
  });

  const nextStep = () => setStep((s) => s + 1);
  const prevStep = () => setStep((s) => s - 1);

  const handleChange = (section: string, data: any) => {
    setFormData((prev) => ({
      ...prev,
      [section]: { ...prev[section], ...data },
    }));
  };

  const handleBaseChange = (data: any) => {
    setFormData((prev) => ({ ...prev, ...data }));
  };

  const handleFinalSubmit = async () => {
    const helm = formData.helm || {};
    const boat = formData.boat || {};

    const payload = {
      regatta_id: formData.regatta_id,
      class_name: formData.class_name,
      boat_country: boat.boat_country || '',
      sail_number: boat.sail_number || '',
      boat_name: boat.boat_name || '',
      category: boat.category || '',
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
    };

    try {
      const res = await fetch('http://localhost:8000/entries/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        alert('Entry submitted successfully! You’ll receive an email to activate your Sailor Account.');
        setStep(1);
        setFormData({
          regatta_id: regattaId,
          class_name: '',
          helm: {},
          crew: {},
          boat: {},
        });
      } else {
        const errorData = await res.json().catch(() => ({}));
        console.error('Backend error:', errorData);
        alert('Failed to submit entry.');
      }
    } catch (error) {
      console.error('Unexpected error:', error);
      alert('Submission error. Check console for details.');
    }
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <Step1
            data={{ class_name: formData.class_name, regatta_id: regattaId }}
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
              const crewCount = boatClasses[formData.class_name] || 1;
              if (crewCount > 1) nextStep();
              else setStep(4);
            }}
            onBack={prevStep}
          />
        );
      case 3:
        return (
          <Step2Crew
            data={formData.crew}
            onChange={(data) => handleChange('crew', data)}
            onNext={nextStep}
            onBack={prevStep}
          />
        );
      case 4:
        return (
          <Step3
            data={{ ...formData.boat, fullForm: formData }}
            onChange={(data) => handleChange('boat', data)}
            onSubmit={handleFinalSubmit}
            onBack={() => {
              const crewCount = boatClasses[formData.class_name] || 1;
              if (crewCount > 1) setStep(3);
              else setStep(2);
            }}
          />
        );
      default:
        return null;
    }
  };

  return <div className="p-6 bg-white rounded shadow max-w-3xl mx-auto">{renderStep()}</div>;
};

export default MultiStepEntryForm;
