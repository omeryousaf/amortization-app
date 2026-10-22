"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  EDITABLE_PRINCIPAL_PERIOD_LIMIT,
  principalEachPeriod,
  roundCents,
  type PrincipalPlan,
  type PrincipalRangeForm,
  type PrincipalUnit,
} from "@/lib/amortization";
import { formatMoney } from "@/lib/format";

interface PrincipalScheduleEditorProps {
  ranges: PrincipalRangeForm[];
  unit: PrincipalUnit;
  rangeErrors: string[];
  warnings: string[];
  plan: PrincipalPlan | null;
  includesCapitalizedInterest: boolean;
  onChange: (ranges: PrincipalRangeForm[]) => void;
}

const fieldClassName =
  "h-8 w-full min-w-0 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function PrincipalScheduleEditor({
  ranges,
  unit,
  rangeErrors,
  warnings,
  plan,
  includesCapitalizedInterest,
  onChange,
}: PrincipalScheduleEditorProps) {
  return (
    <fieldset className="grid gap-3">
      <legend className="text-sm font-medium">Principal schedule</legend>
      <p className="text-xs leading-5 text-muted-foreground">
        {plan
          ? statusText(plan, ranges.length, includesCapitalizedInterest)
          : "Enter a valid loan to see how much principal must be scheduled."}{" "}
        Choose $ or % in the principal column. A percent is a share of the
        principal being repaid, and a range applies it to every period it
        covers. When the loan is drawn in tranches, a dollar amount is applied
        to each tranche and a percent is of that tranche&apos;s own principal.
        Later ranges replace earlier ones on the same period. Period 1 is the
        first repayment, after any grace.
        {plan && plan.amounts.length <= EDITABLE_PRINCIPAL_PERIOD_LIMIT
          ? " This schedule is short enough to edit principal in the table too."
          : ""}
      </p>

      {ranges.length > 0 ? (
        <div className="grid gap-3">
          {ranges.map((range, index) => (
            <div key={range.id} className="grid gap-2 rounded-xl border p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium">Range {index + 1}</p>
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={() =>
                    onChange(ranges.filter((item) => item.id !== range.id))
                  }
                >
                  Remove
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="grid gap-1">
                  <Label htmlFor={`${range.id}-from`}>From period</Label>
                  <input
                    id={`${range.id}-from`}
                    inputMode="numeric"
                    value={range.from}
                    onChange={(event) =>
                      updateRange(ranges, range.id, { from: event.target.value }, onChange)
                    }
                    className={fieldClassName}
                  />
                </div>
                <div className="grid gap-1">
                  <Label htmlFor={`${range.id}-to`}>To period</Label>
                  <input
                    id={`${range.id}-to`}
                    inputMode="numeric"
                    value={range.to}
                    onChange={(event) =>
                      updateRange(ranges, range.id, { to: event.target.value }, onChange)
                    }
                    className={fieldClassName}
                  />
                </div>
              </div>
              <div className="grid gap-1">
                <Label htmlFor={`${range.id}-amount`}>
                  {unit === "percent"
                    ? "Percent each period"
                    : "Principal each period"}
                </Label>
                <div className="flex items-center gap-2">
                  <input
                    id={`${range.id}-amount`}
                    inputMode="decimal"
                    value={range.amount}
                    onChange={(event) =>
                      updateRange(
                        ranges,
                        range.id,
                        { amount: event.target.value, unit },
                        onChange,
                      )
                    }
                    className={fieldClassName}
                  />
                  {unit === "percent" ? (
                    <span className="text-sm text-muted-foreground">%</span>
                  ) : null}
                </div>
                {unit === "percent" && plan ? (
                  <p className="text-xs text-muted-foreground">
                    {percentHint(range.amount, plan.target)}
                  </p>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-fit"
        onClick={() =>
          onChange([
            ...ranges,
            {
              id: crypto.randomUUID(),
              from: "1",
              to: "1",
              amount: "0",
              unit,
            },
          ])
        }
      >
        Add range
      </Button>

      {rangeErrors.map((error, index) => (
        <p
          key={`${error}-${index}`}
          className="text-xs text-destructive"
          role="alert"
        >
          {error}
        </p>
      ))}
      {warnings.map((warning, index) => (
        <p
          key={`${warning}-${index}`}
          className="text-xs text-destructive"
          role="alert"
        >
          {warning}
        </p>
      ))}
    </fieldset>
  );
}

function updateRange(
  ranges: PrincipalRangeForm[],
  id: string,
  patch: Partial<PrincipalRangeForm>,
  onChange: (ranges: PrincipalRangeForm[]) => void,
) {
  onChange(
    ranges.map((range) => (range.id === id ? { ...range, ...patch } : range)),
  );
}

function percentHint(amount: string, target: number): string {
  const percent = Number(amount);
  if (amount.trim() === "" || !Number.isFinite(percent) || percent < 0) {
    return "Enter a percent of the principal being repaid.";
  }
  const each = principalEachPeriod({ amount: percent, unit: "percent" }, target);
  return `${formatMoney(each)} each period, ${percent}% of ${formatMoney(target)}.`;
}

function statusText(
  plan: PrincipalPlan,
  rangeCount: number,
  includesCapitalizedInterest: boolean,
): string {
  const periods = plan.amounts.length;
  const capitalized = includesCapitalizedInterest
    ? " That balance includes interest capitalized at the end of grace."
    : "";
  if (rangeCount === 0) {
    return `No custom ranges. ${formatMoney(plan.target)} is split equally across ${periods} repayment ${periods === 1 ? "period" : "periods"}.${capitalized}`;
  }

  const left = roundCents(plan.target - plan.explicitSum);
  if (plan.uncoveredCount > 0 && left > 0) {
    return `${formatMoney(plan.explicitSum)} is set on custom ranges. ${formatMoney(left)} is split across the other ${plan.uncoveredCount} ${plan.uncoveredCount === 1 ? "period" : "periods"}.${capitalized}`;
  }
  if (plan.uncoveredCount > 0 && left === 0) {
    return `${formatMoney(plan.explicitSum)} covers the full ${formatMoney(plan.target)} balance. The other ${plan.uncoveredCount} ${plan.uncoveredCount === 1 ? "period repays" : "periods repay"} no principal.${capitalized}`;
  }
  if (left < 0) {
    return `Custom ranges schedule ${formatMoney(plan.explicitSum)}, which is more than the ${formatMoney(plan.target)} to repay.${capitalized}`;
  }
  return `Custom ranges schedule ${formatMoney(plan.explicitSum)}, matching the ${formatMoney(plan.target)} to repay.${capitalized}`;
}
