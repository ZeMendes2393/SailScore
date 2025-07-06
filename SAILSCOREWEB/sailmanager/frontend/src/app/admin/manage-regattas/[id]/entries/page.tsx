"use client";

import { useParams } from "next/navigation";

export default function AdminRegattaPage() {
  const { id } = useParams();
  return (
    <main className="p-10">
      <h1 className="text-2xl font-bold">Página da Regata #{id}</h1>
      <p>Bem-vindo ao painel da regata {id}. Aqui podes ver os detalhes.</p>
    </main>
  );
}
