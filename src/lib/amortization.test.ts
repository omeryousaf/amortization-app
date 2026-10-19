import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildSchedule,
  compareTreatments,
  convertPrincipalInput,
  gracePeriodCount,
  parseLoanForm,
  principalCellDraft,
  roundCents,
  scheduledPayment,
  type LoanInput,
} from "./amortization";

const baseInput: LoanInput = {
  principal: 10_000,
  annualRatePercent: 6,
  termYears: 2,
  frequency: "monthly",
  startDate: "2026-01-15",
  graceMonths: 0,
  treatment: "subsidized",
  amortizationMethod: "level",
};

describe("payment frequency", () => {
  it("rebuilds period count, payment, and dates when frequency changes", () => {
    const monthly = buildSchedule(baseInput);
    const annual = buildSchedule({ ...baseInput, frequency: "annual" });
    assert.equal(monthly.totalPeriods, 24);
    assert.equal(annual.totalPeriods, 2);
    assert.ok(annual.scheduledPayment > monthly.scheduledPayment);
    assert.equal(monthly.rows[0]?.date, "2026-02-15");
    assert.equal(annual.rows[0]?.date, "2027-01-15");
  });
});

describe("scheduledPayment", () => {
  it("rounds the classic two-year 6% monthly payment", () => {
    const payment = scheduledPayment(10_000, 0.06 / 12, 24);
    assert.equal(payment, 443.21);
  });

  it("splits principal evenly when the rate is zero", () => {
    assert.equal(scheduledPayment(1_200, 0, 12), 100);
  });
});

describe("buildSchedule without grace", () => {
  it("fully amortizes with leftover cents on the last payment", () => {
    const result = buildSchedule(baseInput);
    assert.equal(result.scheduledPayment, 443.21);
    assert.equal(result.gracePeriods, 0);
    assert.equal(result.rows.length, 24);
    assert.equal(result.rows[0]?.date, "2026-02-15");
    assert.equal(result.rows.at(-1)?.principalBalance, 0);
    assert.equal(result.totals.principal, 10_000);

    const last = result.rows.at(-1);
    const earlier = result.rows.slice(0, -1);
    assert.ok(last);
    assert.ok(earlier.every((row) => row.payment === result.scheduledPayment));
    assert.equal(
      roundCents(result.totals.paid),
      roundCents(result.totals.principal + result.totals.interest),
    );
    assert.ok(result.irrAnnualPercent !== null);
    assert.ok(Math.abs((result.irrAnnualPercent as number) - 6) < 0.05);
    assert.ok(result.rows[0]?.irrAnnualPercent !== null);
    assert.ok(result.rows.at(-1)?.irrAnnualPercent !== null);
  });
});

