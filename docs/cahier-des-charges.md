# FrontiRide — Cahier des charges consolidé (v1.4)

> _Le transport frontalier et de séjour, simple et sécurisé_

Ce document remplace les brouillons successifs (v1 → v1.4) partagés dans les échanges produit. Il retient la dernière version de chaque section (la plus aboutie), et signale explicitement ce qui est repoussé après le MVP dans `plan-de-developpement.md`.

## 1. Positionnement

FrontiRide met en relation :

1. **Volet 1 — Transport Frontalier** : trajets qui traversent une frontière (Cotonou→Lomé, Abomey-Calavi→Lagos…), avec l'option "rendez-vous à la frontière" (Hilacondji, Sèmè-Kraké, Kpékplémé…) et la réservation à l'avance (J+1 à J+30).
2. **Volet 2 — Location Ville avec Chauffeur** : véhicule + chauffeur à l'heure, à la journée ou au forfait (aéroport, tourisme, mission), dans une ville donnée.

**Différenciateur** : aucun acteur du marché (Thedriver, Benin Negoce Transport, ASTT, Tyempire, Benin Voyage, Sola Drive, Carali, BeTaxi) ne combine app mobile + paiement mobile money + frontalier dédié + réservation à l'avance avec avance + vérification poussée des chauffeurs + suivi GPS, sur le corridor Bénin-Togo-Nigeria-Burkina.

**Cibles** : expatriés, ONG, entreprises, touristes, diaspora ↔ chauffeurs professionnels vérifiés et agences avec flotte.

**Villes de lancement** :
- Cotonou ↔ Lomé
- Frontière Hilacondji ↔ Lomé
- Frontière Bénin (Sèmè-Kraké / Owodé / Igolo, à sélectionner) ↔ Nigeria (Lagos)

## 2. Parcours utilisateurs

