/**
 * Jeu de données de démonstration.
 *
 * Objectif : qu'un premier lancement montre l'application vivante — un
 * historique fourni côté client, un catalogue de véhicules réellement
 * filtrable, et un back-office où chaque écran a de quoi s'afficher.
 *
 * Idempotent : toutes les écritures sont des upserts sur des identifiants
 * fixes, donc relancer le seed ne duplique rien.
 */
// Lancé par `tsx`, ce script ne bénéficie pas du chargement de .env fait par
// la CLI Prisma : il le fait donc lui-même, avant de créer le client.
import "../src/env.js";
import {
  PrismaClient,
  type BookingStatus,
  type BookingType,
  type DocumentType,
  type DriverStatus,
  type PaymentMethod,
  type PaymentStatus,
  type VehicleType,
} from "@prisma/client";

const prisma = new PrismaClient();

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? "admin@frontiride.com";
const CLIENT_EMAIL = "client@example.com";

const ALL_DOCUMENTS: DocumentType[] = [
  "CNI",
  "PERMIS",
  "CARTE_GRISE",
  "ASSURANCE",
  "VISITE_TECHNIQUE",
  "CASIER_JUDICIAIRE",
  "PHOTO_VEHICULE",
];

/** Décalage en jours par rapport à maintenant, à heure fixée. */
function at(days: number, hour = 8): Date {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, 0, 0, 0);
  return date;
}

// --- Trançons du corridor pilote -------------------------------------------

const TRONCONS = [
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
  {
    id: "trancon-cotonou-hilacondji",
    originCity: "Cotonou",
    destinationCity: "Hilacondji (frontière)",
    borderPoint: "Hilacondji",
    priceFcfa: 15000,
    estimatedCustomsFeeFcfa: 1500,
  },
  {
    id: "trancon-cotonou-aneho",
    originCity: "Cotonou",
    destinationCity: "Aného",
    borderPoint: "Hilacondji",
    priceFcfa: 20000,
    estimatedCustomsFeeFcfa: 2500,
  },
];

// --- Chauffeurs -------------------------------------------------------------

interface VehicleSpec {
  type: VehicleType;
  brand: string;
  model: string;
  plateNumber: string;
  seats: number;
  pricePerDay: number;
}

interface DriverSpec {
  key: string;
  fullName: string;
  email: string;
  phone: string;
  baseCity: "Cotonou" | "Lomé";
  status: DriverStatus;
  rating: number;
  offersLocationVille: boolean;
  /** Nombre de pièces fournies : en deçà de sept, le dossier est incomplet. */
  documentsProvided?: number;
  vehicles: VehicleSpec[];
  wallet?: { balanceFcfa: number; pendingFcfa: number };
}

