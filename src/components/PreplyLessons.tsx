'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { App, Button, Card, Collapse, Drawer, Empty, Form, Grid, Input, Modal, Popconfirm, Space, Switch, Typography } from 'antd';
import { ChromeOutlined, SnippetsOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

export interface WordRow { id: string; hanzi: string; pinyin: string; meaning: string | null }
export interface LessonRow { id: string; date: string; tutor: string; title: string | null; words: WordRow[] }

type Preview = { date: string; tutor: string; words: Omit<WordRow, 'id'>[] }[];

/**
 * Preply vocabulary, one card per lesson, newest first. Tap a word to correct
 * it. "Hide meanings" turns the list into a self-test.
 */
export function PreplyLessons({ lessons }: { lessons: LessonRow[] }) {
  const router = useRouter();
  const [hide, setHide] = useState(false);
  const [paste, setPaste] = useState(false);
  const [ext, setExt] = useState(false);
  const [editing, setEditing] = useState<WordRow | null>(null);
  const total = lessons.reduce((n, l) => n + l.words.length, 0);

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <Typography.Title level={3} style={{ margin: 0 }}>Preply</Typography.Title>
          <Typography.Text type="secondary">{lessons.length} lessons · {total} words</Typography.Text>
        </div>
        <Space wrap>
          <Space size={6}><Switch size="small" checked={hide} onChange={setHide} /><span>Hide meanings</span></Space>
          <Button icon={<SnippetsOutlined />} onClick={() => setPaste(true)}>Paste chat</Button>
          <Button icon={<ChromeOutlined />} onClick={() => setExt(true)}>Auto-sync</Button>
        </Space>
      </div>

      {lessons.length === 0 ? (
        <Card><Empty description="No lessons yet. Paste the chat, or install the auto-sync." /></Card>
      ) : (
        <Collapse
          defaultActiveKey={[lessons[0].id]}
          items={lessons.map((l) => ({
            key: l.id,
            label: (
              <span>
                <strong>{dayjs(l.date).format('ddd D MMM YYYY')}</strong>
                <Typography.Text type="secondary"> · {l.tutor} · {l.words.length} words</Typography.Text>
              </span>
            ),
            children: <WordList words={l.words} hide={hide} onEdit={setEditing} />,
            styles: { body: { padding: 0 } },
          }))}
        />
      )}

      <PasteDrawer open={paste} onClose={() => setPaste(false)} onSaved={() => router.refresh()} />
      <ExtensionModal open={ext} onClose={() => setExt(false)} />
      <EditWordModal word={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); router.refresh(); }} />
    </Space>
  );
}

function WordList({ words, hide, onEdit }: { words: WordRow[]; hide: boolean; onEdit?: (w: WordRow) => void }) {
  return (
    <div>
      {words.map((w, i) => (
        <WordLine key={w.id ?? i} word={w} hide={hide} onClick={onEdit ? () => onEdit(w) : undefined} first={i === 0} />
      ))}
    </div>
  );
}

function WordLine({ word, hide, onClick, first }: { word: Omit<WordRow, 'id'> & { id?: string }; hide: boolean; onClick?: () => void; first: boolean }) {
  const [shown, setShown] = useState(false);
  const literal = word.meaning?.startsWith('≈ ');
  return (
    <div
      onClick={onClick}
      style={{ padding: '10px 16px', borderTop: first ? undefined : '1px solid rgba(5,5,5,0.06)', cursor: onClick ? 'pointer' : undefined }}
    >
      <div style={{ fontSize: 22, lineHeight: 1.3 }}>{word.hanzi}</div>
      <div style={{ color: '#1677ff' }}>{word.pinyin}</div>
      {hide && !shown ? (
        <Typography.Link onClick={(e) => { e.stopPropagation(); setShown(true); }}>Show meaning</Typography.Link>
      ) : (
        <Typography.Text type={literal || !word.meaning ? 'secondary' : undefined}>
          {word.meaning ? (literal ? <>word by word: {word.meaning.slice(2)}</> : word.meaning) : 'no meaning yet — tap to add'}
        </Typography.Text>
      )}
    </div>
  );
}

