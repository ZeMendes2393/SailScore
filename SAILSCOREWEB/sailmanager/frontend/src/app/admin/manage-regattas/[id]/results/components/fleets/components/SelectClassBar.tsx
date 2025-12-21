'use client';
import React from 'react';

type Props = {
  classes: string[];
  selectedClass: string | null;
  setSelectedClass: (c: string | null) => void;
  clearSelections: () => void; // limpa selectedSet e modeCreate
};

export default function SelectClassBar({
  classes,
  selectedClass,
  setSelectedClass,
  clearSelections,
}: Props) {
  return (
    <div className="flex gap-2 flex-wrap">
      {classes.map((c) => (
        <button
          key={c}
          className={`px-3 py-1 rounded border ${
            c === selectedClass
              ? 'bg-blue-600 text-white border-blue-600'
              : 'bg-white text-blue-600 border-blue-600 hover:bg-blue-50'
          }`}
          onClick={() => {
            setSelectedClass(c);
            clearSelections();
          }}
        >
          {c}
        </button>
      ))}
    </div>
  );
}