const DRIVERS: DriverSpec[] = [
  {
    key: "kofi",
    fullName: "Kofi Adjovi",
    email: "kofi.adjovi@example.com",
    phone: "+22997000001",
    baseCity: "Cotonou",
    status: "APPROVED",
    rating: 4.9,
    offersLocationVille: true,
    vehicles: [
      {
        type: "CONFORT",
        brand: "Toyota",
        model: "Corolla",
        plateNumber: "AB-1234-RB",
        seats: 4,
        pricePerDay: 35000,
      },
    ],
    wallet: { balanceFcfa: 42000, pendingFcfa: 22000 },
  },
  {
    key: "amivi",
    fullName: "Amivi Kossi",
    email: "amivi.kossi@example.com",
    phone: "+22890000002",
    baseCity: "Lomé",
    status: "APPROVED",
    rating: 4.7,
    offersLocationVille: true,
    vehicles: [
      {
        type: "SUV",
        brand: "Toyota",
        model: "RAV4",
        plateNumber: "TG-5567-AA",
        seats: 5,
        pricePerDay: 55000,
      },
    ],
    wallet: { balanceFcfa: 118000, pendingFcfa: 46200 },
  },
  {
    key: "seydou",
    fullName: "Seydou Traoré",
    email: "seydou.traore@example.com",
    phone: "+22997000003",
    baseCity: "Cotonou",
    status: "APPROVED",
    rating: 4.5,
    offersLocationVille: true,
    vehicles: [
      {
        type: "ECONOMIQUE",
        brand: "Kia",
        model: "Picanto",
        plateNumber: "AB-7788-RB",
        seats: 4,
        pricePerDay: 22000,
      },
    ],
    wallet: { balanceFcfa: 8500, pendingFcfa: 0 },
  },
  {
    // Agence : deux véhicules sous le même dossier.
    key: "mariam",
    fullName: "Mariam Bello",
    email: "mariam.bello@example.com",
    phone: "+22997000004",
    baseCity: "Cotonou",
    status: "APPROVED",
    rating: 5,
    offersLocationVille: true,
    vehicles: [
      {
        type: "PREMIUM",
        brand: "Mercedes",
        model: "Classe E",
        plateNumber: "AB-9012-RB",
        seats: 4,
        pricePerDay: 85000,
      },
      {
        type: "MINIBUS",
        brand: "Toyota",
        model: "Hiace",
        plateNumber: "AB-9013-RB",
        seats: 14,
        pricePerDay: 78000,
      },
    ],
    wallet: { balanceFcfa: 236000, pendingFcfa: 0 },
  },
  {
    key: "yao",
    fullName: "Yao Mensah",
    email: "yao.mensah@example.com",
    phone: "+22890000005",
    baseCity: "Lomé",
    status: "APPROVED",
    rating: 4.6,
    offersLocationVille: true,
    vehicles: [
      {
        type: "ECONOMIQUE",
        brand: "Toyota",
        model: "Yaris",
        plateNumber: "TG-3321-AA",
        seats: 4,
        pricePerDay: 20000,
      },
    ],
    wallet: { balanceFcfa: 31000, pendingFcfa: 17600 },
  },
  {
    key: "fatou",
    fullName: "Fatou Sowa",
    email: "fatou.sowa@example.com",
    phone: "+22890000006",
    baseCity: "Lomé",
    status: "APPROVED",
    rating: 4.8,
    offersLocationVille: true,
    vehicles: [
      {
        type: "MINIBUS",
        brand: "Mercedes",
        model: "Sprinter",
        plateNumber: "TG-6644-AA",
        seats: 15,
        pricePerDay: 92000,
      },
      {
        type: "CONFORT",
        brand: "Hyundai",
        model: "Elantra",
        plateNumber: "TG-6645-AA",
        seats: 4,
        pricePerDay: 33000,
      },
    ],
    wallet: { balanceFcfa: 74500, pendingFcfa: 0 },
  },
  {
    key: "ibrahim",
    fullName: "Ibrahim Salifou",
    email: "ibrahim.salifou@example.com",
    phone: "+22997000007",
    baseCity: "Cotonou",
    status: "PENDING_REVIEW",
    rating: 0,
    offersLocationVille: true,
    vehicles: [
      {
        type: "CONFORT",
        brand: "Hyundai",
        model: "Sonata",
        plateNumber: "AB-4455-RB",
        seats: 4,
        pricePerDay: 32000,
      },
    ],
  },
  {
    key: "nadia",
    fullName: "Nadia Agbeko",
    email: "nadia.agbeko@example.com",
    phone: "+22890000008",
    baseCity: "Lomé",
    status: "PENDING_REVIEW",
    rating: 0,
    offersLocationVille: true,
    vehicles: [
      {
        type: "SUV",
        brand: "Toyota",
        model: "Prado",
        plateNumber: "TG-8899-AA",
        seats: 7,
        pricePerDay: 68000,
      },
    ],
  },
  {
    // Dossier incomplet : illustre l'écran « pièces manquantes ».
    key: "rachid",
    fullName: "Rachid Ouédraogo",
    email: "rachid.ouedraogo@example.com",
    phone: "+22997000009",
    baseCity: "Cotonou",
    status: "PENDING_DOCUMENTS",
    rating: 0,
    offersLocationVille: false,
    documentsProvided: 3,
    vehicles: [
      {
        type: "ECONOMIQUE",
        brand: "Suzuki",
        model: "Swift",
        plateNumber: "AB-1177-RB",
        seats: 4,
        pricePerDay: 19000,
      },
    ],
  },
  {
    // Dossier refusé : illustre le cas de rejet côté back-office.
    key: "paul",
    fullName: "Paul Houngbé",
    email: "paul.houngbe@example.com",
    phone: "+22997000010",
    baseCity: "Cotonou",
    status: "REJECTED",
    rating: 0,
    offersLocationVille: false,
    vehicles: [
      {
        type: "ECONOMIQUE",
        brand: "Peugeot",
        model: "207",
        plateNumber: "AB-2200-RB",
        seats: 4,
        pricePerDay: 18000,
      },
    ],
  },
];

