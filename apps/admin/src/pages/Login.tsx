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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function requestCodes(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await api.login(email.trim());
      setUserId(result.userId);
      // Hors production, l'API renvoie les codes : on les préremplit.
      if (result.devCodes) {
        setEmailCode(result.devCodes.email);
        setSmsCode(result.devCodes.sms);
        setDevMode(true);
      }
      setStep("codes");
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 404
          ? "Aucun compte pour cet email."
          : err instanceof ApiError && err.status === 0
            ? "Serveur injoignable."
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
      const { token, user } = await api.verifyOtp(userId, emailCode, smsCode);
      if (user.role !== "ADMIN") {
        setError("Ce compte n'a pas accès à l'administration.");
        return;
      }
      setToken(token);
      onSignedIn(user);
    } catch {
      setError("Code invalide ou expiré.");
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
                Deux codes ont été envoyés à {email} et par SMS.
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
            <button
              className="primary"
              type="submit"
              disabled={busy || emailCode.length !== 6 || smsCode.length !== 6}
            >
              {busy ? "Vérification…" : "Se connecter"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
