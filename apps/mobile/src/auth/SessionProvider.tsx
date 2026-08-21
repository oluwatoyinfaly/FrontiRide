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
import { ApiError, api, setAuthToken } from "../api/client";
import type { User } from "../api/types";

const TOKEN_KEY = "frontiride.token";
const USER_KEY = "frontiride.user";

/**
 * Le démarrage ne doit jamais dépendre du réseau : un téléphone qui ne joint
 * pas l'API laisserait sinon l'app sur son écran de chargement. On rouvre donc
 * la session sur ce qui est stocké, et on ne rafraîchit qu'ensuite, en fond.
 */
const RESTORE_TIMEOUT_MS = 8000;

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
      let token: string | null = null;

      try {
        token = await SecureStore.getItemAsync(TOKEN_KEY);
        if (!token) return;

        setAuthToken(token);

        const cached = await SecureStore.getItemAsync(USER_KEY);
        if (cached && !cancelled) {
          setUser(JSON.parse(cached) as User);
        }
      } catch {
        // Stockage illisible : on repart déconnecté.
        setAuthToken(null);
        return;
      } finally {
        if (!cancelled) setRestoring(false);
      }

      // À partir d'ici l'app est déjà affichée : ce rafraîchissement corrige
      // en silence un profil modifié, ou déconnecte si le jeton a expiré.
      try {
        const me = await api.me(RESTORE_TIMEOUT_MS);
        if (cancelled) return;
        setUser(me);
        await SecureStore.setItemAsync(USER_KEY, JSON.stringify(me));
      } catch (err) {
        // Serveur injoignable : on garde la session en cache. Seul un jeton
        // refusé justifie de déconnecter.
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
          setAuthToken(null);
          if (!cancelled) setUser(null);
          await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {});
          await SecureStore.deleteItemAsync(USER_KEY).catch(() => {});
        }
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
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(nextUser));
  }, []);

  const signOut = useCallback(async () => {
    setAuthToken(null);
    setUser(null);
    await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {});
    await SecureStore.deleteItemAsync(USER_KEY).catch(() => {});
  }, []);

  const refresh = useCallback(async () => {
    try {
      const me = await api.me();
      setUser(me);
      await SecureStore.setItemAsync(USER_KEY, JSON.stringify(me));
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
