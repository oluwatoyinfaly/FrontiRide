import { useState, type FormEvent } from "react";
import { ApiError, api, setToken, type AdminUser } from "../api";
import { Notice } from "../components/ui";

export default function Login({ onSignedIn }: { onSignedIn: (user: AdminUser) => void }) {
  const [step, setStep] = useState<"email" | "codes">("email");
  const [email, setEmail] = useState("");
  const [userId, setUserId] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [smsCode, setSmsCode] = useState("");
  const [devMode, setDevMode] = useState(false);
  // En mode « email seul » (essais), le code SMS n'est pas demandé.
  const [needsSms, setNeedsSms] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function requestCodes(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await api.login(email.trim());
      setUserId(result.userId);
      setNeedsSms(result.channels.includes("sms"));
      // Hors production, l'API renvoie les codes des canaux qu'elle n'envoie
      // pas réellement : on les préremplit.
      if (result.devCodes) {
        if (result.devCodes.email) setEmailCode(result.devCodes.email);
        if (result.devCodes.sms) setSmsCode(result.devCodes.sms);
        setDevMode(true);
      }
      setStep("codes");
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 404
          ? "Aucun compte pour cet email."
          : err instanceof ApiError && err.status === 0
            ? "Serveur injoignable."
            : err instanceof ApiError && err.status === 429
              ? "Un code vient d'être envoyé. Patientez quelques secondes."
              : err instanceof ApiError && err.status === 503
                ? "Le code n'a pas pu être envoyé."
                : "Connexion impossible."
      );
    } finally {
      setBusy(false);
    }
  }

  async function verify(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { token, user } = await api.verifyOtp(
        userId,
        emailCode,
        needsSms ? smsCode : undefined
      );
      if (user.role !== "ADMIN") {
        setError("Ce compte n'a pas accès à l'administration.");
        return;
      }
      setToken(token);
      onSignedIn(user);
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 429
          ? "Trop d'essais. Redemandez un code."
          : "Code invalide ou expiré."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <h1 style={{ marginBottom: 6 }}>FrontiRide</h1>
        <p className="muted" style={{ marginTop: 0, marginBottom: 24 }}>
          Administration
        </p>

        {error ? <Notice message={error} tone="error" /> : null}

        {step === "email" ? (
          <form onSubmit={requestCodes}>
            <div className="field">
              <label htmlFor="email">Email administrateur</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <button className="primary" type="submit" disabled={busy || !email}>
              {busy ? "Envoi…" : "Recevoir les codes"}
            </button>
          </form>
        ) : (
          <form onSubmit={verify}>
            {devMode ? (
              <p className="muted" style={{ fontSize: "0.85rem", marginTop: 0 }}>
                Mode développement — codes préremplis.
              </p>
            ) : (
              <p className="muted" style={{ fontSize: "0.85rem", marginTop: 0 }}>
                {needsSms
                  ? `Deux codes ont été envoyés à ${email} et par SMS.`
                  : `Un code a été envoyé à ${email}.`}
              </p>
            )}
            <div className="field">
              <label htmlFor="ec">Code email</label>
              <input
                id="ec"
                inputMode="numeric"
                maxLength={6}
                value={emailCode}
                onChange={(e) => setEmailCode(e.target.value)}
                required
              />
            </div>
            {needsSms ? (
              <div className="field">
                <label htmlFor="sc">Code SMS</label>
                <input
                  id="sc"
                  inputMode="numeric"
                  maxLength={6}
                  value={smsCode}
                  onChange={(e) => setSmsCode(e.target.value)}
                  required
                />
              </div>
            ) : null}
            <button
              className="primary"
              type="submit"
              disabled={
                busy || emailCode.length !== 6 || (needsSms && smsCode.length !== 6)
              }
            >
              {busy ? "Vérification…" : "Se connecter"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
