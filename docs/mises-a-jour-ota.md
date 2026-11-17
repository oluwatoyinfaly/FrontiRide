# Mises à jour à distance (OTA, EAS Update)

Une mise à jour à distance remplace le JavaScript et les images de l'application
déjà installée, sans repasser par un APK ni par le Play Store. Les utilisateurs
la reçoivent au lancement suivant de l'application.

## Ce qu'une mise à jour peut changer, et ce qu'elle ne peut pas

| Possible en OTA | Exige un nouveau build |
|---|---|
| Écrans, textes, traductions, couleurs | Nouveau module natif (`npm install expo-…`) |
| Logique (réservation, paiement, chauffeur…) | Nouvelle permission (caméra, position…) |
| Images embarquées dans le code | Icône, écran de démarrage, nom, `app.json` natif |
| Correctifs de bugs JavaScript | Montée de version d'Expo / React Native |

**Règle :** dès qu'un changement est dans la colonne de droite, augmenter
`version` dans `apps/mobile/app.json` (ex. `0.1.0` → `0.2.0`) **puis** refaire un
build. La version sert de « runtime » : une mise à jour publiée pour `0.2.0`
n'est jamais envoyée à un téléphone qui a l'APK `0.1.0`, ce qui évite d'envoyer
du code qui appelle un module natif absent (plantage au lancement).

## Canaux

Chaque profil de build est rattaché à un canal (`apps/mobile/eas.json`). Un APK
ne reçoit que les mises à jour de son canal.

| Profil de build | Canal | API |
|---|---|---|
| `preview` | `preview` | `https://frontiride-api.yindolabs.com` |
| `staging` | `staging` | `https://frontiride-api.yindolabs.com` |
| `production` | `production` | à renseigner avant tout usage |
| `development` | — | pas de mise à jour à distance |

## Publier

Depuis `apps/mobile`, connecté au compte EAS propriétaire du projet (`eas login`) :

```bash
npm run ota:preview -- "Correction de l'écran de paiement"
```

Le script `scripts/ota.mjs` :

- reprend l'adresse de l'API du profil de build lié au canal. `eas update` ne lit
  **pas** les variables d'`eas.json` : lancé à la main sans `EXPO_PUBLIC_API_URL`,
  il publierait une version qui vise `localhost` et couperait l'application de
  tous les utilisateurs du canal ;
- vide le cache de Metro (`--clear-cache`). Sans ça, un `expo start` antérieur
  peut laisser en cache du code compilé sans l'adresse de l'API (constaté) ;
- refuse un canal inconnu, et le canal `production` tant que son URL est l'adresse
  d'exemple.

Sous Windows, la commande est la même (PowerShell ou invite de commandes).

## Côté application

- Au lancement et au retour dans l'application (au plus toutes les 30 min), elle
  vérifie et télécharge une éventuelle mise à jour **en arrière-plan**.
- Une fois prête, un bandeau propose « Redémarrer » ou « Plus tard ». Il ne
  s'affiche pas pendant un appel. Sans action, la mise à jour s'applique au
  prochain démarrage à froid.
- Le profil affiche la version installée : `Version 0.1.0 · a1b2c3d` (les 7
  premiers caractères identifient la mise à jour reçue). Utile au support.

## Revenir en arrière

Une mise à jour défectueuse se retire en republiant la précédente :

```bash
npx eas-cli@latest update:republish --channel preview
```

(ou, sur expo.dev → projet → Updates, « Republish » sur la bonne version). Les
téléphones la reçoivent au lancement suivant.

## Premier passage

Les APK construits **avant** cette fonctionnalité ne contiennent pas le module de
mise à jour : ils ne recevront jamais rien. Il faut **un nouveau build** `preview`
(et la réinstallation sur les téléphones de test) ; ensuite, plus besoin d'APK
pour les changements JavaScript.
