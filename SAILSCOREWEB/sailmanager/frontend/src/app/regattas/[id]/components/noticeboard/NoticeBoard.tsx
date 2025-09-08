"use client";
import { useParams } from "next/navigation";
import NoticeBoardPublic from "./components/NoticeBoardPublic";

export default function Page() {
  const { id } = useParams();
  const regattaId = Number(id);
  if (!Number.isFinite(regattaId)) return <div>Regatta inválida.</div>;
  return <NoticeBoardPublic regattaId={regattaId} />;
}