describe("grace treatments", () => {
  const withGrace: LoanInput = {
    ...baseInput,
    graceMonths: 6,
  };

  it("maps six months of monthly grace to six periods", () => {
    assert.equal(gracePeriodCount(6, "monthly"), 6);
    assert.equal(gracePeriodCount(6, "quarterly"), 2);
  });

  it("capitalizes grace interest into principal, then amortizes the new balance", () => {
    const result = buildSchedule({ ...withGrace, treatment: "capitalize" });
    const graceRows = result.rows.filter((row) => row.phase === "grace");
    const repayRows = result.rows.filter((row) => row.phase === "repayment");

    assert.equal(graceRows.length, 6);
    assert.equal(repayRows.length, 18);
    assert.ok(graceRows.every((row) => row.payment === 0));

    const graceInterest = roundCents(
      graceRows.reduce((sum, row) => sum + row.interest, 0),
    );
    assert.equal(graceInterest, 300);
    assert.equal(result.totals.capitalized, 300);
    assert.equal(graceRows.at(-1)?.principalBalance, 10_300);
    assert.equal(graceRows.at(-1)?.accruedBalance, 0);
    assert.equal(
      result.scheduledPayment,
      scheduledPayment(10_300, 0.06 / 12, 18),
    );
    assert.equal(repayRows.at(-1)?.principalBalance, 0);
    assert.equal(result.totals.principal, 10_300);
  });

  it("accrues interest separately and keeps both balances visible", () => {
    const result = buildSchedule({ ...withGrace, treatment: "accrue" });
    const graceRows = result.rows.filter((row) => row.phase === "grace");
    const repayRows = result.rows.filter((row) => row.phase === "repayment");

    assert.ok(result.showAccrued);
    assert.ok(graceRows.every((row) => row.principalBalance === 10_000));
    assert.equal(graceRows.at(-1)?.accruedBalance, 300);
    assert.equal(
      result.scheduledPayment,
      scheduledPayment(10_000, 0.06 / 12, 18),
    );

    const mid = repayRows[0];
    assert.ok(mid);
    assert.ok(mid.accruedApplied > 0);
    assert.ok(mid.principalBalance <= 10_000);

    const last = repayRows.at(-1);
    assert.ok(last);
    assert.equal(last.principalBalance, 0);
    assert.equal(last.accruedBalance, 0);
    assert.ok(last.payment !== result.scheduledPayment);
    assert.equal(result.totals.principal, 10_000);
    assert.equal(result.totals.accruedApplied, 300);
  });

  it("charges no borrower interest during subsidized grace", () => {
    const result = buildSchedule({ ...withGrace, treatment: "subsidized" });
    const graceRows = result.rows.filter((row) => row.phase === "grace");
    assert.ok(graceRows.every((row) => row.interest === 0 && row.payment === 0));
    assert.ok(graceRows.every((row) => row.principalBalance === 10_000));
    assert.equal(
      result.scheduledPayment,
      scheduledPayment(10_000, 0.06 / 12, 18),
    );
    assert.equal(result.rows.at(-1)?.principalBalance, 0);
    assert.equal(result.totals.principal, 10_000);
  });

  it("compares all three treatments on the same loan", () => {
    const comparison = compareTreatments(withGrace);
    const byTreatment = Object.fromEntries(
      comparison.map((row) => [row.treatment, row]),
    );
    assert.equal(comparison.length, 3);
    assert.ok(
      byTreatment.subsidized.totalInterest < byTreatment.accrue.totalInterest,
    );
    assert.ok(
      byTreatment.capitalize.scheduledPayment >
        byTreatment.accrue.scheduledPayment,
    );
    assert.equal(byTreatment.capitalize.firstRepaymentDate, "2026-08-15");
    assert.ok(byTreatment.subsidized.irrAnnualPercent !== null);
    assert.ok(byTreatment.capitalize.irrAnnualPercent !== null);
    assert.ok(
      (byTreatment.subsidized.irrAnnualPercent as number) <
        (byTreatment.capitalize.irrAnnualPercent as number),
    );
  });

  it("leaves IRR blank on zero-payment grace rows", () => {
    const result = buildSchedule({ ...withGrace, treatment: "subsidized" });
    const graceRows = result.rows.filter((row) => row.phase === "grace");
    assert.ok(graceRows.every((row) => row.irrAnnualPercent === null));
    assert.ok(result.rows.find((row) => row.phase === "repayment")?.irrAnnualPercent !== null);
  });

  it("puts leftover accrued on the last payment when the bucket outlasts regular P&I", () => {
    const result = buildSchedule({
      principal: 10_000,
      annualRatePercent: 24,
      termYears: 5,
      frequency: "monthly",
      startDate: "2026-01-15",
      graceMonths: 48,
      treatment: "accrue",
      amortizationMethod: "level",
    });
    const last = result.rows.at(-1);
    assert.ok(last);
    assert.ok(last.accruedApplied > 0);
    assert.ok(last.payment > result.scheduledPayment);
    assert.equal(last.accruedBalance, 0);
    assert.equal(last.principalBalance, 0);
  });
});

