import { prisma } from '@/lib/prisma';
import { parseChat, type ParsedLesson } from './parse-chat';
import { meaningFor } from './dictionary';

const OPEN_FOR_MS = 24 * 3600_000;

export type ImportResult = { lessons: number; newLessons: number; newWords: number; skippedWords: number };

/** The parsed lessons with every missing meaning filled from the dictionary. */
export function previewChat(text: string): ParsedLesson[] {
  return parseChat(text).map((l) => ({
    ...l,
    words: l.words.map((w) => ({ ...w, meaning: w.meaning ?? meaningFor(w.hanzi, w.pinyin) })),
  }));
}

/**
 * Saves a conversation. Safe to run on the same chat again and again — that is
 * how the extension works — because a lesson is keyed by tutor + day and a word
 * by its characters within the lesson. A word already saved is never touched,
 * so a meaning corrected in the app survives every later sync.
 *
 * A lesson only GROWS for a day after it was first saved: long enough to catch
 * every word of a lesson synced while it was still going on, and then it is
 * closed, so a word deleted in the app is not brought back by the next sync.
 */
export async function importChat(text: string): Promise<ImportResult> {
  const lessons = previewChat(text);
  const result: ImportResult = { lessons: lessons.length, newLessons: 0, newWords: 0, skippedWords: 0 };
  for (const l of lessons) {
    const lessonDate = new Date(l.date + 'T00:00:00Z');
    let lesson = await prisma.preplyLesson.findUnique({
      where: { tutorName_lessonDate: { tutorName: l.tutor, lessonDate } },
      include: { words: { select: { hanzi: true, position: true } } },
    });
    if (!lesson) {
      lesson = { ...(await prisma.preplyLesson.create({ data: { tutorName: l.tutor, lessonDate } })), words: [] };
      result.newLessons++;
    } else if (Date.now() - lesson.createdAt.getTime() > OPEN_FOR_MS) {
      result.skippedWords += l.words.length;
      continue;
    }
    const have = new Set(lesson.words.map((w) => w.hanzi));
    let position = Math.max(0, ...lesson.words.map((w) => w.position));
    const fresh = l.words.filter((w) => !have.has(w.hanzi));
    result.skippedWords += l.words.length - fresh.length;
    if (!fresh.length) continue;
    await prisma.preplyWord.createMany({
      data: fresh.map((w) => ({
        lessonId: lesson.id, hanzi: w.hanzi, pinyin: w.pinyin, meaning: w.meaning, position: ++position,
      })),
      skipDuplicates: true,
    });
    result.newWords += fresh.length;
  }
  return result;
}
