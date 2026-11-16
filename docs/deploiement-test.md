# Déploiement de test sur Coolify

Objectif : essayer l'application sur un téléphone, sans backend sur ta machine.
`docker-compose.coolify.yml` monte l'API et sa base ; un build EAS `staging`
produit un APK qui vise cette API. Aucun PC n'est nécessaire une fois installé.

## ⚠️ À lire avant

Hors production, l'API **renvoie les codes OTP dans ses réponses** : c'est ce qui
permet de tester sans passerelle SMS. Sur une adresse publique, avec le compte
`admin@frontiride.com` du jeu de démonstration, cela veut dire que **quiconque
connaît l'URL peut se connecter en administrateur**.

Pour un test de quelques jours, c'est tenable à ces conditions :

- ne mettre **que des données de démonstration** ;
- choisir un sous-domaine qu'on ne devine pas (`api-k3x9.mondomaine.tld`) ;
- **supprimer la ressource** dans Coolify quand le test est fini.

Ne laisse pas ce déploiement vivre. Avant tout vrai utilisateur, il faut une
passerelle OTP réelle (voir plus bas) et `NODE_ENV=production`.

## Étapes

1. **DNS** : un enregistrement `A` pour `api-test.mondomaine.tld` vers l'IP du VPS.
2. **Coolify** → *New Resource* → *Docker Compose* → ce dépôt, branche de travail.
   Dans *Docker Compose Location*, mettre `/docker-compose.coolify.yml`.
3. Dans le service **backend**, champ *Domains* : `https://api-test.mondomaine.tld:47001`
   (le `:47001` dit à Coolify sur quel port du conteneur router).
4. *Environment Variables* : `AGORA_APP_ID` et `AGORA_APP_CERTIFICATE`, si tu veux
   l'appel dans l'application. Le mot de passe de la base et le secret JWT sont
   générés par Coolify.
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

Connexion de démonstration : `client@example.com` sur un téléphone,
`kofi.adjovi@example.com` sur l'autre. Les codes OTP sont préremplis.

## Limites connues

- Le seed rejoue à chaque redémarrage du conteneur et **remet à leur état initial
  les courses de démonstration** : un statut modifié en test revient.
- La sonnerie d'appel n'atteint un téléphone que si l'application est ouverte
  (pas de push) — voir [`appels.md`](appels.md).
- Les paiements Fedapay ne sont pas branchés dans ce déploiement.

## OTP réel : quelles options

Aujourd'hui le code part dans la réponse de l'API. Pour de vrais utilisateurs il
faut l'envoyer. Tarifs relevés en novembre 2026 ; ils bougent, vérifie avant de
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
