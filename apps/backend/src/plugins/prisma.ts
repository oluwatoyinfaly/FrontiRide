import fp from "fastify-plugin";
import { PrismaClient } from "@prisma/client";
import type { FastifyInstance } from "fastify";

declare module "fastify" {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}

/**
 * Traduit les échecs de connexion de Prisma, dont la trace noie la cause
 * réelle sous plusieurs milliers de caractères de code minifié.
 */
function explain(error: unknown): string | null {
  const code = (error as { errorCode?: string })?.errorCode;
  if (code !== "P1000" && code !== "P1001" && code !== "P1003") return null;

  let target = process.env.DATABASE_URL ?? "(DATABASE_URL absente)";
  try {
    const url = new URL(target);
    target = `${url.hostname}:${url.port || 5432}, base « ${url.pathname.slice(1)} », utilisateur « ${url.username} »`;
  } catch {
    // URL illisible : on affiche la valeur brute, elle est parlante aussi.
  }

  const cause =
    code === "P1001"
      ? "aucun serveur PostgreSQL ne répond"
      : code === "P1003"
        ? "le serveur répond mais la base n'existe pas"
        : "le serveur répond mais refuse ces identifiants";

  return [
    `Connexion à la base impossible : ${cause}.`,
    `  Cible : ${target}`,
    "",
    "  Vérifie apps/backend/.env, ou lance la base fournie :",
    "    docker compose up postgres",
    "  (si un PostgreSQL tourne déjà sur 5432, publie l'autre sur un port libre :",
    "   POSTGRES_PORT=5433 docker compose up postgres, puis adapte DATABASE_URL)",
  ].join("\n");
}

export default fp(async (fastify: FastifyInstance) => {
  const prisma = new PrismaClient();

  try {
    await prisma.$connect();
  } catch (error) {
    const message = explain(error);
    if (!message) throw error;
    // console plutôt que le logger : le message est fait pour être lu par un
    // humain, le JSON de pino en échapperait les retours à la ligne.
    console.error(`\n${message}\n`);
    process.exit(1);
  }

  fastify.decorate("prisma", prisma);

  fastify.addHook("onClose", async (instance) => {
    await instance.prisma.$disconnect();
  });
});
