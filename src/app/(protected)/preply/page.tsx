import '@/engine.server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/require-user';
import { PreplyLessons, type LessonRow } from '@/components/PreplyLessons';

export const dynamic = 'force-dynamic';

export default async function PreplyPage() {
  await requireUser();
  const lessons = await prisma.preplyLesson.findMany({
    orderBy: { lessonDate: 'desc' },
    include: { words: { orderBy: { position: 'asc' } } },
  });
  const rows: LessonRow[] = lessons.map((l) => ({
    id: String(l.id),
    date: l.lessonDate.toISOString().slice(0, 10),
    tutor: l.tutorName,
    title: l.title,
    words: l.words.map((w) => ({ id: String(w.id), hanzi: w.hanzi, pinyin: w.pinyin, meaning: w.meaning })),
  }));
  return <PreplyLessons lessons={rows} />;
}
