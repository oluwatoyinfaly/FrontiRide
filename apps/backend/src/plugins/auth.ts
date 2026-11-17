import fp from "fastify-plugin";
import jwt from "@fastify/jwt";
import type { UserRole } from "@prisma/client";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

type Guard = (request: FastifyRequest, reply: FastifyReply) => Promise<void>;

declare module "fastify" {
  interface FastifyInstance {
    authenticate: Guard;
    requireRole: (...roles: UserRole[]) => Guard;
    /** Profil chauffeur de l'utilisateur courant, ou 403 s'il n'en a pas. */
    requireDriver: Guard;
  }

  interface FastifyRequest {
    driverId?: string;
  }
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: { userId: string; role: UserRole };
    user: { userId: string; role: UserRole };
  }
}

export default fp(async (fastify: FastifyInstance) => {
  // Le secret de secours n'existe qu'en développement déclaré : un oubli de
  // variable en production ne doit pas laisser signer des jetons avec une
  // valeur publique, écrite dans ce dépôt.
  const dev = process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test";
  const secret = process.env.JWT_SECRET;
  if (!dev && (!secret || secret.length < 16)) {
    throw new Error(
      "JWT_SECRET (16 caractères au moins) est obligatoire hors développement"
    );
  }

  await fastify.register(jwt, {
    secret: secret ?? "dev-secret-change-me",
    // Un jeton volé ne doit pas valoir à vie.
    sign: { expiresIn: process.env.JWT_TTL ?? "30d" },
    // Les jetons émis avant l'expiration n'en portent pas : on les refuse,
    // sinon ils resteraient valables à vie. Effet : une reconnexion par code.
    verify: { requiredClaims: ["exp"] },
  });

  fastify.decorate("authenticate", async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch {
      await reply.code(401).send({ error: "Non authentifié" });
    }
  });

  fastify.decorate(
    "requireRole",
    (...roles: UserRole[]): Guard =>
      async (request, reply) => {
        // Le rôle est relu en base, pas dans le jeton : un compte retiré du
        // back-office perd l'accès tout de suite, même avec un jeton encore valide.
        const user = await fastify.prisma.user.findUnique({
          where: { id: request.user.userId },
          select: { role: true },
        });
        if (!user || !roles.includes(user.role)) {
          await reply.code(403).send({ error: "Accès refusé" });
        }
      }
  );

  fastify.decorate("requireDriver", async (request, reply) => {
    const driver = await fastify.prisma.driver.findUnique({
      where: { userId: request.user.userId },
      select: { id: true, status: true },
    });

    if (!driver) {
      await reply.code(403).send({ error: "Aucun profil chauffeur" });
      return;
    }

    request.driverId = driver.id;
  });
});
