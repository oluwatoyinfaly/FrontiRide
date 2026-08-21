import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AppState } from "react-native";
import { useSession } from "../auth/SessionProvider";
import { api } from "../api/client";
import { isVoiceCallSupported, joinCall, type CallSession } from "../lib/voiceCall";
import type { CallCredentials, IncomingCall } from "../api/types";
import { CallOverlay } from "./CallOverlay";

/** Rythme d'interrogation de la sonnerie. Le push le remplacera. */
const RING_POLL_MS = 5000;
/** Rythme de suivi d'un appel sortant : on veut savoir vite s'il est refusé. */
const STATUS_POLL_MS = 2500;

export type CallPhase = "idle" | "outgoing" | "incoming" | "active" | "ended";

interface CallState {
  phase: CallPhase;
  callId: string | null;
  peerName: string | null;
  /** Renseigné quand l'appel est établi, pour la durée affichée. */
  connectedAt: number | null;
  /** Raison de fin, affichée brièvement avant de refermer. */
  outcome: "declined" | "missed" | "failed" | "ended" | null;
}

const IDLE: CallState = {
  phase: "idle",
  callId: null,
  peerName: null,
  connectedAt: null,
  outcome: null,
};

interface CallValue {
  /** Vrai si l'appel dans l'application est utilisable ici et maintenant. */
  available: boolean;
  state: CallState;
  call: (bookingId: string, peerName: string | null) => Promise<void>;
  hangUp: () => Promise<void>;
  accept: () => Promise<void>;
  decline: () => Promise<void>;
  setMuted: (muted: boolean) => void;
  setSpeaker: (on: boolean) => void;
}

const CallContext = createContext<CallValue | null>(null);

export function CallProvider({ children }: { children: ReactNode }) {
  const { user } = useSession();

  const [serverEnabled, setServerEnabled] = useState(false);
  const [state, setState] = useState<CallState>(IDLE);
  const [incoming, setIncoming] = useState<IncomingCall | null>(null);

  const session = useRef<CallSession | null>(null);
  const supported = isVoiceCallSupported();
  const available = supported && serverEnabled;

  // Le serveur dit si Agora est configuré : sans clés, l'option reste cachée.
  useEffect(() => {
    if (!user || !supported) return;
    let cancelled = false;
    api
      .callsEnabled()
      .then((r) => !cancelled && setServerEnabled(r.enabled))
      .catch(() => !cancelled && setServerEnabled(false));
    return () => {
      cancelled = true;
    };
  }, [user, supported]);

  const teardown = useCallback((outcome: CallState["outcome"]) => {
    session.current?.leave();
    session.current = null;
    setIncoming(null);
    setState({ ...IDLE, phase: "ended", outcome });
    // L'écran se referme après avoir montré la raison.
    setTimeout(() => setState(IDLE), 1500);
  }, []);

  const join = useCallback(
    async (credentials: CallCredentials, callId: string, peerName: string | null) => {
      const active = await joinCall(credentials, {
        onConnected: () =>
          setState((s) => ({ ...s, phase: "active", connectedAt: Date.now() })),
        onRemoteLeft: () => teardown("ended"),
        onError: () => teardown("failed"),
      });

      if (!active) {
        await api.endCall(callId).catch(() => {});
        teardown("failed");
        return;
      }

      session.current = active;
      setState((s) => ({ ...s, callId, peerName }));
    },
    [teardown]
  );

  const call = useCallback(
    async (bookingId: string, peerName: string | null) => {
      setState({ ...IDLE, phase: "outgoing", peerName });
      try {
        const { call: created, credentials } = await api.startCall(bookingId);
        setState((s) => ({ ...s, callId: created.id }));
        await join(credentials, created.id, peerName);
      } catch {
        teardown("failed");
      }
    },
    [join, teardown]
  );

  const hangUp = useCallback(async () => {
    const id = state.callId;
    session.current?.leave();
    session.current = null;
    setState(IDLE);
    if (id) await api.endCall(id).catch(() => {});
  }, [state.callId]);

  const accept = useCallback(async () => {
    if (!incoming) return;
    try {
      const { credentials } = await api.acceptCall(incoming.id);
      setState({
        ...IDLE,
        phase: "outgoing",
        callId: incoming.id,
        peerName: incoming.caller.fullName,
      });
      setIncoming(null);
      await join(credentials, incoming.id, incoming.caller.fullName);
    } catch {
      teardown("failed");
    }
  }, [incoming, join, teardown]);

  const decline = useCallback(async () => {
    const id = incoming?.id;
    setIncoming(null);
    setState(IDLE);
    if (id) await api.declineCall(id).catch(() => {});
  }, [incoming]);

  // Sonnerie entrante : uniquement au premier plan, et jamais pendant un appel.
  useEffect(() => {
    if (!user || !available) return;
    if (state.phase !== "idle" || incoming) return;

    const timer = setInterval(async () => {
      if (AppState.currentState !== "active") return;
      try {
        const next = await api.incomingCall();
        if (next) setIncoming(next);
      } catch {
        // Réseau instable : on retentera au tour suivant.
      }
    }, RING_POLL_MS);

    return () => clearInterval(timer);
  }, [user, available, state.phase, incoming]);

  // Appel sortant : on surveille si l'autre refuse ou laisse sonner.
  useEffect(() => {
    if (state.phase !== "outgoing" || !state.callId) return;
    const id = state.callId;

    const timer = setInterval(async () => {
      try {
        const current = await api.callStatus(id);
        if (current.status === "DECLINED") teardown("declined");
        if (current.status === "MISSED") teardown("missed");
      } catch {
        // Idem : une lecture ratée n'interrompt pas l'appel.
      }
    }, STATUS_POLL_MS);

    return () => clearInterval(timer);
  }, [state.phase, state.callId, teardown]);

  // Se déconnecter ne doit jamais laisser un canal ouvert derrière soi.
  useEffect(() => {
    if (!user && session.current) {
      session.current.leave();
      session.current = null;
      setState(IDLE);
      setIncoming(null);
    }
  }, [user]);

  const value: CallValue = {
    available,
    state,
    call,
    hangUp,
    accept,
    decline,
    setMuted: (muted) => session.current?.setMuted(muted),
    setSpeaker: (on) => session.current?.setSpeaker(on),
  };

  return (
    <CallContext.Provider value={value}>
      {children}
      <CallOverlay incoming={incoming} />
    </CallContext.Provider>
  );
}

export function useCall(): CallValue {
  const value = useContext(CallContext);
  if (!value) throw new Error("useCall doit être utilisé dans <CallProvider>");
  return value;
}
