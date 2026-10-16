import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

/**
 * CC-CEDICT, the free Chinese–English dictionary, loaded once per process.
 *
 * Fills the meaning when the tutor wrote only pinyin and characters, which is
 * most of the time. Lives beside the uploaded statements (outside the repo,
 * ~4 MB gzipped); refresh it from
 * https://www.mdbg.net/chinese/export/cedict/cedict_1_0_ts_utf-8_mdbg.txt.gz
 */
const FILE = path.join(process.env.STORAGE_ROOT || '/home/claudeuser/lumilab-storage', 'dict', 'cedict.txt.gz');

type Entry = { pinyin: string; defs: string[] };
let dict: Map<string, Entry[]> | null = null;
let longest = 1;

function load(): Map<string, Entry[]> {
  if (dict) return dict;
  dict = new Map();
  let text = '';
  try { text = zlib.gunzipSync(fs.readFileSync(FILE)).toString('utf8'); } catch { return dict; }
  for (const line of text.split('\n')) {
    if (!line || line.startsWith('#')) continue;
    const m = line.match(/^\S+ (\S+) \[([^\]]*)\] \/(.*)\/\s*$/);
    if (!m) continue;
    const [, simp, pinyin, defs] = m;
    const list = dict.get(simp) ?? [];
    list.push({ pinyin, defs: defs.split('/') });
    dict.set(simp, list);
    if (simp.length > longest) longest = simp.length;
  }
  return dict;
}

const TONE_MARKS: Record<string, string> = {
  ā: 'a', á: 'a', ǎ: 'a', à: 'a', ē: 'e', é: 'e', ě: 'e', è: 'e', ī: 'i', í: 'i', ǐ: 'i', ì: 'i',
  ō: 'o', ó: 'o', ǒ: 'o', ò: 'o', ū: 'u', ú: 'u', ǔ: 'u', ù: 'u', ǖ: 'v', ǘ: 'v', ǚ: 'v', ǜ: 'v', ü: 'v',
};
/** "fāng biàn" and "fang1 bian4" both become "fangbian", so readings can be compared. */
export function bareSyllables(pinyin: string): string {
  return pinyin.toLowerCase().replace(/[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜü]/g, (c) => TONE_MARKS[c]).replace(/u:/g, 'v').replace(/[^a-z]/g, '');
}

/** Definitions that say nothing to a learner. */
const NOISE = /^(?:(?:old )?variant of|surname [A-Z]|CL:|abbr\. for|see |used in|Japanese variant|\((?:old|archaic|Tw|dialect)\))/;

function gloss(entry: Entry, max: number): string | null {
  const useful = entry.defs.filter((d) => d && !NOISE.test(d)).map((d) => d.replace(/\s*\(.*?\)\s*/g, ' ').trim()).filter(Boolean);
  return useful.length ? useful.slice(0, max).join('; ') : null;
}

/** The entry for this word, preferring the reading the tutor actually wrote. */
function lookup(word: string, pinyin?: string, strict = false): Entry | null {
  const entries = load().get(word);
  if (!entries?.length) return null;
  const want = pinyin ? bareSyllables(pinyin) : '';
  // Proper nouns (pinyin capitalised: 比 "Belgium") lose to the ordinary word.
  const usable = entries.filter((e) => gloss(e, 1) && !/^[A-Z]/.test(e.pinyin));
  const pool = usable.length ? usable : entries.filter((e) => gloss(e, 1));
  const match = want ? pool.find((e) => bareSyllables(e.pinyin) === want) : null;
  if (strict && want) return match ?? null;
  return match || pool[0] || null;
}

const HAN = /\p{Script=Han}/u;

/**
 * An English meaning for a word, a phrase, or a whole sentence the tutor wrote.
 * Whole word first; failing that, the longest dictionary words left to right,
 * glossed one by one ("他 · can · bake · bread").
 */
export function meaningFor(hanzi: string, pinyin?: string): string | null {
  const whole = lookup(hanzi, pinyin);
  if (whole) return gloss(whole, 3);

  // A list the tutor wrote with 、 or —— : gloss each part.
  const parts = hanzi.split(/[、—\-\/，,；;]+|。{2,}|…+/).filter((p) => HAN.test(p));
  if (parts.length > 1) {
    const each = parts.map((p) => meaningFor(p));
    return each.every(Boolean) ? each.join(' / ') : null;
  }

  // A sentence: the dictionary has no entry, so gloss it word by word, marked
  // "≈" so a literal gloss is never mistaken for a translation. The tutor's
  // pinyin is one syllable per character, which picks the right reading and
  // stops 我去 matching the interjection when it means "I go".
  load();
  const chars = [...hanzi].filter((c) => HAN.test(c));
  const syl = (pinyin ?? '').split(/[\s、，,。？?！!（）()—\-\/]+/).map(bareSyllables).filter(Boolean);
  const aligned = syl.length === chars.length;
  const out: string[] = [];
  for (let i = 0; i < chars.length;) {
    let len = Math.min(longest, chars.length - i);
    let def: string | null = null;
    for (; len > 0; len--) {
      const word = chars.slice(i, i + len).join('');
      const hit = lookup(word, aligned ? syl.slice(i, i + len).join(' ') : undefined, aligned);
      def = hit ? gloss(hit, 1) : null;
      if (def && (len === 1 || !def.includes('!'))) break;
    }
    out.push(len === 0 ? chars[i] : def!.split(';')[0]);
    i += Math.max(len, 1);
  }
  return out.length > 1 ? '≈ ' + out.join(' · ') : out[0] ?? null;
}
