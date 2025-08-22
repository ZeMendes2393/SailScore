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

export default function Step1({ data, onChange, onNext }: Step1Props) {
  const [localData, setLocalData] = useState(data);

  // Agora tratamos as classes como array de strings (ex.: ["ILCA 6", "420", ...])
  const [availableClasses, setAvailableClasses] = useState<string[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(false);
  const [classesError, setClassesError] = useState<string | null>(null);

  // ⚡ Vai buscar classes permitidas da regata (endpoint novo)
  useEffect(() => {
    if (!data.regatta_id) {
      setAvailableClasses([]);
      return;
    }

    const fetchClasses = async () => {
      setLoadingClasses(true);
      setClassesError(null);
      try {
        const res = await fetch(`http://localhost:8000/regattas/${data.regatta_id}/classes`);
        if (!res.ok) {
          const txt = await res.text().catch(() => "");
          console.warn("⚠️ Regatta classes fetch falhou:", res.status, txt);
          setAvailableClasses([]);
          setClassesError("Não foi possível carregar as classes.");
          return;
        }
        const json = await res.json();
        const arr = Array.isArray(json) ? (json as string[]) : [];
        setAvailableClasses(arr);

        // Se não houver classe selecionada ainda, pré-seleciona a primeira
        if (!localData.class_name && arr.length > 0) {
          const updated = { ...localData, class_name: arr[0] };
          setLocalData(updated);
          onChange(updated);
        }
      } catch (err) {
        console.error("❌ Erro ao carregar classes:", err);
        setAvailableClasses([]);
        setClassesError("Erro de rede ao carregar classes.");
      } finally {
        setLoadingClasses(false);
      }
    };

    fetchClasses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.regatta_id]);

  // Mantém o estado local sincronizado se o parent alterar `data`
  useEffect(() => {
    setLocalData(data);
  }, [data.role, data.class_name, data.regatta_id]);

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
        {loadingClasses && <p className="text-gray-500">A carregar classes…</p>}
        {!loadingClasses && classesError && (
          <p className="text-red-700">{classesError}</p>
        )}
        <select
          name="class_name"
          value={localData.class_name}
          onChange={handleChange}
          className="w-full p-2 border rounded"
          disabled={loadingClasses || availableClasses.length === 0}
        >
          <option value="">{availableClasses.length === 0 ? "Sem classes" : "Selecione"}</option>
          {availableClasses.map((cls) => (
            <option key={cls} value={cls}>
              {cls}
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