// --- Réservations du client de démonstration --------------------------------

interface BookingSpec {
  ref: string;
  type: BookingType;
  status: BookingStatus;
  driverKey?: string;
  tranconId?: string;
  vehicleKey?: string;
  departureDays?: number;
  startDays?: number;
  durationDays?: number;
  seats?: number;
  isRoundTrip?: boolean;
  price: number;
  final?: number;
  payment?: { status: PaymentStatus; method: PaymentMethod };
  rating?: { score: number; comment?: string };
  cancelReason?: string;
}

const BOOKINGS: BookingSpec[] = [
  // --- Historique -----------------------------------------------------------
  {
    ref: "FR-10428",
    type: "FRONTALIER",
    status: "COMPLETED",
    driverKey: "kofi",
    tranconId: "trancon-cotonou-lome",
    departureDays: -34,
    seats: 2,
    price: 28000,
    final: 28000,
    payment: { status: "RELEASED", method: "MOMO_MTN" },
    rating: { score: 5, comment: "Chauffeur ponctuel, passage de la frontière très fluide." },
  },
  {
    ref: "FR-23187",
    type: "FRONTALIER",
    status: "COMPLETED",
    driverKey: "amivi",
    tranconId: "trancon-lome-cotonou",
    departureDays: -27,
    seats: 1,
    price: 28000,
    final: 28000,
    payment: { status: "RELEASED", method: "MOMO_MOOV" },
    rating: { score: 4, comment: "Bon trajet, léger retard au départ." },
  },
  {
    ref: "LV-55031",
    type: "LOCATION_VILLE",
    status: "COMPLETED",
    driverKey: "mariam",
    vehicleKey: "mariam-0",
    startDays: -20,
    durationDays: 2,
    price: 170000,
    final: 170000,
    payment: { status: "RELEASED", method: "CARD" },
    rating: { score: 5, comment: "Véhicule impeccable pour nos réunions." },
  },
  {
    ref: "FR-31902",
    type: "FRONTALIER",
    status: "COMPLETED",
    driverKey: "yao",
    tranconId: "trancon-hilacondji-lome",
    departureDays: -12,
    seats: 3,
    price: 13500,
    final: 13500,
    payment: { status: "RELEASED", method: "CASH" },
    rating: { score: 5 },
  },
  {
    ref: "FR-40771",
    type: "FRONTALIER",
    status: "COMPLETED",
    driverKey: "kofi",
    tranconId: "trancon-cotonou-lome",
    departureDays: -6,
    seats: 1,
    isRoundTrip: true,
    price: 56000,
    final: 56000,
    payment: { status: "RELEASED", method: "MOMO_MTN" },
    // Volontairement non notée : l'écran de notation reste atteignable.
  },
  {
    ref: "FR-44120",
    type: "FRONTALIER",
    status: "CANCELLED",
    tranconId: "trancon-cotonou-aneho",
    departureDays: -4,
    seats: 2,
    price: 22500,
    payment: { status: "REFUNDED", method: "MOMO_MTN" },
    cancelReason: "Réunion reportée",
  },
  {
    ref: "LV-61234",
    type: "LOCATION_VILLE",
    status: "DISPUTED",
    driverKey: "seydou",
    vehicleKey: "seydou-0",
    startDays: -3,
    durationDays: 1,
    price: 22000,
    final: 22000,
    payment: { status: "ESCROW_HELD", method: "MOMO_MOOV" },
  },

  // --- En cours -------------------------------------------------------------
  {
    ref: "FR-52318",
    type: "FRONTALIER",
    status: "IN_PROGRESS",
    driverKey: "amivi",
    tranconId: "trancon-lome-cotonou",
    departureDays: 0,
    seats: 1,
    price: 28000,
    payment: { status: "ESCROW_HELD", method: "MOMO_MOOV" },
  },
  {
    ref: "LV-77315",
    type: "LOCATION_VILLE",
    status: "DRIVER_ASSIGNED",
    driverKey: "kofi",
    vehicleKey: "kofi-0",
    startDays: 2,
    durationDays: 3,
    price: 105000,
    payment: { status: "ESCROW_HELD", method: "MOMO_MTN" },
  },

  // --- À venir, sans chauffeur : nourrit l'écran « courses disponibles » -----
  {
    ref: "FR-55901",
    type: "FRONTALIER",
    status: "CONFIRMED",
    tranconId: "trancon-cotonou-lome",
    departureDays: 3,
    seats: 4,
    price: 56000,
    isRoundTrip: true,
    payment: { status: "ESCROW_HELD", method: "CARD" },
  },
  {
    ref: "FR-56744",
    type: "FRONTALIER",
    status: "CONFIRMED",
    tranconId: "trancon-cotonou-hilacondji",
    departureDays: 5,
    seats: 2,
    price: 16500,
    payment: { status: "ESCROW_HELD", method: "MOMO_MTN" },
  },

  // --- En attente de paiement ----------------------------------------------
  {
    ref: "LV-88024",
    type: "LOCATION_VILLE",
    status: "AWAITING_PAYMENT",
    vehicleKey: "amivi-0",
    startDays: 6,
    durationDays: 1,
    price: 55000,
  },
  {
    ref: "FR-90118",
    type: "FRONTALIER",
    status: "AWAITING_PAYMENT",
    tranconId: "trancon-cotonou-aneho",
    departureDays: 9,
    seats: 1,
    price: 22500,
  },
];

