import type { PrismaClient } from "@prisma/client";

/** Le masquage des numéros est-il actif ? Faux tant que l'admin ne l'a pas demandé. */
export async function phonesMasked(prisma: PrismaClient): Promise<boolean> {
  const settings = await prisma.appSettings.findUnique({ where: { id: 1 } });
  return settings?.maskPhoneNumbers ?? false;
}
