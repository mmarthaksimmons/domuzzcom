/**
 * FSBO (For Sale By Owner) Savings Calculator
 *
 * Calculates how much a homeowner can save by selling without a listing agent.
 *
 * Typical US real estate commission structure:
 * - Total commission is usually 5-6% of sale price
 * - Split roughly 50/50 between listing agent and buyer's agent
 * - When selling FSBO, the seller saves the listing agent portion (~2.5-3%)
 * - The seller may still offer a buyer's agent commission (~2.5-3%) to attract buyers
 */

export interface FsboInputs {
  /** Home sale price in USD */
  homePrice: number;
  /** Listing agent commission rate as a percentage (e.g. 3 = 3%) */
  listingAgentCommission: number;
  /** Buyer's agent commission rate the seller is willing to offer (e.g. 2.5 = 2.5%) */
  buyersAgentCommission: number;
  /** Flat fee for MLS listing service (FSBO sellers often pay a flat fee to list on MLS) */
  flatFeeMls: number;
  /** Additional selling costs as percentage (e.g. closing costs seller may cover ~1-2%) */
  additionalSellingCostsPercent: number;
  /** Estimated remaining mortgage balance to pay off at closing */
  remainingMortgage: number;
}

export interface FsboResult {
  /** Total commission with an agent */
  totalCommissionWithAgent: number;
  /** Net proceeds after commissions with an agent (before mortgage payoff) */
  netProceedsWithAgent: number;
  /** Total costs when selling FSBO (buyer's agent commission + MLS flat fee + additional) */
  totalCostsFsbo: number;
  /** Net proceeds when selling FSBO (before mortgage payoff) */
  netProceedsFsbo: number;
  /** Total savings when selling FSBO */
  savings: number;
  /** Savings as a percentage of home price */
  savingsPercent: number;
  /** The effective listing agent commission saved */
  listingAgentCommissionSaved: number;
  /** Cash in pocket with agent (after mortgage payoff) */
  cashInPocketWithAgent: number;
  /** Cash in pocket FSBO (after mortgage payoff) */
  cashInPocketFsbo: number;
}

export const DEFAULT_FSBO_INPUTS: FsboInputs = {
  homePrice: 500_000,
  listingAgentCommission: 3,
  buyersAgentCommission: 2.5,
  flatFeeMls: 500,
  additionalSellingCostsPercent: 1,
  remainingMortgage: 300_000,
};

export function calculateFsboSavings(inputs: FsboInputs): FsboResult {
  const { homePrice, listingAgentCommission, buyersAgentCommission, flatFeeMls, additionalSellingCostsPercent, remainingMortgage } = inputs;

  // With a listing agent
  const listingAgentFee = homePrice * (listingAgentCommission / 100);
  const buyersAgentFee = homePrice * (buyersAgentCommission / 100);
  const totalCommissionWithAgent = listingAgentFee + buyersAgentFee;
  const additionalCosts = homePrice * (additionalSellingCostsPercent / 100);
  const netProceedsWithAgent = homePrice - totalCommissionWithAgent - additionalCosts;

  // FSBO: no listing agent commission, just buyer's agent + flat MLS fee + additional costs
  const totalCostsFsbo = buyersAgentFee + flatFeeMls + additionalCosts;
  const netProceedsFsbo = homePrice - totalCostsFsbo;

  const savings = netProceedsFsbo - netProceedsWithAgent;
  const savingsPercent = (savings / homePrice) * 100;
  const listingAgentCommissionSaved = listingAgentFee;

  // Cash in pocket after paying off mortgage
  const cashInPocketWithAgent = netProceedsWithAgent - remainingMortgage;
  const cashInPocketFsbo = netProceedsFsbo - remainingMortgage;

  return {
    totalCommissionWithAgent: Math.round(totalCommissionWithAgent),
    netProceedsWithAgent: Math.round(netProceedsWithAgent),
    totalCostsFsbo: Math.round(totalCostsFsbo),
    netProceedsFsbo: Math.round(netProceedsFsbo),
    savings: Math.round(savings),
    savingsPercent: Math.round(savingsPercent * 100) / 100,
    listingAgentCommissionSaved: Math.round(listingAgentCommissionSaved),
    cashInPocketWithAgent: Math.round(cashInPocketWithAgent),
    cashInPocketFsbo: Math.round(cashInPocketFsbo),
  };
}

/** Format a number as USD currency string */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}