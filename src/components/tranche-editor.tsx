"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { TrancheForm } from "@/lib/amortization";

interface TrancheEditorProps {
  tranches: TrancheForm[];
  trancheErrors: string[];
  startDate: string;
  principal: string;
  onChange: (tranches: TrancheForm[]) => void;
}

const fieldClassName =
  "h-8 w-full min-w-0 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function TrancheEditor({
  tranches,
  trancheErrors,
  startDate,
  principal,
  onChange,
}: TrancheEditorProps) {
  return (
    <fieldset className="grid gap-3">
      <legend className="text-sm font-medium">Tranches</legend>
      <p className="text-xs leading-5 text-muted-foreground">
        Each tranche is drawn on its date and amortized on its own through the
        end of the term. The first schedule tab adds those tables together.
        Leave this empty to draw the full principal on the start date. A draw
        on a payment date starts earning interest in the following period.
      </p>

      {tranches.length > 0 ? (
        <div className="grid gap-3">
          {tranches.map((tranche, index) => (
            <div key={tranche.id} className="grid gap-2 rounded-xl border p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium">Tranche {index + 1}</p>
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={() =>
                    onChange(tranches.filter((item) => item.id !== tranche.id))
                  }
                >
                  Remove
                </Button>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="grid gap-1">
                  <Label htmlFor={`${tranche.id}-date`}>Draw date</Label>
                  <input
                    id={`${tranche.id}-date`}
                    type="date"
                    value={tranche.date}
                    onChange={(event) =>
                      updateTranche(
                        tranches,
                        tranche.id,
                        { date: event.target.value },
                        onChange,
                      )
                    }
                    className={fieldClassName}
                  />
                </div>
                <div className="grid gap-1">
                  <Label htmlFor={`${tranche.id}-amount`}>Amount</Label>
                  <input
                    id={`${tranche.id}-amount`}
                    inputMode="decimal"
                    value={tranche.amount}
                    onChange={(event) =>
                      updateTranche(
                        tranches,
                        tranche.id,
                        { amount: event.target.value },
                        onChange,
                      )
                    }
                    className={fieldClassName}
                  />
                </div>
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
            ...tranches,
            {
              id: crypto.randomUUID(),
              date: startDate,
              amount: tranches.length === 0 ? principal : "",
            },
          ])
        }
      >
        Add tranche
      </Button>

      {trancheErrors.map((error, index) => (
        <p
          key={`${error}-${index}`}
          className="text-xs text-destructive"
          role="alert"
        >
          {error}
        </p>
      ))}
    </fieldset>
  );
}

function updateTranche(
  tranches: TrancheForm[],
  id: string,
  patch: Partial<TrancheForm>,
  onChange: (tranches: TrancheForm[]) => void,
) {
  onChange(
    tranches.map((tranche) =>
      tranche.id === id ? { ...tranche, ...patch } : tranche,
    ),
  );
}
