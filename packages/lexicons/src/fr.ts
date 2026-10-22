import type { StyleLexicon } from '@proseline-editor/core/features';

const words = (list: string) => list.split(/\s+/).filter(Boolean);

/** French: Kandel & Moles readability, -ment adverbs. No passive check: être also forms the passé composé of motion verbs. */
export const fr: StyleLexicon = {
  locale: 'fr',
  fillers: [
    ...words('vraiment très juste assez plutôt simplement littéralement absolument totalement complètement carrément franchement soudain soudainement quasiment presque bref genre'),
    'tout à coup', 'peut-être', 'en fait', 'au fond', 'en quelque sorte', 'un peu', 'du coup',
  ],
  stopWords: words(`alors aussi avec avoir cela ceci celui celle ceux cette comme dans depuis donc elle elles être était étaient leur leurs mais même nous vous
pour quand quel quelle quels quelles sans sont sous tout tous toute toutes vers voilà entre encore après avant chez dont ainsi puis rien avait avaient
dit dit-il dit-elle fait faire peut sera serait leurs notre votre nos vos ces ses mes tes`),
  abbreviations: ['mme', 'mlle', 'mm', 'dr', 'st', 'ste', 'etc', 'cf', 'ex', 'av', 'bd', 'env', 'p.ex'],
  adverbs: {
    suffixes: ['ment'],
    exceptions: words(`moment comment élément appartement gouvernement mouvement sentiment monument instrument argument document événement évènement traitement
bâtiment logement jugement changement commencement développement enseignement équipement établissement paiement testament régiment vêtement aliment
ciment serment segment tourment froment sacrement fragment compliment supplément complément département parlement ment dément clément véhément`),
  },
  syllables: (word) => {
    const groups = (word.match(/[aeiouyàâäéèêëîïôöùûüÿœæ]+/g) ?? []).length;
    const silent = word.length > 3 && /[^aeiouyàâäéèêëîïôöùûüÿœæ]e(?:s|nt)?$/.test(word) ? 1 : 0;
    return Math.max(1, groups - silent);
  },
  readability: { base: 207, perWordsPerSentence: 1.015, perSyllablesPerWord: 73.6 },
};
