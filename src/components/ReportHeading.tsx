'use client';
import { Typography } from 'antd';

// Client component: antd's compound Typography.Title is undefined inside a
// Server Component (antd has no 'use client', so from RSC the module is a
// client-reference proxy and property access does not resolve).
export function ReportHeading({ name }: { name: string }) {
  return <Typography.Title level={3} style={{ margin: 0 }}>{name} — Report</Typography.Title>;
}
