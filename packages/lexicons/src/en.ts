import type { StyleLexicon } from '@proseline-editor/core/features';

const IRREGULAR_PARTICIPLES = `arisen awoken beaten become begun bent bitten bled blown broken bred brought built burnt bought caught chosen dealt done drawn
dreamt driven drunk eaten fallen fed felt fought found fled flung flown forbidden forgotten forgiven frozen given gone ground grown hung heard hidden
held hurt kept known laid led lent lit lost made meant met paid ridden rung risen sold sent sewn shaken shot shown shut sung sunk slain slung spoken
spent spun split spread stolen stuck stung struck strung sworn swept swum taken taught torn told thought thrown thrust understood woken worn woven won
wound written seen`;

const words = (list: string) => list.split(/\s+/).filter(Boolean);

/** English: Flesch Reading Ease, -ly adverbs, passive voice. */
export const en: StyleLexicon = {
  locale: 'en',
  fillers: [
    ...words('just really very actually basically literally quite rather somewhat simply totally completely absolutely definitely certainly probably perhaps maybe suddenly'),
    'kind of', 'sort of', 'a bit', 'in order to', 'the fact that', 'seemed to', 'began to', 'started to', 'i think', 'i guess', 'at the end of the day',
  ],
  stopWords: words(`the and that this these those with from have having were been being they them their theirs there then than what when where which while who
whom whose will would could should might must shall into onto upon about above below your yours ours said says also some more most only over such each
both here like back even still much well does done doing very just into once ever never always again other another same that's it's didn't don't
wasn't couldn't wouldn't shouldn't himself herself itself themselves myself yourself`),
  abbreviations: ['mr', 'mrs', 'ms', 'dr', 'st', 'prof', 'sr', 'jr', 'vs', 'etc', 'e.g', 'i.e', 'cf', 'approx'],
  adverbs: {
    suffixes: ['ly'],
    exceptions: words(`only early family daily weekly monthly yearly hourly likely unlikely lovely lonely lively friendly unfriendly silly ugly holy jolly belly
bully fly reply supply apply rely ally italy july lily emily holly molly kelly sally billy jelly hilly chilly curly elderly costly deadly cowardly orderly
ghastly ghostly homely assembly anomaly monopoly butterfly firefly dragonfly rally tally wily oily smelly woolly scaly burly surly comely stately timely
unruly wobbly bubbly prickly sickly steely wiggly manly motherly fatherly brotherly sisterly heavenly worldly earthly beastly princely saintly scholarly
neighborly melancholy`),
  },
  passive: {
    auxiliaries: ['am', 'is', 'are', 'was', 'were', 'be', 'been', 'being'],
    participles: words(IRREGULAR_PARTICIPLES),
    participleSuffixes: ['ed'],
    exceptions: words('indeed naked wicked sacred beloved hundred kindred rugged ragged crooked aged jagged wretched need speed seed feed weed deed breed bed red shed'),
  },
  syllables: (word) => {
    if (word.length <= 3) return 1;
    const groups = word.replace(/(?:[^laeiouy]es|[^laeiouy]e|[^td]ed)$/, '').replace(/^y/, '').match(/[aeiouy]+/g);
    return Math.max(1, groups?.length ?? 1);
  },
  readability: { base: 206.835, perWordsPerSentence: 1.015, perSyllablesPerWord: 84.6 },
};
