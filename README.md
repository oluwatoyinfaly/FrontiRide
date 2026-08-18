# FrontiRide

_Le transport frontalier et de séjour, simple et sécurisé_

Plateforme de mise en relation pour le transport frontalier (Volet 1) et la location de véhicule avec chauffeur en ville (Volet 2), avec un pilote de lancement sur le corridor **Cotonou ↔ Lomé**.

## Documentation

- [`docs/cahier-des-charges.md`](docs/cahier-des-charges.md) — spécifications produit consolidées.
- [`docs/plan-de-developpement.md`](docs/plan-de-developpement.md) — stack technique et phasage du MVP.

## Structure du repo

```
apps/
  backend/   API Fastify + TypeScript + Prisma/PostgreSQL
  mobile/    App React Native (Expo) — client MVP
```

## Démarrage rapide (Docker)

Lance PostgreSQL + le backend en une commande :

```bash
docker compose up --build
```

Puis, dans un autre terminal, applique le seed (trançon pilote Cotonou <-> Lomé) :

```bash
docker compose exec backend npm run prisma:seed
```

L'API est disponible sur `http://localhost:3001` (`GET /health` pour vérifier) — le port hôte est volontairement différent de 3000 pour éviter les conflits avec d'autres serveurs locaux ; change-le via `BACKEND_PORT` (ex. `BACKEND_PORT=4000 docker compose up`) si 3001 est aussi pris. Le dossier `apps/backend/src` est monté en volume : les changements rechargent le serveur automatiquement (`tsx watch`).

Pour utiliser une clé Fedapay sandbox, crée un fichier `.env` à la racine avec `FEDAPAY_SECRET_KEY=...` (lu automatiquement par Docker Compose) avant de lancer `docker compose up`.

> Si `docker compose up` échoue avec `ports are not available` / `bind: ... already in use`, c'est qu'un autre programme occupe déjà le port indiqué (5432 ou 3001). Sous Windows : `netstat -ano | findstr :3001` (ou `:5432`) pour trouver le processus, ou change le port dans `docker-compose.yml` / via `BACKEND_PORT`.

## Démarrage manuel (sans Docker)

### Backend

```bash
cd apps/backend
cp .env.example .env   # renseigner DATABASE_URL et FEDAPAY_SECRET_KEY
npm install
npm run prisma:migrate
npm run prisma:seed     # crée le trançon pilote Cotonou <-> Lomé
npm run dev
```

### Mobile

```bash
cd apps/mobile
npm install
npm start
```

L'app pointe par défaut vers `http://localhost:3001` (le port du backend en Docker, voir ci-dessus) — adapter via `EXPO_PUBLIC_API_URL` dans `src/api/client.ts`, notamment pour un émulateur Android (`10.0.2.2`) ou iOS.
