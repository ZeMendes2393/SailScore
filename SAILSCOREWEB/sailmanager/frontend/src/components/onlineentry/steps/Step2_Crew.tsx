"use client";

import { useState } from "react";

interface Step2Props {
  data: any;
  onChange: (data: any) => void;
  onNext: () => void;
  onBack: () => void;
}

export default function Step2({ data, onChange, onNext, onBack }: Step2Props) {
  const [localData, setLocalData] = useState(data || {});

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const updated = { ...localData, [name]: value };
    setLocalData(updated);
    onChange(updated);
  };

  const handleNext = (e: React.FormEvent) => {
    e.preventDefault();
    onNext();
  };

  return (
    <form onSubmit={handleNext} className="space-y-4">
      <h2 className="text-xl font-bold">Passo 2: Dados do Timoneiro</h2>

      <input type="text" name="first_name" placeholder="Nome" value={localData.first_name || ""} onChange={handleChange} className="w-full p-2 border rounded" required />
      <input type="text" name="last_name" placeholder="Apelido" value={localData.last_name || ""} onChange={handleChange} className="w-full p-2 border rounded" required />
      <input type="date" name="date_of_birth" placeholder="Data de Nascimento" value={localData.date_of_birth || ""} onChange={handleChange} className="w-full p-2 border rounded" />
      <input type="text" name="gender" placeholder="Género" value={localData.gender || ""} onChange={handleChange} className="w-full p-2 border rounded" />

      <input type="text" name="email" placeholder="Email" value={localData.email || ""} onChange={handleChange} className="w-full p-2 border rounded" />
      <input type="text" name="contact_phone_1" placeholder="Telefone 1" value={localData.contact_phone_1 || ""} onChange={handleChange} className="w-full p-2 border rounded" />
      <input type="text" name="contact_phone_2" placeholder="Telefone 2" value={localData.contact_phone_2 || ""} onChange={handleChange} className="w-full p-2 border rounded" />

      <input type="text" name="club" placeholder="Clube" value={localData.club || ""} onChange={handleChange} className="w-full p-2 border rounded" />
      <input type="text" name="helm_country" placeholder="País" value={localData.helm_country || ""} onChange={handleChange} className="w-full p-2 border rounded" />
      <input type="text" name="helm_country_secondary" placeholder="Segundo País (opcional)" value={localData.helm_country_secondary || ""} onChange={handleChange} className="w-full p-2 border rounded" />

      <input type="text" name="territory" placeholder="Território" value={localData.territory || ""} onChange={handleChange} className="w-full p-2 border rounded" />
      <input type="text" name="address" placeholder="Morada" value={localData.address || ""} onChange={handleChange} className="w-full p-2 border rounded" />
      <input type="text" name="zip_code" placeholder="Código Postal" value={localData.zip_code || ""} onChange={handleChange} className="w-full p-2 border rounded" />
      <input type="text" name="town" placeholder="Cidade" value={localData.town || ""} onChange={handleChange} className="w-full p-2 border rounded" />

      <div className="flex justify-between mt-4">
        <button type="button" onClick={onBack} className="px-4 py-2 bg-gray-200 rounded">
          Voltar
        </button>
        <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
          Próximo
        </button>
      </div>
    </form>
  );
}
