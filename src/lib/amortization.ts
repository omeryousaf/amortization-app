export type PaymentFrequency =
  | "monthly"
  | "quarterly"
  | "semiannual"
  | "annual"
  | "biweekly";

export type GraceTreatment = "capitalize" | "accrue" | "subsidized";

export type AmortizationMethod = "level" | "equal-principal" | "scheduled";

/** A range value is currency, or a percent of the principal being repaid. */
export type PrincipalUnit = "amount" | "percent";

/** Repayment-period numbers are 1-based and ignore grace periods. */
export interface PrincipalRange {
  from: number;
  to: number;
  /** Currency amount, or a percent of amortizing principal when unit is "percent". */
  amount: number;
  /** Omitted means a currency amount. */
  unit?: PrincipalUnit;
}

export interface PrincipalRangeForm {
  id: string;
  from: string;
  to: string;
  amount: string;
  /** Omitted means a currency amount. */
  unit?: PrincipalUnit;
}

/** Short schedules can be edited from the table as well as the range list. */
export const EDITABLE_PRINCIPAL_PERIOD_LIMIT = 24;

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
      "Principal does not change during grace. Interest collects in a non-interest-bearing bucket. After grace, interest is charged only on principal, and the accrued bucket is repaid over the remaining term. The last payment absorbs any leftover accrued interest.",
  },
  subsidized: {
    label: "Lender-subsidized",
    summary:
      "No borrower interest during grace. After grace, the original principal is amortized over the remaining term.",
  },
};

export const AMORTIZATION_META: Record<
  AmortizationMethod,
  { label: string; summary: string }
