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
  FREQUENCY_META,
  parseLoanForm,
  TREATMENT_META,
  type FormValues,
} from "@/lib/amortization";
import { formatDate, formatIrr, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

const defaultValues: FormValues = {
  principal: "250000",
  annualRatePercent: "6.5",
  termYears: "30",
  frequency: "monthly",
  startDate: "2026-01-01",
  graceMonths: "0",
  treatment: "capitalize",
  amortizationMethod: "level",
};

export function LoanCalculator() {
  const [values, setValues] = useState<FormValues>(defaultValues);

  const parsed = useMemo(() => parseLoanForm(values), [values]);

  const result = parsed.ok ? buildSchedule(parsed.input) : null;
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
          Build a fully amortizing schedule with a level installment or equal
          principal repayments. When a grace period is included, compare
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

          {result ? (
            <>
              <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                <SummaryCard
                  label={
                    result.input.amortizationMethod === "equal-principal"
                      ? "Principal each period"
                      : "Level payment"
                  }
                  value={formatMoney(result.scheduledPayment)}
                  hint={
                    result.input.amortizationMethod === "equal-principal"
                      ? `${FREQUENCY_META[result.input.frequency].label} principal reduction. The installment declines as interest falls; the last period absorbs leftover cents.`
                      : `${FREQUENCY_META[result.input.frequency].label} · ${result.totalPeriods} periods. Last installment absorbs leftover cents.`
                  }
                />
                <SummaryCard
                  label="Total paid"
                  value={formatMoney(result.totals.paid)}
                  hint={`${result.repaymentPeriods} ${FREQUENCY_META[result.input.frequency].label.toLowerCase()} repayment ${result.repaymentPeriods === 1 ? "period" : "periods"}`}
                />
                <SummaryCard
                  label="Total interest"
                  value={formatMoney(result.totals.interest)}
                  hint="Borrower-paid interest over the full schedule."
                />
                <SummaryCard
                  label="IRR"
                  value={formatIrr(result.irrAnnualPercent)}
                  hint="Annualized internal rate of return of disbursement vs. the payment stream."
                />
                <SummaryCard
                  label="First payment date"
                  value={
                    result.rows.find((row) => row.payment > 0)?.date
                      ? formatDate(
                          result.rows.find((row) => row.payment > 0)!.date,
                        )
                      : "—"
                  }
                  hint={
                    result.gracePeriods > 0
                      ? `${result.gracePeriods} grace ${result.gracePeriods === 1 ? "period" : "periods"} before repayment`
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
                  <CardTitle>Amortization schedule</CardTitle>
                  <CardDescription>
                    {result.input.amortizationMethod === "equal-principal"
                      ? "Each repayment period reduces principal by the same amount. Interest is charged on the current principal, so the installment declines."
                      : "The installment stays level. Interest is charged on the current principal, and the rest of the installment reduces principal."}{" "}
                    {result.showAccrued
                      ? result.input.amortizationMethod === "equal-principal"
                        ? "Accrued grace interest is paid in equal slices alongside principal."
                        : "A level payment covers current interest, then accrued grace interest, then principal."
                      : null}{" "}
                    The final payment clears remaining principal
                    {result.showAccrued ? " and any leftover accrued interest" : ""}.
                    IRR is annualized to date on the same compounding basis as
                    the loan rate (disbursement at start, then each
                    period&apos;s payment). Grace periods with a $0 payment
                    show an em dash until cash starts coming back.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ScheduleTable result={result} />
                </CardContent>
              </Card>
            </>
          ) : null}
        </div>
      </div>

      <Separator />
      <p className="max-w-3xl text-xs leading-5 text-muted-foreground">
        Assumptions: fixed rate, fully amortizing after grace by level payment
        or equal principal, no balloon, payments in arrears, and no late-pay
        (days-after-due) grace. This is a calculator, not lending, tax, or
        legal advice.
      </p>
    </div>
  );
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
