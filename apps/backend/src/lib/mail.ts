import nodemailer, { type Transporter } from "nodemailer";

/**
 * Envoi d'email par SMTP.
 *
 * SMTP plutôt que l'API d'un fournisseur : c'est le dénominateur commun de
 * tous — Brevo, Resend, Mailgun, Gmail avec mot de passe d'application, ou un
 * relais sur le VPS. Changer de fournisseur ne demande alors que des variables
 * d'environnement, pas une ligne de code.
 *
 * Sans SMTP_HOST le service est considéré comme non configuré : l'OTP retombe
 * sur son comportement de développement.
 */
export function mailConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.MAIL_FROM);
}

let transporter: Transporter | null = null;

function transport(): Transporter {
  if (transporter) return transporter;

  const port = Number(process.env.SMTP_PORT ?? 587);
  const user = process.env.SMTP_USER;

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    // 465 est du TLS implicite ; 587 démarre en clair puis passe en STARTTLS,
    // que nodemailer négocie seul quand le serveur l'annonce.
    secure: port === 465,
    auth: user ? { user, pass: process.env.SMTP_PASS } : undefined,
    // Un SMTP qui ne répond pas ne doit pas figer la requête de connexion.
    connectionTimeout: 8_000,
    greetingTimeout: 8_000,
    socketTimeout: 12_000,
  });

  return transporter;
}

const COPY = {
  fr: {
    subject: (code: string) => `Votre code FrontiRide : ${code}`,
    intro: "Voici votre code de connexion FrontiRide :",
    validity: "Il est valable 10 minutes.",
    ignore: "Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.",
  },
  en: {
    subject: (code: string) => `Your FrontiRide code: ${code}`,
    intro: "Here is your FrontiRide sign-in code:",
    validity: "It is valid for 10 minutes.",
    ignore: "If you didn't request this, you can ignore this message.",
  },
} as const;

export async function sendOtpEmail(
  to: string,
  code: string,
  locale: string
): Promise<void> {
  const copy = locale === "en" ? COPY.en : COPY.fr;

  await transport().sendMail({
    from: process.env.MAIL_FROM,
    to,
    subject: copy.subject(code),
    text: `${copy.intro}\n\n${code}\n\n${copy.validity}\n${copy.ignore}\n`,
    html: `<p>${copy.intro}</p>
<p style="font-size:28px;font-weight:700;letter-spacing:6px;margin:16px 0">${code}</p>
<p style="color:#5A6C66">${copy.validity}<br>${copy.ignore}</p>`,
  });
}
