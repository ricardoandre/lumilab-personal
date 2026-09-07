import { Space, Typography } from 'antd';
import '@/engine.server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/require-user';
import {
  monthlySeries, benchmarkMonthly, overviewFrom, accountIrr, project, contributionPace, stockReport,
} from '@/lib/gotrade/report';
import { ProjectionView, type ProjectionRow } from '@/components/ProjectionView';
import { usdToIdr } from '@/lib/fx';
import { goldOverview } from '@/lib/gold/report';
import { PageHeading } from '@/components/PageHeading';

export const dynamic = 'force-dynamic';

export default async function ProjectionPage() {
  await requireUser();

  const accounts = await prisma.account.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  });

  // Every figure on this page is RUPIAH: it sums accounts held in different
  // currencies, and adding dollars to rupiah is simply wrong. The same mistake
  // on the dashboard reported a net worth of Rp 41 trillion.
  const fx = await usdToIdr();
  const rate = fx?.rate ?? null;
  const toIdr = (amount: number, currency: string) =>
    currency === 'IDR' ? amount : rate === null ? 0 : amount * rate;

  const rows: ProjectionRow[] = [];
  for (const a of accounts) {
    // Gold has purchases and a live price, not a monthly series.
    if (a.kind === 'COMMODITY') {
      const g = await goldOverview(a.id);
      const stop = project(g.valueNow, g.irr, 0);
      const years = g.firstPurchase
        ? Math.max(1, (Date.now() - new Date(g.firstPurchase).getTime()) / (365.25 * 24 * 3600 * 1000))
        : 1;
      const pace = g.invested / years;
      const keep = project(g.valueNow, g.irr, pace);
      rows.push({
        key: String(a.id), name: a.name, lastEoyLabel: '—', lastEoyValue: 0,
        currentValue: g.valueNow, annualised: g.irr, irr: g.irr, yearlyContribution: pace,
        in5: stop[0]?.value ?? null, in10: stop[1]?.value ?? null,
        in5WithAdding: keep.length ? Math.round((keep[0].value + keep[0].contributed) * 100) / 100 : null,
        in10WithAdding: keep.length ? Math.round((keep[1].value + keep[1].contributed) * 100) / 100 : null,
      });
      continue;
    }
    const [months, bench, stocks] = await Promise.all([
      monthlySeries(prisma, a.id),
      benchmarkMonthly(prisma, a.id),
      stockReport(prisma, a.id),
    ]);
    const overview = overviewFrom(months, bench, stocks);
    if (!overview || !months.length) continue;

    const latest = months[months.length - 1];
    // Last completed year end held in the data — the anchor Andre asked for.
    const lastYear = String(Number(latest.period.slice(0, 4)) - 1);
    const eoy = months.filter((m) => m.period === `${lastYear}-12`)[0] ?? null;

    const irr = await accountIrr(prisma, a.id, overview.latestValue, new Date(latest.periodEnd));
    const pace = contributionPace(months);
    const noAdding = project(overview.latestValue, overview.annualised, 0);
    const withAdding = project(overview.latestValue, overview.annualised, pace);

    rows.push({
      key: String(a.id),
      name: a.name,
      lastEoyLabel: lastYear,
      lastEoyValue: toIdr(eoy?.portfolioValue ?? 0, a.currency),
      currentValue: toIdr(overview.latestValue, a.currency),
      annualised: overview.annualised,
      irr,
      yearlyContribution: toIdr(pace, a.currency),
      in5: noAdding[0] ? toIdr(noAdding[0].value, a.currency) : null,
      in10: noAdding[1] ? toIdr(noAdding[1].value, a.currency) : null,
      in5WithAdding: withAdding.length ? toIdr(withAdding[0].value + withAdding[0].contributed, a.currency) : null,
      in10WithAdding: withAdding.length ? toIdr(withAdding[1].value + withAdding[1].contributed, a.currency) : null,
    });
  }

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <PageHeading title="Projection" />
      <ProjectionView rows={rows} />
    </Space>
  );
}
