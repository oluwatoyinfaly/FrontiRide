export type BookingType = "FRONTALIER" | "LOCATION_VILLE";

export type BookingStatus =
  | "DRAFT"
  | "AWAITING_PAYMENT"
  | "CONFIRMED"
  | "DRIVER_ASSIGNED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED"
  | "DISPUTED";

export type VehicleType =
  | "ECONOMIQUE"
  | "CONFORT"
  | "SUV"
  | "PREMIUM"
  | "MINIBUS";

export type DocumentType =
  | "CNI"
  | "PERMIS"
  | "CARTE_GRISE"
  | "ASSURANCE"
  | "VISITE_TECHNIQUE"
  | "CASIER_JUDICIAIRE"
  | "PHOTO_VEHICULE";

export type DriverStatus =
  | "PENDING_DOCUMENTS"
  | "PENDING_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "SUSPENDED";

export type PaymentMethod = "MOMO_MTN" | "MOMO_MOOV" | "CARD" | "CASH";

export type PaymentStatus =
  | "PENDING"
  | "ESCROW_HELD"
  | "RELEASED"
  | "REFUNDED"
  | "FAILED";

export interface User {
  id: string;
  role: "CLIENT" | "DRIVER" | "ADMIN";
  email: string;
  phone: string;
  fullName: string | null;
  photoUrl: string | null;
  idDocumentUrl: string | null;
  emailVerified: boolean;
  phoneVerified: boolean;
  locale: string;
  driverProfile?: { id: string; status: DriverStatus } | null;
}

export interface Trancon {
  id: string;
  originCity: string;
  destinationCity: string;
  borderPoint: string | null;
  priceFcfa: number;
  estimatedCustomsFeeFcfa: number;
  active: boolean;
}

export interface Vehicle {
  id: string;
  type: VehicleType;
  brand: string | null;
  model: string | null;
  plateNumber: string;
  seats: number;
  pricePerDay: number | null;
  photoUrl: string | null;
  driver?: {
    id: string;
    baseCity: string | null;
    ratingAverage: number;
    user: { fullName: string | null };
  };
}

export interface Payment {
  id: string;
  method: PaymentMethod;
  status: PaymentStatus;
  amountFcfa: number;
  advanceFcfa: number | null;
  escrowReleaseAt: string | null;
}

export interface Rating {
  id: string;
  score: number;
  comment: string | null;
}

/** Côté depuis lequel l'utilisateur voit une course : il peut être les deux. */
export type BookingRole = "CLIENT" | "DRIVER";

export interface Booking {
  id: string;
  role: BookingRole;
  client: { fullName: string | null; phone?: string } | null;
  reference: string;
  type: BookingType;
  status: BookingStatus;
  departureAt: string | null;
  startAt: string | null;
  durationDays: number | null;
  isRoundTrip: boolean;
  seats: number;
  city: string | null;
  vehicleType: VehicleType | null;
  estimatedPriceFcfa: number | null;
  finalPriceFcfa: number | null;
  createdAt: string;
  trancon: Trancon | null;
  payment: Payment | null;
  rating: Rating | null;
  vehicle: Pick<Vehicle, "id" | "type" | "brand" | "model" | "seats"> | null;
  driver: {
    id: string;
    ratingAverage: number;
    user: { fullName: string | null; phone: string; photoUrl: string | null };
  } | null;
}

export interface PriceBreakdown {
  baseFcfa: number;
  customsFcfa: number;
  totalFcfa: number;
}

export interface DriverDocument {
  id: string;
  type: DocumentType;
  fileUrl: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
}

export interface Wallet {
  id: string;
  balanceFcfa: number;
  pendingFcfa: number;
  commissionRate: number;
  withdrawals: {
    id: string;
    amountFcfa: number;
    status: string;
    createdAt: string;
  }[];
}

export interface DriverProfile {
  id: string;
  status: DriverStatus;
  isOnline: boolean;
  baseCity: string | null;
  offersFrontalier: boolean;
  offersLocationVille: boolean;
  ratingAverage: number;
  user: { fullName: string | null; email: string; phone: string };
  vehicles: Vehicle[];
  documents: DriverDocument[];
  wallet: Wallet | null;
  missingDocuments: DocumentType[];
}

/**
 * Course telle que vue depuis l'espace chauffeur. Les routes /driver/rides ne
 * renvoient pas de rôle : de ce côté-là, il n'y a pas d'ambiguïté.
 */
export interface DriverRide
  extends Omit<Booking, "driver" | "vehicle" | "role"> {
  client: { fullName: string | null; phone?: string };
}
