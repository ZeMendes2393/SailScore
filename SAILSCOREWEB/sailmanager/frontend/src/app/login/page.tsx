"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    console.log("🔐 A tentar fazer login...");

    try {
      const response = await fetch("http://localhost:8000/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          username: email,
          password: password,
        }),
      });

      const data = await response.json();

      console.log("📨 Resposta da API:", data);

      if (!response.ok) {
        console.error("❌ Erro no login:", data.detail);
        setError(data.detail || "Erro ao fazer login.");
        setLoading(false);
        return;
      }

      localStorage.setItem("token", data.access_token);
      localStorage.setItem("role", data.role);
      localStorage.setItem("user", JSON.stringify({ email, role: data.role }));

      console.log("✅ Login bem-sucedido. Role:", data.role);

      setLoading(false);

      if (data.role === "admin") {
        console.log("➡️ Redirecionar para /admin");
        router.push("/admin");
      } else {
        console.log("➡️ Redirecionar para /dashboard");
        router.push("/dashboard");
      }
    } catch (err) {
      console.error("⚠️ Erro de rede ou inesperado:", err);
      setError("Erro de rede ou inesperado.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded shadow-md w-full max-w-md">
        <h2 className="text-2xl font-bold mb-6 text-center">Iniciar Sessão</h2>
        <form onSubmit={handleLogin} className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-2 border rounded"
            required
          />
          <input
            type="password"
            placeholder="Palavra-passe"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-2 border rounded"
            required
          />
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
            disabled={loading}
          >
            {loading ? "A entrar..." : "Entrar"}
          </button>
        </form>
        <div className="mt-4 text-center">
  <p className="text-sm">
    Ainda não tens conta?{" "}
    <a href="/register" className="text-blue-600 hover:underline font-medium">
      Criar conta
    </a>
  </p>
</div>

      </div>
    </div>
  );
}
