import { NativeModules, PermissionsAndroid, Platform } from "react-native";

/**
 * Appel audio dans l'application, via Agora.
 *
 * Le module natif n'existe que dans un development build : sous Expo Go, tout
 * ce fichier échoue proprement et l'application n'affiche simplement pas
 * l'option. C'est pourquoi rien n'est importé statiquement — un `import` en
 * tête de fichier planterait au chargement de l'app, pas seulement à l'appel.
 */

interface AgoraModule {
  createAgoraRtcEngine: () => AgoraEngine;
  ChannelProfileType: { ChannelProfileCommunication: number };
  ClientRoleType: { ClientRoleBroadcaster: number };
}

interface AgoraEngine {
  initialize: (config: { appId: string; channelProfile: number }) => void;
  registerEventHandler: (handler: Record<string, unknown>) => void;
  unregisterEventHandler: (handler: Record<string, unknown>) => void;
  enableAudio: () => void;
  disableVideo: () => void;
  joinChannel: (
    token: string,
    channel: string,
    uid: number,
    options: {
      clientRoleType: number;
      publishMicrophoneTrack: boolean;
      autoSubscribeAudio: boolean;
    }
  ) => void;
  muteLocalAudioStream: (muted: boolean) => void;
  setEnableSpeakerphone: (enabled: boolean) => void;
  leaveChannel: () => void;
  release: () => void;
}

let cached: AgoraModule | null | undefined;

/** Charge le module natif une seule fois ; null s'il n'est pas là. */
function loadAgora(): AgoraModule | null {
  if (cached !== undefined) return cached;

  // Le module JS se charge partout ; c'est la brique native qui manque sous
  // Expo Go. Selon la configuration, react-native-agora lève à l'import ou
  // se charge avec un module natif vide : on teste donc les deux.
  if (!NativeModules.AgoraRtcNg) {
    cached = null;
    return cached;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const module = require("react-native-agora") as AgoraModule;
    cached = typeof module?.createAgoraRtcEngine === "function" ? module : null;
  } catch {
    cached = null;
  }

  return cached;
}

/** Vrai si l'appareil sait passer un appel dans l'application. */
export function isVoiceCallSupported(): boolean {
  return loadAgora() !== null;
}

export interface CallHandlers {
  /** L'autre partie vient de rejoindre : l'appel est établi. */
  onConnected?: () => void;
  /** L'autre partie a quitté le canal. */
  onRemoteLeft?: () => void;
  onError?: (code: number) => void;
}

export interface CallSession {
  setMuted: (muted: boolean) => void;
  setSpeaker: (enabled: boolean) => void;
  leave: () => void;
}

/** Le micro est indispensable : sans l'autorisation, l'appel n'a pas de sens. */
export async function ensureMicrophonePermission(): Promise<boolean> {
  if (Platform.OS !== "android") return true;

  const granted = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.RECORD_AUDIO
  );
  return granted === PermissionsAndroid.RESULTS.GRANTED;
}

export interface JoinParams {
  appId: string;
  channel: string;
  token: string;
  uid: number;
}

/**
 * Rejoint le canal de la course. Renvoie null si le module natif est absent :
 * l'appelant retombe alors sur WhatsApp ou l'appel téléphonique.
 */
export async function joinCall(
  params: JoinParams,
  handlers: CallHandlers = {}
): Promise<CallSession | null> {
  const agora = loadAgora();
  if (!agora) return null;

  if (!(await ensureMicrophonePermission())) return null;

  const engine = agora.createAgoraRtcEngine();

  engine.initialize({
    appId: params.appId,
    channelProfile: agora.ChannelProfileType.ChannelProfileCommunication,
  });

  const eventHandler = {
    onUserJoined: () => handlers.onConnected?.(),
    onUserOffline: () => handlers.onRemoteLeft?.(),
    onError: (code: number) => handlers.onError?.(code),
  };
  engine.registerEventHandler(eventHandler);

  // Audio seul : la vidéo coûterait du réseau pour rien sur ce corridor.
  engine.enableAudio();
  engine.disableVideo();

  engine.joinChannel(params.token, params.channel, params.uid, {
    clientRoleType: agora.ClientRoleType.ClientRoleBroadcaster,
    publishMicrophoneTrack: true,
    autoSubscribeAudio: true,
  });

  let left = false;

  return {
    setMuted: (muted) => engine.muteLocalAudioStream(muted),
    setSpeaker: (enabled) => engine.setEnableSpeakerphone(enabled),
    leave: () => {
      if (left) return;
      left = true;
      try {
        engine.leaveChannel();
        engine.unregisterEventHandler(eventHandler);
        engine.release();
      } catch {
        // Un moteur déjà libéré n'a pas à faire échouer un raccrochage.
      }
    },
  };
}
