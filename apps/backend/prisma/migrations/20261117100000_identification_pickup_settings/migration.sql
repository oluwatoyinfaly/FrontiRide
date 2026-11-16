-- La photo de profil du chauffeur devient une pièce obligatoire : c'est ce que
-- le client voit pour reconnaître celui qui vient le chercher.
ALTER TYPE "DocumentType" ADD VALUE 'PHOTO_PROFIL';

-- Couleur du véhicule, avec la plaque et le modèle : de quoi le reconnaître.
ALTER TABLE "Vehicle" ADD COLUMN "color" TEXT;

-- Où le chauffeur doit récupérer le client. Le texte est le repère de référence
-- (« devant l'hôtel X ») ; les coordonnées sont facultatives et servent à ouvrir
-- l'itinéraire dans l'application de cartes du téléphone.
ALTER TABLE "Booking" ADD COLUMN "pickupAddress" TEXT;
ALTER TABLE "Booking" ADD COLUMN "pickupLat" DOUBLE PRECISION;
ALTER TABLE "Booking" ADD COLUMN "pickupLng" DOUBLE PRECISION;

-- Réglages de la plateforme, modifiables depuis le back-office. Une seule ligne.
CREATE TABLE "AppSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "maskPhoneNumbers" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSettings_pkey" PRIMARY KEY ("id")
);
