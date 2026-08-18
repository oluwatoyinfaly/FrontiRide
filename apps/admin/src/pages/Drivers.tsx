import { Fragment, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api, fcfa, shortDate, type AdminDriver } from "../api";
import {
  Badge,
  Card,
  DRIVER_STATUS_OPTIONS,
  Empty,
  Loading,
  Notice,
  Table,
} from "../components/ui";

const DOC_LABEL: Record<string, string> = {
  CNI: "Pièce d'identité",
  PERMIS: "Permis",
  CARTE_GRISE: "Carte grise",
  ASSURANCE: "Assurance",
  VISITE_TECHNIQUE: "Visite technique",
  CASIER_JUDICIAIRE: "Casier judiciaire",
  PHOTO_VEHICULE: "Photo du véhicule",
};

export default function Drivers() {
  const [params, setParams] = useSearchParams();
  const status = params.get("status") ?? "";

  const [drivers, setDrivers] = useState<AdminDriver[] | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ message: string; tone: "success" | "error" } | null>(null);

  const load = useCallback(() => {
    setDrivers(null);
    api
      .drivers(status || undefined)
      .then(setDrivers)
      .catch(() => {
        setDrivers([]);
        setNotice({ message: "Chargement impossible.", tone: "error" });
      });
  }, [status]);

  useEffect(load, [load]);

  async function act(
    id: string,
    action: () => Promise<unknown>,
    message: string
  ) {
    setBusy(id);
    setNotice(null);
    try {
      await action();
      setNotice({ message, tone: "success" });
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
          <h1>Chauffeurs</h1>
          <p>Contrôle des dossiers avant mise en ligne.</p>
        </div>
        <div className="filters">
          <select
            value={status}
            onChange={(e) => {
              const next = e.target.value;
              setParams(next ? { status: next } : {});
            }}
            aria-label="Filtrer par état"
          >
            <option value="">Tous les états</option>
            {DRIVER_STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {notice ? <Notice message={notice.message} tone={notice.tone} /> : null}

      <Card>
        {drivers === null ? (
          <Loading />
        ) : drivers.length === 0 ? (
          <Empty message="Aucun chauffeur pour ce filtre." />
        ) : (
          <Table
            columns={[
              "Chauffeur",
              "Ville",
              "État",
              "Pièces",
              "Courses",
              "Solde",
              "Inscrit le",
              "",
            ]}
          >
            {drivers.map((driver) => (
              <Fragment key={driver.id}>
                <tr>
                  <td>
                    <strong>{driver.user.fullName ?? "—"}</strong>
                    <div className="muted" style={{ fontSize: "0.82rem" }}>
                      {driver.user.email} · {driver.user.phone}
                    </div>
                  </td>
                  <td>{driver.baseCity ?? "—"}</td>
                  <td>
                    <Badge kind="driver" value={driver.status} />
                  </td>
                  <td className="num">
                    {driver.documents.length} / {Object.keys(DOC_LABEL).length}
                  </td>
                  <td className="num">{driver._count.bookings}</td>
                  <td className="num">
                    {driver.wallet ? fcfa(driver.wallet.balanceFcfa) : "—"}
                  </td>
                  <td className="num">{shortDate(driver.createdAt)}</td>
                  <td>
                    <div className="actions">
                      <button
                        className="small"
                        onClick={() =>
                          setExpanded(expanded === driver.id ? null : driver.id)
                        }
                      >
                        {expanded === driver.id ? "Fermer" : "Dossier"}
                      </button>
                      {driver.status === "PENDING_REVIEW" ? (
                        <>
                          <button
                            className="small primary"
                            disabled={busy === driver.id}
                            onClick={() =>
                              act(
                                driver.id,
                                () => api.approveDriver(driver.id),
                                "Chauffeur validé."
                              )
                            }
                          >
                            Valider
                          </button>
                          <button
                            className="small danger"
                            disabled={busy === driver.id}
                            onClick={() =>
                              act(
                                driver.id,
                                () => api.rejectDriver(driver.id),
                                "Dossier refusé."
                              )
                            }
                          >
                            Refuser
                          </button>
                        </>
                      ) : null}
                      {driver.status === "APPROVED" ? (
                        <button
                          className="small danger"
                          disabled={busy === driver.id}
                          onClick={() =>
                            act(
                              driver.id,
                              () => api.suspendDriver(driver.id),
                              "Chauffeur suspendu."
                            )
                          }
                        >
                          Suspendre
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>

                {expanded === driver.id ? (
                  <tr>
                    <td colSpan={8} style={{ background: "var(--surface-muted)" }}>
                      <h3 style={{ marginBottom: 10 }}>Pièces justificatives</h3>
                      <div className="doc-list">
                        {Object.entries(DOC_LABEL).map(([type, label]) => {
                          const doc = driver.documents.find((d) => d.type === type);
                          return (
                            <div className="doc-item" key={type}>
                              <span>{label}</span>
                              {doc ? (
                                <a
                                  href={doc.fileUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  Voir
                                </a>
                              ) : (
                                <span className="badge warn">Manquante</span>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      <h3 style={{ margin: "18px 0 10px" }}>Véhicules</h3>
                      {driver.vehicles.length === 0 ? (
                        <p className="muted">Aucun véhicule déclaré.</p>
                      ) : (
                        <ul style={{ margin: 0, paddingLeft: 18 }}>
                          {driver.vehicles.map((v) => (
                            <li key={v.id}>
                              {v.brand} {v.model} — {v.plateNumber} ({v.type})
                              {v.pricePerDay
                                ? ` · ${fcfa(v.pricePerDay)} / jour`
                                : ""}
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            ))}
          </Table>
        )}
      </Card>
    </>
  );
}
