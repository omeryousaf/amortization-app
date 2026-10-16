# Loan amortization calculator

A fixed-rate amortization schedule with an optional grace period. Principal can be repaid with a level installment or in equal principal amounts. When grace is greater than zero, the calculator supports all three interest treatments:

1. **Capitalize into principal** — interest accrues during grace and is added to principal when repayment starts.
2. **Accrue separately** — principal is unchanged during grace; interest sits in a non-interest-bearing bucket. After grace, interest is charged only on principal, and the accrued bucket is repaid over the remaining term. A level payment applies to current interest, then the accrued bucket, then principal. An equal-principal payment pays current interest, an equal slice of the accrued bucket, and an equal slice of principal. The last payment absorbs leftover accrued interest.
3. **Lender-subsidized** — no borrower interest during grace; original principal is amortized over the remaining term.

## Run locally

```bash
cd "/Users/omeryousuf/Documents/APEX/Loan Amortization/amortization-app"
npm install
npm run dev
```

On this Mac: [http://127.0.0.1:4317](http://127.0.0.1:4317)

On another device on the same Wi‑Fi: `http://<this-mac-lan-ip>:4317` (the Mac’s address, for example `http://192.168.1.20:4317`).

The dev server binds to `0.0.0.0` on port `4317`, so it is reachable on the local network. Restart `npm run dev` after pulling this change. Skip `npm install` if `node_modules` already exists. If another device cannot connect, allow incoming connections for Node in macOS Firewall (System Settings → Network → Firewall).

## Other scripts

```bash
npm test
npm run build
npm run start
```

## Assumptions

- Fixed interest rate
- Fully amortizing after grace (no balloon), either level payment or equal principal
- Payments in arrears
- Accrual matches payment frequency
- Scheduled amounts are rounded to the cent; the last payment absorbs leftover cents
- Late-pay (days-after-due) grace is out of scope
