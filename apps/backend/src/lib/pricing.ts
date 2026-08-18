import type { Trancon, Vehicle } from "@prisma/client";

/** Part du total exigée à la réservation pour une location ville. */
export const ADVANCE_RATIO = 0.3;

/** Commission FrontiRide par volet, telle que définie au cahier des charges. */
export const COMMISSION_RATE = {
  FRONTALIER: 0.12,
  LOCATION_VILLE: 0.17,
} as const;

export interface PriceBreakdown {
  baseFcfa: number;
  customsFcfa: number;
  totalFcfa: number;
}

export function frontalierPrice(
  trancon: Pick<Trancon, "priceFcfa" | "estimatedCustomsFeeFcfa">,
  options: { isRoundTrip: boolean }
): PriceBreakdown {
  const legs = options.isRoundTrip ? 2 : 1;
  const baseFcfa = trancon.priceFcfa * legs;
  const customsFcfa = trancon.estimatedCustomsFeeFcfa * legs;
  return { baseFcfa, customsFcfa, totalFcfa: baseFcfa + customsFcfa };
}

export function locationPrice(
  vehicle: Pick<Vehicle, "pricePerDay">,
  options: { durationDays: number }
): PriceBreakdown {
  const baseFcfa = (vehicle.pricePerDay ?? 0) * options.durationDays;
  return { baseFcfa, customsFcfa: 0, totalFcfa: baseFcfa };
}

export function advanceFor(totalFcfa: number): number {
  return Math.round(totalFcfa * ADVANCE_RATIO);
}

/** Part reversée au chauffeur une fois la commission FrontiRide déduite. */
export function driverEarnings(totalFcfa: number, commissionRate: number): number {
  return Math.round(totalFcfa * (1 - commissionRate));
}
