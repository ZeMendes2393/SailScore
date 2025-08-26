"use client";

import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
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

  return (
    <html lang="pt">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gray-50 text-gray-900 min-h-screen flex flex-col`}
      >
        <AuthProvider>
          {/* Navbar global */}
          <header className="sticky top-0 z-50 bg-gradient-to-r from-blue-700 to-sky-600 text-white shadow-md">
            <div className="mx-auto max-w-7xl px-6 h-16 flex items-center justify-between">
              <Link href="/" className="text-xl font-bold tracking-wide">
                SailScore
              </Link>

              <nav className="hidden md:flex items-center gap-2 text-sm font-medium">
                {[
                  { href: "/", label: "Home" },
                  { href: "/calendar", label: "Calendar" },
                  { href: "/results", label: "Results" },
                  { href: "/news", label: "News" },
                ].map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`px-3 py-1 rounded-md transition ${
                      isActive(item.href)
                        ? "bg-white/20"
                        : "hover:bg-white/10"
                    }`}
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>

              <Link
                href="/login"
                className="px-4 py-2 rounded-lg bg-white text-blue-700 hover:bg-blue-50 font-medium shadow-sm"
              >
                Sailor Account
              </Link>
            </div>
          </header>

          {/* Conteúdo principal */}
          <main className="flex-1 max-w-7xl mx-auto px-6 py-8 w-full">
            {children}
          </main>

          {/* Footer */}
          <footer className="bg-gray-100 border-t mt-10">
            <div className="max-w-7xl mx-auto px-6 py-4 text-center text-sm text-gray-500">
              © {new Date().getFullYear()} SailScore — Sailing Results Platform
            </div>
          </footer>
        </AuthProvider>
      </body>
    </html>
  );
}
