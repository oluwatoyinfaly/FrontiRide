# Déploiement de test sur Coolify

Objectif : essayer l'application sur un téléphone, sans backend sur ta machine.
`docker-compose.coolify.yml` monte l'API et sa base ; un build EAS `staging`
produit un APK qui vise cette API. Aucun PC n'est nécessaire une fois installé.

## Codes de connexion : par email

Le déploiement envoie le code **par email**, un seul (`OTP_CHANNELS=email`), via
n'importe quel serveur SMTP. Le code n'est alors **plus renvoyé** dans la réponse
de l'API : il faut lire sa boîte mail, comme un vrai utilisateur. C'est ce qui
ferme le risque d'un déploiement public avec le compte admin du jeu de
démonstration.

Conséquences à connaître :

- le téléphone n'est pas vérifié, et reste marqué comme tel ;
- un code ne se redemande pas avant 30 s, et 5 essais ratés l'invalident ;
- **le SMTP est obligatoire.** Sans lui l'API retombe en mode « codes dans la
  réponse », et l'URL publique redevient une porte ouverte sur l'administration.
  Si tu ne peux pas le renseigner, ne déploie pas.

Fournisseurs SMTP gratuits qui conviennent : **Brevo** (300 mails/jour),
**Resend** (`smtp.resend.com`, il faut valider un domaine), ou un compte Gmail
avec un mot de passe d'application. Le plus simple pour un test : Brevo.

Quelle que soit la méthode, **supprime la ressource** quand le test est fini, et
ne mets que des données de démonstration.

## Étapes

1. **DNS** : un enregistrement `A` pour `api-test.mondomaine.tld` vers l'IP du VPS.
2. **Coolify** → *New Resource* → *Docker Compose* → ce dépôt, branche de travail.
   Dans *Docker Compose Location*, mettre `/docker-compose.coolify.yml`.
3. Dans le service **backend**, champ *Domains* : `https://api-test.mondomaine.tld:47001`
   (le `:47001` dit à Coolify sur quel port du conteneur router).
4. *Environment Variables* : `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`
   et `MAIL_FROM` (obligatoires, voir plus haut) ; `AGORA_APP_ID` et
   `AGORA_APP_CERTIFICATE` si tu veux l'appel dans l'application. Le mot de passe
   de la base et le secret JWT sont générés par Coolify.
5. **Deploy**. Au premier démarrage l'API applique les migrations et passe le seed.
   Vérifie : `https://api-test.mondomaine.tld/health` → `{"status":"ok"}`.

## Pointer l'application dessus

Dans `apps/mobile/eas.json`, profil `staging`, remplace l'URL :

```json
"EXPO_PUBLIC_API_URL": "https://api-test.mondomaine.tld"
```

puis, depuis `apps/mobile` :

```bash
eas build --profile staging --platform android
```

L'APK obtenu embarque l'application complète, **sans client de développement ni
Metro** : tu l'installes sur deux téléphones et ils parlent directement à ton
VPS. Il contient le module Agora, donc l'appel dans l'application y fonctionne.

### Se connecter : mettre de vraies adresses sur les comptes de démonstration

Les comptes du jeu de démonstration ont des adresses fictives (`@example.com`) :
le code partirait vers une boîte qui n'existe pas. Rattache-les à des adresses
que tu lis, **avant le premier démarrage**, dans les variables d'environnement
de Coolify :

| Variable | Compte | Rôle dans le test |
|---|---|---|
| `SEED_CLIENT_EMAIL` | le client | un téléphone |
| `SEED_DRIVER_EMAIL` | Kofi Adjovi | l'autre téléphone : il conduit **et** réserve |
| `SEED_ADMIN_EMAIL` | l'administrateur | le back-office |

Le plus simple : une seule boîte Gmail avec des alias en `+`, qui arrivent tous
chez toi — `toi+client@gmail.com`, `toi+kofi@gmail.com`, `toi+admin@gmail.com`.

Le seed identifie les comptes par leur adresse : si tu changes une variable
après un premier démarrage, supprime le volume de la base pour repartir propre.

## Limites connues

- Le seed rejoue à chaque redémarrage du conteneur et **remet à leur état initial
  les courses de démonstration** : un statut modifié en test revient.
- La sonnerie d'appel n'atteint un téléphone que si l'application est ouverte
  (pas de push) — voir [`appels.md`](appels.md).
- Les paiements Fedapay ne sont pas branchés dans ce déploiement.

## OTP réel : quelles options

L'email est en place (SMTP, voir plus haut). Pour de vrais utilisateurs il reste
à brancher le **téléphone**. Tarifs relevés en novembre 2026 ; ils bougent, vérifie avant de
t'engager.

| Canal | Coût indicatif | Remarques |
|---|---|---|
| **Email** (Resend, Brevo…) | Gratuit en dessous de quelques milliers de mails/mois | Couvre la moitié « email » du double OTP sans rien payer |
| **WhatsApp Business Platform** (Meta, en direct) | ~0,004 $ par code d'authentification au Bénin et au Togo (tranche « reste de l'Afrique ») | Il faut un compte Meta Business vérifié, un numéro dédié et un modèle de message approuvé : des jours de démarches, pas de code |
| **Twilio Verify**, canal WhatsApp | 0,05 $ par vérification réussie, plus les frais Meta | Cher en comparaison, mais aucune démarche : il porte la relation avec Meta |
| **SMS** (Africa's Talking, Termii, Infobip) | Payant à l'unité, tarif par pays | Couverture Bénin/Togo à vérifier opérateur par opérateur |

Il n'existe pas de service d'OTP **gratuit** sur le téléphone : le SMS et
WhatsApp se facturent partout, seul l'email est gratuit. Le coût réel est faible
(0,004 $ par connexion en WhatsApp direct) ; c'est la mise en place qui prend du
temps.

Recommandation : l'**email gratuit** pour la moitié email, et **WhatsApp** pour
le téléphone. C'est aussi le canal que tes utilisateurs ont déjà sur le
corridor, et le moins cher des deux options payantes.
