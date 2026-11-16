# Test réel sur Coolify

Objectif : un vrai test de bout en bout, sans backend sur ta machine et **sans
aucune donnée fictive**. Chaque compte vient d'une inscription, chaque code de
connexion d'un mail reçu, chaque paiement d'une validation sur un téléphone.

`docker-compose.coolify.yml` monte la base, l'API et le back-office. Un build EAS
`staging` produit un APK autonome qui vise cette API.

## Ce que le déploiement crée

Au démarrage, **seulement** :

- les 5 trançons du corridor (prix modifiables ensuite dans le back-office : un
  redémarrage ne les remet pas à leur valeur d'origine) ;
- le compte administrateur, à l'adresse `SEED_ADMIN_EMAIL`.

Aucun faux chauffeur, client, véhicule ni course. L'admin n'a donc, au début,
rien à valider : le test consiste à fabriquer lui-même ses données.

## Variables d'environnement (à renseigner dans Coolify)

| Variable | Obligatoire | Rôle |
|---|---|---|
| `PUBLIC_API_URL` | oui | Adresse publique de l'API, **avec `https://`** et sans slash final : `https://api-test.mondomaine.tld`. Elle est figée dans le back-office à sa compilation : la changer demande de redéployer l'admin |
| `SEED_ADMIN_EMAIL` | oui | Ton adresse : c'est là que parvient le code de l'admin. Tu peux la changer plus tard : le compte administrateur est **déplacé** vers la nouvelle adresse (l'ancienne perd l'accès) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | oui | Ton serveur Brevo |
| `FEEXPAY_TOKEN`, `FEEXPAY_SHOP_ID` | non | Mobile Money. Sans eux : espèces seulement |
| `FEEXPAY_ENV` | non | `sandbox` ou `live`. Vide : déduit de la clé (`test_…` = sandbox) |
| `AGORA_APP_ID`, `AGORA_APP_CERTIFICATE` | non | Appel dans l'application |

Le mot de passe de la base et le secret JWT sont générés par Coolify.

**Le SMTP est obligatoire.** Sans lui l'API retombe en mode « codes dans la
réponse », et une URL publique devient une porte ouverte sur l'administration.
Si tu ne peux pas le renseigner, ne déploie pas.

## Déployer

1. **DNS** : deux enregistrements `A` vers l'IP du VPS, `api-test.mondomaine.tld`
   et `admin-test.mondomaine.tld`.
2. **Coolify** → *New Resource* → *Docker Compose* → ce dépôt. *Docker Compose
   Location* : `/docker-compose.coolify.yml`.
3. **Domaines** : service `backend` → `https://api-test.mondomaine.tld:47001` (le
   port dit à Coolify où router) ; service `admin` → `https://admin-test.mondomaine.tld`.
   Le back-office écoute sur **les ports 80 et 47005** : le champ *Domains* peut
   préciser l'un, l'autre, ou aucun.
4. Renseigner les variables ci-dessus, puis **Deploy**.
5. Vérifier : `https://api-test.mondomaine.tld/health` → `{"status":"ok"}`.

Un volume `frontiride_uploads` conserve les pièces d'identité des chauffeurs : il
doit survivre aux redéploiements, sinon les dossiers validés perdent leurs
documents.

## L'application

Dans `apps/mobile/eas.json`, profil `staging`, remplace l'URL :

```json
"EXPO_PUBLIC_API_URL": "https://api-test.mondomaine.tld"
```

puis, depuis `apps/mobile` :

```bash
eas build --profile staging --platform android
```

L'APK est autonome : ni client de développement ni Metro. Il contient le module
Agora, donc l'appel dans l'application y fonctionne.

## Le parcours à jouer

Il suffit de deux téléphones et d'un navigateur. Comptes à adresses réelles : une
boîte Gmail avec des alias en `+` arrive entièrement chez toi
(`toi+client@gmail.com`, `toi+chauffeur@gmail.com`…).

1. **Chauffeur** (téléphone A) : *Créer un compte* → code reçu par mail → onglet
   Profil → *Devenir chauffeur* → envoyer les 7 pièces (photos).
2. **Admin** (navigateur) : `https://admin-test.mondomaine.tld`, code reçu à
   `SEED_ADMIN_EMAIL` → *Chauffeurs* → ouvrir le dossier, *Voir* chaque pièce,
   *Valider*.
3. **Chauffeur** : *Mes véhicules* → ajouter un véhicule (avec un prix par jour
   pour la location) → se mettre *en ligne*.
4. **Client** (téléphone B) : *Créer un compte* → réserver Cotonou → Lomé →
   payer.
5. **Chauffeur** : la course apparaît → *Accepter* → *Démarrer* → *Terminer*.
6. **Client** : noter la course ; **appeler** le chauffeur depuis le détail.
7. **Admin** : *Paiements* → *Débloquer* le séquestre → le chauffeur voit son
   solde → demande un retrait → l'admin le verse.

Ce parcours est rejoué automatiquement par `apps/backend/scripts/e2e-real.py`
(voir plus bas).

## Paiement Mobile Money

Le client reçoit une demande de validation sur son téléphone et saisit son code
Mobile Money ; l'application attend, et le serveur **interroge FeexPay lui-même**
pour confirmer. Il n'y a pas de webhook à déclarer : on ne s'en sert pas, et ce
n'est pas un oubli.

- **Pourquoi pas de webhook.** Confirmer par interrogation directe suffit, et il
  est plus sûr : un appel entrant ne peut pas être authentifié sans un mécanisme
  de signature, et sans lui n'importe qui pourrait déclarer une course payée.
  Le serveur règle de lui-même, toutes les 20 secondes, les paiements en
  attente : un client qui valide puis ferme l'app voit quand même sa course
  confirmée.
- **La sandbox et la production n'ont pas la même adresse**
  (`sandbox-api.feexpay.me` / `api-v2.feexpay.me`). Le serveur la déduit de la
  clé ; si ta clé de test ne commence pas par `test_`, mets `FEEXPAY_ENV=sandbox`.
  Une clé de test envoyée à la production est refusée.

### Réseaux

| Réseau | Moyen | Numéro envoyé |
|---|---|---|
| MTN Bénin | `MOMO_MTN` | `229` + `01` + 8 chiffres |
| Moov Bénin | `MOMO_MOOV` | `229` + `01` + 8 chiffres |
| Celtiis Bénin | `MOMO_CELTIIS` | `229` + `01` + 8 chiffres |
| Moov Togo | `MOMO_MOOV_TG` | `228` + 8 chiffres **(format à confirmer)** |
| Togocom | `MOMO_TOGOCOM` | `228` + 8 chiffres **(format à confirmer)** |

Un utilisateur saisit encore « 97 00 00 00 » : l'application convertit au format à
10 chiffres. Un numéro béninois ne peut pas payer sur un réseau togolais, et
inversement : la réponse l'explique.

Limites imposées par FeexPay : entier de **10 à 1 000 000 FCFA** par paiement. Au-delà
(une location longue réglée en totalité, par exemple), le Mobile Money est refusé
avec une explication ; l'acompte de 30 %, lui, passe. La carte bancaire n'est pas
proposée.

### Numéros de test de la sandbox

L'issue dépend des **deux derniers chiffres** du numéro :

| Fin | Résultat |
|---|---|
| `00` | réussi |
| `01` | échec, solde insuffisant |
| `02` | erreur HTTP 503 |
| `03` | échec après 5 à 8 secondes |
| `04` | numéro invalide (400) |
| `05` | reste en attente |

MTN et Moov Bénin répondent le statut final dans la création du paiement ; Celtiis
et les canaux togolais répondent « en attente » puis règlent quelques secondes plus
tard.

### Ce qui reste à confirmer en sandbox

Tout est testé contre un faux serveur calqué sur la documentation V2 de FeexPay
(`scripts/feexpay-mock.mjs`), **jamais contre l'API réelle**. Le premier paiement
sandbox doit confirmer :

1. **Le format des numéros togolais.** Les adresses de Moov Togo et Togocom sont
   confirmées (`/requesttopay/moov_tg`, `/requesttopay/togocom_tg`), mais la
   documentation transmise ne montre pas le format du numéro : on envoie
   `228` + 8 chiffres. Si FeexPay répond « numéro invalide » sur un numéro qui
   se termine par `00`, c'est là : envoie la ligne du Togo de la table « Payin
   (collection) », colonne « Phone number format ».
2. **Le suivi sur la sandbox.** La route `/api/transactions/public/single/status/`
   est documentée sur la production ; on suppose le même chemin sur la sandbox.

## Test automatique

Sur n'importe quelle machine avec PostgreSQL, sans compte externe :

```bash
node apps/backend/scripts/smtp-sink.mjs 2525 /tmp/mails.jsonl &      # faux SMTP
node apps/backend/scripts/feexpay-mock.mjs 4010 /tmp/feexpay.jsonl & # faux FeexPay

cd apps/backend && SEED_DEMO=false SEED_ADMIN_EMAIL=admin@e2e.test npm run prisma:seed
OTP_CHANNELS=email SMTP_HOST=127.0.0.1 SMTP_PORT=2525 MAIL_FROM=test@e2e.test \
  FEEXPAY_TOKEN=test-token FEEXPAY_SHOP_ID=shop-1 FEEXPAY_BASE_URL=http://127.0.0.1:4010 \
  UPLOAD_DIR=/tmp/uploads npm run dev &
python3 scripts/e2e-real.py
```

Il joue le parcours ci-dessus sur une base vierge, en 76 vérifications :
inscription par code reçu en mail, 7 pièces, validation, véhicule, paiement Mobile
Money sur les cinq réseaux (réussi, refusé, solde insuffisant, panne, en attente,
confirmé sans l'application), course, note, appel, déblocage du séquestre et
retrait.

## Limites connues

- **Les courses payées en espèces ne débloquent jamais de gains.** Le chauffeur
  encaisse lui-même ; l'application crédite pourtant son portefeuille en
  attente, et l'admin ne peut débloquer que les paiements sous séquestre. C'est
  une décision de modèle économique, pas un détail : qui doit la commission ?
- La sonnerie d'appel n'atteint un téléphone que si l'application est ouverte
  (pas de push) — voir [`appels.md`](appels.md).
- Un seul serveur : les pièces sont sur le disque de l'API, et le plafond d'essais
  de code est en mémoire.
- Un remboursement depuis le back-office change l'état du paiement mais ne
  rembourse rien chez FeexPay : à faire à la main.

## Si le back-office répond 502

Cloudflare affiche « Bad Gateway » quand le proxy de Coolify ne joint pas le
conteneur. Pour le back-office :

1. **Redéploie**, ne redémarre pas : les règles de routage ne sont régénérées
   qu'au déploiement.
2. Ouvre les journaux du service `admin` : un conteneur sain n'écrit presque rien ;
   un conteneur qui boucle montre pourquoi.
3. Vérifie que `PUBLIC_API_URL` est renseignée **avant** le déploiement : sans elle
   la compilation s'arrête.

Le back-office est un vrai build servi par nginx (`apps/admin/Dockerfile.prod`),
pas le serveur de développement.

## À la fin du test

**Supprime la ressource dans Coolify.** Ce déploiement contient des pièces
d'identité réelles de testeurs.

## OTP : et après le test

L'email est en place. Pour la production il reste à brancher le **téléphone**.
Tarifs relevés en novembre 2026 ; ils bougent, vérifie avant de t'engager.

| Canal | Coût indicatif | Remarques |
|---|---|---|
| **WhatsApp Business Platform** (Meta, en direct) | ~0,004 $ par code au Bénin et au Togo | Compte Meta Business vérifié, numéro dédié, modèle de message approuvé : des jours de démarches, pas de code |
| **Twilio Verify**, canal WhatsApp | 0,05 $ par vérification réussie, plus les frais Meta | Plus cher, mais aucune démarche |
| **SMS** (Africa's Talking, Termii, Infobip) | Tarif par pays | Couverture Bénin/Togo à vérifier opérateur par opérateur |

Aucun service ne fournit de code gratuit sur le téléphone ; seul l'email l'est.