describe("equal principal", () => {
  const annual: LoanInput = {
    principal: 20,
    annualRatePercent: 10,
    termYears: 5,
    frequency: "annual",
    startDate: "2026-01-15",
    graceMonths: 0,
    treatment: "subsidized",
    amortizationMethod: "equal-principal",
  };

  it("repays the same principal each year and lets the installment fall", () => {
    const result = buildSchedule(annual);
    assert.equal(result.scheduledPayment, 4);
    assert.deepEqual(
      result.rows.map((row) => ({
        payment: row.payment,
        interest: row.interest,
        principal: row.principal,
        principalBalance: row.principalBalance,
      })),
      [
        { payment: 6, interest: 2, principal: 4, principalBalance: 16 },
        { payment: 5.6, interest: 1.6, principal: 4, principalBalance: 12 },
        { payment: 5.2, interest: 1.2, principal: 4, principalBalance: 8 },
        { payment: 4.8, interest: 0.8, principal: 4, principalBalance: 4 },
        { payment: 4.4, interest: 0.4, principal: 4, principalBalance: 0 },
      ],
    );
    assert.equal(result.totals.principal, 20);
    assert.equal(result.totals.interest, 6);

    const level = buildSchedule({ ...annual, amortizationMethod: "level" });
    assert.ok(result.totals.interest < level.totals.interest);
  });

  it("puts the leftover cent of principal on the last period", () => {
    const result = buildSchedule({
      ...annual,
      principal: 100,
      annualRatePercent: 0,
      termYears: 3,
    });
    assert.deepEqual(
      result.rows.map((row) => row.principal),
      [33.33, 33.33, 33.34],
    );
    assert.equal(result.rows.at(-1)?.principalBalance, 0);
    assert.equal(result.totals.principal, 100);
  });

  it("amortizes capitalized, accrued, and subsidized grace on an equal-principal schedule", () => {
    const withGrace: LoanInput = {
      principal: 100,
      annualRatePercent: 10,
      termYears: 3,
      frequency: "annual",
      startDate: "2026-01-15",
      graceMonths: 12,
      treatment: "capitalize",
      amortizationMethod: "equal-principal",
    };

    const capitalized = buildSchedule(withGrace);
    assert.equal(capitalized.scheduledPayment, 55);
    assert.equal(capitalized.rows[0]?.capitalized, 10);
    assert.deepEqual(
      capitalized.rows.slice(1).map((row) => ({
        payment: row.payment,
        interest: row.interest,
        principal: row.principal,
        principalBalance: row.principalBalance,
      })),
      [
        { payment: 66, interest: 11, principal: 55, principalBalance: 55 },
        { payment: 60.5, interest: 5.5, principal: 55, principalBalance: 0 },
      ],
    );

    const accrued = buildSchedule({ ...withGrace, treatment: "accrue" });
    assert.equal(accrued.scheduledPayment, 50);
    assert.equal(accrued.rows[0]?.accruedBalance, 10);
    assert.deepEqual(
      accrued.rows.slice(1).map((row) => ({
        payment: row.payment,
        interest: row.interest,
        principal: row.principal,
        accruedApplied: row.accruedApplied,
        accruedBalance: row.accruedBalance,
        principalBalance: row.principalBalance,
      })),
      [
        {
          payment: 65,
          interest: 10,
          principal: 50,
          accruedApplied: 5,
          accruedBalance: 5,
          principalBalance: 50,
        },
        {
          payment: 60,
          interest: 5,
          principal: 50,
          accruedApplied: 5,
          accruedBalance: 0,
          principalBalance: 0,
        },
      ],
    );

    const subsidized = buildSchedule({ ...withGrace, treatment: "subsidized" });
    assert.equal(subsidized.rows[0]?.interest, 0);
    assert.deepEqual(
      subsidized.rows.slice(1).map((row) => row.payment),
      [60, 55],
    );
    assert.equal(subsidized.rows.at(-1)?.principalBalance, 0);
  });
});

