/**
 * Jeu de données de démonstration.
 *
 * Idempotent : toutes les écritures sont des upserts sur des identifiants
 * fixes, donc relancer le seed ne duplique rien.
 */
import { PrismaClient, type DocumentType } from "@prisma/client";

const prisma = new PrismaClient();

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? "admin@frontiride.com";

const REQUIRED_DOCUMENTS: DocumentType[] = [
  "CNI",
  "PERMIS",
  "CARTE_GRISE",
  "ASSURANCE",
  "VISITE_TECHNIQUE",
  "CASIER_JUDICIAIRE",
  "PHOTO_VEHICULE",
];

function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

async function main() {
  // --- Administrateur ---
  const admin = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: { role: "ADMIN" },
    create: {
      id: "seed-admin",
      email: ADMIN_EMAIL,
      phone: "+22900000000",
      fullName: "Administration FrontiRide",
      role: "ADMIN",
      emailVerified: true,
      phoneVerified: true,
    },
  });

  // --- Trançons du corridor pilote ---
  const troncons = [
    {
      id: "trancon-cotonou-lome",
      originCity: "Cotonou",
      destinationCity: "Lomé",
      borderPoint: "Hilacondji",
      priceFcfa: 25000,
      estimatedCustomsFeeFcfa: 3000,
    },
    {
      id: "trancon-lome-cotonou",
      originCity: "Lomé",
      destinationCity: "Cotonou",
      borderPoint: "Hilacondji",
      priceFcfa: 25000,
      estimatedCustomsFeeFcfa: 3000,
    },
    {
      id: "trancon-hilacondji-lome",
      originCity: "Hilacondji (frontière)",
      destinationCity: "Lomé",
      borderPoint: "Hilacondji",
      priceFcfa: 12000,
      estimatedCustomsFeeFcfa: 1500,
    },
  ];

  for (const trancon of troncons) {
    await prisma.trancon.upsert({
      where: { id: trancon.id },
      update: trancon,
      create: trancon,
    });
  }

  // --- Chauffeurs ---
  const driverSpecs = [
    {
      key: "kofi",
      fullName: "Kofi Adjovi",
      email: "kofi.adjovi@example.com",
      phone: "+22997000001",
      baseCity: "Cotonou",
      status: "APPROVED" as const,
      rating: 4.9,
      vehicle: {
        type: "CONFORT" as const,
        brand: "Toyota",
        model: "Corolla",
        plateNumber: "AB-1234-RB",
        seats: 4,
        pricePerDay: 35000,
      },
    },
    {
      key: "amivi",
      fullName: "Amivi Kossi",
      email: "amivi.kossi@example.com",
      phone: "+22890000002",
      baseCity: "Lomé",
      status: "APPROVED" as const,
      rating: 4.7,
      vehicle: {
        type: "SUV" as const,
        brand: "Toyota",
        model: "RAV4",
        plateNumber: "TG-5567-AA",
        seats: 5,
        pricePerDay: 55000,
      },
    },
    {
      key: "seydou",
      fullName: "Seydou Traoré",
      email: "seydou.traore@example.com",
      phone: "+22997000003",
      baseCity: "Cotonou",
      status: "PENDING_REVIEW" as const,
      rating: 0,
      vehicle: {
        type: "ECONOMIQUE" as const,
        brand: "Kia",
        model: "Picanto",
        plateNumber: "AB-7788-RB",
        seats: 4,
        pricePerDay: 22000,
      },
    },
    {
      key: "mariam",
      fullName: "Mariam Bello",
      email: "mariam.bello@example.com",
      phone: "+22997000004",
      baseCity: "Cotonou",
      status: "PENDING_REVIEW" as const,
      rating: 0,
      vehicle: {
        type: "PREMIUM" as const,
        brand: "Mercedes",
        model: "Classe E",
        plateNumber: "AB-9012-RB",
        seats: 4,
        pricePerDay: 85000,
      },
    },
  ];

  const drivers: Record<string, string> = {};

  for (const spec of driverSpecs) {
    const user = await prisma.user.upsert({
      where: { email: spec.email },
      update: { fullName: spec.fullName, role: "DRIVER" },
      create: {
        id: `seed-user-${spec.key}`,
        email: spec.email,
        phone: spec.phone,
        fullName: spec.fullName,
        role: "DRIVER",
        emailVerified: true,
        phoneVerified: true,
      },
    });

    const driver = await prisma.driver.upsert({
      where: { userId: user.id },
      update: { status: spec.status, ratingAverage: spec.rating },
      create: {
        id: `seed-driver-${spec.key}`,
        userId: user.id,
        status: spec.status,
        baseCity: spec.baseCity,
        offersFrontalier: true,
        offersLocationVille: true,
        ratingAverage: spec.rating,
        isOnline: spec.status === "APPROVED",
      },
    });
    drivers[spec.key] = driver.id;

    for (const type of REQUIRED_DOCUMENTS) {
      await prisma.document.upsert({
        where: { driverId_type: { driverId: driver.id, type } },
        update: {},
        create: {
          driverId: driver.id,
          type,
          fileUrl: `https://exemple.frontiride.com/docs/${spec.key}/${type.toLowerCase()}.jpg`,
          status: spec.status === "APPROVED" ? "APPROVED" : "PENDING",
        },
      });
    }

    await prisma.vehicle.upsert({
      where: { id: `seed-vehicle-${spec.key}` },
      update: spec.vehicle,
      create: { id: `seed-vehicle-${spec.key}`, driverId: driver.id, ...spec.vehicle },
    });

    if (spec.status === "APPROVED") {
      await prisma.driverWallet.upsert({
        where: { driverId: driver.id },
        update: {},
        create: {
          driverId: driver.id,
          balanceFcfa: 42000,
          pendingFcfa: 22000,
        },
      });
    }
  }

  // --- Client de démonstration ---
  const client = await prisma.user.upsert({
    where: { email: "client@example.com" },
    update: {},
    create: {
      id: "seed-client",
      email: "client@example.com",
      phone: "+22996000010",
      fullName: "Awa Diallo",
      emailVerified: true,
      phoneVerified: true,
    },
  });

  // --- Réservations couvrant chaque état du tableau de bord ---
  const bookings = [
    {
      id: "seed-booking-1",
      reference: "FR-1042",
      type: "FRONTALIER" as const,
      status: "COMPLETED" as const,
      driverId: drivers.kofi,
      tranconId: "trancon-cotonou-lome",
      departureAt: daysFromNow(-6),
      completedAt: daysFromNow(-6),
      seats: 2,
      estimatedPriceFcfa: 28000,
      finalPriceFcfa: 28000,
      payment: { status: "RELEASED" as const, method: "MOMO_MTN" as const },
    },
    {
      id: "seed-booking-2",
      reference: "FR-2318",
      type: "FRONTALIER" as const,
      status: "IN_PROGRESS" as const,
      driverId: drivers.amivi,
      tranconId: "trancon-lome-cotonou",
      departureAt: daysFromNow(0),
      startedAt: new Date(),
      seats: 1,
      estimatedPriceFcfa: 28000,
      payment: { status: "ESCROW_HELD" as const, method: "MOMO_MOOV" as const },
    },
    {
      id: "seed-booking-3",
      reference: "FR-5590",
      type: "FRONTALIER" as const,
      status: "CONFIRMED" as const,
      driverId: null,
      tranconId: "trancon-cotonou-lome",
      departureAt: daysFromNow(3),
      seats: 4,
      estimatedPriceFcfa: 56000,
      payment: { status: "ESCROW_HELD" as const, method: "CARD" as const },
    },
    {
      id: "seed-booking-4",
      reference: "LV-7731",
      type: "LOCATION_VILLE" as const,
      status: "DRIVER_ASSIGNED" as const,
      driverId: drivers.kofi,
      vehicleId: "seed-vehicle-kofi",
      city: "Cotonou",
      vehicleType: "CONFORT" as const,
      startAt: daysFromNow(2),
      endAt: daysFromNow(5),
      durationDays: 3,
      estimatedPriceFcfa: 105000,
      payment: { status: "ESCROW_HELD" as const, method: "MOMO_MTN" as const },
    },
    {
      id: "seed-booking-5",
      reference: "LV-8802",
      type: "LOCATION_VILLE" as const,
      status: "AWAITING_PAYMENT" as const,
      driverId: null,
      vehicleId: "seed-vehicle-amivi",
      city: "Lomé",
      vehicleType: "SUV" as const,
      startAt: daysFromNow(5),
      endAt: daysFromNow(6),
      durationDays: 1,
      estimatedPriceFcfa: 55000,
      payment: null,
    },
  ];

  for (const spec of bookings) {
    const { payment, ...data } = spec;

    await prisma.booking.upsert({
      where: { id: data.id },
      update: { status: data.status },
      create: { ...data, clientId: client.id },
    });

    if (payment) {
      await prisma.payment.upsert({
        where: { bookingId: data.id },
        update: { status: payment.status },
        create: {
          bookingId: data.id,
          method: payment.method,
          status: payment.status,
          amountFcfa: data.estimatedPriceFcfa,
        },
      });
    }
  }

  // Une note sur la course terminée, pour que la moyenne affichée soit réelle.
  await prisma.rating.upsert({
    where: { bookingId: "seed-booking-1" },
    update: {},
    create: {
      bookingId: "seed-booking-1",
      clientId: client.id,
      driverId: drivers.kofi,
      score: 5,
      comment: "Chauffeur ponctuel, passage de la frontière très fluide.",
    },
  });

  console.log(`Seed terminé.
  Admin        : ${admin.email}
  Client démo  : ${client.email}
  Chauffeurs   : ${driverSpecs.length} (2 validés, 2 en attente de contrôle)
  Trançons     : ${troncons.length}
  Réservations : ${bookings.length}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
