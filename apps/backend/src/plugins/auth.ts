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
  const secret = process.env.JWT_SECRET;
  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET est obligatoire en production");
  }

  await fastify.register(jwt, { secret: secret ?? "dev-secret-change-me" });

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
        if (!roles.includes(request.user.role)) {
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
