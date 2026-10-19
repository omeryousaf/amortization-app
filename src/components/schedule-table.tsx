"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { PrincipalUnit, ScheduleResult } from "@/lib/amortization";
import { formatDate, formatIrr, formatMoney } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function ScheduleTable({
  result,
  principalEditor,
  principalColumn,
}: {
  result: ScheduleResult;
  principalColumn?: {
    unit: PrincipalUnit;
    onUnitChange: (unit: PrincipalUnit) => void;
  };
  principalEditor?: {
    gracePeriods: number;
    value: (repaymentPeriod: number, paidPrincipal: number) => string;
    onChange: (repaymentPeriod: number, value: string) => void;
  };
}) {
  const percentColumn = principalColumn?.unit === "percent";
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="sticky left-0 z-10 bg-background">#</TableHead>
          <TableHead>Date</TableHead>
          <TableHead>Phase</TableHead>
          <TableHead className="text-right">Payment</TableHead>
          <TableHead className="text-right">Interest</TableHead>
          <TableHead className="text-right">
            {principalColumn ? (
              <span className="inline-flex items-center justify-end gap-1.5 whitespace-nowrap">
                {percentColumn ? "Principal %" : "Principal"}
                <PrincipalUnitToggle
                  unit={principalColumn.unit}
                  onUnitChange={principalColumn.onUnitChange}
                />
              </span>
            ) : (
              "Principal"
            )}
          </TableHead>
          {result.showAccrued ? (
            <>
              <TableHead className="text-right">To accrued</TableHead>
              <TableHead className="text-right">Accrued balance</TableHead>
            </>
          ) : null}
          {result.showCapitalized ? (
            <TableHead className="text-right">Capitalized</TableHead>
          ) : null}
          <TableHead className="text-right">Principal balance</TableHead>
          <TableHead className="text-right">IRR</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {result.rows.map((row) => (
          <TableRow key={row.period}>
            <TableCell className="sticky left-0 z-10 bg-background font-medium">
              {row.period}
            </TableCell>
            <TableCell>{formatDate(row.date)}</TableCell>
            <TableCell>
              <Badge variant={row.phase === "grace" ? "secondary" : "outline"}>
                {row.phase === "grace" ? "Grace" : "Repayment"}
              </Badge>
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {formatMoney(row.payment)}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {formatMoney(row.interest)}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {principalEditor && row.phase === "repayment" ? (
                <span className="ml-auto inline-flex items-center justify-end gap-1">
                  <input
                    aria-label={`${percentColumn ? "Principal percent" : "Principal"} for repayment period ${row.period - principalEditor.gracePeriods}`}
                    inputMode="decimal"
                    value={principalEditor.value(
                      row.period - principalEditor.gracePeriods,
                      row.principal,
                    )}
                    onChange={(event) =>
                      principalEditor.onChange(
                        row.period - principalEditor.gracePeriods,
                        event.target.value,
                      )
                    }
                    className="h-7 w-24 rounded-md border border-input bg-background px-2 text-right text-sm tabular-nums outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  />
                  {percentColumn ? (
                    <span className="text-xs text-muted-foreground">%</span>
                  ) : null}
                </span>
              ) : percentColumn && row.phase === "grace" ? (
                "0%"
              ) : (
                formatMoney(row.principal)
              )}
            </TableCell>
            {result.showAccrued ? (
              <>
                <TableCell className="text-right tabular-nums">
                  {formatMoney(row.accruedApplied)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatMoney(row.accruedBalance)}
                </TableCell>
              </>
            ) : null}
            {result.showCapitalized ? (
              <TableCell className="text-right tabular-nums">
                {formatMoney(row.capitalized)}
              </TableCell>
            ) : null}
            <TableCell className="text-right tabular-nums">
              {formatMoney(row.principalBalance)}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {formatIrr(row.irrAnnualPercent)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell
            colSpan={3}
            className="sticky left-0 z-10 bg-muted/50 font-medium"
          >
            Totals
          </TableCell>
          <TableCell className="text-right tabular-nums">
            {formatMoney(result.totals.paid)}
          </TableCell>
          <TableCell className="text-right tabular-nums">
            {formatMoney(result.totals.interest)}
          </TableCell>
          <TableCell className="text-right tabular-nums">
            {formatMoney(result.totals.principal)}
          </TableCell>
          {result.showAccrued ? (
            <>
              <TableCell className="text-right tabular-nums">
                {formatMoney(result.totals.accruedApplied)}
              </TableCell>
              <TableCell />
            </>
          ) : null}
          {result.showCapitalized ? (
            <TableCell className="text-right tabular-nums">
              {formatMoney(result.totals.capitalized)}
            </TableCell>
          ) : null}
          <TableCell />
          <TableCell className="text-right tabular-nums">
            {formatIrr(result.irrAnnualPercent)}
          </TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  );
}

function PrincipalUnitToggle({
  unit,
  onUnitChange,
}: {
  unit: PrincipalUnit;
  onUnitChange: (unit: PrincipalUnit) => void;
}) {
  return (
    <span className="inline-flex rounded-md border border-input">
      {(
        [
          ["amount", "$", "Enter principal as an amount"],
          ["percent", "%", "Enter principal as a percent"],
        ] as const
      ).map(([option, label, description]) => (
        <button
          key={option}
          type="button"
          aria-label={description}
          aria-pressed={unit === option}
          onClick={() => onUnitChange(option)}
          className={cn(
            "h-6 px-1.5 text-xs",
            unit === option
              ? "bg-foreground text-background"
              : "text-muted-foreground",
          )}
        >
          {label}
        </button>
      ))}
    </span>
  );
}
