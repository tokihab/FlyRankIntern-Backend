"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";

type AuthContextType = {
  token: string | null;
  user: { id: string; email: string } | null;
  isAuthenticated: boolean;
  login: (token: string, user: { id: string; email: string }) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);

  useEffect(() => {
    const storedToken = localStorage.getItem("flyrank_access_token");
    const storedUser = localStorage.getItem("flyrank_user");
    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
    }
  }, []);

  const login = (token: string, user: { id: string; email: string }) => {
    localStorage.setItem("flyrank_access_token", token);
    localStorage.setItem("flyrank_user", JSON.stringify(user));
    setToken(token);
    setUser(user);
  };

  const logout = () => {
    localStorage.removeItem("flyrank_access_token");
    localStorage.removeItem("flyrank_user");
    setToken(null);
    setUser(null);
  };

  const value = {
    token,
    user,
    isAuthenticated: !!token,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
