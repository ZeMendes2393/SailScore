"use client";
import { useEffect, useState } from "react";

interface Step1Props {
  data: {
    role: string;
    class_name: string;
    regatta_id?: number;
  };
  onChange: (data: { role?: string; class_name?: string }) => void;
  onNext: () => void;
}

interface RegattaClass {
  id: number;
  regatta_id: number;
  class_name: string;
}

export default function Step1({ data, onChange, onNext }: Step1Props) {
  const [localData, setLocalData] = useState(data);
  const [availableClasses, setAvailableClasses] = useState<RegattaClass[]>([]);

  // ⚡ Vai buscar classes permitidas da regata
  useEffect(() => {
    if (!data.regatta_id) return;

    fetch(`http://localhost:8000/regatta-classes/by_regatta/${data.regatta_id}`)
      .then((res) => {
        if (!res.ok) {
          console.warn("⚠️ Regatta classes fetch falhou:", res.status);
          return [];
        }
        return res.json();
      })
      .then((classes) => {
        if (Array.isArray(classes)) {
          setAvailableClasses(classes);
        } else {
          console.error("❌ Resposta inesperada:", classes);
          setAvailableClasses([]);
        }
      })
      .catch((err) => {
        console.error("❌ Erro ao carregar classes:", err);
        setAvailableClasses([]);
      });
  }, [data.regatta_id]);

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
          {availableClasses.map((cls) => (
            <option key={cls.id} value={cls.class_name}>
              {cls.class_name}
            </option>
          ))}
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
