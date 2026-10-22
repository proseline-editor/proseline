import { useState } from 'react';
import { CommentsRail, StylePanel, VersionsPanel, useProseline } from '@proseline-editor/react';

/** The example's side panel: comments, versions and style behind tabs. */
export const Sidebar = () => {
  const { t } = useProseline();
  const [tab, setTab] = useState<'comments' | 'versions' | 'style'>('comments');
  return (
    <div className="sidebar">
      <div className="pl-row sidebar-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'comments'} className="pl-text-button" onClick={() => setTab('comments')}>
          {t('comments.title')}
        </button>
        <button type="button" role="tab" aria-selected={tab === 'versions'} className="pl-text-button" onClick={() => setTab('versions')}>
          {t('versions.title')}
        </button>
        <button type="button" role="tab" aria-selected={tab === 'style'} className="pl-text-button" onClick={() => setTab('style')}>
          {t('styleAnalysis.title')}
        </button>
      </div>
      {tab === 'comments' ? <CommentsRail /> : tab === 'versions' ? <VersionsPanel /> : <StylePanel />}
    </div>
  );
};