> = {
  level: {
    label: "Level payment",
    summary:
      "The installment stays the same. Interest falls and the principal portion rises as the balance declines.",
  },
  "equal-principal": {
    label: "Equal principal",
    summary:
      "Each repayment period reduces principal by the same amount. The installment falls because interest is charged on a smaller balance.",
  },
  scheduled: {
    label: "Scheduled principal",
    summary:
      "You choose how much principal each repayment period reduces, as an amount or as a percent of principal. Interest is added on top. Periods you leave out share whatever principal is left.",
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
  amortizationMethod: AmortizationMethod;
  /** Used when amortizationMethod is "scheduled". Empty means split the balance equally. */
  principalRanges?: PrincipalRange[];
  /**
   * Draws. Omitted means the full principal is drawn on the start date.
   * An empty list means the user asked for tranches but none are valid yet.
   */
  tranches?: Tranche[];
}

export interface Tranche {
  date: string;
  amount: number;
}

export interface TrancheForm {
  id: string;
  date: string;
  amount: string;
}

export interface TrancheSchedule {
  index: number;
  date: string;
  amount: number;
  firstPeriod: number;
  result: ScheduleResult;
}

export interface ScheduleRow {
  period: number;
  date: string;
  phase: "grace" | "repayment";
  payment: number;
  interest: number;
  principal: number;
  /** Principal added at the beginning of this period. */
  drawn: number;
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
  /** Principal balance that repayment amortizes. Includes capitalized grace interest. */
  amortizingPrincipal: number;
  /** Resolved scheduled-principal plan, or null for the other methods. */
  principalPlan: PrincipalPlan | null;
  /** Sum and per-period problems for a scheduled-principal loan. The schedule is still built. */
  warnings: string[];
  /** Present on the consolidated result when the loan is drawn in tranches. */
  trancheSchedules?: TrancheSchedule[];
}

export interface PrincipalPlan {
  amounts: number[];
  explicitSum: number;
  uncoveredCount: number;
  target: number;
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
  | "treatment"
  | "amortizationMethod"
  | "principalRanges";

export type FieldErrors = Partial<Record<FieldKey, string>>;

export interface ParseSuccess {
  ok: true;
  input: LoanInput;
  rangeErrors: string[];
  trancheErrors: string[];
}

export interface ParseFailure {
  ok: false;
  errors: FieldErrors;
  empty: boolean;
  rangeErrors: string[];
  trancheErrors: string[];
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

/** Equal cent-rounded slice of an amount. The last period keeps the remainder. */
export function equalInstallment(amount: number, n: number): number {
  if (n <= 0) return 0;
  return roundCents(amount / n);
}

/** Split an amount across n periods. Earlier periods get the rounded slice; the last keeps the rest. */
export function distributeAmount(amount: number, n: number): number[] {
  if (n <= 0) return [];
  const slice = equalInstallment(amount, n);
  const amounts: number[] = [];
  let remaining = roundCents(amount);
  for (let i = 0; i < n - 1; i += 1) {
    const pay = roundCents(Math.min(slice, Math.max(remaining, 0)));
    amounts.push(pay);
    remaining = roundCents(remaining - pay);
  }
  amounts.push(roundCents(Math.max(remaining, 0)));
  return amounts;
}

function moneyText(value: number): string {
  return roundCents(value).toFixed(2);
}

/**
 * Currency principal one period of a range reduces.
 * A percent is that share of `target` (the principal being repaid).
 */
export function principalEachPeriod(
  range: Pick<PrincipalRange, "amount" | "unit">,
  target: number,
): number {
  if (range.unit === "percent") {
    return roundCents((target * range.amount) / 100);
  }
  return roundCents(range.amount);
}

/** Percent of `target` that `amount` represents, to six decimal places. */
export function shareOfPrincipal(amount: number, target: number): number {
  if (target <= 0) return 0;
  return Math.round((amount / target) * 100 * 1e6) / 1e6;
}

export function formatPrincipalShare(share: number): string {
  if (!Number.isFinite(share)) return "";
  return String(Math.round((share + Number.EPSILON) * 1e6) / 1e6);
}

/** Rewrite a range entry when the principal column changes between $ and %. */
export function convertPrincipalInput(
  amount: string,
  from: PrincipalUnit,
  to: PrincipalUnit,
  target: number,
): string {
  if (from === to) return amount;
  const parsed = Number(amount);
  if (amount.trim() === "" || !Number.isFinite(parsed)) return amount;
  if (to === "percent") {
    const dollars = principalEachPeriod({ amount: parsed, unit: from }, target);
    return formatPrincipalShare(shareOfPrincipal(dollars, target));
  }
  return String(principalEachPeriod({ amount: parsed, unit: from }, target));
}

/**
 * Text shown in one scheduled-principal cell.
 * A range that already uses `unit` keeps its raw text, so a half-typed percent
 * is not replaced by the dollar amount it converts to.
 */
export function principalCellDraft(
  ranges: PrincipalRangeForm[],
  repaymentPeriod: number,
  plannedAmount: number,
  unit: PrincipalUnit,
  target: number,
): string {
  let winner: PrincipalRangeForm | null = null;
  for (const range of ranges) {
    const from = Number(range.from);
    const to = Number(range.to);
    if (
      Number.isInteger(from) &&
      Number.isInteger(to) &&
      from <= repaymentPeriod &&
      repaymentPeriod <= to
    ) {
      winner = range;
    }
  }
  const winnerUnit: PrincipalUnit =
    winner?.unit === "percent" ? "percent" : "amount";
  if (winner && winnerUnit === unit) return winner.amount;
  if (unit === "percent") {
    return formatPrincipalShare(shareOfPrincipal(plannedAmount, target));
  }
  return String(plannedAmount);
}

/**
 * Turn ordered principal ranges into one amount per repayment period.
 * Later ranges replace earlier ones. A percent is a share of `target`,
 * applied each period the range covers. Periods no range covers share
 * whatever principal the explicit ranges did not claim, when that remainder
 * is positive.
 */
export function planPrincipalSchedule(
  ranges: PrincipalRange[],
  periods: number,
  target: number,
): PrincipalPlan {
  const assigned: Array<number | null> = Array.from(
    { length: periods },
    () => null,
  );

  for (const range of ranges) {
    const from = Math.max(1, range.from);
    const to = Math.min(periods, range.to);
    const each = principalEachPeriod(range, target);
    for (let period = from; period <= to; period += 1) {
      assigned[period - 1] = each;
    }
  }

  let explicitSum = 0;
  const uncovered: number[] = [];
  for (let index = 0; index < assigned.length; index += 1) {
    const amount = assigned[index];
    if (amount === null) {
      uncovered.push(index);
    } else {
      explicitSum = roundCents(explicitSum + amount);
    }
  }

  const remainder = roundCents(target - explicitSum);
  if (uncovered.length > 0 && remainder > 0) {
    const slices = distributeAmount(remainder, uncovered.length);
    uncovered.forEach((index, sliceIndex) => {
      assigned[index] = slices[sliceIndex] ?? 0;
    });
  } else {
    for (const index of uncovered) assigned[index] = 0;
  }

  return {
    amounts: assigned.map((amount) => amount ?? 0),
    explicitSum,
    uncoveredCount: uncovered.length,
    target: roundCents(target),
  };
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
  amortizationMethod: AmortizationMethod;
  principalRanges?: PrincipalRangeForm[];
  /** Unit for the scheduled-principal column. Omitted means a currency amount. */
  principalUnit?: PrincipalUnit;
  tranches?: TrancheForm[];
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

  if (!(values.amortizationMethod in AMORTIZATION_META)) {
    errors.amortizationMethod = "Choose how principal is repaid.";
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

  const repaymentPeriods =
    principal !== null &&
    termYears !== null &&
    !errors.graceMonths &&
    !errors.frequency
      ? Math.round(termYears * periodsPerYear(frequency)) -
        gracePeriodCount(graceMonths, frequency)
      : null;
  const { ranges: principalRanges, rangeErrors } = parsePrincipalRanges(
    values.amortizationMethod === "scheduled" ? values.principalRanges : [],
    repaymentPeriods,
  );
  const trancheList = values.tranches ?? [];
  const { tranches, trancheErrors } = parseTranches(
    trancheList,
    values.startDate,
    termYears,
    frequency,
  );

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors, empty, rangeErrors, trancheErrors };
  }

  return {
    ok: true,
    rangeErrors,
    trancheErrors,
    input: {
      principal: principal as number,
      annualRatePercent: annualRatePercent as number,
      termYears: termYears as number,
      frequency,
      startDate: values.startDate,
      graceMonths,
      treatment: graceMonths > 0 ? values.treatment : "subsidized",
      amortizationMethod: values.amortizationMethod,
      principalRanges,
      ...(trancheList.length > 0 ? { tranches } : {}),
    },
  };
}

function parsePrincipalRanges(
  ranges: PrincipalRangeForm[] | undefined,
  repaymentPeriods: number | null,
): { ranges: PrincipalRange[]; rangeErrors: string[] } {
  const parsed: PrincipalRange[] = [];
  const rangeErrors: string[] = [];
  for (const [index, range] of (ranges ?? []).entries()) {
    const label = `Range ${index + 1}`;
    const from = parsePeriodNumber(range.from);
    const to = parsePeriodNumber(range.to);
    const amount = parseNonNegativeNumber(range.amount);
    if (from === null || to === null) {
      rangeErrors.push(`${label} needs a whole repayment period number.`);
      continue;
    }
    if (from > to) {
      rangeErrors.push(`${label} ends before it starts.`);
      continue;
    }
    if (
      repaymentPeriods !== null &&
      (from > repaymentPeriods || to > repaymentPeriods)
    ) {
      rangeErrors.push(
        `${label} must stay within repayment periods 1 to ${repaymentPeriods}.`,
      );
      continue;
    }
    const unit = range.unit === "percent" ? "percent" : "amount";
    if (range.amount.trim() === "" || amount === null) {
      rangeErrors.push(
        unit === "percent"
          ? `${label} needs a principal percent of zero or more.`
          : `${label} needs a principal amount of zero or more.`,
      );
      continue;
    }
    parsed.push(unit === "percent" ? { from, to, amount, unit } : { from, to, amount });
  }
  return { ranges: parsed, rangeErrors };
}

function parseTranches(
  tranches: TrancheForm[],
  startDate: string,
  termYears: number | null,
  frequency: PaymentFrequency,
): { tranches: Tranche[]; trancheErrors: string[] } {
  const parsed: Tranche[] = [];
  const trancheErrors: string[] = [];
  const start = parseISODate(startDate);
  const totalPeriods =
    start && termYears !== null && frequency in FREQUENCY_META
      ? Math.round(termYears * periodsPerYear(frequency))
      : null;

  for (const [index, tranche] of tranches.entries()) {
    const label = `Tranche ${index + 1}`;
    const date = parseISODate(tranche.date);
    const amount = parsePositiveNumber(tranche.amount);
    if (!date) {
      trancheErrors.push(`${label} needs a valid draw date.`);
      continue;
    }
    if (tranche.amount.trim() === "" || amount === null) {
      trancheErrors.push(`${label} needs a draw amount greater than zero.`);
      continue;
    }
    if (start && totalPeriods !== null) {
      const firstPeriod = trancheStartPeriod(start, date, frequency, totalPeriods);
      if (firstPeriod === null) {
        trancheErrors.push(
          `${label} must be on or after the start date and before the final payment.`,
        );
        continue;
      }
    }
    parsed.push({ date: formatISODate(date), amount });
  }
  return { tranches: parsed, trancheErrors };
}

/** First period a draw is outstanding. A draw on a payment date starts the next period. */
export function trancheStartPeriod(
  start: Date,
  trancheDate: Date,
  frequency: PaymentFrequency,
  totalPeriods: number,
): number | null {
  if (trancheDate.getTime() < start.getTime()) return null;
  if (sameDay(trancheDate, start)) return 1;
  for (let period = 1; period <= totalPeriods; period += 1) {
    const end = addPeriods(start, period, frequency);
    if (sameDay(trancheDate, end)) {
      const next = period + 1;
      return next <= totalPeriods ? next : null;
    }
    if (trancheDate.getTime() < end.getTime()) return period;
  }
  return null;
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function parsePeriodNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const n = Number(trimmed);
  if (!Number.isInteger(n) || n < 1) return null;
  return n;
}

function periodDate(
  start: Date,
  period: number,
  frequency: PaymentFrequency,
): string {
  return formatISODate(addPeriods(start, period, frequency));
}

function buildSingleSchedule(input: LoanInput): ScheduleResult {
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
      drawn: 0,
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
  const equalPrincipal = input.amortizationMethod === "equal-principal";
  const scheduledPrincipal = input.amortizationMethod === "scheduled";
  const principalSlice = equalInstallment(amortizePrincipal, repaymentPeriods);
  const principalPlan = scheduledPrincipal
    ? planPrincipalSchedule(
        input.principalRanges ?? [],
        repaymentPeriods,
        amortizePrincipal,
      )
    : null;
  const principalAmounts =
    scheduledPrincipal && principalPlan
      ? principalPlan.amounts
      : equalPrincipal
        ? distributeAmount(amortizePrincipal, repaymentPeriods)
        : null;
  const accruedSlice =
    input.treatment === "accrue"
      ? equalInstallment(accruedBalance, repaymentPeriods)
      : 0;
  const warnings: string[] = [];

  for (let i = 0; i < repaymentPeriods; i += 1) {
    const period = gracePeriods + i + 1;
    const isLast = i === repaymentPeriods - 1;
    const currentInterest = roundCents(principalBalance * periodicRate);

    if (principalAmounts) {
      const requested = principalAmounts[i] ?? 0;
      const principalPay = roundCents(Math.min(requested, principalBalance));
      if (
        scheduledPrincipal &&
        roundCents(requested - principalPay) >= 0.01
      ) {
        warnings.push(
          `Repayment period ${i + 1} schedules ${moneyText(requested)} of principal, and ${moneyText(principalBalance)} is left.`,
        );
      }
      const accruedApplied =
        input.treatment === "accrue"
          ? isLast
            ? accruedBalance
            : roundCents(Math.min(accruedSlice, accruedBalance))
          : 0;
      const payment = roundCents(
        currentInterest + accruedApplied + principalPay,
      );
      principalBalance = roundCents(principalBalance - principalPay);
      accruedBalance = roundCents(accruedBalance - accruedApplied);
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
        drawn: 0,
        irrAnnualPercent: null,
      });
      continue;
    }

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
          drawn: 0,
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
        drawn: 0,
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
        drawn: 0,
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
      drawn: 0,
      irrAnnualPercent: null,
    });
  }

  if (scheduledPrincipal && principalBalance >= 0.01) {
    warnings.push(
      `${moneyText(principalBalance)} of principal is still unpaid after the last repayment period.`,
    );
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
    scheduledPayment: scheduledPrincipal
      ? (rows.find((row) => row.phase === "repayment")?.payment ?? 0)
      : equalPrincipal
        ? principalSlice
        : levelPayment,
    rows,
    totals,
    irrAnnualPercent: rows.at(-1)?.irrAnnualPercent ?? null,
    showAccrued: input.treatment === "accrue" && gracePeriods > 0,
    showCapitalized: input.treatment === "capitalize" && gracePeriods > 0,
    amortizingPrincipal: amortizePrincipal,
    principalPlan,
    warnings,
  };
}

