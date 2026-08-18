import { useCallback, useEffect, useState } from "react";
import { api, fcfa, shortDate, type AdminWithdrawal } from "../api";
import { Badge, Card, Empty, Loading, Notice, Table } from "../components/ui";

export default function Withdrawals() {
  const [withdrawals, setWithdrawals] = useState<AdminWithdrawal[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ message: string; tone: "success" | "error" } | null>(null);

  const load = useCallback(() => {
    setWithdrawals(null);
    api
      .withdrawals()
      .then(setWithdrawals)
      .catch(() => {
        setWithdrawals([]);
        setNotice({ message: "Chargement impossible.", tone: "error" });
      });
  }, []);

  useEffect(load, [load]);

  async function settle(id: string) {
    setBusy(id);
    setNotice(null);
    try {
      await api.settleWithdrawal(id);
      setNotice({ message: "Retrait marqué comme versé.", tone: "success" });
      load();
    } catch {
      setNotice({ message: "L'opération a échoué.", tone: "error" });
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Retraits chauffeurs</h1>
          <p>
            Le montant est déjà déduit du solde à la demande. Marquez « versé »
            une fois le transfert Mobile Money effectué.
          </p>
        </div>
      </div>

      {notice ? <Notice message={notice.message} tone={notice.tone} /> : null}

      <Card>
        {withdrawals === null ? (
          <Loading />
        ) : withdrawals.length === 0 ? (
          <Empty message="Aucune demande de retrait." />
        ) : (
          <Table
            columns={["Chauffeur", "Destination", "Montant", "Demandé le", "État", ""]}
          >
            {withdrawals.map((w) => (
              <tr key={w.id}>
                <td>{w.wallet.driver.user.fullName ?? "—"}</td>
                <td className="num">{w.destination}</td>
                <td className="num">{fcfa(w.amountFcfa)}</td>
                <td className="num">{shortDate(w.createdAt)}</td>
                <td>
                  <Badge kind="withdrawal" value={w.status} />
                </td>
                <td>
                  {w.status === "REQUESTED" ? (
                    <button
                      className="small primary"
                      disabled={busy === w.id}
                      onClick={() => settle(w.id)}
                    >
                      Marquer versé
                    </button>
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
