'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Card, Form, Input, Button, Typography, Alert } from 'antd';

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFinish(values: { email: string; password: string }) {
    setLoading(true);
    setError(null);
    const res = await signIn('credentials', { ...values, redirect: false });
    setLoading(false);
    if (res?.error) setError('Wrong email or password.');
    else router.push('/');
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#faf9f6', padding: 24 }}>
      <Card style={{ width: '100%', maxWidth: 380 }}>
        <Typography.Title level={4} style={{ marginTop: 0 }}>Lumilab Personal</Typography.Title>
        <Typography.Paragraph type="secondary" style={{ marginTop: -8 }}>
          Finance and investment
        </Typography.Paragraph>
        {error && <Alert type="error" message={error} style={{ marginBottom: 16 }} showIcon />}
        <Form layout="vertical" onFinish={onFinish} requiredMark={false}>
          <Form.Item name="email" label="Email" rules={[{ required: true }]}>
            <Input type="email" autoComplete="username" size="large" />
          </Form.Item>
          <Form.Item name="password" label="Password" rules={[{ required: true }]}>
            <Input.Password autoComplete="current-password" size="large" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block size="large" loading={loading}>
            Sign in
          </Button>
        </Form>
      </Card>
    </div>
  );
}
