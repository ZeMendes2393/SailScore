import type { NextConfig } from "next";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"]);

/** URL da API usada no build (rewrites + NEXT_PUBLIC_*). */
function resolveBuildApiUrl(): string {
  let u = (
    process.env.NEXT_PUBLIC_API_URL?.trim() ||
    (process.env.VERCEL ? "https://api.sailscore.online" : "http://127.0.0.1:8000")
  ).replace(/\/$/, "");

  if (u.startsWith("http://")) {
    try {
      const host = new URL(u).hostname;
      if (!LOCAL_HOSTS.has(host)) {
        u = `https://${u.slice("http://".length)}`;
      }
    } catch {
      /* keep u */
    }
  }
  return u;
}

const API_URL = resolveBuildApiUrl();

const nextConfig: NextConfig = {
  /** Garante HTTPS na Vercel mesmo se a variável no painel falhar ou estiver em http:// */
  env: {
    NEXT_PUBLIC_API_URL: API_URL,
  },
  async rewrites() {
    return [
      {
        source: "/api/backend/:path*",
        destination: `${API_URL}/:path*`,
      },
    ];
  },
};

export default nextConfig;
