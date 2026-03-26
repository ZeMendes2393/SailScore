import Link from 'next/link';
import HomePageClient, { type HomeDesign } from '@/app/HomePageClient';

const API = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') || 'http://127.0.0.1:8000';

export default async function OrgHomePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug: raw } = await params;
  const slug = typeof raw === 'string' ? raw.trim() : '';
  if (!slug) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Organization not specified.</p>
      </div>
    );
  }

  let checkOk = false;
  try {
    const check = await fetch(`${API}/organizations/by-slug/${encodeURIComponent(slug)}`, {
      cache: 'no-store',
    });
    checkOk = check.ok;
  } catch {
    checkOk = false;
  }

  if (!checkOk) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-gray-600">Organization not found.</p>
        <Link href="/" className="text-blue-600 hover:underline">
          ← Back to home
        </Link>
      </div>
    );
  }

  let initialHomeDesign: HomeDesign | null = null;
  try {
    const hpRes = await fetch(`${API}/design/homepage?org=${encodeURIComponent(slug)}`, {
      cache: 'no-store',
    });
    if (hpRes.ok) {
      const data = (await hpRes.json()) as {
        home_images?: { url: string; position_x?: number; position_y?: number }[];
        hero_title?: string | null;
        hero_subtitle?: string | null;
      };
      const hi = data?.home_images ?? [];
      initialHomeDesign = {
        home_images: hi.slice(0, 3).map((img) => ({
          url: img.url?.startsWith('http') ? img.url : `${API}${img.url}`,
          position_x: Math.max(0, Math.min(100, img.position_x ?? 50)),
          position_y: Math.max(0, Math.min(100, img.position_y ?? 50)),
        })),
        hero_title: data?.hero_title ?? null,
        hero_subtitle: data?.hero_subtitle ?? null,
      };
    }
  } catch {
    // client pode completar
  }

  return <HomePageClient initialHomeDesign={initialHomeDesign} orgSlug={slug} />;
}