### 2.1 Client
1. Inscription (email + téléphone), vérification OTP mail + SMS.
2. Profil complet (nom, pièce d'identité, photo) — requis pour débloquer le paiement des courses.
3. Choix du service : Frontalier ou Location Ville.
4. **Frontalier** : départ (ville/adresse ou point frontière), arrivée, date/heure, aller ou aller-retour, réservation à l'avance possible, nombre de places (curseur 1-4, au-delà → minibus/bus/plusieurs véhicules), type de véhicule, estimation prix (trançon + prix/km + majoration + frais de douane estimés).
5. **Location Ville** : ville, type de véhicule (Économique / Confort / SUV-4x4 / Premium-VIP / Minibus), durée (à l'heure, à la journée, forfait spécial), date/heure, options (chauffeur bilingue, siège bébé, wifi, eau), réservation avec avance (30% par défaut, configurable par l'admin, ou 100%), solde payé à la fin.
6. Paiement : Mobile Money (MTN, Moov), carte, espèces au chauffeur — via portefeuille séquestre.
7. Suivi GPS temps réel du/des chauffeur(s).
8. Notation chauffeur + véhicule + propreté après course.
9. Programme de fidélité "FrontiPoints" + parrainage.
10. Abonnement optionnel (Pass Découverte / Pro / Entreprise).

### 2.2 Chauffeur / Agence

Un chauffeur est d'abord un client : le compte est le même, on y ajoute une
candidature. Tant qu'aucune course n'y est rattachée, cette candidature se
retire et le compte redevient un simple compte client. L'espace chauffeur
n'apparaît dans l'application que pour qui en a déposé une, et « Mes courses »
distingue par une pastille les courses réservées de celles conduites.

1. Inscription (email + téléphone), OTP.
2. Vérification obligatoire : CNI, permis, carte grise, assurance, visite technique, casier judiciaire, photo du véhicule et du profil.
3. Déclare son offre : Frontalier et/ou Location Ville ; profil véhicule (type, places, photos, prix/jour) ; option flotte multi-véhicules pour les agences.
4. Validation manuelle par l'équipe FrontiRide (back-office admin).
5. Tableau de bord des courses disponibles, filtrable (type, places, "à la frontière", réservation future), calendrier de disponibilités pour la location.
6. Navigation GPS intégrée, statut en ligne/hors ligne/positionné à un point frontière.
7. Portefeuille : gains, commission déduite automatiquement, bonus, historique, demande de retrait (montant min. 5 000 FCFA, versement J+2).
8. Programme "Chauffeur Elite" (bonus volume, ponctualité, nouvelle ville).

### 2.3 Admin
1. Validation des chauffeurs, véhicules, flottes, documents.
2. Gestion des tarifs intelligents : trançons frontaliers (prix fixe par trajet), prix/km de base par type de véhicule, majorations (nuit, dimanche/fêtes), % d'avance pour la location.
3. Gestion des commissions (slider 5-20% selon volet, promos ponctuelles).
4. Gestion des abonnements clients.
5. Suivi des courses, litiges, annulations (règles d'annulation gratuite/payante).
6. Statistiques : CA par volet, top trançons, taux d'occupation flotte, satisfaction.
7. Support client (chat/ticket, WhatsApp).

## 3. Paiement

| Acteur | Moyens | Fonctionnement |
|---|---|---|
| Client | MoMo MTN, MoMo Moov, carte Visa/Mastercard, espèces, virement | Prix estimé avant course → paiement bloqué en séquestre → débloqué au chauffeur 24h après la course sauf litige. Frontalier longue distance : option 50%/50%. Location : avance 30% (configurable) + solde à la fin, caution bloquée puis libérée après état des lieux. |
| Chauffeur | Retrait MoMo, virement | Commission prélevée automatiquement (10-15% Frontalier, 15-20% Location Ville). Retrait min. 5 000 FCFA, versement J+2. |
| Admin | Dashboard | Vue de toutes les transactions, remboursements, litiges, factures PDF auto pour entreprises/ONG. |

Prestataires : **Fedapay** et/ou **Paystack** pour couvrir MoMo MTN/Moov (Bénin, Togo) et cartes/MoMo (Nigeria).

## 4. Fidélité & abonnement

- **FrontiPoints (client)** : 1 000 FCFA dépensés = 1 point ; 100 points = 1 000 FCFA de réduction. Parrainage : 2 000 FCFA parrain + 2 000 FCFA filleul après 1ère course. Palier VIP Expat après 10 courses frontalier → chauffeur prioritaire + support WhatsApp dédié.
- **Chauffeur Elite** : prime 25 000 FCFA si 50 courses/mois ; -2% commission si note > 4,8 pendant 30 jours ; 10 000 FCFA bonus "nouvelle ville" pour les 10 premiers chauffeurs validés.
- **Abonnement client** :

| Pack | Prix | Avantages |
|---|---|---|
| Pass Découverte | 0 FCFA | Paiement à la course + bonus standard |
| Pass Pro | 15 000 FCFA/mois | -10% sur 2 courses, support prioritaire, facture mensuelle |
| Pass Entreprise | 50 000 FCFA/mois | -15% sur 5 courses, chauffeur favori, dashboard, facture consolidée |

(Anciennes offres 3€/mois, 10€/an, 25€ à vie mentionnées en v1 — à trancher : proposition ci-dessous en section "Décisions à prendre".)

## 5. Contraintes techniques

- Mobile Android + iOS (client + chauffeur), back-office web responsive (admin).
- Langues : Français (V1), Anglais (V1.1 — utile dès le lancement pour le corridor Nigeria).
- Paiement : Fedapay / Paystack, gestion séquestre + avance.
- Cartographie : Google Maps API (itinéraires, suivi temps réel, points d'intérêt "frontière").
- Sécurité : chiffrement au repos (AES-256), RGPD, stockage sécurisé des pièces d'identité, casier judiciaire chauffeur.
- Notifications : push + SMS + email (réservation, rappel J-1/H-3, paiement, validation chauffeur).

## 6. Modèle économique

- Commission Frontalier : 10-15% (modulable).
- Commission Location Ville : 15-20% (modulable).
- Abonnement client récurrent (voir section 4).
- Abonnement entreprise/ONG (forfait mensuel).

## 7. Décisions produit (tranchées)

1. **Devise** : tout en **FCFA**, y compris l'abonnement client (Pass Pro 15 000 FCFA / Pass Entreprise 50 000 FCFA). Les montants EUR de la v1 sont abandonnés.
2. **Pilote de lancement** : un seul corridor pour le MVP — **Cotonou ↔ Lomé** (y compris le passage par le point frontière Hilacondji). Le corridor Bénin↔Nigeria est reporté après validation du pilote.
3. **Paiement** : **Fedapay** uniquement au démarrage (couvre MoMo MTN/Moov Bénin-Togo et cartes). Paystack sera ajouté à l'ouverture du corridor Nigeria.
4. **Stack technique validée** : voir `plan-de-developpement.md` — React Native (mobile), Fastify + TypeScript (API), PostgreSQL (données).

### Points encore ouverts (non bloquants pour démarrer le dev)

- Qui valide le casier judiciaire en pratique (délai, pièce justificative, coût).
- Assurance frontalière : partenariat assureur à identifier avant le lancement commercial.
- Cadre juridique : statut des chauffeurs, fiscalité, conformité protection des données Bénin/Togo.