describe("scheduled principal", () => {
  const annual: LoanInput = {
    principal: 20,
    annualRatePercent: 10,
    termYears: 5,
    frequency: "annual",
    startDate: "2026-01-15",
    graceMonths: 0,
    treatment: "subsidized",
    amortizationMethod: "scheduled",
  };

  it("matches equal principal when no ranges are set", () => {
    const scheduled = buildSchedule(annual);
    const equal = buildSchedule({
      ...annual,
      amortizationMethod: "equal-principal",
    });
    assert.deepEqual(
      scheduled.rows.map((row) => row.payment),
      equal.rows.map((row) => row.payment),
    );
    assert.equal(scheduled.rows.at(-1)?.principalBalance, 0);
    assert.deepEqual(scheduled.warnings, []);
  });

  it("applies ranges and splits the unclaimed principal across the other periods", () => {
    const result = buildSchedule({
      ...annual,
      principalRanges: [{ from: 1, to: 2, amount: 2 }],
    });
    assert.equal(result.scheduledPayment, 4);
    assert.deepEqual(
      result.rows.map((row) => ({
        payment: row.payment,
        interest: row.interest,
        principal: row.principal,
        principalBalance: row.principalBalance,
      })),
      [
        { payment: 4, interest: 2, principal: 2, principalBalance: 18 },
        { payment: 3.8, interest: 1.8, principal: 2, principalBalance: 16 },
        { payment: 6.93, interest: 1.6, principal: 5.33, principalBalance: 10.67 },
        { payment: 6.4, interest: 1.07, principal: 5.33, principalBalance: 5.34 },
        { payment: 5.87, interest: 0.53, principal: 5.34, principalBalance: 0 },
      ],
    );
    assert.equal(result.principalPlan?.explicitSum, 4);
    assert.equal(result.principalPlan?.uncoveredCount, 3);
  });

  it("lets a later range replace an earlier one", () => {
    const result = buildSchedule({
      ...annual,
      principalRanges: [
        { from: 1, to: 5, amount: 4 },
        { from: 1, to: 1, amount: 0 },
      ],
    });
    assert.deepEqual(
      result.rows.map((row) => row.principal),
      [0, 4, 4, 4, 4],
    );
    assert.equal(result.rows.at(-1)?.principalBalance, 4);
    assert.deepEqual(result.warnings, [
      "4.00 of principal is still unpaid after the last repayment period.",
    ]);
  });

  it("caps a period that asks for more principal than is left", () => {
    const result = buildSchedule({
      ...annual,
      principalRanges: [{ from: 1, to: 5, amount: 10 }],
    });
    assert.deepEqual(
      result.rows.map((row) => row.principal),
      [10, 10, 0, 0, 0],
    );
    assert.equal(result.rows.at(-1)?.principalBalance, 0);
    assert.equal(result.warnings.length, 3);
    assert.match(result.warnings[0] ?? "", /Repayment period 3/);
  });

  it("keeps accrued grace interest beside the scheduled principal", () => {
    const result = buildSchedule({
      principal: 100,
      annualRatePercent: 10,
      termYears: 3,
      frequency: "annual",
      startDate: "2026-01-15",
      graceMonths: 12,
      treatment: "accrue",
      amortizationMethod: "scheduled",
      principalRanges: [{ from: 1, to: 1, amount: 20 }],
    });
    assert.equal(result.amortizingPrincipal, 100);
    assert.equal(result.rows[0]?.accruedBalance, 10);
    assert.deepEqual(
      result.rows.slice(1).map((row) => ({
        payment: row.payment,
        interest: row.interest,
        principal: row.principal,
        accruedApplied: row.accruedApplied,
        principalBalance: row.principalBalance,
      })),
      [
        {
          payment: 35,
          interest: 10,
          principal: 20,
          accruedApplied: 5,
          principalBalance: 80,
        },
        {
          payment: 93,
          interest: 8,
          principal: 80,
          accruedApplied: 5,
          principalBalance: 0,
        },
      ],
    );
  });

  it("treats a percent as that share of principal on every period in the range", () => {
    const result = buildSchedule({
      ...annual,
      principalRanges: [{ from: 1, to: 2, amount: 10, unit: "percent" }],
    });
    assert.deepEqual(
      result.rows.map((row) => row.principal),
      [2, 2, 5.33, 5.33, 5.34],
    );
    assert.equal(result.principalPlan?.explicitSum, 4);
    assert.equal(result.rows.at(-1)?.principalBalance, 0);
  });

  it("rounds a percent of principal to the cent", () => {
    const result = buildSchedule({
      ...annual,
      principal: 10,
      termYears: 2,
      principalRanges: [{ from: 1, to: 1, amount: 33.33, unit: "percent" }],
    });
    assert.deepEqual(
      result.rows.map((row) => row.principal),
      [3.33, 6.67],
    );
  });

  it("uses the principal being repaid, including capitalized interest, as the percent base", () => {
    const result = buildSchedule({
      principal: 100,
      annualRatePercent: 10,
      termYears: 3,
      frequency: "annual",
      startDate: "2026-01-15",
      graceMonths: 12,
      treatment: "capitalize",
      amortizationMethod: "scheduled",
      principalRanges: [{ from: 1, to: 1, amount: 10, unit: "percent" }],
    });
    assert.equal(result.amortizingPrincipal, 110);
    assert.equal(result.rows[1]?.principal, 11);
    assert.equal(result.rows.at(-1)?.principalBalance, 0);
  });

  it("lets a later percent replace an earlier amount", () => {
    const result = buildSchedule({
      ...annual,
      principalRanges: [
        { from: 1, to: 5, amount: 4 },
        { from: 1, to: 1, amount: 0, unit: "percent" },
      ],
    });
    assert.deepEqual(
      result.rows.map((row) => row.principal),
      [0, 4, 4, 4, 4],
    );
  });

  it("amortizes capitalized grace interest when no ranges are set", () => {
    const scheduled = buildSchedule({
      principal: 100,
      annualRatePercent: 10,
      termYears: 3,
      frequency: "annual",
      startDate: "2026-01-15",
      graceMonths: 12,
      treatment: "capitalize",
      amortizationMethod: "scheduled",
    });
    const equal = buildSchedule({
      ...scheduled.input,
      amortizationMethod: "equal-principal",
    });
    assert.equal(scheduled.amortizingPrincipal, 110);
    assert.deepEqual(
      scheduled.rows.map((row) => row.principal),
      equal.rows.map((row) => row.principal),
    );
  });
});

