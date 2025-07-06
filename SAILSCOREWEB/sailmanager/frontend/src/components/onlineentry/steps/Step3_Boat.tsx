"use client";

import { useState } from "react";

interface Step3Props {
  data: any;
  onChange: (data: any) => void;
  onSubmit: () => void;
  onBack: () => void;
}

export default function Step3({ data, onChange, onSubmit, onBack }: Step3Props) {
  const [localData, setLocalData] = useState(data || {});
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const newValue = type === "checkbox" ? (e.target as HTMLInputElement).checked : value;
    const updated = { ...localData, [name]: newValue };
    setLocalData(updated);
    onChange(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    const formData = data.fullForm;
if (!formData || !formData.helm) {
  console.error("⚠️ Dados do timoneiro não encontrados.");
  alert("Erro interno: dados do timoneiro em falta.");
  setSubmitting(false);
  return;
}


    const payload = {
      user_id: 1, // ⚠️ Substituir futuramente pelo user autenticado
      regatta_id: formData.regatta_id,
      class_name: formData.class_name,
      boat_country: localData.boat_country,
      sail_number: localData.sail_number,
      boat_name: localData.boat_name,
      category: localData.category,
      // Helm
      date_of_birth: formData.helm.date_of_birth,
      gender: formData.helm.gender,
      first_name: formData.helm.first_name,
      last_name: formData.helm.last_name,
      helm_country: formData.helm.helm_country,
      territory: formData.helm.territory,
      club: formData.helm.club,
      email: formData.helm.email,
      contact_phone_1: formData.helm.contact_phone_1,
      contact_phone_2: formData.helm.contact_phone_2,
      address: formData.helm.address,
      zip_code: formData.helm.zip_code,
      town: formData.helm.town,
      helm_country_secondary: formData.helm.helm_country_secondary,
        paid: localData.paid || false,  // ✅ este estava a faltar

    };

    const res = await fetch("http://localhost:8000/entries/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      alert("✅ Inscrição submetida com sucesso!");
    } else {
      const error = await res.json();
      console.error("❌ Erro do backend:", error);
      alert("Erro ao submeter inscrição. Ver consola.");
    }

    setSubmitting(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 className="text-xl font-bold">Passo 3: Dados do Barco</h2>

      <input
        type="text"
        name="boat_name"
        placeholder="Nome do Barco"
        value={localData.boat_name || ""}
        onChange={handleChange}
        className="w-full p-2 border rounded"
        required
      />
      <input
        type="text"
        name="sail_number"
        placeholder="Número da Vela"
        value={localData.sail_number || ""}
        onChange={handleChange}
        className="w-full p-2 border rounded"
      />
      <input
        type="text"
        name="boat_country"
        placeholder="País do Barco"
        value={localData.boat_country || ""}
        onChange={handleChange}
        className="w-full p-2 border rounded"
      />
      <input
        type="text"
        name="category"
        placeholder="Categoria"
        value={localData.category || ""}
        onChange={handleChange}
        className="w-full p-2 border rounded"
      />

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          name="paid"
          checked={localData.paid || false}
          onChange={handleChange}
        />
        Pago
      </label>

      <div className="flex justify-between mt-4">
        <button type="button" onClick={onBack} className="px-4 py-2 bg-gray-200 rounded">
          Voltar
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
        >
          {submitting ? "A submeter..." : "Submeter Inscrição"}
        </button>
      </div>
    </form>
  );
}
