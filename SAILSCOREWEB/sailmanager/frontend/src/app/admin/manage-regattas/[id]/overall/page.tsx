import AdminOverallResultsClient from "../results/components/AdminOverallResultsClient";

// Server Component
export default async function Page(
  props: { params: Promise<{ id: string }> }   // <- params é Promise
) {
  const { id } = await props.params;           // <- await obrigatório
  return <AdminOverallResultsClient regattaId={Number(id)} />;
}
