import { House, RenovationBudget, UserProfile } from "./types";

/**
 * Conservative mortgage calculator.
 * Assumptions:
 * - 20% down payment
 * - 30-year fixed rate
 * - Interest rate tiered by credit score (conservative estimates)
 * - Property tax, HOA, and homeowner's insurance included in monthly
 * - DTI target: monthly payment ≤ 28% of gross monthly income (front-end ratio)
 */

function getInterestRate(creditScore: number): number {
  if (creditScore >= 760) return 6.5;
  if (creditScore >= 720) return 6.75;
  if (creditScore >= 680) return 7.0;
  if (creditScore >= 660) return 7.25;
  if (creditScore >= 640) return 7.5;
  if (creditScore >= 620) return 7.875;
  return 8.5; // below 620
}

function getPmiRate(creditScore: number): number {
  // PMI annual rate as fraction of loan amount
  if (creditScore >= 760) return 0.0055;
  if (creditScore >= 720) return 0.0065;
  if (creditScore >= 680) return 0.0075;
  if (creditScore >= 660) return 0.0085;
  if (creditScore >= 640) return 0.0095;
  if (creditScore >= 620) return 0.011;
  return 0.014;
}

/**
 * Normalize property tax rate.
 * Zillow returns tax rate as percentage value (e.g. 1.25 = 1.25%).
 * But some data may already be stored as decimal (0.0125).
 * Heuristic: if value >= 0.1, treat as percentage; else treat as decimal.
 */
export function normalizeTaxRate(rawRate: number | null): number | null {
  if (rawRate == null) return null;
  // If it's >= 0.1 it's likely a percentage (e.g. 1.25 = 1.25%)
  // If it's < 0.1 it's likely already a decimal (e.g. 0.0125 = 1.25%)
  return rawRate >= 0.1 ? rawRate / 100 : rawRate;
}

export interface MortgageEstimate {
  monthlyPayment: number;
  monthlyBreakdown: {
    principalInterest: number;
    propertyTax: number;
    hoa: number;
    insurance: number;
    pmi: number;
  };
  annualTax: number;
  totalMonthlyCost: number;
  cashNeeded: {
    downPayment: number;
    estimatedClosingCosts: number;
    total: number;
  };
  dtiRatio: number | null; // null if no income provided
  affordabilityRating: string;
  interestRate: number;
  /** First-year total cost including purchase, repairs, and renovations */
  firstYearCost: FirstYearCost | null;
}

export interface FirstYearCost {
  purchasePrice: number;
  downPayment: number;
  closingCosts: number;
  immediateRepairs: number;
  desiredRenovations: number;
  annualMaintenance: number;
  totalFirstYear: number;
}

export function calculateMortgage(
  house: House,
  profile?: UserProfile | null,
  renovationBudget?: RenovationBudget | null
): MortgageEstimate {
  const price = house.price ?? 0;
  const taxRate = normalizeTaxRate(house.propertyTaxRate);
  const hoaMonthly = house.hoaMonthly ?? 0;

  // Use profile or defaults (conservative fallback)
  const creditScore = profile?.creditScore ?? 680;
  const income = profile?.income ?? 0;
  const hasProfile = income > 0;

  // Interest rate based on credit score
  const annualRate = getInterestRate(creditScore);
  const monthlyRate = annualRate / 100 / 12;

  // 20% down payment
  const downPaymentPercent = 0.2;
  const downPayment = price * downPaymentPercent;
  const loanAmount = price - downPayment;

  // 30-year fixed (360 months)
  const termMonths = 360;

  // Monthly P&I via amortization formula: M = P * r(1+r)^n / ((1+r)^n - 1)
  let principalInterest = 0;
  if (monthlyRate > 0 && loanAmount > 0) {
    const pow = Math.pow(1 + monthlyRate, termMonths);
    principalInterest = loanAmount * (monthlyRate * pow) / (pow - 1);
  }

  // PMI (if down payment < 20%)
  let pmi = 0;
  if (downPaymentPercent < 0.2 && loanAmount > 0) {
    const pmiAnnualRate = getPmiRate(creditScore);
    pmi = (loanAmount * pmiAnnualRate) / 12;
  }
  // Note: with 20% down, PMI is 0 — this is conservative

  // Property tax (monthly)
  const annualTax = taxRate ? price * taxRate : 0;
  const monthlyTax = annualTax / 12;

  // Homeowner's insurance (~0.35% annually, conservative)
  const annualInsuranceRate = 0.0035;
  const monthlyInsurance = (price * annualInsuranceRate) / 12;

  // Total monthly
  const totalMonthlyCost =
    principalInterest + monthlyTax + hoaMonthly + monthlyInsurance + pmi;

  // Cash needed
  const closingCosts = price * 0.03; // ~3% of purchase price
  const totalCash = downPayment + closingCosts;

  // DTI ratio (front-end: housing / gross monthly income)
  const monthlyIncome = income / 12;
  const dtiRatio = hasProfile ? totalMonthlyCost / monthlyIncome : null;

  // Affordability rating
  let affordabilityRating = "Unknown";
  if (hasProfile && price > 0) {
    if (dtiRatio! <= 0.28) {
      affordabilityRating = "Comfortable";
    } else if (dtiRatio! <= 0.36) {
      affordabilityRating = "Moderate";
    } else if (dtiRatio! <= 0.43) {
      affordabilityRating = "Stretched";
    } else {
      affordabilityRating = "Difficult";
    }
  }

  // First-year cost calculation (with renovation budget)
  let firstYearCost: MortgageEstimate["firstYearCost"] = null;
  if (renovationBudget || price > 0) {
    const immediateRepairs = renovationBudget?.immediateRepairs ?? 0;
    const desiredRenovations = renovationBudget?.desiredRenovations ?? 0;
    const annualMaintenancePct =
      renovationBudget?.annualMaintenancePercent ?? 0.01;
    const annualMaintenance = price * annualMaintenancePct;
    firstYearCost = {
      purchasePrice: price,
      downPayment: Math.round(downPayment),
      closingCosts: Math.round(closingCosts),
      immediateRepairs,
      desiredRenovations,
      annualMaintenance: Math.round(annualMaintenance),
      totalFirstYear: Math.round(
        downPayment + closingCosts + immediateRepairs + desiredRenovations + annualMaintenance
      ),
    };
  }

  return {
    monthlyPayment: Math.round(totalMonthlyCost),
    monthlyBreakdown: {
      principalInterest: Math.round(principalInterest),
      propertyTax: Math.round(monthlyTax),
      hoa: hoaMonthly,
      insurance: Math.round(monthlyInsurance),
      pmi: Math.round(pmi),
    },
    annualTax: Math.round(annualTax),
    totalMonthlyCost: Math.round(totalMonthlyCost),
    cashNeeded: {
      downPayment: Math.round(downPayment),
      estimatedClosingCosts: Math.round(closingCosts),
      total: Math.round(totalCash),
    },
    dtiRatio,
    affordabilityRating,
    interestRate: annualRate,
    firstYearCost,
  };
}
