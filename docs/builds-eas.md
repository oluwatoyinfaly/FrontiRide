# Builds EAS et intégration GitHub

Projet EAS : `36e54071-32b1-41ed-881e-08ba1ebe308b`, déclaré dans
[`apps/mobile/app.json`](../apps/mobile/app.json) sous `extra.eas.projectId`.

## Compte propriétaire du projet

`app.json` déclare `"owner": "yindo"` : c'est le compte qui détient le projet
EAS `36e54071-32b1-41ed-881e-08ba1ebe308b`. Un `eas build` lancé depuis un
autre compte s'arrête avec :

> Owner of project identified by "extra.eas.projectId" (yindo) does not match
> the logged in user (…)

Deux issues, selon l'intention :

- **rester sur ce projet** (l'historique de builds, les mises à jour OTA et les
  labels de PR y sont rattachés) : se connecter avec le bon compte,
  `eas login`, ou faire du compte connecté un membre de `yindo` ;
- **repartir sur un projet neuf** sous l'autre compte : `eas init`, qui écrit
  un nouveau `projectId`. Il faut alors mettre à jour **aussi** `updates.url`
  dans `app.json`, qui contient le même identifiant, et refaire les secrets EAS.

## Une précision sur la commande de départ

La commande transmise créait un nouveau projet :

```bash
npx create-expo-app frontride && cd frontride && eas init --id 36e54071-…
```

Elle n'a **pas** été exécutée telle quelle : l'application existe déjà dans
`apps/mobile`, avec ses écrans, sa charte et ses assets. La repartir de zéro
aurait tout écrasé. À la place, seule la partie utile a été appliquée — le
`projectId` a été inscrit directement dans `app.json`, ce que `eas init --id`
aurait fait.

Deux champs d'`app.json` doivent correspondre au projet EAS distant, sinon `eas
build` s'arrête (« Slug for project … does not match the "slug" field ») :

- **`owner`** : `yindo`, le compte qui détient le projet.
- **`slug`** : **`frontride`**, sans le « i ». Le projet a été créé sous ce nom (la
  commande d'origine comportait cette graphie) et le slug d'un projet Expo ne se
  renomme pas ensuite. Le nom affiché de l'application, lui, reste « FrontiRide » :
  c'est le champ `name`, indépendant.

Si tu repars sur un autre projet EAS, `npx eas-cli@latest init` réécrit ces champs
d'après le projet distant, mais aussi un nouveau `projectId` — et `updates.url`,
qui porte le même identifiant, est alors à corriger à la main.

## Profils de build

Définis dans [`apps/mobile/eas.json`](../apps/mobile/eas.json).

| Profil | Distribution | Android | Pour quoi |
|---|---|---|---|
| `development` | interne | APK + client de développement | Débogage sur appareil réel, API en local |
| `preview` | interne | APK | Tests internes, API de recette |
| `production` | magasins | App Bundle | Publication, versions incrémentées par EAS |

Chaque profil déclare `"image": "latest"` : **c'est obligatoire pour les
builds déclenchés depuis GitHub**, qui refusent un profil sans image.

L'URL du backend est injectée par profil via `EXPO_PUBLIC_API_URL`, à la
compilation : changer d'API demande un nouveau build.

- `preview` et `staging` visent le déploiement de test
  (`https://frontiride-api.yindolabs.com`) ;
- `development` n'en définit pas : l'app vise la machine qui sert Metro ;
- `production` garde un **espace réservé** (`api.frontiride.com`), à remplacer
  par la vraie URL avant tout build de production, sinon il pointera dans le vide.

## Premier build

```bash
npm install --global eas-cli
cd apps/mobile
eas login
eas build --profile preview --platform android
```

Le premier build iOS demandera les identifiants Apple Developer.

## Builds depuis GitHub

### Mise en place, une seule fois

1. Sur [expo.dev](https://expo.dev), ouvrir le projet → **Configuration →
   GitHub**, et installer l'application GitHub Expo sur le dépôt
   `oluwatoyinfaly/FrontiRide`.
2. Le dépôt étant un monorepo, renseigner le **répertoire de base** :
   `apps/mobile`. Sans cela, EAS cherche `eas.json` à la racine et échoue.

### Déclencher un build par label de pull request

Poser sur la PR un label de la forme :

```
eas-build-<plateforme>:<profil>
```

`<plateforme>` vaut `android`, `ios` ou `all` ; `<profil>` est un profil de
`eas.json`. Exemples à créer une fois dans les labels du dépôt :

| Label | Effet |
|---|---|
| `eas-build-android:preview` | APK Android de recette |
| `eas-build-ios:preview` | Build iOS de recette |
| `eas-build-all:preview` | Les deux plateformes |
| `eas-build-all:production` | Build de publication |

Le label déclenche le build à la pose ; le retirer puis le remettre en relance
un nouveau. Aucun fichier de workflow n'est nécessaire — c'est l'application
GitHub d'Expo qui s'en charge, côté serveur.

Référence : [Trigger builds from the Expo GitHub App](https://docs.expo.dev/build/building-from-github/).

## Intégration continue

[`.github/workflows/ci.yml`](../.github/workflows/ci.yml) tourne à chaque
pull request et vérifie les trois applications :

- **backend** : migration Prisma sur un PostgreSQL de service, compilation,
  seed, puis les 23 assertions de `scripts/smoke.sh` contre le serveur
  compilé ;
- **mobile** : `tsc --noEmit` ;
- **admin** : build Vite complet.

La CI ne construit pas d'app native — c'est le rôle des labels EAS ci-dessus,
un build natif prenant plusieurs minutes de machine payante.

## Rappel sur les assets

Icône, splash et icône adaptative sont compilés dans les ressources natives.
Un rechargement Metro ne les met pas à jour : il faut un nouveau build.
