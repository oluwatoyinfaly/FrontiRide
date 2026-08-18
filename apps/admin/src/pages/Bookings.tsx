import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api, dateTime, fcfa, type AdminBooking } from "../api";
import {
  BOOKING_STATUS_OPTIONS,
  Badge,
  Card,
  Empty,
  Loading,
  Notice,
  Table,
} from "../components/ui";

/** Une course encore ouverte peut être basculée en litige par l'admin. */
const DISPUTABLE = ["CONFIRMED", "DRIVER_ASSIGNED", "IN_PROGRESS", "COMPLETED"];

export default function Bookings() {
  const [params, setParams] = useSearchParams();
  const status = params.get("status") ?? "";

  const [bookings, setBookings] = useState<AdminBooking[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ message: string; tone: "success" | "error" } | null>(null);

  const load = useCallback(() => {
    setBookings(null);
    api
      .bookings(status || undefined)
      .then(setBookings)
      .catch(() => {
        setBookings([]);
        setNotice({ message: "Chargement impossible.", tone: "error" });
      });
  }, [status]);

  useEffect(load, [load]);

  async function dispute(id: string) {
    setBusy(id);
    setNotice(null);
    try {
      await api.disputeBooking(id);
      setNotice({ message: "Course passée en litige.", tone: "success" });
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
          <h1>Courses</h1>
          <p>Suivi des réservations frontalières et des locations.</p>
        </div>
        <div className="filters">
          <select
            value={status}
            onChange={(e) => setParams(e.target.value ? { status: e.target.value } : {})}
            aria-label="Filtrer par état"
          >
            <option value="">Tous les états</option>
            {BOOKING_STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {notice ? <Notice message={notice.message} tone={notice.tone} /> : null}

      <Card>
        {bookings === null ? (
          <Loading />
        ) : bookings.length === 0 ? (
          <Empty message="Aucune course pour ce filtre." />
        ) : (
          <Table
            columns={[
              "Réf.",
              "Type",
              "Trajet",
              "Client",
              "Chauffeur",
              "Date",
              "Montant",
              "État",
              "",
            ]}
          >
            {bookings.map((booking) => (
              <tr key={booking.id}>
                <td className="ref">{booking.reference}</td>
                <td>
                  {booking.type === "FRONTALIER" ? "Frontalier" : "Location"}
                </td>
                <td>
                  {booking.trancon
                    ? `${booking.trancon.originCity} → ${booking.trancon.destinationCity}`
                    : "—"}
                </td>
                <td>
                  {booking.client.fullName ?? booking.client.email}
                  <div className="muted" style={{ fontSize: "0.82rem" }}>
                    {booking.client.phone}
                  </div>
                </td>
                <td>{booking.driver?.user.fullName ?? <span className="muted">—</span>}</td>
                <td className="num">
                  {dateTime(booking.departureAt ?? booking.startAt ?? booking.createdAt)}
                </td>
                <td className="num">
                  {fcfa(booking.finalPriceFcfa ?? booking.estimatedPriceFcfa ?? 0)}
                </td>
                <td>
                  <Badge kind="booking" value={booking.status} />
                </td>
                <td>
                  {DISPUTABLE.includes(booking.status) ? (
                    <button
                      className="small danger"
                      disabled={busy === booking.id}
                      onClick={() => dispute(booking.id)}
                    >
                      Litige
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
