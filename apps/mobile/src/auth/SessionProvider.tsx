import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import * as SecureStore from "expo-secure-store";
import { api, setAuthToken } from "../api/client";
import type { User } from "../api/types";

const TOKEN_KEY = "frontiride.token";

interface SessionValue {
  user: User | null;
  /** Vrai tant que la session enregistrée n'a pas été relue au démarrage. */
  restoring: boolean;
  signIn: (token: string, user: User) => Promise<void>;
  signOut: () => Promise<void>;
  /** Recharge l'utilisateur depuis l'API (après édition du profil, par ex.). */
  refresh: () => Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [restoring, setRestoring] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const token = await SecureStore.getItemAsync(TOKEN_KEY);
        if (token) {
          setAuthToken(token);
          const me = await api.me();
          if (!cancelled) setUser(me);
        }
      } catch {
        // Jeton expiré ou serveur injoignable : on repart déconnecté plutôt
        // que de bloquer l'app sur un écran de chargement.
        setAuthToken(null);
        await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {});
      } finally {
        if (!cancelled) setRestoring(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async (token: string, nextUser: User) => {
    setAuthToken(token);
    setUser(nextUser);
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  }, []);

  const signOut = useCallback(async () => {
    setAuthToken(null);
    setUser(null);
    await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {});
  }, []);

  const refresh = useCallback(async () => {
    try {
      setUser(await api.me());
    } catch {
      // Un rafraîchissement raté ne doit pas déconnecter l'utilisateur.
    }
  }, []);

  const value = useMemo<SessionValue>(
    () => ({ user, restoring, signIn, signOut, refresh }),
    [user, restoring, signIn, signOut, refresh]
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) {
    throw new Error("useSession doit être utilisé dans <SessionProvider>");
  }
  return value;
}
