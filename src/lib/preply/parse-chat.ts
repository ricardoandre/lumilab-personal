/**
 * Reads a Preply conversation as TEXT — what the Chrome extension lifts off the
 * page, or what is pasted by hand — and finds the words the tutor taught.
 *
 * The tutor writes each item as two lines: pinyin, then the characters spaced
 * out ("fāng biàn" / "方 便"). Sometimes with a meaning on the same line
 * ("洗 =wash", "其 他 的 others") or the line after ("如 果" / "if"). An English
 * message on its OWN is not attached to a neighbour: on the real chat that
 * guessed wrong more often than right ("孩 子" then "80mins"). Everything else — chit-chat,
 * links, numbers, Preply's own notices — is ignored.
 *
 * A lesson is a day: the conversation shows a date header per day, and a day on
 * which the tutor wrote at least one word is a lesson.
 */

export type ParsedWord = { hanzi: string; pinyin: string; meaning: string | null };
export type ParsedLesson = { date: string; tutor: string; words: ParsedWord[] };

type Message = { sender: string; time: string; lines: string[]; date: string };

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const DATE_HEADER = /^(?:mon|tue|wed|thu|fri|sat|sun)[a-z]*,?\s+(\d{1,2})\s+([a-z]{3})[a-z]*\.?(?:,?\s+(\d{4}))?$/i;
const DATE_HEADER_US = /^(?:mon|tue|wed|thu|fri|sat|sun)[a-z]*,?\s+([a-z]{3})[a-z]*\.?\s+(\d{1,2})(?:,?\s+(\d{4}))?$/i;
const TIME = /^\d{1,2}:\d{2}(?:\s?[AP]M)?$/i;
const HAN = /\p{Script=Han}/u;
const LATIN = /[a-zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜü]/i;
const TONED = /[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/i;

const iso = (y: number, m: number, d: number) =>
  `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

/** Today in Jakarta: the server runs UTC, the lessons happen in WIB. */
export function todayWib(now = new Date()): string {
  return new Date(now.getTime() + 7 * 3600_000).toISOString().slice(0, 10);
}

/** A header without a year is the latest such date that is not in the future. */
function headerDate(line: string, today: string): string | null {
  const t = line.trim();
  if (/^today$/i.test(t)) return today;
  if (/^yesterday$/i.test(t)) {
    const d = new Date(today + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() - 1);
    return d.toISOString().slice(0, 10);
  }
  let day: number, mon: number, year: number | null;
  let m = t.match(DATE_HEADER);
  if (m && MONTHS.includes(m[2].toLowerCase())) {
    day = +m[1]; mon = MONTHS.indexOf(m[2].toLowerCase()); year = m[3] ? +m[3] : null;
  } else if ((m = t.match(DATE_HEADER_US)) && MONTHS.includes(m[1].toLowerCase())) {
    day = +m[2]; mon = MONTHS.indexOf(m[1].toLowerCase()); year = m[3] ? +m[3] : null;
  } else return null;
  if (day < 1 || day > 31) return null;
  if (year) return iso(year, mon, day);
  const y = +today.slice(0, 4);
  const guess = iso(y, mon, day);
  return guess <= today ? guess : iso(y - 1, mon, day);
}

/** Splits the text into messages: a sender line, a time line, then the body. */
function messages(text: string, today: string): Message[] {
  const lines = text.split(/\r?\n/).map((l) => l.replace(/^\s*[*•]\s+/, '').trim());
  const out: Message[] = [];
  let date: string | null = null;
  let current: Message | null = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const d = headerDate(line, today);
    if (d) { date = d; current = null; continue; }
    if (TIME.test(lines[i + 1] ?? '') && !TIME.test(line) && line.length <= 40 && !HAN.test(line)) {
      current = { sender: line, time: lines[i + 1], lines: [], date: date ?? today };
      out.push(current);
      i++;
      continue;
    }
    current?.lines.push(line);
  }
  return out;
}

/** "方 便 面" → "方便面"; "上 学 — — 放 学" → "上学——放学". */
const joinHanzi = (s: string) => s.replace(/\s+/g, '');

const isPinyinLine = (s: string) =>
  LATIN.test(s) && !HAN.test(s) && !/https?:\/\//.test(s) &&
  (TONED.test(s) || /^[a-zü\s、，,？?！!。.\-—\/()（）]+$/i.test(s)) &&
  // a sentence of plain English is not pinyin
  !(!TONED.test(s) && /\b(the|is|are|and|you|to|of|it|my)\b/i.test(s));

/** An English note, as opposed to a number, a link, or "This message was deleted". */
const englishNote = (s: string) => {
  const t = s.replace(/^[=:\s]+/, '').replace(/[、,，]+$/, '').trim();
  if (!t || !/[a-z]/i.test(t) || HAN.test(t) || TONED.test(t) || /https?:\/\//.test(t)) return null;
  if (/^this message was deleted$/i.test(t)) return null;
  return t;
};

/** Splits "洗 =wash" / "其 他 的 others" into characters and the note after them. */
function splitHanziLine(line: string): { hanzi: string; note: string | null } {
  const at = line.search(/\s*=|\s+[a-z]/i);
  if (at > 0 && HAN.test(line.slice(0, at))) {
    return { hanzi: joinHanzi(line.slice(0, at)), note: englishNote(line.slice(at)) };
  }
  return { hanzi: joinHanzi(line), note: null };
}

type Item = ParsedWord & { msg: number };

function itemsIn(msg: Message, index: number): Item[] {
  // A reply quotes the earlier message first: "Wei W." / quoted line / reply.
  let lines = msg.lines;
  if (lines.length >= 2 && lines[0] === msg.sender) {
    const quoted = lines[1];
    const m = quoted.match(/^([^\p{Script=Han}]+?)\s+(\p{Script=Han}.*)$/u);
    lines = m ? [m[1], m[2], ...lines.slice(2)] : lines.slice(1);
  }
  const items: Item[] = [];
  for (let i = 0; i < lines.length - 1; i++) {
    if (!isPinyinLine(lines[i]) || !HAN.test(lines[i + 1])) continue;
    const { hanzi, note } = splitHanziLine(lines[i + 1]);
    const after = lines[i + 2] && !isPinyinLine(lines[i + 2]) ? englishNote(lines[i + 2]) : null;
    items.push({ hanzi, pinyin: lines[i].replace(/\s+/g, ' ').trim(), meaning: note ?? after, msg: index });
    i++;
  }
  return items;
}

/**
 * @param tutor  whose messages count; by default whoever wrote the most
 *               pinyin-and-characters pairs, which is always the tutor.
 */
export function parseChat(text: string, opts: { today?: string; tutor?: string } = {}): ParsedLesson[] {
  const today = opts.today ?? todayWib();
  const msgs = messages(text, today);

  const perSender = new Map<string, Item[]>();
  msgs.forEach((m, i) => {
    const items = itemsIn(m, i);
    if (items.length) perSender.set(m.sender, [...(perSender.get(m.sender) ?? []), ...items]);
  });
  const tutor = opts.tutor ??
    [...perSender.entries()].sort((a, b) => b[1].length - a[1].length)[0]?.[0];
  if (!tutor) return [];
  const items = perSender.get(tutor) ?? [];

  const byDate = new Map<string, ParsedWord[]>();
  for (const { msg, ...word } of items) {
    const date = msgs[msg].date;
    const words = byDate.get(date) ?? [];
    const seen = words.find((w) => w.hanzi === word.hanzi);
    if (seen) { seen.meaning ??= word.meaning; continue; }
    words.push(word);
    byDate.set(date, words);
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, words]) => ({ date, tutor, words }));
}
