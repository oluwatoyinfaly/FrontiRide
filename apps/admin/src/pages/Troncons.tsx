import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api, fcfa, type Trancon } from "../api";
import { Card, Empty, Loading, Notice, Table } from "../components/ui";

const EMPTY_FORM = {
  originCity: "",
  destinationCity: "",
  borderPoint: "",
  priceFcfa: "",
  estimatedCustomsFeeFcfa: "",
};

export default function Troncons() {
  const [troncons, setTroncons] = useState<Trancon[] | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ message: string; tone: "success" | "error" } | null>(null);

  const load = useCallback(() => {
    setTroncons(null);
    api
      .troncons()
      .then(setTroncons)
      .catch(() => {
        setTroncons([]);
        setNotice({ message: "Chargement impossible.", tone: "error" });
      });
  }, []);

  useEffect(load, [load]);

  async function create(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setNotice(null);
    try {
      await api.createTrancon({
        originCity: form.originCity.trim(),
        destinationCity: form.destinationCity.trim(),
        borderPoint: form.borderPoint.trim() || null,
        priceFcfa: Number(form.priceFcfa),
        estimatedCustomsFeeFcfa: Number(form.estimatedCustomsFeeFcfa || 0),
        active: true,
      });
      setForm(EMPTY_FORM);
      setNotice({ message: "Trançon créé.", tone: "success" });
      load();
    } catch {
      setNotice({ message: "Création impossible.", tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function toggle(trancon: Trancon) {
    setBusy(true);
    try {
      await api.updateTrancon(trancon.id, { active: !trancon.active });
      load();
    } catch {
      setNotice({ message: "L'opération a échoué.", tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  /** Le prix affiché au client est le tarif du trançon plus les frais de douane. */
  async function updatePrice(trancon: Trancon, field: keyof Trancon, value: string) {
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount < 0) return;
    try {
      await api.updateTrancon(trancon.id, { [field]: amount });
      load();
    } catch {
      setNotice({ message: "Mise à jour impossible.", tone: "error" });
    }
  }

  const canSubmit =
    form.originCity.trim() && form.destinationCity.trim() && Number(form.priceFcfa) > 0;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Trançons et tarifs</h1>
          <p>
            Grille fixe du transport frontalier. Le client voit le tarif du
            trançon plus les frais de douane estimés.
          </p>
        </div>
      </div>

      {notice ? <Notice message={notice.message} tone={notice.tone} /> : null}

      <Card>
        {troncons === null ? (
          <Loading />
        ) : troncons.length === 0 ? (
          <Empty message="Aucun trançon défini." />
        ) : (
          <Table
            columns={["Trajet", "Frontière", "Tarif", "Douane", "Total client", "État", ""]}
          >
            {troncons.map((trancon) => (
              <tr key={trancon.id}>
                <td>
                  <strong>
                    {trancon.originCity} → {trancon.destinationCity}
                  </strong>
                </td>
                <td>{trancon.borderPoint ?? "—"}</td>
                <td className="num">
                  <input
                    type="number"
                    defaultValue={trancon.priceFcfa}
                    min={0}
                    step={500}
                    style={{ width: 110 }}
                    aria-label={`Tarif ${trancon.originCity} ${trancon.destinationCity}`}
                    onBlur={(e) => updatePrice(trancon, "priceFcfa", e.target.value)}
                  />
                </td>
                <td className="num">
                  <input
                    type="number"
                    defaultValue={trancon.estimatedCustomsFeeFcfa}
                    min={0}
                    step={500}
                    style={{ width: 110 }}
                    aria-label={`Douane ${trancon.originCity} ${trancon.destinationCity}`}
                    onBlur={(e) =>
                      updatePrice(trancon, "estimatedCustomsFeeFcfa", e.target.value)
                    }
                  />
                </td>
                <td className="num">
                  <strong>
                    {fcfa(trancon.priceFcfa + trancon.estimatedCustomsFeeFcfa)}
                  </strong>
                </td>
                <td>
                  <span className={`badge ${trancon.active ? "good" : "bad"}`}>
                    {trancon.active ? "Actif" : "Inactif"}
                  </span>
                </td>
                <td>
                  <button
                    className="small"
                    disabled={busy}
                    onClick={() => toggle(trancon)}
                  >
                    {trancon.active ? "Désactiver" : "Activer"}
                  </button>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <Card title="Ajouter un trançon" padded>
        <form
          onSubmit={create}
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: 12,
            alignItems: "end",
          }}
        >
          <div className="field" style={{ margin: 0 }}>
            <label htmlFor="o">Ville de départ</label>
            <input
              id="o"
              value={form.originCity}
              onChange={(e) => setForm({ ...form, originCity: e.target.value })}
              required
            />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label htmlFor="d">Ville d'arrivée</label>
            <input
              id="d"
              value={form.destinationCity}
              onChange={(e) => setForm({ ...form, destinationCity: e.target.value })}
              required
            />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label htmlFor="b">Poste frontière</label>
            <input
              id="b"
              value={form.borderPoint}
              onChange={(e) => setForm({ ...form, borderPoint: e.target.value })}
              placeholder="Hilacondji"
            />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label htmlFor="p">Tarif (FCFA)</label>
            <input
              id="p"
              type="number"
              min={0}
              step={500}
              value={form.priceFcfa}
              onChange={(e) => setForm({ ...form, priceFcfa: e.target.value })}
              required
            />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label htmlFor="c">Douane (FCFA)</label>
            <input
              id="c"
              type="number"
              min={0}
              step={500}
              value={form.estimatedCustomsFeeFcfa}
              onChange={(e) =>
                setForm({ ...form, estimatedCustomsFeeFcfa: e.target.value })
              }
            />
          </div>
          <button className="primary" type="submit" disabled={busy || !canSubmit}>
            Créer
          </button>
        </form>
      </Card>
    </>
  );
}