function clipPrincipalRanges(
  ranges: PrincipalRange[],
  firstRepaymentNumber: number,
  count: number,
): PrincipalRange[] {
  const last = firstRepaymentNumber + count - 1;
  const clipped: PrincipalRange[] = [];
  for (const range of ranges) {
    const from = Math.max(range.from, firstRepaymentNumber);
    const to = Math.min(range.to, last);
    if (from <= to) {
      clipped.push({
        from: from - firstRepaymentNumber + 1,
        to: to - firstRepaymentNumber + 1,
        amount: range.amount,
        ...(range.unit === "percent" ? { unit: "percent" as const } : {}),
      });
    }
  }
  return clipped;
}

function sumMoney(values: number[]): number {
  return values.reduce((total, value) => roundCents(total + value), 0);
}

/** Amortize one draw on the loan's existing period dates. */
function buildPortionSchedule(
  input: LoanInput,
  portionPrincipal: number,
  firstPeriod: number,
): ScheduleResult {
  const perYear = periodsPerYear(input.frequency);
  const totalPeriods = Math.round(input.termYears * perYear);
  const gracePeriods = gracePeriodCount(input.graceMonths, input.frequency);
  const periodicRate = input.annualRatePercent / 100 / perYear;
  const origination = parseISODate(input.startDate);
  if (!origination) throw new Error("Invalid start date");

  const rows: ScheduleRow[] = [];
  let principalBalance = 0;
  let accruedBalance = 0;
  let drawRecorded = false;
  const drawAmount = roundCents(portionPrincipal);

  const takeDraw = (period: number): number => {
    if (period !== firstPeriod || drawRecorded) return 0;
    principalBalance = roundCents(principalBalance + drawAmount);
    drawRecorded = true;
    return drawAmount;
  };

  for (let period = 1; period <= gracePeriods; period += 1) {
    const drawn = takeDraw(period);
    if (period < firstPeriod) continue;
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
      drawn,
      irrAnnualPercent: null,
    });
  }

  const repaymentStart = Math.max(firstPeriod, gracePeriods + 1);
  const portionCount = totalPeriods - repaymentStart + 1;
  const duringGrace = firstPeriod <= gracePeriods;
  const amortizePrincipal =
    duringGrace && input.treatment === "capitalize"
      ? principalBalance
      : drawAmount;
  const levelPayment = scheduledPayment(
    amortizePrincipal,
    periodicRate,
    portionCount,
  );
  const equalPrincipal = input.amortizationMethod === "equal-principal";
  const scheduledPrincipal = input.amortizationMethod === "scheduled";
  const firstRepaymentNumber = repaymentStart - gracePeriods;
  const principalSlice = equalInstallment(amortizePrincipal, portionCount);
  const principalPlan = scheduledPrincipal
    ? planPrincipalSchedule(
        clipPrincipalRanges(
          input.principalRanges ?? [],
          firstRepaymentNumber,
          portionCount,
        ),
        portionCount,
        amortizePrincipal,
      )
    : null;
  const principalAmounts =
    scheduledPrincipal && principalPlan
      ? principalPlan.amounts
      : equalPrincipal
        ? distributeAmount(amortizePrincipal, portionCount)
        : null;
  const accruedSlice =
    input.treatment === "accrue"
      ? equalInstallment(accruedBalance, portionCount)
      : 0;
  const warnings: string[] = [];

  for (let i = 0; i < portionCount; i += 1) {
    const period = repaymentStart + i;
    const drawn = takeDraw(period);
    const isLast = i === portionCount - 1;
    const repaymentNumber = firstRepaymentNumber + i;
    const currentInterest = roundCents(principalBalance * periodicRate);

    if (principalAmounts) {
      const requested = principalAmounts[i] ?? 0;
      const principalPay = roundCents(Math.min(requested, principalBalance));
      if (scheduledPrincipal && roundCents(requested - principalPay) >= 0.01) {
        warnings.push(
          `Repayment period ${repaymentNumber} schedules ${moneyText(requested)} of principal, and ${moneyText(principalBalance)} is left.`,
        );
      }
      const accruedApplied =
        input.treatment === "accrue"
          ? isLast
            ? accruedBalance
            : roundCents(Math.min(accruedSlice, accruedBalance))
          : 0;
      const payment = roundCents(currentInterest + accruedApplied + principalPay);
      principalBalance = roundCents(principalBalance - principalPay);
      accruedBalance = roundCents(accruedBalance - accruedApplied);
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
        drawn,
        irrAnnualPercent: null,
      });
      continue;
    }

    if (input.treatment === "accrue") {
      if (isLast) {
        const principalPay = principalBalance;
        const accruedApplied = accruedBalance;
        const payment = roundCents(currentInterest + accruedApplied + principalPay);
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
          drawn,
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
        drawn,
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
        drawn,
        irrAnnualPercent: null,
      });
      continue;
    }

    let principalPay = roundCents(levelPayment - currentInterest);
    if (principalPay > principalBalance) principalPay = principalBalance;
    if (principalPay < 0) principalPay = 0;
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
      drawn,
      irrAnnualPercent: null,
    });
  }

  if (scheduledPrincipal && principalBalance >= 0.01) {
    warnings.push(
      `${moneyText(principalBalance)} of principal is still unpaid after the last repayment period.`,
    );
  }

  const cashFlows = [-drawAmount];
  for (const row of rows) {
    cashFlows.push(row.payment);
    row.irrAnnualPercent = annualizedIrrPercent(periodicIrr(cashFlows), perYear);
  }

  const totals = totalsOf(rows);
  return {
    input: { ...input, principal: drawAmount, tranches: undefined },
    periodicRate,
    periodsPerYear: perYear,
    totalPeriods,
    gracePeriods,
    repaymentPeriods: portionCount,
    scheduledPayment: scheduledPrincipal
      ? (rows.find((row) => row.phase === "repayment")?.payment ?? 0)
      : equalPrincipal
        ? principalSlice
        : levelPayment,
    rows,
    totals,
    irrAnnualPercent: rows.at(-1)?.irrAnnualPercent ?? null,
    showAccrued: input.treatment === "accrue" && duringGrace,
    showCapitalized: input.treatment === "capitalize" && duringGrace,
    amortizingPrincipal: amortizePrincipal,
    principalPlan,
    warnings,
  };
}

