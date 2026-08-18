# FrontiRide

_Le transport frontalier et de séjour, simple et sécurisé_

Plateforme de mise en relation pour le transport frontalier (Volet 1) et la location de véhicule avec chauffeur en ville (Volet 2), avec un pilote de lancement sur le corridor **Cotonou ↔ Lomé**.

## Documentation

- [`docs/cahier-des-charges.md`](docs/cahier-des-charges.md) — spécifications produit consolidées.
- [`docs/plan-de-developpement.md`](docs/plan-de-developpement.md) — stack technique et phasage du MVP.
- [`docs/charte-graphique.md`](docs/charte-graphique.md) — logo, couleurs, typographie, assets.
- [`docs/builds-eas.md`](docs/builds-eas.md) — builds EAS, labels de PR, intégration continue.

## Structure du repo

```
apps/
  backend/   API Fastify + TypeScript + Prisma/PostgreSQL
  mobile/    App React Native (Expo) — client et chauffeur, FR/EN
  admin/     Back-office React + Vite
brand/       Tracé maître du logo et lockups
docs/        Spécifications, charte et procédures
```

## Démarrage rapide

### 1. Backend et base de données

```bash
docker compose up --build
docker compose exec backend npm run prisma:seed   # dans un autre terminal
```

L'API écoute sur `http://localhost:3001` (`GET /health` pour vérifier). Le port hôte évite le 3000 souvent déjà pris ; change-le avec `BACKEND_PORT` si besoin.

Le seed crée le corridor Cotonou ↔ Lomé, quatre chauffeurs (deux validés, deux à contrôler), un client et cinq réservations couvrant chaque état — de quoi voir le back-office rempli tout de suite.

| Compte de démonstration | Rôle |
|---|---|
| `admin@frontiride.com` | Administrateur |
| `client@example.com` | Client |
| `kofi.adjovi@example.com` | Chauffeur validé |

L'authentification se fait par code OTP double (email + SMS). **Hors production, l'API renvoie les codes dans sa réponse** et les interfaces les préremplissent : le parcours est donc testable sans passerelle SMS.

### 2. Back-office administrateur

```bash
cd apps/admin
cp .env.example .env
npm install && npm run dev        # http://localhost:5173
```

### 3. Application mobile

```bash
cd apps/mobile
npm install && npm start
```

L'app vise automatiquement la machine qui sert Metro sur le port 3001 ; `EXPO_PUBLIC_API_URL` permet de forcer une autre adresse.

## Vérifications

```bash
npm run typecheck   # backend + mobile + admin
npm run smoke       # 23 assertions de bout en bout sur l'API
```

Le smoke test suppose une base fraîchement migrée et seedée — il consomme les données de démonstration.

## Démarrage manuel du backend (sans Docker)

```bash
cd apps/backend
cp .env.example .env   # renseigner DATABASE_URL et FEDAPAY_SECRET_KEY
npm install
npm run prisma:migrate
npm run prisma:seed
npm run dev
```
