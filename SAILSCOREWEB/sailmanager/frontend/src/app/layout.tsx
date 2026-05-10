import { headers } from 'next/headers';
import { Geist, Geist_Mono } from 'next/font/google';
import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import ClientLayout from './ClientLayout';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

const API = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') || 'http://127.0.0.1:8000';

/** Homepage `/` sem /o/slug: usar a mesma org em todo o site (variável de ambiente). */
const DEFAULT_PUBLIC_ORG_SLUG = process.env.NEXT_PUBLIC_DEFAULT_ORG_SLUG?.trim() || null;

export const metadata: Metadata = {
  title: {
    default: 'SailScore',
    template: '%s | SailScore',
  },
  description:
    'SailScore helps clubs and race teams handle setup, entries, scoring, notices, and results in one structured workflow.',
  icons: {
    icon: [
      { url: '/sailscore-icon.png?v=3', sizes: '32x32', type: 'image/png' },
      { url: '/sailscore-icon.png?v=3', sizes: '192x192', type: 'image/png' },
    ],
    shortcut: '/sailscore-icon.png?v=3',
    apple: [{ url: '/sailscore-icon.png?v=3', sizes: '180x180', type: 'image/png' }],
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headersList = await headers();
  const pathname = headersList.get('x-pathname') || '';

  // /o/[slug]/... ou /admin?org=slug → carregar design da org para evitar flash do site default
  const orgMatch = pathname.match(/^\/o\/([^/]+)/);
  let orgSlug = orgMatch?.[1] ?? null;
  if (!orgSlug && (pathname.startsWith('/admin') || pathname.startsWith('/scorer'))) {
    orgSlug = headersList.get('x-org-slug')?.trim() || null;
  }
  if (!orgSlug && pathname === '/' && DEFAULT_PUBLIC_ORG_SLUG) {
    orgSlug = DEFAULT_PUBLIC_ORG_SLUG;
  }
  if (!orgSlug && pathname.startsWith('/calendar')) {
    const fromCalendarQs = headersList.get('x-org-slug')?.trim() || null;
    if (fromCalendarQs) {
      orgSlug = fromCalendarQs;
    } else if (DEFAULT_PUBLIC_ORG_SLUG) {
      orgSlug = DEFAULT_PUBLIC_ORG_SLUG;
    }
  }
  /** Dashboard / login: ?org=slug (middleware envia x-org-slug) — alinha cabeçalho/rodapé com a organização. */
  if (!orgSlug && (pathname.startsWith('/dashboard') || pathname.startsWith('/login'))) {
    const fromQs = headersList.get('x-org-slug')?.trim() || null;
    if (fromQs) {
      orgSlug = fromQs;
    }
  }
  if (!orgSlug) {
    const regattaMatch = pathname.match(/^\/regattas\/(\d+)/);
    const adminManageRegattaMatch = pathname.match(/^\/admin\/manage-regattas\/(\d+)/);
    const scorerManageRegattaMatch = pathname.match(/^\/scorer\/manage-regattas\/(\d+)/);
    const dashRegattaId = headersList.get('x-dashboard-regatta-id')?.trim() || '';
    const loginRegattaId = headersList.get('x-login-regatta-id')?.trim() || '';
    const regattaIdFromPathOrDashboard =
      regattaMatch?.[1] ??
      adminManageRegattaMatch?.[1] ??
      scorerManageRegattaMatch?.[1] ??
      (/^\d+$/.test(dashRegattaId) ? dashRegattaId : null) ??
      (/^\d+$/.test(loginRegattaId) ? loginRegattaId : null);
    if (regattaIdFromPathOrDashboard) {
      try {
        const res = await fetch(`${API}/regattas/${regattaIdFromPathOrDashboard}`, { cache: 'no-store' });
        if (res.ok) {
          const data = (await res.json()) as { organization_slug?: string | null };
          if (data.organization_slug && typeof data.organization_slug === 'string') {
            orgSlug = data.organization_slug;
          }
        }
      } catch {
        // ignore
      }
    }
  }

  const q = orgSlug ? `?org=${encodeURIComponent(orgSlug)}` : '';

  let headerDesign: { club_logo_url: string | null; club_logo_link: string | null } = {
    club_logo_url: null,
    club_logo_link: null,
  };
  let footerDesign: Record<string, unknown> | null = null;
  try {
    const [headerRes, footerRes] = await Promise.all([
      fetch(`${API}/design/header${q}`, { cache: 'no-store' }),
      fetch(`${API}/design/footer${q}`, { cache: 'no-store' }),
    ]);
    if (headerRes.ok) headerDesign = await headerRes.json();
    if (footerRes.ok) footerDesign = await footerRes.json();
  } catch {
    // ignore
  }

  return (
    <html lang="pt">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gray-50 text-gray-900 min-h-screen flex flex-col`}
      >
        <AuthProvider>
          <ClientLayout
            headerDesign={headerDesign}
            footerDesign={footerDesign}
            serverOrgSlug={orgSlug}
          >
            {children}
          </ClientLayout>
        </AuthProvider>
      </body>
    </html>
  );
}