function totalsOf(rows: ScheduleRow[]): ScheduleTotals {
  return rows.reduce<ScheduleTotals>(
    (acc, row) => ({
      paid: roundCents(acc.paid + row.payment),
      interest: roundCents(acc.interest + row.interest),
      principal: roundCents(acc.principal + row.principal),
      accruedApplied: roundCents(acc.accruedApplied + row.accruedApplied),
      capitalized: roundCents(acc.capitalized + row.capitalized),
    }),
    { paid: 0, interest: 0, principal: 0, accruedApplied: 0, capitalized: 0 },
  );
}

function zeroRow(
  period: number,
  date: string,
  phase: ScheduleRow["phase"],
): ScheduleRow {
  return {
    period,
    date,
    phase,
    payment: 0,
    interest: 0,
    principal: 0,
    accruedApplied: 0,
    accruedBalance: 0,
    principalBalance: 0,
    capitalized: 0,
    drawn: 0,
    irrAnnualPercent: null,
  };
}

function buildConsolidatedSchedule(input: LoanInput): ScheduleResult {
  const perYear = periodsPerYear(input.frequency);
  const totalPeriods = Math.round(input.termYears * perYear);
  const gracePeriods = gracePeriodCount(input.graceMonths, input.frequency);
  const repaymentPeriods = totalPeriods - gracePeriods;
  const periodicRate = input.annualRatePercent / 100 / perYear;
  const origination = parseISODate(input.startDate);
  if (!origination) throw new Error("Invalid start date");
  if (repaymentPeriods < 1) {
    throw new Error("Repayment term must include at least one period");
  }

  const tranches = input.tranches ?? [];
  const trancheSchedules: TrancheSchedule[] = [];
  for (const [index, tranche] of tranches.entries()) {
    const date = parseISODate(tranche.date);
    if (!date) continue;
    const firstPeriod = trancheStartPeriod(
      origination,
      date,
      input.frequency,
      totalPeriods,
    );
    if (firstPeriod === null) continue;
    trancheSchedules.push({
      index: index + 1,
      date: tranche.date,
      amount: tranche.amount,
      firstPeriod,
      result: buildPortionSchedule(input, tranche.amount, firstPeriod),
    });
  }

  const rows: ScheduleRow[] = [];
  for (let period = 1; period <= totalPeriods; period += 1) {
    const parts = trancheSchedules
      .map((tranche) => tranche.result.rows.find((row) => row.period === period))
      .filter((row): row is ScheduleRow => row !== undefined);
    const phase = period <= gracePeriods ? "grace" : "repayment";
    const date = periodDate(origination, period, input.frequency);
    if (parts.length === 0) {
      rows.push(zeroRow(period, date, phase));
      continue;
    }
    rows.push({
      period,
      date,
      phase,
      payment: sumMoney(parts.map((row) => row.payment)),
      interest: sumMoney(parts.map((row) => row.interest)),
      principal: sumMoney(parts.map((row) => row.principal)),
      accruedApplied: sumMoney(parts.map((row) => row.accruedApplied)),
      accruedBalance: sumMoney(parts.map((row) => row.accruedBalance)),
      principalBalance: sumMoney(parts.map((row) => row.principalBalance)),
      capitalized: sumMoney(parts.map((row) => row.capitalized)),
      drawn: sumMoney(parts.map((row) => row.drawn)),
      irrAnnualPercent: null,
    });
  }

  const opening = sumMoney(
    trancheSchedules
      .filter((tranche) => tranche.firstPeriod === 1)
      .map((tranche) => tranche.amount),
  );
  const nettedDraw = Array.from({ length: totalPeriods + 1 }, () => 0);
  for (const tranche of trancheSchedules) {
    if (tranche.firstPeriod > 1) {
      nettedDraw[tranche.firstPeriod - 1] = roundCents(
        nettedDraw[tranche.firstPeriod - 1] + tranche.amount,
      );
    }
  }
  const cashFlows = [-opening];
  for (const row of rows) {
    cashFlows.push(roundCents(row.payment - (nettedDraw[row.period] ?? 0)));
    row.irrAnnualPercent = annualizedIrrPercent(periodicIrr(cashFlows), perYear);
  }

  const warnings = trancheSchedules.flatMap((tranche) =>
    tranche.result.warnings.map((warning) => `Tranche ${tranche.index}: ${warning}`),
  );
  const drawnSum = sumMoney(tranches.map((tranche) => tranche.amount));
  const commitment = roundCents(input.principal);
  if (tranches.length === 0) {
    warnings.push("Add a valid tranche to draw principal.");
  } else if (drawnSum !== commitment) {
    warnings.push(
      `Tranches draw ${moneyText(drawnSum)} of the ${moneyText(commitment)} principal.`,
    );
  }

  const firstRepayment = rows.find((row) => row.phase === "repayment");
  return {
    input,
    periodicRate,
    periodsPerYear: perYear,
    totalPeriods,
    gracePeriods,
    repaymentPeriods,
    scheduledPayment: firstRepayment?.payment ?? 0,
    rows,
    totals: totalsOf(rows),
    irrAnnualPercent: rows.at(-1)?.irrAnnualPercent ?? null,
    showAccrued: trancheSchedules.some((tranche) => tranche.result.showAccrued),
    showCapitalized: trancheSchedules.some(
      (tranche) => tranche.result.showCapitalized,
    ),
    amortizingPrincipal: sumMoney(
      trancheSchedules.map((tranche) => tranche.result.amortizingPrincipal),
    ),
    principalPlan: null,
    warnings,
    trancheSchedules,
  };
}

export function buildSchedule(input: LoanInput): ScheduleResult {
  if (input.tranches === undefined) return buildSingleSchedule(input);
  return buildConsolidatedSchedule(input);
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