function PasteDrawer({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const { message } = App.useApp();
  const phone = !Grid.useBreakpoint().md;
  const [text, setText] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);

  async function call(save: boolean) {
    setBusy(true);
    try {
      const res = await fetch('/api/preply/import', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text, save }) });
      const data = await res.json();
      if (!res.ok) { message.error(data.error ?? 'Failed'); return; }
      if (!save) { setPreview(data.lessons); return; }
      message.success(`Saved ${data.newWords} new word(s)${data.newLessons ? ` in ${data.newLessons} new lesson(s)` : ''}.`);
      setText(''); setPreview(null); onSaved(); onClose();
    } finally { setBusy(false); }
  }

  return (
    <Drawer
      title="Paste the Preply chat"
      open={open}
      onClose={onClose}
      width={phone ? '100%' : 640}
      extra={preview
        ? <Button type="primary" loading={busy} disabled={!preview.length} onClick={() => call(true)}>Save</Button>
        : <Button type="primary" loading={busy} disabled={!text.trim()} onClick={() => call(false)}>Find words</Button>}
    >
      {!preview ? (
        <>
          <Typography.Paragraph type="secondary">
            Select the whole conversation on Preply, copy, and paste it here. Words already saved are skipped, so pasting the same chat again is safe.
          </Typography.Paragraph>
          <Input.TextArea value={text} onChange={(e) => setText(e.target.value)} autoSize={{ minRows: 12, maxRows: 24 }} placeholder="Paste here" />
        </>
      ) : (
        <Space direction="vertical" style={{ width: '100%' }}>
          <Button onClick={() => setPreview(null)}>Back to the text</Button>
          {preview.length === 0 && <Empty description="No words found in that text." />}
          {preview.map((l) => (
            <Card key={l.date} size="small" title={`${dayjs(l.date).format('ddd D MMM YYYY')} · ${l.words.length} words`} styles={{ body: { padding: 0 } }}>
              <WordList words={l.words.map((w, i) => ({ ...w, id: String(i) }))} hide={false} />
            </Card>
          ))}
        </Space>
      )}
    </Drawer>
  );
}

function ExtensionModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal title="Sync Preply automatically" open={open} onCancel={onClose} footer={null}>
      <Typography.Paragraph>
        A small Chrome extension for your laptop. While your chat with the tutor is open on preply.com, every word is sent here as it is written.
        Every 6 hours it also opens the chat for a minute in a background tab to catch anything missed.
      </Typography.Paragraph>
      <ol style={{ paddingLeft: 20 }}>
        <li><a href="/api/preply/extension">Download preply-sync.zip</a> and unzip it.</li>
        <li>In Chrome, open <Typography.Text code>chrome://extensions</Typography.Text> and turn on <b>Developer mode</b> (top right).</li>
        <li>Click <b>Load unpacked</b> and choose the unzipped <b>preply-sync</b> folder.</li>
        <li>Open your chat with your tutor on preply.com once. Done.</li>
      </ol>
      <Typography.Text type="secondary">The download carries a private key for this account. Don&apos;t share it.</Typography.Text>
    </Modal>
  );
}

function EditWordModal({ word, onClose, onSaved }: { word: WordRow | null; onClose: () => void; onSaved: () => void }) {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [busy, setBusy] = useState(false);

  async function send(method: 'PATCH' | 'DELETE', body?: object) {
    if (!word) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/preply/words/${word.id}`, { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
      const data = await res.json();
      if (!res.ok) { message.error(data.error ?? 'Failed'); return; }
      onSaved();
    } finally { setBusy(false); }
  }

  return (
    <Modal
      title="Edit word"
      open={!!word}
      onCancel={onClose}
      destroyOnHidden
      footer={[
        <Popconfirm key="del" title="Delete this word?" onConfirm={() => send('DELETE')}>
          <Button danger style={{ float: 'left' }}>Delete</Button>
        </Popconfirm>,
        <Button key="cancel" onClick={onClose}>Cancel</Button>,
        <Button key="save" type="primary" loading={busy} onClick={() => form.validateFields().then((v) => send('PATCH', v))}>Save</Button>,
      ]}
    >
      {word && (
        <Form form={form} layout="vertical" initialValues={word} preserve={false}>
          <Form.Item name="hanzi" label="Characters" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="pinyin" label="Pinyin" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="meaning" label="Meaning"><Input.TextArea autoSize /></Form.Item>
        </Form>
      )}
    </Modal>
  );
}
