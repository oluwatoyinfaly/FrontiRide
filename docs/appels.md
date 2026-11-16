# Appels entre client et chauffeur

Trois canaux, proposés dans cet ordre du moins cher au plus cher pour
l'utilisateur : appel dans l'application, WhatsApp, puis appel téléphonique.

| Canal | Passe par | Coût pour l'utilisateur | Disponible |
|---|---|---|---|
| Appel FrontiRide | Données (Agora) | Gratuit | Development build, avec les clés Agora |
| WhatsApp | Données | Gratuit | Partout où WhatsApp est installé |
| Appel téléphonique | Réseau mobile | Forfait, itinérance à l'étranger | Toujours |

L'ordre n'est pas cosmétique : sur le corridor Cotonou ↔ Lomé, l'un des deux
interlocuteurs est presque toujours à l'étranger, et un appel classique part
alors en itinérance. Le troisième canal reste en dernier recours — mais il
reste, parce qu'il est le seul à fonctionner sans données.

## Mettre en service l'appel dans l'application

1. Créer un projet sur [console.agora.io](https://console.agora.io), en mode
   **Secured mode: APP ID + Token** (l'App ID seul n'authentifie personne).
2. Relever l'**App ID** et le **Primary Certificate**.
3. Les poser dans `apps/backend/.env` :

   ```
   AGORA_APP_ID="…"
   AGORA_APP_CERTIFICATE="…"
   ```

   Avec Docker, les mêmes variables sont lues depuis l'environnement :
   `AGORA_APP_ID=… AGORA_APP_CERTIFICATE=… docker compose up`.

Sans ces deux valeurs, le service se désactive proprement : `/calls/config`
répond `{"enabled": false}`, les autres routes répondent 503, et l'application
n'affiche que WhatsApp et l'appel téléphonique. Rien ne casse.

**Le forfait gratuit d'Agora couvre 10 000 minutes par mois**, largement
au-delà du pilote. Attention : souscrire un forfait payant fait disparaître ce
bucket gratuit, il est alors remplacé par une remise sur l'abonnement.

## Ce qu'il faut savoir avant de tester

**L'appel ne fonctionne pas sous Expo Go.** Agora est un module natif ; Expo Go
embarque un jeu de modules figé qui ne l'inclut pas. L'application le détecte
seule — elle vérifie la présence du module natif — et masque simplement
l'option. Pour l'essayer :

```bash
npx eas build --profile development --platform android
```

puis installer l'APK obtenu et lancer `npm start` comme d'habitude.

**La sonnerie n'existe qu'au premier plan.** Le destinataire découvre l'appel
en interrogeant `/calls/incoming` toutes les 5 secondes, uniquement quand
l'application est ouverte. Un téléphone en veille ne sonnera pas. C'est
suffisant pour un pilote — client et chauffeur sont dans l'app autour d'une
course — et volontairement isolé derrière une seule route : le jour où le push
sera en place (Expo Notifications, puis CallKit sur iOS et ConnectionService
sur Android), il remplacera cette interrogation sans toucher au reste.

## Comment c'est fait

- **Canal** : `booking-<id>`. Les deux parties le déduisent de la course, sans
  rien échanger.
- **Identifiant Agora** : dérivé de l'identifiant utilisateur par un SHA-256
  tronqué à 32 bits. Stable d'un appel à l'autre, sans table de correspondance.
- **Jeton** : fabriqué par le backend, valable une heure, jamais par le mobile —
  le certificat ne quitte pas le serveur.
- **Autorisation** : `POST /calls` n'accepte que le client ou le chauffeur
  affecté à la course, et seulement dans les états où appeler a un sens
  (confirmée, chauffeur affecté, en cours, terminée).
- **Sonnerie** : une ligne `Call` en base, expirée au bout de 45 secondes, qui
  bascule alors en appel manqué.
