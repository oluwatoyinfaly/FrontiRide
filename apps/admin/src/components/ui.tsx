import type { ReactNode } from "react";

/** Libellés français des états, avec la tonalité qui va avec. */
const BOOKING_STATUS: Record<string, { label: string; tone: string }> = {
  DRAFT: { label: "Brouillon", tone: "info" },
  AWAITING_PAYMENT: { label: "Attente paiement", tone: "warn" },
  CONFIRMED: { label: "Confirmée", tone: "brand" },
  DRIVER_ASSIGNED: { label: "Chauffeur attribué", tone: "brand" },
  IN_PROGRESS: { label: "En cours", tone: "brand" },
  COMPLETED: { label: "Terminée", tone: "good" },
  CANCELLED: { label: "Annulée", tone: "bad" },
  DISPUTED: { label: "Litige", tone: "bad" },
};

const DRIVER_STATUS: Record<string, { label: string; tone: string }> = {
  PENDING_DOCUMENTS: { label: "Pièces manquantes", tone: "warn" },
  PENDING_REVIEW: { label: "À contrôler", tone: "warn" },
  APPROVED: { label: "Validé", tone: "good" },
  REJECTED: { label: "Refusé", tone: "bad" },
  SUSPENDED: { label: "Suspendu", tone: "bad" },
};

const PAYMENT_STATUS: Record<string, { label: string; tone: string }> = {
  PENDING: { label: "En attente", tone: "warn" },
  ESCROW_HELD: { label: "Sous séquestre", tone: "brand" },
  RELEASED: { label: "Débloqué", tone: "good" },
  REFUNDED: { label: "Remboursé", tone: "info" },
  FAILED: { label: "Échoué", tone: "bad" },
};

const WITHDRAWAL_STATUS: Record<string, { label: string; tone: string }> = {
  REQUESTED: { label: "Demandé", tone: "warn" },
  APPROVED: { label: "Approuvé", tone: "brand" },
  PAID: { label: "Versé", tone: "good" },
  REJECTED: { label: "Refusé", tone: "bad" },
};

const DICTIONARIES = {
  booking: BOOKING_STATUS,
  driver: DRIVER_STATUS,
  payment: PAYMENT_STATUS,
  withdrawal: WITHDRAWAL_STATUS,
} as const;

/** La couleur ne porte jamais seule l'information : le libellé l'accompagne. */
export function Badge({
  kind,
  value,
}: {
  kind: keyof typeof DICTIONARIES;
  value: string;
}) {
  const entry = DICTIONARIES[kind][value] ?? { label: value, tone: "info" };
  return <span className={`badge ${entry.tone}`}>{entry.label}</span>;
}

export const BOOKING_STATUS_OPTIONS = Object.entries(BOOKING_STATUS).map(
  ([value, { label }]) => ({ value, label })
);

export const DRIVER_STATUS_OPTIONS = Object.entries(DRIVER_STATUS).map(
  ([value, { label }]) => ({ value, label })
);

export const PAYMENT_STATUS_OPTIONS = Object.entries(PAYMENT_STATUS).map(
  ([value, { label }]) => ({ value, label })
);

export function Tile({
  label,
  value,
  hint,
  alert = false,
}: {
  label: string;
  value: string | number;
  hint?: string;
  alert?: boolean;
}) {
  return (
    <div className={`tile${alert ? " alert" : ""}`}>
      <div className="tile-label">{label}</div>
      <div className="tile-value">{value}</div>
      {hint ? <div className="tile-hint">{hint}</div> : null}
    </div>
  );
}

export function Card({
  title,
  actions,
  children,
  padded = false,
}: {
  title?: string;
  actions?: ReactNode;
  children: ReactNode;
  padded?: boolean;
}) {
  return (
    <section className="card">
      {title || actions ? (
        <header className="card-head">
          {title ? <h2>{title}</h2> : <span />}
          {actions}
        </header>
      ) : null}
      {padded ? <div className="card-body">{children}</div> : children}
    </section>
  );
}

export function Notice({
  message,
  tone,
}: {
  message: string;
  tone: "error" | "success";
}) {
  return <div className={`notice ${tone}`}>{message}</div>;
}

export function Loading() {
  return <div className="loading">Chargement…</div>;
}

export function Empty({ message }: { message: string }) {
  return <div className="empty">{message}</div>;
}

export function Table({
  columns,
  children,
}: {
  columns: string[];
  children: ReactNode;
}) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
