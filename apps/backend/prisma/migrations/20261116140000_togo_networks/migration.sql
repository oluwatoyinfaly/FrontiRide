-- Le corridor Cotonou <-> Lome oblige a encaisser aussi des clients togolais :
-- Moov Togo et Togocom, les deux reseaux Mobile Money du pays.
ALTER TYPE "PaymentMethod" ADD VALUE 'MOMO_MOOV_TG';
ALTER TYPE "PaymentMethod" ADD VALUE 'MOMO_TOGOCOM';
