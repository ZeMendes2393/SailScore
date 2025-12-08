'use client';

import { useParams } from 'next/navigation';
import AdminOverallResultsClient from '../results/components/AdminOverallResultsClient';

export default function Page() {
  const params = useParams<{ id: string }>();
  const id = Array.isArray(params?.id) ? params.id[0] : params?.id; // robusto c/ catch de array
  return <AdminOverallResultsClient regattaId={Number(id)} />;
}
