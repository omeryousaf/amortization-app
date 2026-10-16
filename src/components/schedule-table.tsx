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
import type { ScheduleResult } from "@/lib/amortization";
import { formatDate, formatIrr, formatMoney } from "@/lib/format";
import { Badge } from "@/components/ui/badge";

export function ScheduleTable({ result }: { result: ScheduleResult }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="sticky left-0 z-10 bg-background">#</TableHead>
          <TableHead>Date</TableHead>
          <TableHead>Phase</TableHead>
          <TableHead className="text-right">Payment</TableHead>
          <TableHead className="text-right">Interest</TableHead>
          <TableHead className="text-right">Principal</TableHead>
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
              {formatMoney(row.principal)}
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
