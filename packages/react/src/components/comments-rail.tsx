import { useEffect, useRef, useState } from 'react';
import type { ThreadView } from '@proseline-editor/core/features';
import { useProseline } from '../context.js';
import { useController } from '../use-controller.js';
import { relativeTime } from '../relative-time.js';

export interface CommentsRailProps {
  className?: string;
}

/** Comment threads beside the text: composer, replies, resolve and delete. Requires the comments feature. */
export const CommentsRail = ({ className }: CommentsRailProps) => {
  const { t, locale } = useProseline();
  const comments = useController('comments');
  const [showResolved, setShowResolved] = useState(true);
  const [draft, setDraft] = useState('');
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const composing = comments?.state.composing ?? false;

  useEffect(() => {
    if (composing) composerRef.current?.focus();
  }, [composing]);

  if (!comments) return null;
  const { state, commands } = comments;
  const shown = showResolved ? state.threads : state.threads.filter((th) => !th.resolved);

  const submit = async () => {
    if (await commands.submitComment(draft)) setDraft('');
  };

  return (
    <aside className={['pl-comments', className].filter(Boolean).join(' ')} aria-label={t('comments.title')}>
      <header className="pl-comments-header">
        <h2>{t('comments.title')}</h2>
        <label className="pl-check">
          <input type="checkbox" checked={showResolved} onChange={(e) => setShowResolved(e.target.checked)} />
          {t('comments.showResolved')}
        </label>
      </header>
      {state.error && <p role="alert" className="pl-error">{t(`comments.${state.error}`)}</p>}
      {state.composing && (
        <form
          className="pl-composer"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <textarea
            ref={composerRef}
            className="pl-textarea"
            aria-label={t('comments.placeholder')}
            placeholder={t('comments.placeholder')}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                void submit();
              } else if (e.key === 'Escape') {
                commands.cancelComment();
              }
            }}
          />
          <div className="pl-row">
            <button type="submit" className="pl-text-button pl-primary" disabled={!draft.trim()}>{t('comments.submit')}</button>
            <button type="button" className="pl-text-button" onClick={() => commands.cancelComment()}>{t('comments.cancel')}</button>
          </div>
        </form>
      )}
      {shown.length === 0 && !state.composing && (
        <p className="pl-hint">{state.allowed ? t('comments.selectText') : t('comments.empty')}</p>
      )}
      <ol className="pl-threads">
        {shown.map((thread) => (
          <Thread key={thread.id} thread={thread} active={thread.id === state.activeId} allowed={state.allowed} locale={locale} />
        ))}
      </ol>
    </aside>
  );
};

const Thread = ({ thread, active, allowed, locale }: { thread: ThreadView; active: boolean; allowed: boolean; locale: string }) => {
  const { t } = useProseline();
  const comments = useController('comments');
  const [reply, setReply] = useState('');
  const [confirming, setConfirming] = useState(false);
  const itemRef = useRef<HTMLLIElement>(null);
  // Clicking commented text activates the thread: bring it into view in the rail.
  useEffect(() => {
    if (active) itemRef.current?.scrollIntoView?.({ block: 'nearest' });
  }, [active]);
  if (!comments) return null;
  const { commands } = comments;
  const [first, ...replies] = thread.comments;

  const sendReply = async () => {
    if (await commands.reply(thread.id, reply)) setReply('');
  };

  return (
    <li ref={itemRef} className="pl-thread" data-active={active || undefined} data-resolved={thread.resolved || undefined} data-orphaned={thread.orphaned || undefined}>
      <button type="button" className="pl-quote" disabled={thread.orphaned} onClick={() => commands.select(active ? null : thread.id)}>
        {thread.orphaned && <span className="pl-orphaned">{t('comments.orphaned')}</span>}
        <q>{thread.anchor.quote}</q>
      </button>
      {[first, ...replies].filter(Boolean).map((c) => (
        <div key={c!.id} className="pl-comment-entry">
          <p className="pl-meta">
            <span className="pl-author">{c!.authorName ?? t('comments.someone')}</span>
            {' · '}
            <time dateTime={c!.createdAt}>{relativeTime(c!.createdAt, locale)}</time>
          </p>
          <p className="pl-body">{c!.body}</p>
        </div>
      ))}
      {allowed && (
        <>
          <form
            className="pl-reply"
            onSubmit={(e) => {
              e.preventDefault();
              void sendReply();
            }}
          >
            <input className="pl-input" aria-label={t('comments.replyPlaceholder')} placeholder={t('comments.replyPlaceholder')} value={reply} onChange={(e) => setReply(e.target.value)} />
            <button type="submit" className="pl-text-button" disabled={!reply.trim()}>{t('comments.reply')}</button>
          </form>
          <div className="pl-row">
            <button type="button" className="pl-text-button" onClick={() => void commands.setResolved(thread.id, !thread.resolved)}>
              {thread.resolved ? t('comments.reopen') : t('comments.resolve')}
            </button>
            {confirming ? (
              <>
                <span className="pl-confirm">{t('comments.confirmDelete')}</span>
                <button type="button" className="pl-text-button pl-danger" onClick={() => void commands.remove(thread.id)}>{t('comments.delete')}</button>
                <button type="button" className="pl-text-button" onClick={() => setConfirming(false)}>{t('comments.cancel')}</button>
              </>
            ) : (
              <button type="button" className="pl-text-button" onClick={() => setConfirming(true)}>{t('comments.delete')}</button>
            )}
          </div>
        </>
      )}
    </li>
  );
};
