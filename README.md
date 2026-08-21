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

### 1. Base de données, API et back-office — une seule commande

```bash
docker compose up --build
```

Trois services démarrent dans l'ordre : PostgreSQL, puis l'API (qui applique les migrations **et le seed** toute seule), puis le back-office une fois l'API en bonne santé.

| Service | Adresse |
|---|---|
| API | http://localhost:3001 — `GET /health` pour vérifier |
| Back-office | http://localhost:5173 |
| PostgreSQL | `localhost:5432` |

Si l'un de ces ports est déjà pris sur ta machine :

```bash
BACKEND_PORT=4000 ADMIN_PORT=5174 POSTGRES_PORT=5433 docker compose up --build
```

Sous PowerShell, les variables se passent autrement :

```powershell
$env:BACKEND_PORT=4000; docker compose up --build
```

Le seed crée le corridor Cotonou ↔ Lomé, quatre chauffeurs (deux validés, deux à contrôler), un client et cinq réservations couvrant chaque état — de quoi voir le back-office rempli dès le premier démarrage. Il est idempotent : le relancer ne duplique rien.

| Compte de démonstration | Rôle |
|---|---|
| `admin@frontiride.com` | Administrateur |
| `client@example.com` | Client |
| `kofi.adjovi@example.com` | Chauffeur validé |

L'authentification se fait par code OTP double (email + SMS). **Hors production, l'API renvoie les codes dans sa réponse** et les interfaces les préremplissent : le parcours est donc testable sans passerelle SMS.

### 2. Application mobile

Metro doit rester joignable depuis le téléphone, il tourne donc hors de Docker :

```bash
npm install
cd apps/mobile
npm start
```

Scanne le QR code avec Expo Go. L'app vise automatiquement la machine qui sert Metro sur le port 3001, donc **rien à configurer si le téléphone et le PC sont sur le même Wi-Fi**.

Si la connexion à l'API échoue depuis le téléphone, force l'adresse avec l'IP locale de ta machine :

```powershell
# Windows : relève l'IPv4 de ton adaptateur Wi-Fi
ipconfig | Select-String IPv4

$env:EXPO_PUBLIC_API_URL="http://192.168.1.42:3001"; npm start
```

Pense aussi à autoriser le port 3001 dans le pare-feu Windows — c'est la cause la plus fréquente d'un téléphone qui ne joint pas l'API.

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
