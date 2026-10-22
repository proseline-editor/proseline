import type { StyleLexicon } from '@proseline-editor/core/features';

const words = (list: string) => list.split(/\s+/).filter(Boolean);

/** Noun/adjective endings, longest first; stripping them groups inflected forms for the repetition check. */
const ENDINGS = words('ами ями ові еві єві ого ому ими іми ій ий ою ею єю ом ем єм ам ям ах ях ів їв ей ої а я у ю і и ї е є о').sort((a, b) => b.length - a.length);

/**
 * Ukrainian: filler words, repetitions across inflected forms (a light stemmer) and a Flesch score
 * with Oborneva's coefficients (the adaptation used for East Slavic languages). No adverb or passive
 * check: suffixes do not identify them reliably.
 */
export const uk: StyleLexicon = {
  locale: 'uk',
  fillers: [
    ...words('просто ніби наче начебто якось взагалі власне фактично буквально справді дійсно мабуть напевно певно ну типу дуже зовсім цілком досить трохи раптом майже якийсь якась якесь якісь'),
    'так би мовити', 'в принципі', 'у принципі', 'по суті', 'в цілому', 'у цілому',
  ],
  stopWords: words(`який яка яке які якого якої якому яким якій яких цей ця це ці цього цієї цьому цим цих того тому той та ті тих тим тією його її їхній їхня
їхнє їхні вона воно вони мене тебе себе нього неї них ними нами вами свій своя своє свої свого своєї своїм своїх щоб коли тоді теж також лише тільки
більш більше вже навіть після перед через біля поміж серед понад щодо було були буде будуть бути був була сказав сказала сказали каже кажу може можна
треба немов мовби аніж адже хоча якщо отже проте однак зараз тепер потім знову усе все всі усі всіх усіх весь вся нічого ніхто щось хтось десь там тут
туди сюди звідти куди дуже`),
  abbreviations: ['т.д', 'т.п', 'т.ч', 'вул', 'див', 'напр', 'проф', 'ім', 'рис', 'табл', 'ст', 'рр', 'тис', 'млн', 'млрд', 'грн', 'пп', 'обл', 'р-н'],
  stem: (word) => {
    const ending = ENDINGS.find((e) => word.endsWith(e) && word.length - e.length >= 3);
    return ending ? word.slice(0, -ending.length) : word;
  },
  syllables: (word) => Math.max(1, (word.match(/[аеєиіїоуюя]/g) ?? []).length),
  readability: { base: 206.835, perWordsPerSentence: 1.3, perSyllablesPerWord: 60.1 },
};
