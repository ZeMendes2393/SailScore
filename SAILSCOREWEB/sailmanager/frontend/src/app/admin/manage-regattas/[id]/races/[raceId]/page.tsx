import AdminRaceEditorClient from './AdminRaceEditorClient';

export default async function Page({
  params,
}: {
  params: Promise<{ id: string; raceId: string }>;
}) {
  const { id, raceId } = await params; // ✅ await necessário no App Router
  return <AdminRaceEditorClient regattaId={Number(id)} raceId={Number(raceId)} />;
}
