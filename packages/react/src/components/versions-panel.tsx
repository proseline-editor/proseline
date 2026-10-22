import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { DOMSerializer } from '@tiptap/pm/model';
import type { JSONContent } from '@tiptap/core';
import type { FeatureController, FeatureRegistry } from '@proseline-editor/core';
import type { DiffBlock, VersionMeta } from '@proseline-editor/core/features';
import { useProseline } from '../context.js';
import { useController } from '../use-controller.js';
import { relativeTime } from '../relative-time.js';

export interface VersionsPanelProps {
  className?: string;
}

const noopSubscribe = () => () => undefined;
const zero = () => 0;

/** Number of co-authors present, if the collaboration feature (@proseline-editor/sync) is installed. */
const usePeerCount = (): number => {
  const editor = useProseline();
  const c = editor.feature('collaboration' as keyof FeatureRegistry) as FeatureController<{ peers: unknown[] }> | undefined;
  return useSyncExternalStore(c?.subscribe ?? noopSubscribe, c ? () => c.getState().peers.length : zero, zero);
};

/** Read-only rendering of a version with the editor's own schema (same look as the writing surface). */
const VersionContent = ({ content }: { content: JSONContent }) => {
  const { tiptap } = useProseline();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fragment = DOMSerializer.fromSchema(tiptap.schema).serializeFragment(tiptap.schema.nodeFromJSON(content).content);
    el.replaceChildren(fragment);
  }, [content, tiptap]);
  return <div ref={ref} className="ProseMirror pl-version-content" />;
};

const DiffView = ({ diff }: { diff: DiffBlock[] }) => (
  <div className="ProseMirror pl-diff">
    {diff.map((block, i) => {
      if (block.kind === 'horizontalRule') return <hr key={i} data-status={block.status} />;
      // Lists and quotes render as paragraphs; data-container lets the theme indent them.
      const Tag = block.kind === 'heading' ? (`h${block.level ?? 3}` as 'h1') : 'p';
      return (
        <Tag key={i} data-status={block.status} data-container={block.container}>
          {block.parts.map((part, j) =>
            part.op === 'insert' ? <ins key={j}>{part.text}</ins> : part.op === 'delete' ? <del key={j}>{part.text}</del> : <span key={j}>{part.text}</span>,
          )}
        </Tag>
      );
    })}
  </div>
);

/** Snapshots: save, browse, compare with the current text, restore, delete. Requires the versions feature. */
export const VersionsPanel = ({ className }: VersionsPanelProps) => {
  const { t, locale } = useProseline();
  const versions = useController('versions');
  const peers = usePeerCount();
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');
  const [mode, setMode] = useState<'version' | 'compare'>('compare');
  const [confirm, setConfirm] = useState<{ action: 'restore' | 'delete'; id: string } | null>(null);
  if (!versions) return null;
  const { state, commands } = versions;
  const preview = state.preview;

  const save = async () => {
    if (await commands.snapshot(name)) {
      setName('');
      setNaming(false);
    }
  };
  const label = (v: VersionMeta) => v.label ?? t('versions.automatic');

  return (
    <aside className={['pl-versions', className].filter(Boolean).join(' ')} aria-label={t('versions.title')}>
      <header className="pl-comments-header">
        <h2>{t('versions.title')}</h2>
        {state.allowed && !naming && (
          <button type="button" className="pl-text-button" onClick={() => setNaming(true)}>{t('versions.save')}</button>
        )}
      </header>
      {naming && (
        <form
          className="pl-reply"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <input className="pl-input" autoFocus aria-label={t('versions.namePlaceholder')} placeholder={t('versions.namePlaceholder')} value={name} onChange={(e) => setName(e.target.value)} />
          <button type="submit" className="pl-text-button pl-primary" disabled={state.busy}>{t('versions.saveConfirm')}</button>
          <button type="button" className="pl-text-button" onClick={() => setNaming(false)}>{t('versions.cancel')}</button>
        </form>
      )}
      {state.error && <p role="alert" className="pl-error">{t(`versions.${state.error}`)}</p>}
      {preview && (
        <section className="pl-preview" aria-label={t('versions.preview')}>
          <div className="pl-row pl-preview-head">
            <strong>{label(preview)}</strong>
            <button type="button" className="pl-text-button" aria-label={t('versions.closePreview')} onClick={() => commands.close()}>×</button>
          </div>
          <div className="pl-row" role="tablist">
            <button type="button" role="tab" aria-selected={mode === 'compare'} className="pl-text-button" onClick={() => setMode('compare')}>{t('versions.compare')}</button>
            <button type="button" role="tab" aria-selected={mode === 'version'} className="pl-text-button" onClick={() => setMode('version')}>{t('versions.showVersion')}</button>
          </div>
          {mode === 'compare' ? (
            <>
              <p className="pl-meta">{t('versions.changes', { inserted: preview.summary.insertedWords, deleted: preview.summary.deletedWords })}</p>
              <DiffView diff={preview.diff} />
            </>
          ) : (
            <VersionContent content={preview.content} />
          )}
        </section>
      )}
      {state.versions.length === 0 && <p className="pl-hint">{t('versions.empty')}</p>}
      <ol className="pl-threads">
        {state.versions.map((v) => {
          const confirming = confirm?.id === v.id ? confirm.action : null;
          return (
            <li key={v.id} className="pl-thread pl-version" data-active={preview?.id === v.id || undefined}>
              <p className="pl-body"><strong>{label(v)}</strong></p>
              <p className="pl-meta">
                <time dateTime={v.createdAt}>{relativeTime(v.createdAt, locale)}</time>
                {' · '}
                {t.plural('versions.words', v.words)}
                {v.authorName ? ` · ${v.authorName}` : ''}
              </p>
              {confirming ? (
                <div className="pl-row">
                  <span className="pl-confirm">{confirming === 'restore' ? t('versions.confirmRestore') : t('versions.confirmDelete')}</span>
                  {confirming === 'restore' && peers > 0 && <span role="alert" className="pl-warning">{t('versions.coAuthors')}</span>}
                  <button
                    type="button"
                    className={['pl-text-button', confirming === 'delete' ? 'pl-danger' : 'pl-primary'].join(' ')}
                    disabled={state.busy}
                    onClick={() => {
                      setConfirm(null);
                      void (confirming === 'restore' ? commands.restore(v.id) : commands.remove(v.id));
                    }}
                  >
                    {confirming === 'restore' ? t('versions.restore') : t('versions.delete')}
                  </button>
                  <button type="button" className="pl-text-button" onClick={() => setConfirm(null)}>{t('versions.cancel')}</button>
                </div>
              ) : (
                <div className="pl-row">
                  <button type="button" className="pl-text-button" aria-pressed={preview?.id === v.id} onClick={() => (preview?.id === v.id ? commands.close() : void commands.open(v.id))}>
                    {t('versions.preview')}
                  </button>
                  {state.allowed && <button type="button" className="pl-text-button" onClick={() => setConfirm({ action: 'restore', id: v.id })}>{t('versions.restore')}</button>}
                  {state.canRemove && <button type="button" className="pl-text-button" onClick={() => setConfirm({ action: 'delete', id: v.id })}>{t('versions.delete')}</button>}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </aside>
  );
};
