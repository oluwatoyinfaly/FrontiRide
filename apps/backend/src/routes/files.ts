import { randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import multipart from "@fastify/multipart";
import type { FastifyInstance } from "fastify";

/**
 * Pièces justificatives des chauffeurs : cartes d'identité, permis, carte
 * grise… Ce sont des documents sensibles, d'où trois choix :
 *
 * - le contenu est reconnu à ses premiers octets, jamais à ce que le client
 *   en dit ;
 * - le nom sur disque est un UUID, et rien n'est servi sans authentification ;
 * - seuls le chauffeur concerné et un administrateur peuvent relire une pièce.
 *
 * Stockage sur disque local (UPLOAD_DIR) : suffisant pour un déploiement sur un
 * seul serveur avec un volume. Plusieurs instances, ou un hébergeur sans disque
 * persistant, demanderaient un stockage objet (S3) derrière ces mêmes routes.
 */

const MAX_BYTES = 8 * 1024 * 1024;

/** Nom de fichier servi : un UUID et une extension connue, rien d'autre. */
export const STORED_NAME = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/;
export const STORED_URL = /^\/files\/[0-9a-f-]{36}\.(jpg|png|webp)$/;

const CONTENT_TYPES = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
} as const;

export function uploadDir(): string {
  return path.resolve(process.env.UPLOAD_DIR ?? "uploads");
}

/** Reconnaît un JPEG, un PNG ou un WebP à ses octets de tête. */
function sniff(buffer: Buffer): keyof typeof CONTENT_TYPES | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "jpg";
  }
  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return "png";
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "webp";
  }
  return null;
}

/** Supprime une pièce remplacée ; son absence n'est pas une erreur. */
export async function removeStoredFile(url: string): Promise<void> {
  if (!STORED_URL.test(url)) return;
  await unlink(path.join(uploadDir(), path.basename(url))).catch(() => {});
}

export default async function fileRoutes(fastify: FastifyInstance) {
  await fastify.register(multipart, {
    limits: { fileSize: MAX_BYTES, files: 1, fields: 0 },
  });

  /**
   * Réservé aux chauffeurs : c'est la seule raison de téléverser un fichier
   * pour l'instant, et ça évite qu'un compte quelconque remplisse le disque.
   */
  fastify.post(
    "/uploads",
    { preHandler: [fastify.authenticate, fastify.requireDriver] },
    async (request, reply) => {
      const part = await request.file();
      if (!part) {
        return reply.code(400).send({ error: "Aucun fichier reçu" });
      }

      const buffer = await part.toBuffer();
      // toBuffer() lève si la limite est dépassée ; on garde une garde explicite
      // au cas où `truncated` serait posé sans exception.
      if (part.file.truncated) {
        return reply.code(413).send({ error: "Fichier trop volumineux (8 Mo max)" });
      }

      const kind = sniff(buffer);
      if (!kind) {
        return reply
          .code(415)
          .send({ error: "Format non pris en charge (JPEG, PNG ou WebP)" });
      }

      const name = `${randomUUID()}.${kind}`;
      await mkdir(uploadDir(), { recursive: true });
      await writeFile(path.join(uploadDir(), name), buffer);

      return reply.code(201).send({ url: `/files/${name}` });
    }
  );

  fastify.get(
    "/files/:name",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const { name } = request.params as { name: string };
      if (!STORED_NAME.test(name)) {
        return reply.code(404).send({ error: "Fichier introuvable" });
      }

      // Une pièce n'est lisible que par son propriétaire et par un admin. Elle
      // est retrouvée par le document qui la référence : un fichier téléversé
      // mais jamais rattaché n'est lisible par personne.
      const document = await fastify.prisma.document.findFirst({
        where: { fileUrl: `/files/${name}` },
        select: { driver: { select: { userId: true } } },
      });

      const allowed =
        document &&
        (request.user.role === "ADMIN" ||
          document.driver.userId === request.user.userId);

      if (!allowed) {
        return reply.code(404).send({ error: "Fichier introuvable" });
      }

      const file = path.join(uploadDir(), name);
      const info = await stat(file).catch(() => null);
      if (!info) {
        return reply.code(404).send({ error: "Fichier introuvable" });
      }

      const ext = name.split(".").pop() as keyof typeof CONTENT_TYPES;
      return reply
        .header("Content-Type", CONTENT_TYPES[ext])
        .header("Content-Length", info.size)
        .header("Cache-Control", "private, max-age=300")
        .header("X-Content-Type-Options", "nosniff")
        .send(createReadStream(file));
    }
  );
}
