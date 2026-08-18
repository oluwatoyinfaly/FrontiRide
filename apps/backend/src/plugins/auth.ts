import fp from "fastify-plugin";
import jwt from "@fastify/jwt";
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: { userId: string; role: "CLIENT" | "DRIVER" | "ADMIN" };
  }
}

export default fp(async (fastify: FastifyInstance) => {
  fastify.register(jwt, {
    secret: process.env.JWT_SECRET ?? "dev-secret-change-me",
  });

  fastify.decorate(
    "authenticate",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        await request.jwtVerify();
      } catch {
        reply.code(401).send({ error: "Non authentifié" });
      }
    }
  );
});
