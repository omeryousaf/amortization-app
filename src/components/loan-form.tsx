"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  FREQUENCY_META,
  TREATMENT_META,
  type FieldErrors,
  type FormValues,
  type GraceTreatment,
  type PaymentFrequency,
} from "@/lib/amortization";
import { cn } from "@/lib/utils";

const FREQUENCIES = Object.keys(FREQUENCY_META) as PaymentFrequency[];
const TREATMENTS = Object.keys(TREATMENT_META) as GraceTreatment[];

interface LoanFormProps {
  values: FormValues;
  errors: FieldErrors;
  onChange: (patch: Partial<FormValues>) => void;
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="text-xs text-destructive" role="alert">
      {message}
    </p>
  );
}

function enteredGraceMonths(value: string): number {
  const parsed = Number.parseInt(value.trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export function LoanForm({
  values,
  errors,
  onChange,
}: LoanFormProps) {
  const showGraceTreatments = enteredGraceMonths(values.graceMonths) > 0;
  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => event.preventDefault()}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="principal">Principal</Label>
          <Input
            id="principal"
            inputMode="decimal"
            placeholder="250000"
            value={values.principal}
            aria-invalid={Boolean(errors.principal)}
            onChange={(event) => onChange({ principal: event.target.value })}
          />
          <FieldError message={errors.principal} />
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="annualRatePercent">Annual interest rate (%)</Label>
          <Input
            id="annualRatePercent"
            inputMode="decimal"
            placeholder="6.5"
            value={values.annualRatePercent}
            aria-invalid={Boolean(errors.annualRatePercent)}
            onChange={(event) =>
              onChange({ annualRatePercent: event.target.value })
            }
          />
          <FieldError message={errors.annualRatePercent} />
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="termYears">Term (years)</Label>
          <Input
            id="termYears"
            inputMode="decimal"
            placeholder="30"
            value={values.termYears}
            aria-invalid={Boolean(errors.termYears)}
            onChange={(event) => onChange({ termYears: event.target.value })}
          />
          <FieldError message={errors.termYears} />
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="frequency">Payment frequency</Label>
          <select
            id="frequency"
            value={values.frequency}
            aria-invalid={Boolean(errors.frequency)}
            onChange={(event) =>
              onChange({ frequency: event.target.value as PaymentFrequency })
            }
            className="h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive md:text-sm"
          >
            {FREQUENCIES.map((frequency) => (
              <option key={frequency} value={frequency}>
                {FREQUENCY_META[frequency].label} —{" "}
                {FREQUENCY_META[frequency].hint}
              </option>
            ))}
          </select>
          <FieldError message={errors.frequency} />
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="startDate">Start date</Label>
          <Input
            id="startDate"
            type="date"
            value={values.startDate}
            aria-invalid={Boolean(errors.startDate)}
            onChange={(event) => onChange({ startDate: event.target.value })}
          />
          <p className="text-xs text-muted-foreground">
            Origination date. Payments are in arrears, so the first period ends
            one frequency later.
          </p>
          <FieldError message={errors.startDate} />
        </div>

        <div className="grid gap-1.5 sm:col-span-2">
          <Label htmlFor="graceMonths">Grace period (months)</Label>
          <input
            id="graceMonths"
            name="graceMonths"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            placeholder="0"
            value={values.graceMonths}
            aria-invalid={Boolean(errors.graceMonths)}
            onInput={(event) =>
              onChange({ graceMonths: event.currentTarget.value })
            }
            onChange={(event) =>
              onChange({ graceMonths: event.currentTarget.value })
            }
            className="h-8 w-full min-w-0 rounded-lg border border-input bg-background px-2.5 py-1 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive md:text-sm"
          />
          <p className="text-xs text-muted-foreground">
            {showGraceTreatments
              ? `${enteredGraceMonths(values.graceMonths)}-month grace is on. Choose how interest is treated below.`
              : "Use 0 for no grace. Late-pay (days-after-due) grace is not modeled."}
          </p>
          <FieldError message={errors.graceMonths} />
        </div>
      </div>

      {showGraceTreatments ? (
        <fieldset className="grid gap-3">
          <legend className="text-sm font-medium">
            Grace interest treatment
          </legend>
          <div className="grid gap-2">
            {TREATMENTS.map((treatment) => {
              const selected = values.treatment === treatment;
              return (
                <button
                  key={treatment}
                  type="button"
                  onClick={() => onChange({ treatment })}
                  aria-pressed={selected}
                  className={cn(
                    "rounded-xl border px-3 py-3 text-left transition-colors",
                    selected
                      ? "border-foreground/20 bg-muted"
                      : "border-border hover:bg-muted/50",
                  )}
                >
                  <div className="text-sm font-medium">
                    {TREATMENT_META[treatment].label}
                  </div>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {TREATMENT_META[treatment].summary}
                  </p>
                </button>
              );
            })}
          </div>
          <FieldError message={errors.treatment} />
        </fieldset>
      ) : (
        <Alert>
          <AlertTitle>No grace period</AlertTitle>
          <AlertDescription>
            The loan amortizes from the first period. Enter a number of months
            above (for example 12) to compare capitalization, a separate
            accrued bucket, and lender-subsidized interest.
          </AlertDescription>
        </Alert>
      )}
    </form>
  );
}
