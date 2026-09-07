import { notFound, redirect } from 'next/navigation';
import '@/engine.server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/require-user';
import {
  monthlySeries, benchmarkMonthly, yearlyVsBenchmark, overviewFrom, stockReport,
  missingMonths, failedImports, stockYearReport, accountIrr, yearlyIrr,
} from '@/lib/gotrade/report';
import { AccountDashboard } from '@/components/AccountDashboard';
import { livePortfolio } from '@/lib/ipot/positions';
import { loadAccount } from '@/lib/account-page';

export const dynamic = 'force-dynamic';

export default async function AccountDashboardPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const { accountId, account } = await loadAccount(id);
  if (!account) notFound();

  // Gold has no statements — its dashboard is a different shape entirely, so
  // send it there rather than rendering an empty statement view.
  if (account.kind === 'COMMODITY') redirect(`/accounts/${id}/gold`);

  const [months, bench, stocks, missing, failed] = await Promise.all([
    monthlySeries(prisma, accountId),
    benchmarkMonthly(prisma, accountId),
    stockReport(prisma, accountId),
    missingMonths(prisma, accountId),
    failedImports(prisma, accountId),
  ]);

  const years = yearlyVsBenchmark(months, bench);
  // "This year" is the newest year present in the data, not the wall-clock year:
  // the statements can be months behind, and an empty box would be the result.
  const latestYear = years.length ? years[years.length - 1] : null;
  // The year's chart starts at LAST year's closing value, so "2026 so far" is
  // measured from where 2025 ended rather than from January's own close.
  const yearMonths = latestYear ? months.filter((m) => m.period.startsWith(latestYear.year)) : [];
  const firstIdx = yearMonths.length ? months.indexOf(yearMonths[0]) : -1;
  const thisYearMonths = firstIdx > 0 ? [months[firstIdx - 1], ...yearMonths] : yearMonths;

  const newest = months.length ? months[months.length - 1] : null;
  const asAt = newest
    ? (() => {
        const [y, m] = newest.period.split('-').map(Number);
        const now = new Date();
        return {
          period: new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' }),
          monthsBehind: Math.max(0, (now.getUTCFullYear() - y) * 12 + (now.getUTCMonth() - (m - 1))),
        };
      })()
    : null;

  /**
   * Where a broker's statement carries no prices, value the position at MARKET
   * instead of at the last snapshot. Verified against Andre's live IPOT app on
   * 2026-09-07: all seven positions matched to the share.
   */
  const live = await livePortfolio(accountId);
  const overview = overviewFrom(months, bench, stocks);
  if (live && overview && live.positions.length) {
    overview.latestValue = live.totalValue;
    overview.cash = live.cash;
    overview.holdingsValue = live.holdingsValue;
    overview.cashPct = live.totalValue > 0 ? live.cash / live.totalValue : 0;
    overview.gain = Math.round((live.totalValue - overview.contributions) * 100) / 100;
    overview.simpleReturn = overview.contributions > 0 ? overview.gain / overview.contributions : null;
    // Deliberately NOT clearing the staleness flags. Today's value is now
    // known, but the MONTHLY HISTORY still carries December 2023 prices — there
    // is no source of historical IDX prices here — so a time-weighted return
    // chained over those months remains meaningless and must stay suppressed.
    // Clearing them let "-5.64% a year" back onto an account that has grown.
    overview.topSymbol = live.positions[0]?.symbol ?? null;
    overview.topWeightPct = live.positions[0]?.weightPct ?? null;
  }
  const [yearStocks, irr, irrYears] = await Promise.all([
    latestYear ? stockYearReport(prisma, accountId, latestYear.year) : Promise.resolve([]),
    overview
      ? accountIrr(prisma, accountId, overview.latestValue, new Date(months[months.length - 1].periodEnd))
      : Promise.resolve(null),
    yearlyIrr(prisma, accountId, months),
  ]);

  return (
    <AccountDashboard
      accountId={id}
      accountName={account.name}
      provider={account.provider.label}
      currency={account.currency}
      accountNo={account.externalAccountNo}
      overview={overview}
      stocks={live && live.positions.length
        ? live.positions.map((pos) => ({
            symbol: pos.symbol, name: pos.name, quantity: pos.quantity,
            costBasis: pos.costBasis, marketValue: pos.marketValue,
            unrealized: pos.unrealized, dividends: 0, totalReturn: pos.unrealized,
            returnPct: pos.returnPct, heldSince: null, heldYears: null,
            annualisedPct: null, weightPct: pos.weightPct, dividendYield: null,
          }))
        : stocks}
      months={months}
      thisYear={
        latestYear && live && live.positions.length
          // The current year ENDS at today's real value, not at a month-end
          // carried forward from a two-year-old price sheet.
          ? { ...latestYear, endValue: live.totalValue,
              gain: Math.round((live.totalValue - latestYear.startValue - latestYear.contributions) * 100) / 100 }
          : latestYear
      }
      thisYearMonths={thisYearMonths.length >= 2 ? thisYearMonths : months.slice(-12)}
      yearStocks={yearStocks}
      irr={irr}
      irrYears={irrYears}
      years={years}
      asAt={asAt}
      missing={missing}
      failed={failed}
      holdings={overview && overview.holdingsAsOf ? { asOf: overview.holdingsAsOf, staleMonths: overview.holdingsStaleMonths } : null}
      livePricing={live && live.positions.length
        ? { anchoredAt: live.anchoredAt, pricedAt: live.pricedAt, stale: live.pricesStale, trades: live.tradesSinceAnchor }
        : null}
    />
  );
}
