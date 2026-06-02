// 草稿箱 / 历史记录页面

import React, { useMemo } from 'react';
import { DraftCard } from './draftcard';
import type { DraftEntry, DraftAction } from './types';

interface DraftBoxProps {
  entries: DraftEntry[];
  title: string;
  emptyMessage: string;
  onAction: (entry: DraftEntry, action: DraftAction) => void;
  onBack: () => void;
}

export const DraftBox: React.FC<DraftBoxProps> = ({
  entries,
  title,
  emptyMessage,
  onAction,
  onBack,
}) => {
  const sorted = useMemo(() => {
    return [...entries].sort((a, b) => {
      const da = a.data.savedAt ? new Date(a.data.savedAt).getTime() : 0;
      const db = b.data.savedAt ? new Date(b.data.savedAt).getTime() : 0;
      return db - da;
    });
  }, [entries]);

  return (
    <div className="draft-box">
      <div className="draft-box-header">
        <button className="btn btn-secondary" onClick={onBack}>
          ← 返回
        </button>
        <h3>{title}</h3>
        <span className="draft-box-count">{entries.length} 条</span>
      </div>
      <div className="draft-box-grid">
        {sorted.map((entry) => (
          <DraftCard
            key={entry.name}
            entry={entry}
            onAction={onAction}
          />
        ))}
        {sorted.length === 0 && (
          <div className="draft-box-empty">{emptyMessage}</div>
        )}
      </div>
    </div>
  );
};
