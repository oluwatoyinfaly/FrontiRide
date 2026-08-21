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
| API | http://localhost:47001 — `GET /health` pour vérifier |
| Back-office | http://localhost:47005 |
| PostgreSQL | `localhost:47432` |
| Metro (mobile, hors Docker) | `localhost:47081` |

Le projet occupe le bloc **47000-47099**, volontairement à l'écart des ports de
développement habituels (3000, 5432, 5173, 8081) et sous la plage dynamique de
Windows (49152-65535) que le système attribue tout seul : rien ne devrait entrer
en conflit avec ce qui tourne déjà sur ta machine.

Si l'un de ces ports est déjà pris sur ta machine :

```bash
BACKEND_PORT=48001 ADMIN_PORT=48005 POSTGRES_PORT=48432 docker compose up --build
```

Sous PowerShell, les variables se passent autrement :

```powershell
$env:BACKEND_PORT=48001; docker compose up --build
```

Le seed remplit la base de quoi juger l'application dès le premier démarrage : 5 trançons du corridor, 10 chauffeurs couvrant les cinq états d'un dossier, 12 véhicules répartis sur les deux villes et les cinq gammes, 15 courses et 3 demandes de retrait. Il est idempotent : le relancer ne duplique rien.

| Compte de démonstration | Rôle | Ce qu'on y voit |
|---|---|---|
| `admin@frontiride.com` | Administrateur | 2 dossiers à contrôler, 5 paiements sous séquestre, 2 retraits à verser |
| `client@example.com` | Client | 13 courses couvrant tous les états, dont 5 terminées et 4 notées |
| `kofi.adjovi@example.com` | Chauffeur validé | Portefeuille garni, et surtout les deux rôles : 4 courses conduites, 2 réservées comme client |
| `rachid.ouedraogo@example.com` | Chauffeur incomplet | Dossier à 3 pièces sur 7 |

**Connecte-toi avec `client@example.com` sur le mobile** : un compte tout neuf afficherait un historique vide, alors que celui-ci montre l'application vivante.

L'authentification se fait par code OTP double (email + SMS). **Hors production, l'API renvoie les codes dans sa réponse** et les interfaces les préremplissent : le parcours est donc testable sans passerelle SMS.

### 2. Application mobile

Metro doit rester joignable depuis le téléphone, il tourne donc hors de Docker :

```bash
npm install
npm run setup:env   # crée les .env locaux (une seule fois)
npm start
```

`npm start` à la racine délègue au workspace mobile. Ne lance **pas** `npx expo start` depuis la racine : le `package.json` racine n'a pas de champ `main`, Expo retombe alors sur `node_modules/expo/AppEntry.js` qui cherche un `App` à la racine et le bundling échoue sur `Unable to resolve "../../App"`. L'équivalent manuel est `cd apps/mobile && npx expo start`.

Scanne le QR code avec Expo Go. L'app vise automatiquement la machine qui sert Metro sur le port 47001, donc **rien à configurer si le téléphone et le PC sont sur le même Wi-Fi**.

Si la connexion à l'API échoue depuis le téléphone, force l'adresse avec l'IP locale de ta machine :

```powershell
# Windows : relève l'IPv4 de ton adaptateur Wi-Fi
ipconfig | Select-String IPv4

$env:EXPO_PUBLIC_API_URL="http://192.168.1.42:47001"; npm start
```

Pense aussi à autoriser le port 47001 dans le pare-feu Windows — c'est la cause la plus fréquente d'un téléphone qui ne joint pas l'API.

## Vérifications

```bash
npm run typecheck   # backend + mobile + admin
npm run smoke       # 40 assertions de bout en bout sur l'API
```

Le smoke test suppose une base fraîchement migrée et seedée — il consomme les données de démonstration.

## Démarrage manuel du backend (sans Docker)

```bash
npm install            # à la racine : génère aussi le client Prisma
npm run setup:env      # crée apps/backend/.env depuis l'exemple
cd apps/backend
npm run prisma:migrate
npm run prisma:seed
npm run dev            # http://localhost:47001
```

Le client Prisma est généré par le `postinstall` du backend. Si l'API démarre
sur `SyntaxError: ... does not provide an export named 'PrismaClient'`, c'est
qu'il manque : `npm run prisma:generate --workspace apps/backend`.

Le back-office se lance à côté, depuis la racine :

```bash
npm run dev:admin      # http://localhost:47005
```
