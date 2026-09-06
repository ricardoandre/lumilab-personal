'use client';
import { Typography } from 'antd';

// Client component: antd's compound Typography.Title is undefined inside a
// Server Component, since antd ships no 'use client' and RSC sees a proxy.
export function PageHeading({ title, extra }: { title: string; extra?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
      <Typography.Title level={3} style={{ margin: 0 }}>{title}</Typography.Title>
      {extra}
    </div>
  );
}
