import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import { Platform } from "react-native";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";

import { apiFetch, getToken, TOKEN_KEY } from "@/src/lib/api";
import { storage } from "@/src/utils/storage";

WebBrowser.maybeCompleteAuthSession();

const AUTH_URL = "https://auth.emergentagent.com/";
const SESSION_RE = /[?#&]session_id=([^&#]+)/;
const exchanged = new Set<string>();

function extractSessionId(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = url.match(SESSION_RE);
  return m ? decodeURIComponent(m[1]) : null;
}

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
  /** Opens Google sign-in. Resolves true when the user is signed in (mobile); on web the page redirects. */
  loginWithGoogle: () => Promise<boolean>;
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

  /** Exchange a one-time session_id (from the OAuth redirect) for our JWT. */
  const exchangeSession = useCallback(
    async (sessionId: string): Promise<boolean> => {
      if (exchanged.has(sessionId)) return false;
      exchanged.add(sessionId);
      const res = await apiFetch<{ access_token: string; user: User }>("/auth/session", {
        method: "POST",
        body: { session_id: sessionId },
      });
      await storage.secureSet(TOKEN_KEY, res.access_token);
      await loadMe();
      return true;
    },
    [loadMe],
  );

  useEffect(() => {
    (async () => {
      try {
        // Web: landed back from Google with #session_id=… — process it before anything else.
        if (Platform.OS === "web" && typeof window !== "undefined") {
          const sid = extractSessionId(window.location.hash) ?? extractSessionId(window.location.search);
          if (sid) {
            try {
              await exchangeSession(sid);
              const url = new URL(window.location.href);
              url.hash = url.hash.replace(/[&]?session_id=[^&#]+/, "").replace(/^#&/, "#");
              if (url.hash === "#") url.hash = "";
              url.searchParams.delete("session_id");
              window.history.replaceState(window.history.state, "", url.toString());
              return;
            } catch {
              // fall through to normal token check
            }
          }
        }
        // Native cold start via deep link (app relaunched by the OAuth redirect).
        if (Platform.OS !== "web") {
          const sid = extractSessionId(await Linking.getInitialURL());
          if (sid) {
            try {
              await exchangeSession(sid);
              return;
            } catch {
              // fall through
            }
          }
        }
        const token = await getToken();
        if (token) await loadMe();
      } catch {
        await storage.secureRemove(TOKEN_KEY);
        setUser(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [loadMe, exchangeSession]);

  // Native: hot deep links carrying a session_id (co-equal source with openAuthSessionAsync on Android).
  useEffect(() => {
    if (Platform.OS === "web") return;
    const sub = Linking.addEventListener("url", ({ url }) => {
      const sid = extractSessionId(url);
      if (sid) exchangeSession(sid).catch(() => {});
    });
    return () => sub.remove();
  }, [exchangeSession]);

  const loginWithGoogle = useCallback(async (): Promise<boolean> => {
    if (Platform.OS === "web") {
      const redirectUrl = window.location.origin + "/";
      window.location.href = `${AUTH_URL}?redirect=${encodeURIComponent(redirectUrl)}`;
      return false;
    }
    const redirectUrl = Linking.createURL("");
    const authUrl = `${AUTH_URL}?redirect=${encodeURIComponent(redirectUrl)}`;
    let captured: string | null = null;
    const sub = Linking.addEventListener("url", ({ url }) => {
      captured = captured ?? url;
    });
    try {
      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
      const url = (result.type === "success" ? result.url : null) ?? captured ?? (await Linking.getInitialURL());
      const sid = extractSessionId(url);
      if (!sid) return false;
      if (exchanged.has(sid)) return true; // the url listener already handled it
      return await exchangeSession(sid);
    } finally {
      sub.remove();
    }
  }, [exchangeSession]);

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
    () => ({ user, loading, isPro, login, register, loginWithGoogle, logout, refresh, setEntitlement }),
    [user, loading, isPro, login, register, loginWithGoogle, logout, refresh, setEntitlement],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("AuthProvider missing");
  return c;
}
