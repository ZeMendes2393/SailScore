"use client";

import { useState } from "react";

interface Step1Props {
  data: {
    role: string;
    class_name: string;
  };
  onChange: (data: { role?: string; class_name?: string }) => void;
  onNext: () => void;
}

export default function Step1({ data, onChange, onNext }: Step1Props) {
  const [localData, setLocalData] = useState(data);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target;
    const updated = { ...localData, [name]: value };
    setLocalData(updated);
    onChange(updated);
  };

  const handleNext = () => {
    if (localData.role && localData.class_name) {
      onNext();
    } else {
      alert("Por favor, preencha todos os campos.");
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Passo 1: Escolha o seu papel e classe</h2>

      <div>
        <label className="block font-semibold mb-1">Papel</label>
        <select
          name="role"
          value={localData.role}
          onChange={handleChange}
          className="w-full p-2 border rounded"
        >
          <option value="">Selecione</option>
          <option value="helmsman">Skipper</option>
          <option value="crew">Tripulante</option>
        </select>
      </div>

      <div>
        <label className="block font-semibold mb-1">Classe</label>
        <select
          name="class_name"
          value={localData.class_name}
          onChange={handleChange}
          className="w-full p-2 border rounded"
        >
          <option value="">Selecione</option>
          <option value="Snipe">Snipe</option>
          <option value="Laser">Laser</option>
          <option value="420">420</option>
          {/* Adiciona mais opções conforme necessário */}
        </select>
      </div>

      <button
        onClick={handleNext}
        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
      >
        Próximo
      </button>
    </div>
  );
}
