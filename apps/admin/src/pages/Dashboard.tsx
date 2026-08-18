import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, fcfa, type Stats } from "../api";
import { Card, Empty, Loading, Notice, Tile } from "../components/ui";

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .stats()
      .then(setStats)
      .catch(() => setError("Impossible de charger les statistiques."));
  }, []);

  if (error) return <Notice message={error} tone="error" />;
  if (!stats) return <Loading />;

  const active =
    (stats.bookings.CONFIRMED ?? 0) +
    (stats.bookings.DRIVER_ASSIGNED ?? 0) +
    (stats.bookings.IN_PROGRESS ?? 0);

  const maxCount = Math.max(1, ...stats.topTroncons.map((t) => t.count));

  // Seules les lignes réellement en attente ont leur place dans une liste
  // de tâches : un « 0 dossier » n'appelle aucune action.
  const todo = [
    {
      count: stats.drivers.pendingReview,
      to: "/chauffeurs?status=PENDING_REVIEW",
      label: `${stats.drivers.pendingReview} dossier(s) chauffeur en attente de contrôle`,
    },
    {
      count: stats.escrow.count,
      to: "/paiements?status=ESCROW_HELD",
      label: `${stats.escrow.count} paiement(s) sous séquestre à arbitrer`,
    },
    {
      count: stats.pendingWithdrawals,
      to: "/retraits",
      label: `${stats.pendingWithdrawals} demande(s) de retrait à verser`,
    },
    {
      count: stats.bookings.DISPUTED ?? 0,
      to: "/courses?status=DISPUTED",
      label: `${stats.bookings.DISPUTED ?? 0} course(s) en litige`,
    },
  ].filter((item) => item.count > 0);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Tableau de bord</h1>
          <p>Corridor pilote Cotonou ↔ Lomé.</p>
        </div>
      </div>

      <div className="tiles">
        <Tile
          label="Dossiers à contrôler"
          value={stats.drivers.pendingReview}
          hint={`${stats.drivers.approved} chauffeurs validés`}
          alert={stats.drivers.pendingReview > 0}
        />
        <Tile
          label="Courses en cours"
          value={active}
          hint={`${stats.bookings.AWAITING_PAYMENT ?? 0} en attente de paiement`}
        />
        <Tile
          label="Sous séquestre"
          value={fcfa(stats.escrow.amountFcfa)}
          hint={`${stats.escrow.count} paiement(s) à débloquer`}
          alert={stats.escrow.count > 0}
        />
        <Tile
          label="Retraits à verser"
          value={stats.pendingWithdrawals}
          alert={stats.pendingWithdrawals > 0}
        />
        <Tile
          label="Chiffre d'affaires du mois"
          value={fcfa(stats.revenue.thisMonthFcfa)}
        />
        <Tile
          label="Courses terminées"
          value={stats.revenue.completedCount}
          hint={`${fcfa(stats.revenue.totalFcfa)} au total`}
        />
      </div>

      <Card title="Trajets les plus demandés" padded>
        {stats.topTroncons.length === 0 ? (
          <Empty message="Aucune course frontalière enregistrée." />
        ) : (
          <div className="rank">
            {stats.topTroncons.map((row, index) => (
              <div className="rank-row" key={row.trancon?.originCity ?? index}>
                <span>
                  {row.trancon
                    ? `${row.trancon.originCity} → ${row.trancon.destinationCity}`
                    : "Trajet supprimé"}
                </span>
                <div
                  className="rank-bar-track"
                  role="img"
                  aria-label={`${row.count} course(s)`}
                >
                  <div
                    className="rank-bar"
                    style={{ width: `${(row.count / maxCount) * 100}%` }}
                  />
                </div>
                <strong style={{ fontVariantNumeric: "tabular-nums" }}>
                  {row.count}
                </strong>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="À traiter" padded>
        {todo.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            Rien en attente. Tous les dossiers, paiements et retraits sont traités.
          </p>
        ) : (
          <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 2 }}>
            {todo.map((item) => (
              <li key={item.to}>
                <Link to={item.to}>{item.label}</Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
