"use client";

import { createContext, useContext, useEffect, useState } from "react";

interface User {
  email: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (token: string, user: User) => void;
  logout: () => void;
  loading: boolean;
  setUser: (user: User | null) => void; // 👈 ADICIONAR ISTO
}


const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem("token");
    const storedUser = localStorage.getItem("user");

    console.log("🔐 Recuperando token:", storedToken);
    console.log("🔐 Recuperando user:", storedUser);

    if (storedToken && storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        setToken(storedToken);
        setUser(parsedUser);
        console.log("✅ Autenticado com:", parsedUser);
      } catch (e) {
        console.error("❌ Erro ao parsear user do localStorage:", e);
      }
    } else {
      console.log("⚠️ Nenhum token/user encontrado.");
    }

    setLoading(false);
  }, []);

  const login = (token: string, user: User) => {
  console.log("🔐 [AuthContext] login chamado:", user);
  localStorage.setItem("token", token);
  localStorage.setItem("user", JSON.stringify(user));
  setToken(token);
  setUser(user);
  setLoading(false); // <-- garante que a mudança de estado é visível
};

  const logout = () => {
    console.log("🚪 Logout efetuado.");
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setToken(null);
    setUser(null);
  };

  return (
<AuthContext.Provider value={{ user, token, login, logout, loading, setUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
};