// --- Demandes de retrait ----------------------------------------------------

const WITHDRAWALS = [
  { id: "seed-wd-1", driverKey: "mariam", amountFcfa: 150000, status: "REQUESTED" as const, days: -1 },
  { id: "seed-wd-2", driverKey: "amivi", amountFcfa: 60000, status: "REQUESTED" as const, days: -2 },
  { id: "seed-wd-3", driverKey: "kofi", amountFcfa: 25000, status: "PAID" as const, days: -9 },
];

async function main() {
  // --- Administrateur -------------------------------------------------------
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

  // --- Trançons -------------------------------------------------------------
  for (const trancon of TRONCONS) {
    await prisma.trancon.upsert({
      where: { id: trancon.id },
      update: trancon,
      create: trancon,
    });
  }

  // --- Chauffeurs, véhicules, pièces, portefeuilles --------------------------
  const driverIds: Record<string, string> = {};
  const vehicleIds: Record<string, string> = {};

  for (const spec of DRIVERS) {
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
        offersLocationVille: spec.offersLocationVille,
        ratingAverage: spec.rating,
        isOnline: spec.status === "APPROVED",
      },
    });
    driverIds[spec.key] = driver.id;

    const provided = ALL_DOCUMENTS.slice(0, spec.documentsProvided ?? ALL_DOCUMENTS.length);
    for (const type of provided) {
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

    for (const [index, vehicle] of spec.vehicles.entries()) {
      const id = `seed-vehicle-${spec.key}-${index}`;
      await prisma.vehicle.upsert({
        where: { id },
        update: vehicle,
        create: { id, driverId: driver.id, ...vehicle },
      });
      vehicleIds[`${spec.key}-${index}`] = id;
    }

    if (spec.wallet) {
      await prisma.driverWallet.upsert({
        where: { driverId: driver.id },
        update: {},
        create: { driverId: driver.id, ...spec.wallet },
      });
    }
  }

  // --- Client de démonstration ----------------------------------------------
  const client = await prisma.user.upsert({
    where: { email: CLIENT_EMAIL },
    update: {},
    create: {
      id: "seed-client",
      email: CLIENT_EMAIL,
      phone: "+22996000010",
      fullName: "Awa Diallo",
      emailVerified: true,
      phoneVerified: true,
    },
  });

  // --- Réservations ----------------------------------------------------------
  for (const [index, spec] of BOOKINGS.entries()) {
    const id = `seed-booking-${index + 1}`;
    const startAt = spec.startDays !== undefined ? at(spec.startDays) : null;
    const endAt =
      startAt && spec.durationDays
        ? at(spec.startDays! + spec.durationDays)
        : null;

    const data = {
      reference: spec.ref,
      type: spec.type,
      status: spec.status,
      clientId: client.id,
      driverId: spec.driverKey ? driverIds[spec.driverKey] : null,
      vehicleId: spec.vehicleKey ? vehicleIds[spec.vehicleKey] : null,
      tranconId: spec.tranconId ?? null,
      departureAt: spec.departureDays !== undefined ? at(spec.departureDays) : null,
      startAt,
      endAt,
      durationDays: spec.durationDays ?? null,
      seats: spec.seats ?? 1,
      isRoundTrip: spec.isRoundTrip ?? false,
      city: spec.vehicleKey
        ? DRIVERS.find((d) => d.key === spec.vehicleKey!.split("-")[0])!.baseCity
        : null,
      vehicleType: spec.vehicleKey
        ? (() => {
            const [key, idx] = spec.vehicleKey!.split("-");
            return DRIVERS.find((d) => d.key === key)!.vehicles[Number(idx)].type;
          })()
        : null,
      estimatedPriceFcfa: spec.price,
      finalPriceFcfa: spec.final ?? null,
      completedAt: spec.status === "COMPLETED" ? at(spec.departureDays ?? spec.startDays ?? 0) : null,
      startedAt: ["IN_PROGRESS", "COMPLETED"].includes(spec.status)
        ? at(spec.departureDays ?? spec.startDays ?? 0)
        : null,
      cancelledAt: spec.status === "CANCELLED" ? at(spec.departureDays ?? 0) : null,
      cancelReason: spec.cancelReason ?? null,
      acceptedAt: spec.driverKey ? at((spec.departureDays ?? spec.startDays ?? 0) - 1) : null,
    };

    await prisma.booking.upsert({
      where: { id },
      update: { status: spec.status },
      create: { id, ...data },
    });

    if (spec.payment) {
      await prisma.payment.upsert({
        where: { bookingId: id },
        update: { status: spec.payment.status },
        create: {
          bookingId: id,
          method: spec.payment.method,
          status: spec.payment.status,
          amountFcfa: spec.price,
          advanceFcfa:
            spec.type === "LOCATION_VILLE" ? Math.round(spec.price * 0.3) : null,
          escrowReleaseAt:
            spec.payment.status === "ESCROW_HELD" ? at(1) : null,
        },
      });
    }

    if (spec.rating && spec.driverKey) {
      await prisma.rating.upsert({
        where: { bookingId: id },
        update: {},
        create: {
          bookingId: id,
          clientId: client.id,
          driverId: driverIds[spec.driverKey],
          score: spec.rating.score,
          comment: spec.rating.comment ?? null,
        },
      });
    }
  }

  // --- Retraits --------------------------------------------------------------
  for (const spec of WITHDRAWALS) {
    const wallet = await prisma.driverWallet.findUnique({
      where: { driverId: driverIds[spec.driverKey] },
    });
    if (!wallet) continue;

    await prisma.withdrawalRequest.upsert({
      where: { id: spec.id },
      update: { status: spec.status },
      create: {
        id: spec.id,
        walletId: wallet.id,
        amountFcfa: spec.amountFcfa,
        status: spec.status,
        destination: DRIVERS.find((d) => d.key === spec.driverKey)!.phone,
        createdAt: at(spec.days),
        settledAt: spec.status === "PAID" ? at(spec.days + 2) : null,
      },
    });
  }

  const counts = {
    troncons: TRONCONS.length,
    drivers: DRIVERS.length,
    approved: DRIVERS.filter((d) => d.status === "APPROVED").length,
    pending: DRIVERS.filter((d) => d.status === "PENDING_REVIEW").length,
    vehicles: DRIVERS.reduce((n, d) => n + d.vehicles.length, 0),
    bookings: BOOKINGS.length,
    withdrawals: WITHDRAWALS.length,
  };

  console.log(`Seed terminé.

  Comptes
    Admin        ${admin.email}
    Client démo  ${client.email}          (historique de ${counts.bookings} courses)
    Chauffeur    kofi.adjovi@example.com

  Données
    Trançons     ${counts.troncons}
    Chauffeurs   ${counts.drivers}  (${counts.approved} validés, ${counts.pending} à contrôler)
    Véhicules    ${counts.vehicles}
    Réservations ${counts.bookings}
    Retraits     ${counts.withdrawals}

  Connexion : les codes OTP sont renvoyés par l'API hors production.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
