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
| `PUBLIC_API_URL` | oui | Adresse publique de l'API, `https://api-test.mondomaine.tld` |
| `SEED_ADMIN_EMAIL` | oui | Ton adresse : c'est là que parvient le code de l'admin |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | oui | Ton serveur Brevo |
| `FEEXPAY_TOKEN`, `FEEXPAY_SHOP_ID` | non | Mobile Money. Sans eux : espèces seulement |
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
3. **Domaines** : service `backend` → `https://api-test.mondomaine.tld:47001` ;
   service `admin` → `https://admin-test.mondomaine.tld:47005`. Le port dit à
   Coolify où router.
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

## Paiement Mobile Money : ce qui est vérifié, et ce qui ne l'est pas

Le client reçoit une demande de validation sur son téléphone et saisit son code
Mobile Money ; l'application attend, et le serveur **interroge FeexPay lui-même**
pour confirmer. Il n'y a pas de webhook : on ne peut pas authentifier un appel
entrant sans un mécanisme de signature que FeexPay ne documente pas dans son SDK,
et sans lui, n'importe qui pourrait déclarer une course payée. En plus de
l'application, le serveur règle de lui-même, toutes les 20 secondes, les
paiements en attente : un client qui valide puis ferme l'app voit quand même sa
course confirmée.

Adresses, champs et statuts viennent du **SDK officiel** (`feexpay-sdk`, lu
directement), pas de la documentation en ligne, qui n'était pas accessible. Le
code est testé contre un faux serveur calqué dessus (`scripts/feexpay-mock.mjs`),
**jamais contre l'API réelle**. Un premier paiement en sandbox doit lever ces
points, marqués `À CONFIRMER` dans `src/lib/feexpay.ts` :

| Point | Hypothèse actuelle | Si c'est faux |
|---|---|---|
| Format du numéro | `22997000000` (indicatif, sans `+`) | La demande est refusée : ajuster `formatPhone` |
| Unité du montant | francs entiers, en chaîne | Montant divisé ou multiplié : ajuster `amount` |
| Réseaux | `mtn` et `moov` | Autre valeur (Togo, Celtiis…) : élargir `NETWORK` |
| Champ de référence | `reference` dans la réponse | « Réponse FeexPay sans référence » dans les journaux |

**Les numéros togolais ne sont pas couverts** : le SDK ne cite que `mtn` et
`moov`, qui sont des réseaux béninois. Le corridor Cotonou ↔ Lomé en a besoin ;
il faut les valeurs exactes dans la documentation FeexPay.

La **carte bancaire** n'est pas proposée : le SDK n'expose pas de flux carte.

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

Il joue le parcours ci-dessus sur une base vierge : inscription par code reçu en
mail, 7 pièces, validation, véhicule, paiement Mobile Money (réussi, refusé,
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
- Le back-office tourne en serveur de développement : suffisant pour un test, pas
  pour un déploiement durable.
- Un remboursement depuis le back-office change l'état du paiement mais ne
  rembourse rien chez FeexPay : à faire à la main.

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
