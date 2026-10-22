# Features

Every feature is a function from `@proseline-editor/core/features` that returns something to put in `features`. The
editor works with any subset. Each section below lists the options; the [reference](/reference/core) has the full
state and command types.

## Writing basics

| Feature | What it does | Options |
|---|---|---|
| `typography()` | Smart quotes for the locale (“” / «» / « »), em dashes from `--`, ellipses, French spacing | `quotes`, `dashes`, `ellipsis`, `frenchSpacing` |
| `paragraphStyles()` | Body, epigraph, letter, centered; flush paragraphs (no first-line indent) | — |
| `findReplace()` | Case, whole word, regex, in-selection; replace all as one undo step; Mod-F | — |
| `stats()` | Words, characters, pages, reading time; document and session goals | `goal`, `sessionGoal`, `wordsPerPage`, `wordsPerMinute` |
| `focus()` | Paragraph or sentence focus, typewriter scrolling, distraction-free mode | `mode`, `typewriter`, `distractionFree` |

Components: `<Toolbar>` (formatting plus the controls of installed features), `<FindReplace>`, `<StatsBar>`,
`<FocusControls>`.

## Comments

```ts
comments({ store, docId, anchoring?, allowComments? })
```

Threads anchored to selected text, with replies, resolve and delete. The highlights are decorations, never part of the
document. Your backend implements `CommentStore` (`list`, `create`, `reply`, `setResolved`, `remove`, optionally
`updateAnchor` and `subscribe`); `memoryCommentStore()` is for tests and demos. With collaboration, pass
`anchoring: yjsAnchoring()` from `@proseline-editor/sync`. A thread whose text is deleted is marked as orphaned.
Component: `<CommentsRail>`; the toolbar shows a Comment button.

## Versions

```ts
versions({ store, docId, autoSnapshotMs?, allowChanges? })
```

Named and automatic snapshots (ProseMirror JSON in your `VersionStore`), a read-only preview, a word-level comparison
with the current text, and restore as one undoable change (after saving the current text as "Before restore").
Component: `<VersionsPanel>`.

## Mentions

```ts
mentions({ provider, trigger?, allowCaseChange?, onOpen? })
```

Typing `@` opens a menu over your entities (`MentionProvider`: `search`, `resolve`, optionally `subscribe`), which also
matches grammatical case forms you supply. A mention shows the entity's current name in its case, follows renames and
marks deleted entities. Clicking a mention switches its case; with `onOpen`, Cmd/Ctrl-click opens the entity in your
app. `staticMentionProvider(items)` serves fixed lists. Components: `<MentionMenu>`, `<MentionCasePicker>`.

## Style analysis

```ts
import { en } from '@proseline-editor/lexicons/en';
styleAnalysis({ lexicon: en, enabled?, checks?, longSentence?, repetitionWindow?, minRepeatLength?, debounceMs? })
```

Filler words, adverbs, repetitions, long sentences, passive voice and a readability score. Off until the writer
switches it on; it analyzes only changed paragraphs, and highlights only what is near the viewport, so it stays fast
in a 150 000-word manuscript. Lexicons: `/en`, `/uk`, `/fr`, or your own (`extendLexicon`). Component: `<StylePanel>`;
the toolbar shows a toggle.

## Paste

Pasting from Word and Google Docs is cleaned up automatically: Word's list paragraphs become real lists, Office
markup disappears, blank lines become empty paragraphs and typed break marks (`* * *`) become scene breaks.
`cleanPastedHTML` is exported if you need it elsewhere.
