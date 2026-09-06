import { Space, Typography } from 'antd';
import '@/engine.server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/require-user';
import {
  monthlySeries, benchmarkMonthly, overviewFrom, accountIrr, project, contributionPace, stockReport,
} from '@/lib/gotrade/report';
import { ProjectionView, type ProjectionRow } from '@/components/ProjectionView';
import { PageHeading } from '@/components/PageHeading';

export const dynamic = 'force-dynamic';

export default async function ProjectionPage() {
  await requireUser();

  const accounts = await prisma.account.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  });

  const rows: ProjectionRow[] = [];
  for (const a of accounts) {
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
      lastEoyValue: eoy?.portfolioValue ?? 0,
      currentValue: overview.latestValue,
      annualised: overview.annualised,
      irr,
      yearlyContribution: pace,
      in5: noAdding[0]?.value ?? null,
      in10: noAdding[1]?.value ?? null,
      in5WithAdding: withAdding.length ? Math.round((withAdding[0].value + withAdding[0].contributed) * 100) / 100 : null,
      in10WithAdding: withAdding.length ? Math.round((withAdding[1].value + withAdding[1].contributed) * 100) / 100 : null,
    });
  }

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <PageHeading title="Projection" />
      <ProjectionView rows={rows} />
    </Space>
  );
}
