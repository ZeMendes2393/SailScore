'use client';

import { useState, useEffect } from 'react';

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
}

const inputClass =
  'w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500';

function sailorLabel(m: { first_name?: string; last_name?: string }) {
  const n = [m.first_name, m.last_name].filter(Boolean).join(' ').trim();
  return n || '—';
}

export default function Step2Crew({ data, helm, sailorsPerBoat, onChange, onNext, onBack }: Step2CrewProps) {
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
      <h2 className="text-xl font-bold text-gray-900">Crew members</h2>
      <p className="text-sm text-gray-600">
        You can add more crew members (up to {sailorsPerBoat} in total). Each with position Skipper or Crew.
      </p>

      <section className="rounded-lg border border-gray-200 bg-gray-50 p-4">
        <h3 className="text-sm font-semibold text-gray-800 mb-2">Sailors in this entry</h3>
        <ul className="space-y-1.5 text-sm">
          <li className="flex items-center gap-2">
            <span className="font-medium">{sailorLabel(helm)}</span>
            <span className="text-gray-500">({helm.position || 'Skipper'})</span>
          </li>
          {localCrew.map((c, i) => (
            <li key={i} className="flex items-center gap-2">
              <span className="font-medium">{sailorLabel(c)}</span>
              <span className="text-gray-500">({c.position || 'Crew'})</span>
            </li>
          ))}
          {localCrew.length === 0 && (
            <li className="text-gray-500">Add crew members below if the boat has more than one sailor.</li>
          )}
        </ul>
      </section>

      {/* Lista de formulários de tripulantes */}
      <div className="space-y-6">
        {localCrew.map((member, index) => (
          <div key={index} className="rounded-lg border border-gray-300 bg-white p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-gray-800">Crew member {index + 1}</h4>
              <button
                type="button"
                onClick={() => removeCrew(index)}
                className="text-sm text-red-600 hover:underline"
              >
                Remover
              </button>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Position">
                <select
                  value={member.position || 'Crew'}
                  onChange={(e) => updateCrewAt(index, { position: e.target.value })}
                  className={inputClass}
                >
                  <option value="Skipper">Skipper</option>
                  <option value="Crew">Crew</option>
                </select>
              </Field>
              <Field label="First name">
                <input
                  type="text"
                  value={member.first_name || ''}
                  onChange={(e) => updateCrewAt(index, { first_name: e.target.value })}
                  placeholder="e.g. Jane"
                  className={inputClass}
                />
              </Field>
              <Field label="Last name">
                <input
                  type="text"
                  value={member.last_name || ''}
                  onChange={(e) => updateCrewAt(index, { last_name: e.target.value })}
                  placeholder="e.g. Smith"
                  className={inputClass}
                />
              </Field>
              <Field label="Email">
                <input
                  type="email"
                  value={member.email || ''}
                  onChange={(e) => updateCrewAt(index, { email: e.target.value })}
                  placeholder="e.g. jane@example.com"
                  className={inputClass}
                />
              </Field>
              <Field label="Federation license" hint="Optional for each crew member">
                <input
                  type="text"
                  value={member.federation_license || ''}
                  onChange={(e) => updateCrewAt(index, { federation_license: e.target.value })}
                  placeholder="e.g. 12345"
                  className={inputClass}
                />
              </Field>
            </div>
          </div>
        ))}

        {localCrew.length < maxCrew && (
          <button
            type="button"
            onClick={addCrew}
            className="w-full py-3 rounded-lg border-2 border-dashed border-gray-300 text-gray-600 hover:border-blue-500 hover:text-blue-600 font-medium"
          >
            + Add crew member
          </button>
        )}
      </div>

      <div className="flex justify-between pt-2">
        <button type="button" onClick={onBack} className="px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50">
          Back
        </button>
        <button type="submit" className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
          Next
        </button>
      </div>
    </form>
  );
}
