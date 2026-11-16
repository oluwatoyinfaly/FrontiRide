-- Le prestataire de paiement n'est plus Fedapay mais FeexPay : la colonne porte
-- désormais le nom du rôle (la référence chez le prestataire), pas celui d'une
-- marque. RENAME COLUMN conserve les références déjà enregistrées.
ALTER TABLE "Payment" RENAME COLUMN "fedapayReference" TO "providerReference";
