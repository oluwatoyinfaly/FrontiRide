import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api, dateTime, fcfa, type AdminPayment } from "../api";
import {
  Badge,
  Card,
  Empty,
  Loading,
  Notice,
  PAYMENT_STATUS_OPTIONS,
  Table,
} from "../components/ui";

const METHOD_LABEL: Record<string, string> = {
  MOMO_MTN: "MTN MoMo",
  MOMO_MOOV: "Moov Money",
  CARD: "Carte",
  CASH: "Espèces",
};

export default function Payments() {
  const [params, setParams] = useSearchParams();
  const status = params.get("status") ?? "";

  const [payments, setPayments] = useState<AdminPayment[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ message: string; tone: "success" | "error" } | null>(null);

  const load = useCallback(() => {
    setPayments(null);
    api
      .payments(status || undefined)
      .then(setPayments)
      .catch(() => {
        setPayments([]);
        setNotice({ message: "Chargement impossible.", tone: "error" });
      });
  }, [status]);

  useEffect(load, [load]);

  async function act(id: string, action: () => Promise<unknown>, message: string) {
    setBusy(id);
    setNotice(null);
    try {
      await action();
      setNotice({ message, tone: "success" });
      load();
    } catch (err) {
      setNotice({
        message: err instanceof Error ? err.message : "L'opération a échoué.",
        tone: "error",
      });
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Paiements</h1>
          <p>
            Le séquestre se débloque 24 h après la course, sauf litige. Le
            déblocage crédite le portefeuille du chauffeur.
          </p>
        </div>
        <div className="filters">
          <select
            value={status}
            onChange={(e) => setParams(e.target.value ? { status: e.target.value } : {})}
            aria-label="Filtrer par état"
          >
            <option value="">Tous les états</option>
            {PAYMENT_STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {notice ? <Notice message={notice.message} tone={notice.tone} /> : null}

      <Card>
        {payments === null ? (
          <Loading />
        ) : payments.length === 0 ? (
          <Empty message="Aucun paiement pour ce filtre." />
        ) : (
          <Table
            columns={[
              "Réf. course",
              "Client",
              "Chauffeur",
              "Moyen",
              "Montant",
              "Déblocage",
              "État",
              "",
            ]}
          >
            {payments.map((payment) => (
              <tr key={payment.id}>
                <td className="ref">{payment.booking.reference}</td>
                <td>{payment.booking.client.fullName ?? "—"}</td>
                <td>
                  {payment.booking.driver?.user.fullName ?? (
                    <span className="muted">—</span>
                  )}
                </td>
                <td>{METHOD_LABEL[payment.method] ?? payment.method}</td>
                <td className="num">
                  {fcfa(payment.amountFcfa)}
                  {payment.advanceFcfa ? (
                    <div className="muted" style={{ fontSize: "0.8rem" }}>
                      acompte {fcfa(payment.advanceFcfa)}
                    </div>
                  ) : null}
                </td>
                <td className="num">{dateTime(payment.escrowReleaseAt)}</td>
                <td>
                  <Badge kind="payment" value={payment.status} />
                </td>
                <td>
                  {payment.status === "ESCROW_HELD" ? (
                    <div className="actions">
                      {/* Le déblocage crédite le portefeuille du chauffeur :
                          sans chauffeur assigné, il n'a pas de destinataire. */}
                      {payment.booking.driver ? (
                        <button
                          className="small primary"
                          disabled={busy === payment.id}
                          onClick={() =>
                            act(
                              payment.id,
                              () => api.releasePayment(payment.id),
                              "Séquestre débloqué, chauffeur crédité."
                            )
                          }
                        >
                          Débloquer
                        </button>
                      ) : (
                        <span className="muted" style={{ fontSize: "0.8rem" }}>
                          En attente d'un chauffeur
                        </span>
                      )}
                      <button
                        className="small danger"
                        disabled={busy === payment.id}
                        onClick={() =>
                          act(
                            payment.id,
                            () => api.refundPayment(payment.id),
                            "Paiement remboursé."
                          )
                        }
                      >
                        Rembourser
                      </button>
                    </div>
                  ) : null}
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </>
  );
}
