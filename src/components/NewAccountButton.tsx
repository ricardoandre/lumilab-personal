'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Drawer, Form, Input, Select, Grid, App, Typography } from 'antd';
import { PlusOutlined } from '@ant-design/icons';

export function NewAccountButton({ providers }: { providers: { value: string; label: string }[] }) {
  const { message } = App.useApp();
  const router = useRouter();
  const screens = Grid.useBreakpoint();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  async function onFinish(v: { name: string; provider: string; kind: string; currency: string }) {
    setSaving(true);
    const res = await fetch('/api/accounts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(v),
    });
    setSaving(false);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) { message.error(body.error ?? 'Could not create the account.'); return; }
    message.success(`${body.name} created.`);
    form.resetFields();
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>
        {screens.sm ? 'New account' : 'New'}
      </Button>
      <Drawer
        title="New account"
        open={open}
        onClose={() => setOpen(false)}
        placement={screens.lg ? 'right' : 'bottom'}
        width={screens.lg ? 460 : undefined}
        height={screens.lg ? undefined : '80%'}
      >
        <Form form={form} layout="vertical" onFinish={onFinish} requiredMark={false}
              initialValues={{ kind: 'BROKERAGE', currency: 'USD' }}>
          <Form.Item name="name" label="Name" rules={[{ required: true, message: 'Give it a name.' }]}
                     extra="What you will see in the menu, e.g. “Lisa Gotrade”.">
            <Input size="large" placeholder="Lisa Gotrade" />
          </Form.Item>
          <Form.Item name="provider" label="Provider" rules={[{ required: true, message: 'Choose a provider.' }]}>
            <Select size="large" options={providers} placeholder="Gotrade" />
          </Form.Item>
          <Form.Item name="kind" label="Type" rules={[{ required: true }]}>
            <Select size="large" options={[
              { value: 'BROKERAGE', label: 'Brokerage — stocks and investments' },
              { value: 'BANK', label: 'Bank — cash account' },
            ]} />
          </Form.Item>
          <Form.Item name="currency" label="Currency" rules={[{ required: true }]}
                     extra="The account's own currency — USD for Gotrade, IDR for a local bank.">
            <Select size="large" options={[
              { value: 'USD', label: 'USD' }, { value: 'IDR', label: 'IDR' }, { value: 'SGD', label: 'SGD' },
            ]} />
          </Form.Item>
          <Typography.Paragraph type="secondary" style={{ fontSize: 12 }}>
            The broker's account number is picked up automatically from the first statement you
            upload, and is then used to keep each account's statements apart.
          </Typography.Paragraph>
          <Button type="primary" htmlType="submit" loading={saving} block size="large">Create account</Button>
        </Form>
      </Drawer>
    </>
  );
}
