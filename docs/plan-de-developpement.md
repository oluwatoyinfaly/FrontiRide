# FrontiRide — Plan de développement

Référence produit : `cahier-des-charges.md`. Objectif : découper la vision complète (v1.4) en un MVP livrable rapidement, puis en itérations.

## 1. Stack technique (validée)

| Brique | Choix retenu | Pourquoi |
|---|---|---|
| App mobile (Client + Chauffeur) | **React Native (Expo)** | Un seul code pour Android/iOS, écosystème JS partagé avec le backend |
| Back-office Admin | **React (Next.js) + Tailwind** — après le MVP, ou API-only avec Postman/Retool en attendant | Réutilise les mêmes devs/typescript que mobile et API |
| API Backend | **Fastify + TypeScript** | Léger, rapide, bon support plugins/validation (JSON Schema natif), simple à monter en équipe réduite |
| ORM / Base de données | **PostgreSQL + Prisma** (extension PostGIS activable si besoin géospatial avancé) | Migrations typées, requêtes géospatiales possibles |
| Paiement | **Fedapay** uniquement au MVP (MoMo MTN/Moov, cartes) | Suffisant pour le corridor Bénin-Togo du pilote ; Paystack ajouté à l'ouverture du Nigeria |
| Cartographie | **Google Maps API** (Directions, Distance Matrix, Places) | Suivi GPS, estimation trajets, point frontière Hilacondji |
| Notifications | **Firebase Cloud Messaging** (push) + provider SMS local + email (SendGrid/Postmark) | |
| Stockage documents (pièces d'identité, permis) | **S3-compatible avec chiffrement AES-256** | Conformité sécurité |
| Infra / CI-CD | Conteneurs Docker, déploiement cloud, pipeline CI (tests + lint + build) | |

## 2. Périmètre du MVP (V1) — ce qu'on construit d'abord

Le cahier des charges complet est trop large pour un premier lancement. Le MVP retient le strict nécessaire pour valider le marché sur 1-2 corridors :

**Inclus dans le MVP :**
- Un seul corridor pilote : **Cotonou ↔ Lomé**, avec passage par le point frontière **Hilacondji**.
- Volet 1 (Frontalier) **et** Volet 2 (Location Ville, à Cotonou et Lomé) dès le départ — c'est le cœur de la différenciation.
- Auth client + chauffeur (email + téléphone + OTP).
- Profil + upload documents chauffeur, validation manuelle admin (pas d'automatisation IA au départ).
- Réservation Frontalier : Cotonou↔Lomé ou point frontière Hilacondji, date/heure, 1-4 places, estimation prix par trançon fixe (grille admin, pas de calcul dynamique douane au 1er jour).
- Réservation Location Ville : Cotonou ou Lomé, type véhicule, durée (journée uniquement au MVP, pas "à l'heure"), avance 30% + solde.
- Paiement **Fedapay** : MoMo MTN/Moov + espèces au chauffeur (carte bancaire peut suivre en V1.1).
- Paiement séquestre simple (déblocage manuel ou règle 24h automatique).
- Suivi GPS temps réel (position chauffeur uniquement, pas ETA prédictif avancé).
- Notation post-course (chauffeur + véhicule).
- Back-office admin : validation chauffeurs, gestion trançons/tarifs, suivi transactions, gestion litiges basique.
- Notifications push + SMS (confirmation, rappel).

**Explicitement repoussé après le MVP (V1.1+) :**
- Corridor Bénin↔Nigeria (Sèmè-Kraké/Owodé/Igolo ↔ Lagos) et intégration Paystack.
- Programme FrontiPoints, parrainage, palier VIP.
- Programme Chauffeur Elite (bonus volume/ponctualité).
- Abonnements client (Pass Pro/Entreprise) et facturation entreprise consolidée.
- Location "à l'heure" et forfaits spéciaux (aéroport, tour de ville).
- Minibus/bus et matching multi-véhicules ("plusieurs véhicules").
- Anglais (V1.1 dès que le corridor Nigeria s'active commercialement).
- Chat intégré / support avancé (démarrer avec WhatsApp).
- Facturation PDF automatique.
- Calcul dynamique des frais de douane (démarrer avec grille fixe par trançon, gérée par l'admin).

Raison de ce découpage : valider d'abord que le tandem "réservation + paiement séquestre + chauffeur vérifié" fonctionne opérationnellement sur 2-3 trajets fixes, avant d'investir dans la fidélisation et la variété de véhicules.

## 3. Phasage

### Phase 0 — Cadrage (1-2 semaines)
- Trancher les points de la section 7 du cahier des charges (devise abonnement, assurance, cadre juridique, provider paiement).
- Définir la grille tarifaire initiale des trançons de lancement (Cotonou-Lomé, Hilacondji-Lomé, Bénin-Lagos).
- Maquettes UI (client, chauffeur, admin) — wireframes des parcours ci-dessus.
- Choix définitif des providers (Fedapay/Paystack, SMS, hébergement).

### Phase 1 — Fondations techniques (2-3 semaines)
- Setup repo(s), CI/CD, environnements (dev/staging/prod).
- Modèle de données (users, drivers, vehicles, rides, bookings, payments, documents, tariffs).
- Auth + OTP (email/SMS) client et chauffeur.
- Upload et stockage sécurisé des documents.

### Phase 2 — Cœur métier (4-6 semaines)
- Réservation Frontalier (recherche, estimation, création de course).
- Réservation Location Ville (journée + avance/solde).
- Matching / attribution chauffeur (acceptation manuelle depuis le dashboard chauffeur).
- Suivi GPS temps réel (websocket ou polling + Google Maps).
- Intégration paiement (Fedapay + Paystack) + logique séquestre.

### Phase 3 — Back-office Admin (parallèle à la Phase 2, 3-4 semaines)
- Validation chauffeurs/véhicules.
- Gestion des trançons et tarifs.
- Vue transactions, litiges, annulations.
- Statistiques de base (CA, courses par trançon).

### Phase 4 — Finitions & conformité (2-3 semaines)
- Notation, notifications, rappels.
- Sécurité (chiffrement, revue RGPD/local), tests de charge légers, tests end-to-end sur les parcours critiques (réservation → paiement → course → notation).
- Recrutement et validation des premiers chauffeurs pilotes sur les 2-3 trançons de lancement.

### Phase 5 — Lancement pilote
- Lancement fermé sur Cotonou-Lomé (+ Hilacondji-Lomé), suivi opérationnel rapproché, ajustements tarifs/UX.
- Extension au corridor Nigeria une fois le premier corridor stable.

**Estimation globale MVP** : ~3-4 mois avec une petite équipe (1-2 devs mobile, 1-2 devs backend, 1 designer produit, à temps partiel un profil paiement/conformité).

## 3 bis. Mise en relation client ↔ chauffeur

Trois niveaux, du moins cher au plus engageant. Le premier est en place.

**Niveau 1 — livré. Appel téléphonique et WhatsApp.** L'écran de détail d'une
course et l'espace chauffeur ouvrent l'un ou l'autre en un geste, avec un
message WhatsApp pré-rempli portant la référence et le trajet. Sur le volet
frontalier, WhatsApp passe en premier : l'un des deux interlocuteurs est à
l'étranger, l'appel classique part alors en itinérance quand WhatsApp passe par
les données. Coût : nul. Limite : les deux numéros sont visibles en clair, et
WhatsApp ne permet pas de déclencher un appel par lien — on ouvre la
conversation, l'appel est à un bouton de là.

**Niveau 2 — numéros masqués.** Le client appelle un numéro de service qui
route vers le chauffeur, et inversement ; aucun des deux ne connaît le numéro
de l'autre. C'est le standard du VTC, et la réponse à la question qu'on se
posera vite : que se passe-t-il quand un chauffeur rappelle une cliente après
la course ? Demande un compte CPaaS avec des numéros locaux BJ/TG (Twilio,
Infobip, Africa's Talking) et une facturation à la minute. Le trafic reste sur
le réseau téléphonique : rien à changer côté application, seulement le numéro
composé.

**Niveau 3 — appel dans l'application (VoIP) — livré, sur Agora.** L'appel
passe par les données, sans numéro. Le forfait gratuit d'Agora couvre 10 000
minutes par mois, bien au-delà du pilote. Deux limites assumées à ce stade :
l'appel exige un **development build** (Expo Go n'embarque pas le module
natif), et la sonnerie n'atteint le destinataire que si son application est
ouverte, faute de push. Voir [`appels.md`](appels.md).

Reste à faire pour un usage réel : le push (Expo Notifications, puis CallKit
sur iOS et ConnectionService sur Android) pour faire sonner un téléphone en
veille, et une campagne de tests sur le réseau du corridor, où la qualité se
dégrade par endroits.

Le niveau 2 reste la réponse à la confidentialité : le VoIP masque les numéros
pendant l'appel, mais ils restent visibles dans la fiche de la course.

## 4. Prochaines étapes immédiates

1. Trancher les 5 points ouverts du cahier des charges (section 7).
2. Choisir la stack définitive (valider Flutter vs React Native si préférence équipe).
3. Démarrer les maquettes des 3 parcours (client, chauffeur, admin) pour le périmètre MVP défini ci-dessus.
4. Négocier l'intégration Fedapay/Paystack (délais d'homologation marchand — à lancer tôt, c'est souvent le chemin critique).
