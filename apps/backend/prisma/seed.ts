import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.trancon.upsert({
    where: { id: "trancon-cotonou-lome" },
    update: {},
    create: {
      id: "trancon-cotonou-lome",
      originCity: "Cotonou",
      destinationCity: "Lomé",
      borderPoint: "Hilacondji",
      priceFcfa: 25000,
      estimatedCustomsFeeFcfa: 3000,
    },
  });

  console.log("Seed terminé : trançon pilote Cotonou <-> Lomé créé.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
