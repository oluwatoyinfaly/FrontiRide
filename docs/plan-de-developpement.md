# FrontiRide — Plan de développement

Référence produit : `cahier-des-charges.md`. Objectif : découper la vision complète (v1.4) en un MVP livrable rapidement, puis en itérations.

## 1. Stack technique proposée

| Brique | Choix proposé | Pourquoi |
|---|---|---|
| App mobile (Client + Chauffeur) | **Flutter** | Un seul code pour Android/iOS, équipe réduite, bon support Google Maps + notifications push |
| Back-office Admin | **Next.js (React) + Tailwind** | Développement rapide, SSR pour dashboards, réutilise les devs web/mobile (même écosystème JS que le backend si Node) |
| API Backend | **NestJS (Node/TypeScript)** ou Django REST (Python) | API structurée, modules clairs (auth, courses, paiement, admin), bon écosystème pour webhooks paiement |
| Base de données | **PostgreSQL + PostGIS** | Requêtes géospatiales (trançons, distances, matching chauffeur/course) |
| Paiement | **Fedapay** (MoMo MTN/Moov Bénin-Togo) + **Paystack** (Nigeria/cartes) | Couverture des 3 pays de lancement |
| Cartographie | **Google Maps API** (Directions, Distance Matrix, Places) | Suivi GPS, estimation trajets, points frontière |
| Notifications | **Firebase Cloud Messaging** (push) + provider SMS local (ex. Twilio ou agrégateur régional) + email (SendGrid/Postmark) | |
| Stockage documents (pièces d'identité, permis) | **S3-compatible avec chiffrement AES-256** | Conformité sécurité |
| Infra / CI-CD | Conteneurs Docker, déploiement cloud (ex. Render/Fly.io/AWS selon budget), pipeline CI (tests + lint + build) | |

## 2. Périmètre du MVP (V1) — ce qu'on construit d'abord

Le cahier des charges complet est trop large pour un premier lancement. Le MVP retient le strict nécessaire pour valider le marché sur 1-2 corridors :

**Inclus dans le MVP :**
- Volet 1 (Frontalier) **et** Volet 2 (Location Ville) dès le départ — c'est le cœur de la différenciation, pas juste un des deux.
- Auth client + chauffeur (email + téléphone + OTP).
- Profil + upload documents chauffeur, validation manuelle admin (pas d'automatisation IA au départ).
- Réservation Frontalier : ville→ville ou point frontière, date/heure, 1-4 places, estimation prix par trançon fixe (pas de calcul dynamique douane au 1er jour — grille admin).
- Réservation Location Ville : ville, type véhicule, durée (journée uniquement au MVP, pas "à l'heure"), avance 30% + solde.
- Paiement MoMo + espèces (carte bancaire peut suivre en V1.1).
- Paiement séquestre simple (déblocage manuel ou règle 24h automatique).
- Suivi GPS temps réel (position chauffeur uniquement, pas ETA prédictif avancé).
- Notation post-course (chauffeur + véhicule).
- Back-office admin : validation chauffeurs, gestion trançons/tarifs, suivi transactions, gestion litiges basique.
- Notifications push + SMS (confirmation, rappel).

**Explicitement repoussé après le MVP (V1.1+) :**
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

## 4. Prochaines étapes immédiates

1. Trancher les 5 points ouverts du cahier des charges (section 7).
2. Choisir la stack définitive (valider Flutter vs React Native si préférence équipe).
3. Démarrer les maquettes des 3 parcours (client, chauffeur, admin) pour le périmètre MVP défini ci-dessus.
4. Négocier l'intégration Fedapay/Paystack (délais d'homologation marchand — à lancer tôt, c'est souvent le chemin critique).
