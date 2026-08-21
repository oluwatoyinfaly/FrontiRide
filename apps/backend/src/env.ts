import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * Hors Docker, les variables du backend vivent dans apps/backend/.env ; sous
 * Docker elles sont déjà dans l'environnement et le fichier n'existe pas.
 *
 * Ce module est importé en premier par le serveur : en ESM les imports sont
 * évalués dans l'ordre, donc DATABASE_URL est en place avant que le client
 * Prisma ne la lise.
 */
const envFile = fileURLToPath(new URL("../.env", import.meta.url));

if (existsSync(envFile)) {
  process.loadEnvFile(envFile);
}
