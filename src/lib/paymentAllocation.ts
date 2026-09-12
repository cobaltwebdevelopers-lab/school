export interface FeeTierBalance {
  feeTierId: string;
  tierName: string;
  priority: number;
  amountDue: number;
  amountPaid: number;
}

export interface AllocationLine {
  feeTierId: string;
  tierName: string;
  amount: number;
}

export interface AllocationResult {
  allocations: AllocationLine[];
  /** Any amount left over after every tier's outstanding balance is fully covered. */
  overpayment: number;
}

/**
 * Allocates an incoming payment across a student's fee tiers in priority order
 * (e.g. Boarding first, then Tuition, then Transport), filling each tier's
 * outstanding balance before moving to the next. Any amount left after every
 * tier is fully paid is returned as `overpayment` (a credit for next term).
 */
export function allocatePayment(amount: number, balances: FeeTierBalance[]): AllocationResult {
  const sorted = [...balances].sort((a, b) => a.priority - b.priority);
  let remaining = amount;
  const allocations: AllocationLine[] = [];

  for (const tier of sorted) {
    if (remaining <= 0) break;
    const outstanding = Math.max(0, tier.amountDue - tier.amountPaid);
    if (outstanding <= 0) continue;

    const allocated = Math.min(remaining, outstanding);
    allocations.push({ feeTierId: tier.feeTierId, tierName: tier.tierName, amount: allocated });
    remaining -= allocated;
  }

  return { allocations, overpayment: Math.max(0, remaining) };
}
