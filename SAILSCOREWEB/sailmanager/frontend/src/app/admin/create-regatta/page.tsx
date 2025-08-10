"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const AVAILABLE_CLASSES = [
  "420",
  "470",
  "49er",
  "49erFX",
  "ILCA 4",
  "ILCA 6",
  "ILCA 7",
  "Optimist",
  "Snipe",
  "Nacra 17",
];

const API = "http://127.0.0.1:8000"; // evita “localhost” vs “127.0.0.1”

export default function CreateRegattaPage() {
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  const handleCheckboxChange = (className: string) => {
    setSelectedClasses((prev) =>
      prev.includes(className)
        ? prev.filter((c) => c !== className)
        : [...prev, className]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem("token");
    if (!token) {
      alert("Sem sessão. Faz login de novo.");
      return;
    }

    setSubmitting(true);
    try {
      // ⚠️ barra final para evitar redirect/CORS
      const regattaRes = await fetch(`${API}/regattas/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name,
          location,
          start_date: startDate,
          end_date: endDate,
        }),
      });

      if (!regattaRes.ok) {
        const txt = await regattaRes.text();
        console.error("Erro ao criar regata:", txt);
        alert("Erro ao criar regata.");
        return;
      }

      const { id: regattaId } = await regattaRes.json();

      // Associar classes (em paralelo)
      if (selectedClasses.length) {
        await Promise.all(
          selectedClasses.map((className) =>
            // se o teu router for @router.post("/regatta-classes")
            // mantém sem barra final; se for "/" com prefix, troca para `${API}/regatta-classes/`
            fetch(`${API}/regatta-classes`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ regatta_id: regattaId, class_name: className }),
            })
          )
        );
      }

      alert("Regata criada com sucesso!");
      router.push("/admin");
    } catch (err) {
      console.error(err);
      alert("Falha de rede ao criar regata.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Criar Nova Regata</h1>
      <form onSubmit={handleSubmit} className="space-y-4 bg-white p-6 shadow rounded">
        <input
          type="text"
          placeholder="Nome da Regata"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full border p-2 rounded"
          required
        />
        <input
          type="text"
          placeholder="Localização"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          className="w-full border p-2 rounded"
          required
        />
        <div className="flex gap-4">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full border p-2 rounded"
            required
          />
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full border p-2 rounded"
            required
          />
        </div>

        <div>
          <p className="font-medium mb-2">Selecionar Classes:</p>
          <div className="grid grid-cols-2 gap-2">
            {AVAILABLE_CLASSES.map((c) => (
              <label key={c} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  value={c}
                  checked={selectedClasses.includes(c)}
                  onChange={() => handleCheckboxChange(c)}
                />
                {c}
              </label>
            ))}
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {submitting ? "A criar..." : "Criar Regata"}
        </button>
      </form>
    </div>
  );
}
