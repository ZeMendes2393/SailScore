"use client";

import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import ContentContainer from "@/components/ContentContainer";
import Link from "next/link";
import { usePathname } from "next/navigation";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isActive = (p: string) => pathname === p;
  const showMainHeader = !pathname?.match(/^\/regattas\/\d+(?:\/|$)/);
  const useContentContainer =
    pathname !== '/' &&
    !pathname?.match(/^\/admin(\/|$)/) &&
    !pathname?.match(/^\/login(\/|$)/) &&
    !pathname?.match(/^\/register(\/|$)/) &&
    !pathname?.match(/^\/dashboard(\/|$)/) &&
    !pathname?.match(/^\/accept-invite(\/|$)/) &&
    !pathname?.match(/^\/regattas\/\d+/);

  return (
    <html lang="pt">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gray-50 text-gray-900 min-h-screen flex flex-col`}
      >
        <AuthProvider>
          {/* Navbar global — oculto nas páginas de regata (usa header próprio) */}
          {showMainHeader && (
          <header className="sticky top-0 z-50 bg-gradient-to-r from-blue-700/85 to-sky-600/85 text-white shadow-lg backdrop-blur-md">
            <div className="w-full h-28 flex items-center justify-between px-4 sm:px-6">
              <Link href="/" className="text-xl font-bold tracking-tight hover:opacity-90 transition-opacity">
                SailScore
              </Link>

              <nav className="hidden md:flex items-center gap-1 text-sm font-medium">
                {[
                  { href: "/", label: "Home" },
                  { href: "/calendar", label: "Calendar" },
                  { href: "/results", label: "Results" },
                  { href: "/news", label: "News" },
                ].map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`px-3 py-2 rounded-lg transition ${
                      isActive(item.href)
                        ? "bg-white/25 text-white"
                        : "hover:bg-white/15 text-white/95"
                    }`}
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>

              
<Link href="/admin/login">
  <button className="px-4 py-2 rounded-lg bg-white/20 hover:bg-white/30 text-white font-medium text-sm transition shadow-sm">
    Admin Account
  </button>
</Link>


            </div>
          </header>
          )}

          {/* Conteúdo principal — container nas páginas públicas; homepage, admin, login, dashboard sem container */}
          <main className="flex-1 w-full py-8">
            {useContentContainer ? <ContentContainer>{children}</ContentContainer> : children}
          </main>

          {/* Footer */}
          <footer className="bg-white border-t border-gray-200 mt-auto">
            <div className="max-w-screen-2xl mx-auto py-6 text-center px-2 lg:px-3">
              <p className="text-sm text-gray-600">
                © {new Date().getFullYear()} SailScore — Sailing Results Platform
              </p>
            </div>
          </footer>
        </AuthProvider>
      </body>
    </html>
  );
}
