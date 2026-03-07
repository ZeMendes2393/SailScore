import { Geist, Geist_Mono } from 'next/font/google';
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

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let headerDesign: { club_logo_url: string | null; club_logo_link: string | null } = {
    club_logo_url: null,
    club_logo_link: null,
  };
  try {
    const res = await fetch(`${API}/design/header`, { cache: 'no-store' });
    if (res.ok) headerDesign = await res.json();
  } catch {
    // ignore
  }

  return (
    <html lang="pt">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gray-50 text-gray-900 min-h-screen flex flex-col`}
      >
        <AuthProvider>
          <ClientLayout headerDesign={headerDesign}>{children}</ClientLayout>
        </AuthProvider>
      </body>
    </html>
  );
}