describe("principal column percent", () => {
  it("keeps a typed percent instead of replacing it with dollars", () => {
    assert.equal(
      principalCellDraft(
        [{ id: "p", from: "1", to: "1", amount: "10.", unit: "percent" }],
        1,
        2,
        "percent",
        20,
      ),
      "10.",
    );
  });

  it("shows an equal split as a percent of principal when the cell is not overridden", () => {
    assert.equal(principalCellDraft([], 1, 4, "percent", 20), "20");
  });

  it("converts a dollar range into the same percent of principal", () => {
    assert.equal(convertPrincipalInput("4", "amount", "percent", 20), "20");
    assert.equal(convertPrincipalInput("20", "percent", "amount", 20), "4");
  });
});

describe("parseLoanForm", () => {
  it("accepts a complete valid form", () => {
    const parsed = parseLoanForm({
      principal: "250000",
      annualRatePercent: "6.5",
      termYears: "30",
      frequency: "monthly",
      startDate: "2026-01-01",
      graceMonths: "0",
      treatment: "capitalize",
      amortizationMethod: "level",
    });
    assert.equal(parsed.ok, true);
  });

  it("keeps a 12-month grace period on a 30-year loan", () => {
    const parsed = parseLoanForm({
      principal: "250000",
      annualRatePercent: "6.5",
      termYears: "30",
      frequency: "monthly",
      startDate: "2026-01-01",
      graceMonths: "12",
      treatment: "capitalize",
      amortizationMethod: "level",
    });
    assert.equal(parsed.ok, true);
    if (parsed.ok) {
      assert.equal(parsed.input.graceMonths, 12);
    }
  });

  it("reports empty and invalid states separately", () => {
    const empty = parseLoanForm({
      principal: "",
      annualRatePercent: "",
      termYears: "",
      frequency: "monthly",
      startDate: "",
      graceMonths: "",
      treatment: "capitalize",
      amortizationMethod: "level",
    });
    assert.equal(empty.ok, false);
    if (!empty.ok) {
      assert.equal(empty.empty, true);
      assert.ok(empty.errors.principal);
    }

    const invalid = parseLoanForm({
      principal: "-5",
      annualRatePercent: "abc",
      termYears: "0",
      frequency: "monthly",
      startDate: "2026-13-40",
      graceMonths: "1.5",
      treatment: "accrue",
      amortizationMethod: "level",
    });
    assert.equal(invalid.ok, false);
    if (!invalid.ok) {
      assert.equal(invalid.empty, false);
      assert.ok(invalid.errors.principal);
      assert.ok(invalid.errors.annualRatePercent);
      assert.ok(invalid.errors.termYears);
      assert.ok(invalid.errors.startDate);
      assert.ok(invalid.errors.graceMonths);
    }
  });

  it("keeps a schedule when a principal range is incomplete", () => {
    const parsed = parseLoanForm({
      principal: "20",
      annualRatePercent: "10",
      termYears: "5",
      frequency: "annual",
      startDate: "2026-01-15",
      graceMonths: "0",
      treatment: "subsidized",
      amortizationMethod: "scheduled",
      principalRanges: [
        { id: "bad", from: "1", to: "2", amount: "" },
        { id: "ok", from: "1", to: "1", amount: "2" },
      ],
    });
    assert.equal(parsed.ok, true);
    assert.deepEqual(parsed.rangeErrors, [
      "Range 1 needs a principal amount of zero or more.",
    ]);
    if (parsed.ok) {
      assert.deepEqual(parsed.input.principalRanges, [
        { from: 1, to: 1, amount: 2 },
      ]);
    }
  });

  it("keeps a percent range and reports a blank percent", () => {
    const parsed = parseLoanForm({
      principal: "20",
      annualRatePercent: "10",
      termYears: "5",
      frequency: "annual",
      startDate: "2026-01-15",
      graceMonths: "0",
      treatment: "subsidized",
      amortizationMethod: "scheduled",
      principalRanges: [
        { id: "pct", from: "1", to: "2", amount: "10", unit: "percent" },
        { id: "blank", from: "3", to: "3", amount: "", unit: "percent" },
      ],
    });
    assert.equal(parsed.ok, true);
    assert.deepEqual(parsed.rangeErrors, [
      "Range 2 needs a principal percent of zero or more.",
    ]);
    if (parsed.ok) {
      assert.deepEqual(parsed.input.principalRanges, [
        { from: 1, to: 2, amount: 10, unit: "percent" },
      ]);
    }
  });

  it("rejects grace that consumes the entire term", () => {
    const parsed = parseLoanForm({
      principal: "10000",
      annualRatePercent: "6",
      termYears: "1",
      frequency: "monthly",
      startDate: "2026-01-01",
      graceMonths: "12",
      treatment: "capitalize",
      amortizationMethod: "level",
    });
    assert.equal(parsed.ok, false);
    if (!parsed.ok) {
      assert.ok(parsed.errors.graceMonths);
    }
  });
});
