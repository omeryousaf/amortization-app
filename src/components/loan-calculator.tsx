"use client";

import { useMemo, useState } from "react";
import { LoanForm } from "@/components/loan-form";
import { ScheduleTable } from "@/components/schedule-table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  AMORTIZATION_META,
  buildSchedule,
  compareTreatments,
  EDITABLE_PRINCIPAL_PERIOD_LIMIT,
  FREQUENCY_META,
  convertPrincipalInput,
  parseLoanForm,
  principalCellDraft,
  TREATMENT_META,
  type FormValues,
  type PrincipalRangeForm,
  type PrincipalUnit,
} from "@/lib/amortization";
import { formatDate, formatIrr, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

const defaultValues: FormValues = {
  principal: "20",
  annualRatePercent: "10",
  termYears: "5",
  frequency: "annual",
  startDate: "2026-01-01",
  graceMonths: "0",
  treatment: "capitalize",
  amortizationMethod: "level",
  principalRanges: [],
  principalUnit: "amount",
  tranches: [],
};

export function LoanCalculator() {
  const [values, setValues] = useState<FormValues>(defaultValues);
  const [scheduleTab, setScheduleTab] = useState(0);

  const parsed = useMemo(() => parseLoanForm(values), [values]);

  const result = parsed.ok ? buildSchedule(parsed.input) : null;
  const trancheSchedules = result?.trancheSchedules ?? [];
  const activeTab = Math.min(scheduleTab, trancheSchedules.length);
  const schedule = result
    ? activeTab > 0
      ? (trancheSchedules[activeTab - 1]?.result ?? result)
      : result
    : null;
  const comparison =
    parsed.ok && parsed.input.graceMonths > 0
      ? compareTreatments(parsed.input)
      : null;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-3">
        <Badge variant="secondary" className="w-fit">
          Fixed-rate calculator
        </Badge>
        <h1 className="font-heading text-3xl tracking-tight sm:text-4xl">
          Loan amortization
        </h1>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
          Build a fully amortizing schedule with a level installment, equal
          principal, or a principal schedule you set. Draw the loan in
          tranches to get one table per tranche plus a consolidated table.
          When a grace period is included, compare
          capitalizing interest, holding it in a separate accrued bucket, or
          having the lender subsidize it.
        </p>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <Card className="overflow-visible lg:sticky lg:top-6">
          <CardHeader>
            <CardTitle>Loan details</CardTitle>
            <CardDescription>
              Change any field to rebuild the schedule. Figures are in US
              dollars.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LoanForm
              values={values}
              errors={parsed.ok ? {} : parsed.empty ? {} : parsed.errors}
              rangeErrors={parsed.rangeErrors}
              trancheErrors={parsed.trancheErrors}
              warnings={result?.trancheSchedules ? [] : (result?.warnings ?? [])}
              principalPlan={result?.principalPlan ?? null}
              includesCapitalizedInterest={result?.showCapitalized ?? false}
              onChange={(patch) => {
                setValues((current) => ({ ...current, ...patch }));
              }}
            />
          </CardContent>
        </Card>

        <div className="grid gap-6">
          {!parsed.ok && parsed.empty ? (
            <Alert>
              <AlertTitle>Enter loan details</AlertTitle>
              <AlertDescription>
                Add a principal, annual rate, term, and start date to generate
                a payment schedule.
              </AlertDescription>
            </Alert>
          ) : null}

          {!parsed.ok && !parsed.empty ? (
            <Alert variant="destructive">
              <AlertTitle>Some inputs need attention</AlertTitle>
              <AlertDescription>
                Correct the highlighted fields to see an amortization schedule.
                Grace must leave at least one repayment period, and the start
                date must be a real calendar date.
              </AlertDescription>
            </Alert>
          ) : null}

          {result && schedule ? (
            <>
              <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                <SummaryCard
                  label={
                    trancheSchedules.length > 0 && activeTab === 0
                      ? "First installment"
                      : schedule.input.amortizationMethod === "scheduled"
                        ? "First installment"
                        : schedule.input.amortizationMethod === "equal-principal"
                          ? "Principal each period"
                          : "Level payment"
                  }
                  value={formatMoney(schedule.scheduledPayment)}
                  hint={
                    trancheSchedules.length > 0 && activeTab === 0
                      ? "Combined payment on the first repayment date. Later dates change as tranches are drawn."
                      : schedule.input.amortizationMethod === "scheduled"
                        ? "Interest plus the principal scheduled for the first repayment period. Later installments change as both change."
                        : schedule.input.amortizationMethod === "equal-principal"
                          ? `${FREQUENCY_META[schedule.input.frequency].label} principal reduction. The installment declines as interest falls; the last period absorbs leftover cents.`
                          : `${FREQUENCY_META[schedule.input.frequency].label} · ${schedule.rows.length} periods. Last installment absorbs leftover cents.`
                  }
                />
                <SummaryCard
                  label="Total paid"
                  value={formatMoney(schedule.totals.paid)}
                  hint={`${schedule.repaymentPeriods} ${FREQUENCY_META[schedule.input.frequency].label.toLowerCase()} repayment ${schedule.repaymentPeriods === 1 ? "period" : "periods"}`}
                />
                <SummaryCard
                  label="Total interest"
                  value={formatMoney(schedule.totals.interest)}
                  hint="Borrower-paid interest over the full schedule."
                />
                <SummaryCard
                  label="IRR"
                  value={formatIrr(schedule.irrAnnualPercent)}
                  hint="Annualized internal rate of return of disbursement vs. the payment stream."
                />
                <SummaryCard
                  label="First payment date"
                  value={
                    schedule.rows.find((row) => row.payment > 0)?.date
                      ? formatDate(
                          schedule.rows.find((row) => row.payment > 0)!.date,
                        )
                      : "—"
                  }
                  hint={
                    schedule.gracePeriods > 0 &&
                    schedule.rows.some((row) => row.phase === "grace")
                      ? `${schedule.rows.filter((row) => row.phase === "grace").length} grace ${schedule.rows.filter((row) => row.phase === "grace").length === 1 ? "period" : "periods"} before repayment`
                      : "No grace; repayment starts at period 1"
                  }
                />
              </section>

              {comparison ? (
                <Card>
                  <CardHeader>
                    <CardTitle>Grace treatment comparison</CardTitle>
                    <CardDescription>
                      Same loan, three ways to handle interest during the{" "}
                      {result.input.graceMonths}-month grace period, using{" "}
                      {AMORTIZATION_META[
                        result.input.amortizationMethod
                      ].label.toLowerCase()}{" "}
                      amortization.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-3 md:grid-cols-3">
                    {comparison.map((row) => {
                      const selected =
                        parsed.ok && parsed.input.treatment === row.treatment;
                      return (
                        <button
                          key={row.treatment}
                          type="button"
                          onClick={() =>
                            setValues((current) => ({
                              ...current,
                              treatment: row.treatment,
                            }))
                          }
                          className={cn(
                            "rounded-xl border px-3 py-3 text-left",
                            selected
                              ? "border-foreground/20 bg-muted"
                              : "border-border hover:bg-muted/40",
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-medium">
                              {TREATMENT_META[row.treatment].label}
                            </p>
                            {selected ? (
                              <Badge>Selected</Badge>
                            ) : (
                              <Badge variant="outline">View</Badge>
                            )}
                          </div>
                          <dl className="mt-3 grid gap-1 text-sm">
                            <div className="flex justify-between gap-3">
                              <dt className="text-muted-foreground">
                                {result.input.amortizationMethod ===
                                "scheduled"
                                  ? "First installment"
                                  : result.input.amortizationMethod ===
                                      "equal-principal"
                                    ? "Principal each period"
                                    : "Level payment"}
                              </dt>
                              <dd className="tabular-nums">
                                {formatMoney(row.scheduledPayment)}
                              </dd>
                            </div>
                            <div className="flex justify-between gap-3">
                              <dt className="text-muted-foreground">
                                Total interest
                              </dt>
                              <dd className="tabular-nums">
                                {formatMoney(row.totalInterest)}
                              </dd>
                            </div>
                            <div className="flex justify-between gap-3">
                              <dt className="text-muted-foreground">
                                Total paid
                              </dt>
                              <dd className="tabular-nums">
                                {formatMoney(row.totalPaid)}
                              </dd>
                            </div>
                            <div className="flex justify-between gap-3">
                              <dt className="text-muted-foreground">IRR</dt>
                              <dd className="tabular-nums">
                                {formatIrr(row.irrAnnualPercent)}
                              </dd>
                            </div>
                          </dl>
                        </button>
                      );
                    })}
                  </CardContent>
                </Card>
              ) : null}

              <Card>
                <CardHeader>
                  <CardTitle>
                    {activeTab === 0
                      ? "Amortization schedule"
                      : `Tranche ${activeTab}`}
                  </CardTitle>
                  <CardDescription>
                    {trancheSchedules.length > 0 && activeTab === 0
                      ? "This table adds every tranche schedule together. Each other tab is one tranche, amortized on its own from its draw date through the end of the term."
                      : activeTab > 0
                        ? `This tranche draws ${formatMoney(trancheSchedules[activeTab - 1]?.amount ?? 0)} on ${formatDate(trancheSchedules[activeTab - 1]?.date ?? schedule.input.startDate)} and amortizes that amount alone.`
                        : schedule.input.amortizationMethod === "scheduled"
                          ? "Each repayment period reduces principal by the amount or percent of principal you scheduled. Interest is charged on the current principal and added to that amount."
                          : schedule.input.amortizationMethod === "equal-principal"
                            ? "Each repayment period reduces principal by the same amount. Interest is charged on the current principal, so the installment declines."
                            : "The installment stays level. Interest is charged on the current principal, and the rest of the installment reduces principal."}{" "}
                    {trancheSchedules.length === 0 ? (
                      <>
                        {schedule.showAccrued
                          ? schedule.input.amortizationMethod === "level"
                            ? "A level payment covers current interest, then accrued grace interest, then principal."
                            : "Accrued grace interest is paid in equal slices alongside principal."
                          : null}{" "}
                        The final payment clears remaining principal
                        {schedule.showAccrued
                          ? " and any leftover accrued interest"
                          : ""}
                        . IRR is annualized to date on the same compounding
                        basis as the loan rate. Grace periods with a $0 payment
                        show an em dash until cash starts coming back.
                      </>
                    ) : null}
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4">
                  {trancheSchedules.length > 0 ? (
                    <div
                      role="tablist"
                      aria-label="Amortization tables"
                      className="flex flex-wrap gap-2"
                    >
                      <button
                        type="button"
                        role="tab"
                        aria-selected={activeTab === 0}
                        onClick={() => setScheduleTab(0)}
                        className={cn(
                          "rounded-lg border px-3 py-1.5 text-sm",
                          activeTab === 0
                            ? "border-foreground/20 bg-muted font-medium"
                            : "border-border hover:bg-muted/50",
                        )}
                      >
                        Consolidated
                      </button>
                      {trancheSchedules.map((tranche) => (
                        <button
                          key={`${tranche.index}-${tranche.date}-${tranche.amount}`}
                          type="button"
                          role="tab"
                          aria-selected={activeTab === tranche.index}
                          onClick={() => setScheduleTab(tranche.index)}
                          className={cn(
                            "rounded-lg border px-3 py-1.5 text-sm",
                            activeTab === tranche.index
                              ? "border-foreground/20 bg-muted font-medium"
                              : "border-border hover:bg-muted/50",
                          )}
                        >
                          Tranche {tranche.index}
                          <span className="ml-1 text-muted-foreground">
                            {formatMoney(tranche.amount)}
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                  {activeTab === 0 && result.warnings.length > 0 ? (
                    <div className="grid gap-1">
                      {result.warnings.map((warning, index) => (
                        <p
                          key={`${warning}-${index}`}
                          className="text-xs text-destructive"
                          role="alert"
                        >
                          {warning}
                        </p>
                      ))}
                    </div>
                  ) : null}
                  <ScheduleTable
                    result={schedule}
                    showDrawn={trancheSchedules.length > 0}
                    principalColumn={
                      schedule.input.amortizationMethod === "scheduled"
                        ? {
                            unit: principalUnit(values.principalUnit),
                            onUnitChange: (unit) =>
                              setValues((current) => ({
                                ...current,
                                principalUnit: unit,
                                principalRanges: (
                                  current.principalRanges ?? []
                                ).map((range) =>
                                  convertPrincipalRange(
                                    range,
                                    unit,
                                    schedule.amortizingPrincipal,
                                  ),
                                ),
                              })),
                          }
                        : undefined
                    }
                    principalEditor={
                      trancheSchedules.length === 0 &&
                      schedule.input.amortizationMethod === "scheduled" &&
                      schedule.repaymentPeriods <=
                        EDITABLE_PRINCIPAL_PERIOD_LIMIT
                        ? {
                            gracePeriods: result.gracePeriods,
                            value: (repaymentPeriod, paidPrincipal) =>
                              principalCellDraft(
                                values.principalRanges ?? [],
                                repaymentPeriod,
                                result.principalPlan?.amounts[
                                  repaymentPeriod - 1
                                ] ?? paidPrincipal,
                                principalUnit(values.principalUnit),
                                result.amortizingPrincipal,
                              ),
                            onChange: (repaymentPeriod, amount) =>
                              setValues((current) => ({
                                ...current,
                                principalRanges: withPeriodAmount(
                                  current.principalRanges ?? [],
                                  repaymentPeriod,
                                  amount,
                                  principalUnit(current.principalUnit),
                                ),
                              })),
                          }
                        : undefined
                    }
                  />
                </CardContent>
              </Card>
            </>
          ) : null}
        </div>
      </div>

      <Separator />
      <p className="max-w-3xl text-xs leading-5 text-muted-foreground">
        Assumptions: fixed rate, fully amortizing after grace by level payment,
        equal principal, or a principal schedule, no balloon, payments in
        arrears, and no late-pay (days-after-due) grace. This is a calculator,
        not lending, tax, or legal advice.
      </p>
    </div>
  );
}

function principalUnit(unit: PrincipalUnit | undefined): PrincipalUnit {
  return unit === "percent" ? "percent" : "amount";
}

function convertPrincipalRange(
  range: PrincipalRangeForm,
  unit: PrincipalUnit,
  target: number,
): PrincipalRangeForm {
  const from = principalUnit(range.unit);
  return {
    ...range,
    unit,
    amount: convertPrincipalInput(range.amount, from, unit, target),
  };
}

function withPeriodAmount(
  ranges: PrincipalRangeForm[],
  repaymentPeriod: number,
  amount: string,
  unit: PrincipalUnit,
): PrincipalRangeForm[] {
  const period = String(repaymentPeriod);
  const existing = [...ranges]
    .reverse()
    .find(
      (range) => range.from.trim() === period && range.to.trim() === period,
    );
  const kept = ranges.filter((range) => range.id !== existing?.id);
  return [
    ...kept,
    {
      id: existing?.id ?? crypto.randomUUID(),
      from: period,
      to: period,
      amount,
      unit,
    },
  ];
}

function SummaryCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-xl tabular-nums">{value}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}
