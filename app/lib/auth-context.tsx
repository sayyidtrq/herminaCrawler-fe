"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { fetchJson } from "./api";

// Update types.ts later if needed, but for now we define User here or import it
export interface AuthUser {
  id: number;
  email: string;
  full_name: string | null;
  company_id: number;
  company_name: string;
  ai_enable_flag: boolean;
  total_enable_review: number;
  analyze_competitor_flag: boolean;
}

type AuthContextType = {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  login: (token: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Load token from localStorage
    const savedToken = localStorage.getItem("hermina_token");
    if (savedToken) {
      setToken(savedToken);
      fetchUser(savedToken);
    } else {
      setIsLoading(false);
      if (pathname !== "/login") {
        router.push("/login");
      }
    }
  }, []);

  const fetchUser = async (authToken: string) => {
    try {
      // Call endpoint auth/me. We temporarily pass headers here manually
      const userPayload = await fetchJson<AuthUser>("/api/auth/me");
      setUser(userPayload);
    } catch (err) {
      console.error("Failed to fetch user profiles", err);
      logout();
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (newToken: string) => {
    localStorage.setItem("hermina_token", newToken);
    setToken(newToken);
    setIsLoading(true);
    await fetchUser(newToken);
    router.push("/dashboard");
  };

  const logout = () => {
    localStorage.removeItem("hermina_token");
    setToken(null);
    setUser(null);
    setIsLoading(false);
    router.push("/login");
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
