import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildSchedule,
  compareTreatments,
  gracePeriodCount,
  parseLoanForm,
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
    });
    const last = result.rows.at(-1);
    assert.ok(last);
    assert.ok(last.accruedApplied > 0);
    assert.ok(last.payment > result.scheduledPayment);
    assert.equal(last.accruedBalance, 0);
    assert.equal(last.principalBalance, 0);
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

  it("rejects grace that consumes the entire term", () => {
    const parsed = parseLoanForm({
      principal: "10000",
      annualRatePercent: "6",
      termYears: "1",
      frequency: "monthly",
      startDate: "2026-01-01",
      graceMonths: "12",
      treatment: "capitalize",
    });
    assert.equal(parsed.ok, false);
    if (!parsed.ok) {
      assert.ok(parsed.errors.graceMonths);
    }
  });
});
