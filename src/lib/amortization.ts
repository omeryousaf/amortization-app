export type PaymentFrequency =
  | "monthly"
  | "quarterly"
  | "semiannual"
  | "annual"
  | "biweekly";

export type GraceTreatment = "capitalize" | "accrue" | "subsidized";

export const FREQUENCY_META: Record<
  PaymentFrequency,
  { label: string; periodsPerYear: number; hint: string }
> = {
  monthly: {
    label: "Monthly",
    periodsPerYear: 12,
    hint: "12 payments per year",
  },
  quarterly: {
    label: "Quarterly",
    periodsPerYear: 4,
    hint: "4 payments per year",
  },
  semiannual: {
    label: "Semiannual",
    periodsPerYear: 2,
    hint: "2 payments per year",
  },
  annual: {
    label: "Annual",
    periodsPerYear: 1,
    hint: "1 payment per year",
  },
  biweekly: {
    label: "Biweekly",
    periodsPerYear: 26,
    hint: "26 payments per year",
  },
};

export const TREATMENT_META: Record<
  GraceTreatment,
  { label: string; summary: string }
> = {
  capitalize: {
    label: "Capitalize into principal",
    summary:
      "Interest accrues during grace and is added to principal when repayment starts. The new balance is then amortized over the remaining term.",
  },
  accrue: {
    label: "Accrue separately",
    summary:
      "Principal does not change during grace. Interest collects in a non-interest-bearing bucket. After grace, interest is charged only on principal. Each payment covers current interest, then the accrued bucket, then principal. The last payment absorbs any leftover accrued interest.",
  },
  subsidized: {
    label: "Lender-subsidized",
    summary:
      "No borrower interest during grace. After grace, the original principal is amortized over the remaining term.",
  },
};

export interface LoanInput {
  principal: number;
  annualRatePercent: number;
  termYears: number;
  frequency: PaymentFrequency;
  startDate: string;
  graceMonths: number;
  treatment: GraceTreatment;
}

export interface ScheduleRow {
  period: number;
  date: string;
  phase: "grace" | "repayment";
  payment: number;
  interest: number;
  principal: number;
  accruedApplied: number;
  accruedBalance: number;
  principalBalance: number;
  capitalized: number;
  /** Annualized IRR to this period, percent (same compounding basis as the loan rate). */
  irrAnnualPercent: number | null;
}

export interface ScheduleTotals {
  paid: number;
  interest: number;
  principal: number;
  accruedApplied: number;
  capitalized: number;
}

export interface ScheduleResult {
  input: LoanInput;
  periodicRate: number;
  periodsPerYear: number;
  totalPeriods: number;
  gracePeriods: number;
  repaymentPeriods: number;
  scheduledPayment: number;
  rows: ScheduleRow[];
  totals: ScheduleTotals;
  /** Full-term annualized IRR, percent. */
  irrAnnualPercent: number | null;
  showAccrued: boolean;
  showCapitalized: boolean;
}

export interface ComparisonRow {
  treatment: GraceTreatment;
  scheduledPayment: number;
  totalPaid: number;
  totalInterest: number;
  irrAnnualPercent: number | null;
  firstRepaymentDate: string | null;
}

export type FieldKey =
  | "principal"
  | "annualRatePercent"
  | "termYears"
  | "frequency"
  | "startDate"
  | "graceMonths"
  | "treatment";

export type FieldErrors = Partial<Record<FieldKey, string>>;

export interface ParseSuccess {
  ok: true;
  input: LoanInput;
}

export interface ParseFailure {
  ok: false;
  errors: FieldErrors;
  empty: boolean;
}

