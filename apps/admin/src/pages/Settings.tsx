import { useEffect, useState } from "react";
import { api, ApiError, type AdminSettings } from "../api";
import { Card, Loading, Notice } from "../components/ui";

export default function Settings() {
  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ message: string; tone: "success" | "error" } | null>(null);

  useEffect(() => {
    api
      .settings()
      .then(setSettings)
      .catch(() => setNotice({ message: "Chargement impossible.", tone: "error" }));
  }, []);

  async function toggle(next: boolean) {
    setBusy(true);
    setNotice(null);
    try {
      setSettings(await api.updateSettings({ maskPhoneNumbers: next }));
      setNotice({
        message: next
          ? "Numéros masqués : le contact passe uniquement par l'appel dans l'application."
          : "Numéros visibles : le client et le chauffeur peuvent s'appeler directement.",
        tone: "success",
      });
    } catch (err) {
      setNotice({
        message: err instanceof ApiError ? err.message : "Enregistrement impossible.",
        tone: "error",
      });
    } finally {
      setBusy(false);
    }
  }

  if (!settings) return notice ? <Notice {...notice} /> : <Loading />;

  const blocked = !settings.inAppCallsAvailable && !settings.maskPhoneNumbers;

  return (
    <>
      <div className="page-head">
        <h1>Réglages</h1>
      </div>

      {notice ? <Notice {...notice} /> : null}

      <Card title="Confidentialité des numéros" padded>
        <p>
          Quand cette option est active, <strong>ni le client ni le chauffeur ne voient le
          numéro de l'autre</strong> : plus de bouton « Appeler » ni WhatsApp, seulement
          l'appel dans l'application. Les numéros ne quittent jamais le serveur.
        </p>

        {!settings.inAppCallsAvailable ? (
          <p>
            <strong>Appel dans l'application non configuré</strong> (AGORA_APP_ID et
            AGORA_APP_CERTIFICATE manquants) : l'option ne peut pas être activée, sinon client
            et chauffeur ne pourraient plus se joindre.
          </p>
        ) : (
          <p>
            L'appel dans l'application ne fonctionne que dans une version installée de
            l'app (APK / build), pas dans Expo Go. Testez-le entre deux téléphones avant
            d'activer l'option en production.
          </p>
        )}

        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            type="checkbox"
            checked={settings.maskPhoneNumbers}
            disabled={busy || blocked}
            onChange={(e) => toggle(e.target.checked)}
          />
          Masquer les numéros de téléphone
        </label>
      </Card>
    </>
  );
}
