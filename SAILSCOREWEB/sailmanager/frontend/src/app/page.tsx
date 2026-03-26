import HomePageClient from './HomePageClient';

const API = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') || 'http://127.0.0.1:8000';

const DEFAULT_PUBLIC_ORG_SLUG = process.env.NEXT_PUBLIC_DEFAULT_ORG_SLUG?.trim() || null;

export default async function Page() {
  let initialHomeDesign: {
    home_images: { url: string; position_x?: number; position_y?: number }[];
    hero_title: string | null;
    hero_subtitle: string | null;
  } | null = null;
  const homeQ = DEFAULT_PUBLIC_ORG_SLUG
    ? `?org=${encodeURIComponent(DEFAULT_PUBLIC_ORG_SLUG)}`
    : '';
  try {
    const res = await fetch(`${API}/design/homepage${homeQ}`, { cache: 'no-store' });
    if (res.ok) {
      const data = (await res.json()) as {
        home_images?: { url: string; position_x?: number; position_y?: number }[];
        hero_title?: string | null;
        hero_subtitle?: string | null;
      };
      const hi = data?.home_images ?? [];
      initialHomeDesign = {
        home_images: hi.slice(0, 3).map((img: { url: string; position_x?: number; position_y?: number }) => ({
          url: img.url?.startsWith('http') ? img.url : `${API}${img.url}`,
          position_x: Math.max(0, Math.min(100, img.position_x ?? 50)),
          position_y: Math.max(0, Math.min(100, img.position_y ?? 50)),
        })),
        hero_title: data?.hero_title ?? null,
        hero_subtitle: data?.hero_subtitle ?? null,
      };
    }
  } catch {
    // ignore
  }
  return (
    <HomePageClient initialHomeDesign={initialHomeDesign} orgSlug={DEFAULT_PUBLIC_ORG_SLUG} />
  );
}