export function roundCents(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function npv(rate: number, cashFlows: number[]): number {
  let total = 0;
  for (let t = 0; t < cashFlows.length; t += 1) {
    total += cashFlows[t] / (1 + rate) ** t;
  }
  return total;
}

/** Periodic IRR for cash flows at t = 0, 1, 2, … or null if undefined. */
export function periodicIrr(cashFlows: number[]): number | null {
  const hasInflow = cashFlows.some((cf) => cf > 1e-9);
  const hasOutflow = cashFlows.some((cf) => cf < -1e-9);
  if (!hasInflow || !hasOutflow) return null;

  let rate = 0.01;
  for (let i = 0; i < 40; i += 1) {
    let value = 0;
    let derivative = 0;
    for (let t = 0; t < cashFlows.length; t += 1) {
      const denom = (1 + rate) ** t;
      value += cashFlows[t] / denom;
      if (t > 0) {
        derivative -= (t * cashFlows[t]) / (1 + rate) ** (t + 1);
      }
    }
    if (Math.abs(value) < 1e-10) return rate;
    if (Math.abs(derivative) < 1e-16) break;
    const next = rate - value / derivative;
    if (!Number.isFinite(next) || next <= -0.999999) break;
    rate = next;
  }

  let low = -0.999999;
  let high = 20;
  let npvLow = npv(low, cashFlows);
  let npvHigh = npv(high, cashFlows);
  if (npvLow * npvHigh > 0) return null;

  for (let i = 0; i < 80; i += 1) {
    const mid = (low + high) / 2;
    const npvMid = npv(mid, cashFlows);
    if (Math.abs(npvMid) < 1e-12) return mid;
    if (npvLow * npvMid <= 0) {
      high = mid;
      npvHigh = npvMid;
    } else {
      low = mid;
      npvLow = npvMid;
    }
  }
  return (low + high) / 2;
}

export function annualizedIrrPercent(
  periodic: number | null,
  periodsPerYear: number,
): number | null {
  if (periodic === null) return null;
  return periodic * periodsPerYear * 100;
}

export function periodsPerYear(frequency: PaymentFrequency): number {
  return FREQUENCY_META[frequency].periodsPerYear;
}

export function gracePeriodCount(
  graceMonths: number,
  frequency: PaymentFrequency,
): number {
  if (graceMonths <= 0) return 0;
  return Math.round((graceMonths / 12) * periodsPerYear(frequency));
}

export function scheduledPayment(
  principal: number,
  periodicRate: number,
  n: number,
): number {
  if (n <= 0) return 0;
  if (periodicRate === 0) return roundCents(principal / n);
  const factor = (1 + periodicRate) ** n;
  return roundCents((principal * (periodicRate * factor)) / (factor - 1));
}

function parseISODate(iso: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

export function formatISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addMonths(date: Date, months: number): Date {
  const day = date.getDate();
  const next = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const lastDay = new Date(
    next.getFullYear(),
    next.getMonth() + 1,
    0,
  ).getDate();
  next.setDate(Math.min(day, lastDay));
  return next;
}

export function addPeriods(
  start: Date,
  count: number,
  frequency: PaymentFrequency,
): Date {
  switch (frequency) {
    case "monthly":
      return addMonths(start, count);
    case "quarterly":
      return addMonths(start, count * 3);
    case "semiannual":
      return addMonths(start, count * 6);
    case "annual":
      return addMonths(start, count * 12);
    case "biweekly": {
      const next = new Date(start.getTime());
      next.setDate(next.getDate() + count * 14);
      return next;
    }
  }
}

function isEmpty(value: string): boolean {
  return value.trim() === "";
}

function parsePositiveNumber(value: string): number | null {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function parseNonNegativeNumber(value: string): number | null {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

function parseIntegerNonNegative(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "") return 0;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0) return null;
  if (!Number.isInteger(n)) return null;
  return n;
}

export interface FormValues {
  principal: string;
  annualRatePercent: string;
  termYears: string;
  frequency: PaymentFrequency;
  startDate: string;
  graceMonths: string;
  treatment: GraceTreatment;
}

export function parseLoanForm(values: FormValues): ParseSuccess | ParseFailure {
  const errors: FieldErrors = {};
  const empty =
    isEmpty(values.principal) &&
    isEmpty(values.annualRatePercent) &&
    isEmpty(values.termYears) &&
    isEmpty(values.graceMonths);

  if (isEmpty(values.principal)) {
    errors.principal = "Enter the loan principal.";
  } else if (parsePositiveNumber(values.principal) === null) {
    errors.principal = "Principal must be a number greater than zero.";
  }

  if (isEmpty(values.annualRatePercent)) {
    errors.annualRatePercent = "Enter the annual interest rate.";
  } else if (parseNonNegativeNumber(values.annualRatePercent) === null) {
    errors.annualRatePercent =
      "Annual rate must be zero or a positive number (for example 6.5).";
  }

  if (isEmpty(values.termYears)) {
    errors.termYears = "Enter the term in years.";
  } else if (parsePositiveNumber(values.termYears) === null) {
    errors.termYears = "Term must be a number greater than zero.";
  }

  if (!(values.frequency in FREQUENCY_META)) {
    errors.frequency = "Choose a payment frequency.";
  }

  if (isEmpty(values.startDate)) {
    errors.startDate = "Enter the loan start date.";
  } else if (!parseISODate(values.startDate)) {
    errors.startDate = "Start date must be a valid calendar date.";
  }

  let graceMonths = 0;
  if (isEmpty(values.graceMonths)) {
    graceMonths = 0;
  } else {
    const parsedGrace = parseIntegerNonNegative(values.graceMonths);
    if (parsedGrace === null) {
      errors.graceMonths =
        "Grace period must be a whole number of months (0 for none).";
    } else {
      graceMonths = parsedGrace;
    }
  }

  if (graceMonths > 0 && !(values.treatment in TREATMENT_META)) {
    errors.treatment = "Choose how grace-period interest is treated.";
  }

  const principal = parsePositiveNumber(values.principal);
  const annualRatePercent = parseNonNegativeNumber(values.annualRatePercent);
  const termYears = parsePositiveNumber(values.termYears);
  const frequency = values.frequency;

  if (
    principal !== null &&
    annualRatePercent !== null &&
    termYears !== null &&
    !errors.graceMonths &&
    !errors.frequency
  ) {
    const total = Math.round(termYears * periodsPerYear(frequency));
    const grace = gracePeriodCount(graceMonths, frequency);

    if (graceMonths > 0 && grace === 0) {
      errors.graceMonths =
        "This grace period is shorter than one payment period at the selected frequency. Increase grace months or choose a more frequent schedule.";
    } else if (grace >= total) {
      errors.graceMonths =
        "Grace must leave at least one repayment period. Shorten grace or lengthen the term.";
    }
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors, empty };
  }

  return {
    ok: true,
    input: {
      principal: principal as number,
      annualRatePercent: annualRatePercent as number,
      termYears: termYears as number,
      frequency,
      startDate: values.startDate,
      graceMonths,
      treatment: graceMonths > 0 ? values.treatment : "subsidized",
    },
  };
}

function periodDate(
  start: Date,
  period: number,
  frequency: PaymentFrequency,
): string {
  return formatISODate(addPeriods(start, period, frequency));
}

export function buildSchedule(input: LoanInput): ScheduleResult {
  const perYear = periodsPerYear(input.frequency);
  const totalPeriods = Math.round(input.termYears * perYear);
  const gracePeriods = gracePeriodCount(input.graceMonths, input.frequency);
  const repaymentPeriods = totalPeriods - gracePeriods;
  const periodicRate = input.annualRatePercent / 100 / perYear;
  const origination = parseISODate(input.startDate);

  if (!origination) {
    throw new Error("Invalid start date");
  }
  if (repaymentPeriods < 1) {
    throw new Error("Repayment term must include at least one period");
  }

  const rows: ScheduleRow[] = [];
  let principalBalance = roundCents(input.principal);
  let accruedBalance = 0;
  const originalPrincipal = principalBalance;

  for (let period = 1; period <= gracePeriods; period += 1) {
    const isLastGrace = period === gracePeriods;
    let interest = 0;
    let capitalized = 0;

    if (input.treatment === "subsidized") {
      interest = 0;
    } else {
      interest = roundCents(principalBalance * periodicRate);
      accruedBalance = roundCents(accruedBalance + interest);
    }

    if (input.treatment === "capitalize" && isLastGrace) {
      capitalized = accruedBalance;
      principalBalance = roundCents(principalBalance + capitalized);
      accruedBalance = 0;
    }

    rows.push({
      period,
      date: periodDate(origination, period, input.frequency),
      phase: "grace",
      payment: 0,
      interest,
      principal: 0,
      accruedApplied: 0,
      accruedBalance,
      principalBalance,
      capitalized,
      irrAnnualPercent: null,
    });
  }

  const amortizePrincipal =
    input.treatment === "capitalize" ? principalBalance : originalPrincipal;
  const levelPayment = scheduledPayment(
    amortizePrincipal,
    periodicRate,
    repaymentPeriods,
  );

  for (let i = 0; i < repaymentPeriods; i += 1) {
    const period = gracePeriods + i + 1;
    const isLast = i === repaymentPeriods - 1;
    const currentInterest = roundCents(principalBalance * periodicRate);

    if (input.treatment === "accrue") {
      if (isLast) {
        const principalPay = principalBalance;
        const accruedApplied = accruedBalance;
        const payment = roundCents(
          currentInterest + accruedApplied + principalPay,
        );
        principalBalance = 0;
        accruedBalance = 0;
        rows.push({
          period,
          date: periodDate(origination, period, input.frequency),
          phase: "repayment",
          payment,
          interest: currentInterest,
          principal: principalPay,
          accruedApplied,
          accruedBalance,
          principalBalance,
          capitalized: 0,
          irrAnnualPercent: null,
        });
        continue;
      }

      let remaining = roundCents(levelPayment - currentInterest);
      let accruedApplied = 0;

      if (remaining < 0) {
        accruedBalance = roundCents(accruedBalance - remaining);
        remaining = 0;
      } else {
        accruedApplied = roundCents(Math.min(remaining, accruedBalance));
        accruedBalance = roundCents(accruedBalance - accruedApplied);
        remaining = roundCents(remaining - accruedApplied);
      }

      const principalPay = roundCents(Math.min(remaining, principalBalance));
      principalBalance = roundCents(principalBalance - principalPay);

      rows.push({
        period,
        date: periodDate(origination, period, input.frequency),
        phase: "repayment",
        payment: levelPayment,
        interest: currentInterest,
        principal: principalPay,
        accruedApplied,
        accruedBalance,
        principalBalance,
        capitalized: 0,
        irrAnnualPercent: null,
      });
      continue;
    }

    if (isLast) {
      const principalPay = principalBalance;
      const payment = roundCents(currentInterest + principalPay);
      principalBalance = 0;
      rows.push({
        period,
        date: periodDate(origination, period, input.frequency),
        phase: "repayment",
        payment,
        interest: currentInterest,
        principal: principalPay,
        accruedApplied: 0,
        accruedBalance,
        principalBalance,
        capitalized: 0,
        irrAnnualPercent: null,
      });
      continue;
    }

    let principalPay = roundCents(levelPayment - currentInterest);
    if (principalPay > principalBalance) {
      principalPay = principalBalance;
    }
    if (principalPay < 0) {
      principalPay = 0;
    }
    principalBalance = roundCents(principalBalance - principalPay);

    rows.push({
      period,
      date: periodDate(origination, period, input.frequency),
      phase: "repayment",
      payment: levelPayment,
      interest: currentInterest,
      principal: principalPay,
      accruedApplied: 0,
      accruedBalance,
      principalBalance,
      capitalized: 0,
      irrAnnualPercent: null,
    });
  }

  const totals = rows.reduce<ScheduleTotals>(
    (acc, row) => ({
      paid: roundCents(acc.paid + row.payment),
      interest: roundCents(acc.interest + row.interest),
      principal: roundCents(acc.principal + row.principal),
      accruedApplied: roundCents(acc.accruedApplied + row.accruedApplied),
      capitalized: roundCents(acc.capitalized + row.capitalized),
    }),
    {
      paid: 0,
      interest: 0,
      principal: 0,
      accruedApplied: 0,
      capitalized: 0,
    },
  );

  const cashFlows = [-originalPrincipal];
  for (const row of rows) {
    cashFlows.push(row.payment);
    row.irrAnnualPercent = annualizedIrrPercent(
      periodicIrr(cashFlows),
      perYear,
    );
  }

  return {
    input,
    periodicRate,
    periodsPerYear: perYear,
    totalPeriods,
    gracePeriods,
    repaymentPeriods,
    scheduledPayment: levelPayment,
    rows,
    totals,
    irrAnnualPercent: rows.at(-1)?.irrAnnualPercent ?? null,
    showAccrued: input.treatment === "accrue" && gracePeriods > 0,
    showCapitalized: input.treatment === "capitalize" && gracePeriods > 0,
  };
}

export function compareTreatments(input: LoanInput): ComparisonRow[] {
  const treatments: GraceTreatment[] = [
    "capitalize",
    "accrue",
    "subsidized",
  ];
  return treatments.map((treatment) => {
    const result = buildSchedule({ ...input, treatment });
    const firstRepayment = result.rows.find((row) => row.phase === "repayment");
    return {
      treatment,
      scheduledPayment: result.scheduledPayment,
      totalPaid: result.totals.paid,
      totalInterest: result.totals.interest,
      irrAnnualPercent: result.irrAnnualPercent,
      firstRepaymentDate: firstRepayment?.date ?? null,
    };
  });
}
