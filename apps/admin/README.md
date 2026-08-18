# FrontiRide — Back-office administrateur

SPA React + Vite. Reprend la palette et la typographie de
[`docs/charte-graphique.md`](../../docs/charte-graphique.md).

## Écrans

| Écran | Rôle |
|---|---|
| Tableau de bord | Chiffres clés, trajets les plus demandés, liste des actions en attente |
| Chauffeurs | Contrôle des dossiers : pièces justificatives, véhicules, validation ou refus |
| Courses | Suivi des réservations, passage en litige |
| Paiements | Séquestre : déblocage vers le portefeuille chauffeur, remboursement |
| Retraits | Demandes de versement Mobile Money des chauffeurs |
| Trançons | Grille tarifaire du transport frontalier, éditable en ligne |

## Démarrage

```bash
cp .env.example .env   # VITE_API_URL pointe vers le backend
npm install
npm run dev            # http://localhost:5173
```

La connexion se fait avec un compte de rôle `ADMIN` et le même OTP double
(email + SMS) que l'application mobile. Hors production, l'API renvoie les
codes et l'interface les préremplit.

Le compte administrateur est créé par le seed du backend
(`admin@frontiride.com` par défaut, modifiable via `SEED_ADMIN_EMAIL`).
