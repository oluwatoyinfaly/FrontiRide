import { useEffect, useState } from "react";
import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import { api, getToken, setToken, type AdminUser, type Stats } from "./api";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Drivers from "./pages/Drivers";
import Bookings from "./pages/Bookings";
import Payments from "./pages/Payments";
import Withdrawals from "./pages/Withdrawals";
import Troncons from "./pages/Troncons";

/** Le logo, repris du tracé maître (brand/frontiride-mark.svg). */
function Mark({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" aria-hidden="true">
      <rect width="512" height="512" rx="112" fill="#0B6E52" />
      <g fill="#FFFFFF">
        <rect x="128" y="123" width="64" height="292" rx="8" />
        <rect x="128" y="123" width="180" height="60" rx="8" />
        <polygon points="300,97 384,153 300,209" />
        <rect x="128" y="241" width="130" height="58" rx="8" />
      </g>
    </svg>
  );
}

const NAV = [
  { to: "/", label: "Tableau de bord", end: true },
  { to: "/chauffeurs", label: "Chauffeurs" },
  { to: "/courses", label: "Courses" },
  { to: "/paiements", label: "Paiements" },
  { to: "/retraits", label: "Retraits" },
  { to: "/troncons", label: "Trançons" },
];

export default function App() {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [restoring, setRestoring] = useState(true);
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    if (!getToken()) {
      setRestoring(false);
      return;
    }
    api
      .me()
      .then((me) => {
        if (me.role === "ADMIN") setUser(me);
        else setToken(null);
      })
      .catch(() => setToken(null))
      .finally(() => setRestoring(false));
  }, []);

  // Les pastilles de la navigation signalent ce qui attend une action.
  useEffect(() => {
    if (!user) return;
    api.stats().then(setStats).catch(() => {});
  }, [user]);

  if (restoring) return <div className="loading">Chargement…</div>;
  if (!user) return <Login onSignedIn={setUser} />;

  const counts: Record<string, number> = {
    "/chauffeurs": stats?.drivers.pendingReview ?? 0,
    "/paiements": stats?.escrow.count ?? 0,
    "/retraits": stats?.pendingWithdrawals ?? 0,
  };

  function signOut() {
    setToken(null);
    setUser(null);
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <Mark />
          <span className="brand-name">FrontiRide</span>
        </div>

        <nav className="nav">
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end}>
              <span>{item.label}</span>
              {counts[item.to] ? (
                <span className="nav-count">{counts[item.to]}</span>
              ) : null}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <span>{user.email}</span>
          <button className="small" onClick={signOut}>
            Se déconnecter
          </button>
        </div>
      </aside>

      <main className="main">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/chauffeurs" element={<Drivers />} />
          <Route path="/courses" element={<Bookings />} />
          <Route path="/paiements" element={<Payments />} />
          <Route path="/retraits" element={<Withdrawals />} />
          <Route path="/troncons" element={<Troncons />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
