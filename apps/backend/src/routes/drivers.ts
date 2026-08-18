import type { FastifyInstance } from "fastify";
import { z } from "zod";

const registerDriverSchema = z.object({
  email: z.string().email(),
  phone: z.string().min(8),
  fullName: z.string(),
  baseCity: z.enum(["Cotonou", "Lomé"]),
  offersFrontalier: z.boolean().default(true),
  offersLocationVille: z.boolean().default(false),
});

const uploadDocumentSchema = z.object({
  type: z.enum([
    "CNI",
    "PERMIS",
    "CARTE_GRISE",
    "ASSURANCE",
    "VISITE_TECHNIQUE",
    "CASIER_JUDICIAIRE",
    "PHOTO_VEHICULE",
  ]),
  fileUrl: z.string().url(),
});

const REQUIRED_DOCUMENTS = [
  "CNI",
  "PERMIS",
  "CARTE_GRISE",
  "ASSURANCE",
  "VISITE_TECHNIQUE",
  "CASIER_JUDICIAIRE",
  "PHOTO_VEHICULE",
] as const;

export default async function driversRoutes(fastify: FastifyInstance) {
  fastify.post("/drivers/register", async (request, reply) => {
    const body = registerDriverSchema.parse(request.body);

    const user = await fastify.prisma.user.upsert({
      where: { email: body.email },
      update: { role: "DRIVER", fullName: body.fullName },
      create: {
        email: body.email,
        phone: body.phone,
        fullName: body.fullName,
        role: "DRIVER",
      },
    });

    const driver = await fastify.prisma.driver.upsert({
      where: { userId: user.id },
      update: {
        baseCity: body.baseCity,
        offersFrontalier: body.offersFrontalier,
        offersLocationVille: body.offersLocationVille,
      },
      create: {
        userId: user.id,
        baseCity: body.baseCity,
        offersFrontalier: body.offersFrontalier,
        offersLocationVille: body.offersLocationVille,
      },
    });

    return reply.code(201).send({ userId: user.id, driverId: driver.id });
  });

  // Le fichier lui-même est envoyé via un service de stockage (S3) côté client ;
  // ici on n'enregistre que l'URL déjà uploadée (fileUrl).
  fastify.post(
    "/drivers/:id/documents",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = uploadDocumentSchema.parse(request.body);

      const document = await fastify.prisma.document.create({
        data: { driverId: id, type: body.type, fileUrl: body.fileUrl },
      });

      const documents = await fastify.prisma.document.findMany({
        where: { driverId: id },
      });
      const uploadedTypes = new Set(documents.map((d) => d.type));
      const allDocumentsUploaded = REQUIRED_DOCUMENTS.every((t) =>
        uploadedTypes.has(t)
      );

      if (allDocumentsUploaded) {
        await fastify.prisma.driver.update({
          where: { id },
          data: { status: "PENDING_REVIEW" },
        });
      }

      return reply.code(201).send(document);
    }
  );
}
