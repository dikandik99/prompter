import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";

import { apiFetch, getToken, TOKEN_KEY } from "@/src/lib/api";
import { storage } from "@/src/utils/storage";

export type Entitlement = {
  plan: "free" | "pro";
  status: string | null;
  provider: string | null;
  plan_id: string | null;
  current_period_end: string | null;
};

export type User = {
  id: string;
  email: string;
  name: string;
  photo_url: string | null;
  created_at: string;
  entitlement?: Entitlement;
};

type AuthCtx = {
  user: User | null;
  loading: boolean;
  isPro: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  setEntitlement: (e: Entitlement) => void;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const loadMe = useCallback(async () => {
    const me = await apiFetch<User>("/auth/me", { auth: true });
    setUser(me);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const token = await getToken();
        if (token) await loadMe();
      } catch {
        await storage.secureRemove(TOKEN_KEY);
        setUser(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [loadMe]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await apiFetch<{ access_token: string; user: User }>("/auth/login", {
      method: "POST",
      body: { email, password },
    });
    await storage.secureSet(TOKEN_KEY, res.access_token);
    await loadMe();
  }, [loadMe]);

  const register = useCallback(async (email: string, password: string, name: string) => {
    const res = await apiFetch<{ access_token: string; user: User }>("/auth/register", {
      method: "POST",
      body: { email, password, name },
    });
    await storage.secureSet(TOKEN_KEY, res.access_token);
    await loadMe();
  }, [loadMe]);

  const logout = useCallback(async () => {
    await storage.secureRemove(TOKEN_KEY);
    setUser(null);
  }, []);

  const refresh = useCallback(async () => {
    const token = await getToken();
    if (token) await loadMe();
  }, [loadMe]);

  const setEntitlement = useCallback((e: Entitlement) => {
    setUser((u) => (u ? { ...u, entitlement: e } : u));
  }, []);

  const isPro = user?.entitlement?.plan === "pro";

  const value = useMemo(
    () => ({ user, loading, isPro, login, register, logout, refresh, setEntitlement }),
    [user, loading, isPro, login, register, logout, refresh, setEntitlement],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("AuthProvider missing");
  return c;
}
