// 草稿卡片 — 在网格中显示草稿条目，支持右键菜单

import React, { useState } from 'react';
import type { DraftEntry, DraftAction } from './types';

interface DraftCardProps {
  entry: DraftEntry;
  onAction: (entry: DraftEntry, action: DraftAction) => void;
}

export const DraftCard: React.FC<DraftCardProps> = ({ entry, onAction }) => {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const handleAction = (action: DraftAction) => {
    setContextMenu(null);
    onAction(entry, action);
  };

  const closeMenu = () => setContextMenu(null);

  // 计算显示的文字：text 和 annotation 各占一半空间
  const MAX_TOTAL = 200;
  const halfMax = Math.floor(MAX_TOTAL / 2);
  let displayText = entry.data.text || '';
  let displayAnnotation = entry.data.annotation || '';

  if (displayText.length + displayAnnotation.length > MAX_TOTAL) {
    if (displayText.length > halfMax && displayAnnotation.length > halfMax) {
      displayText = displayText.slice(0, halfMax - 2) + '…';
      displayAnnotation = displayAnnotation.slice(0, halfMax - 2) + '…';
    } else if (displayText.length > MAX_TOTAL - displayAnnotation.length) {
      const budget = MAX_TOTAL - displayAnnotation.length - 1;
      displayText = displayText.slice(0, Math.max(20, budget)) + '…';
    } else {
      const budget = MAX_TOTAL - displayText.length - 1;
      displayAnnotation = displayAnnotation.slice(0, Math.max(20, budget)) + '…';
    }
  }

  const timeStr = entry.data.savedAt
    ? new Date(entry.data.savedAt).toLocaleString('zh-CN')
    : '';

  return (
    <>
      <div
        className="draft-card"
        onContextMenu={handleContextMenu}
        title={`${entry.data.title || '无标题'}\n${timeStr}`}
      >
        <div className="draft-card-meta">
          <span className="draft-card-time">{timeStr || '无时间'}</span>
          {entry.data.title && (
            <span className="draft-card-title">{entry.data.title}</span>
          )}
        </div>
        {displayText && (
          <div className="draft-card-text">{displayText}</div>
        )}
        {displayAnnotation && (
          <div className="draft-card-annotation">{displayAnnotation}</div>
        )}
      </div>

      {contextMenu && (
        <>
          <div className="context-menu-backdrop" onClick={closeMenu} />
          <div
            className="context-menu"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <button className="context-menu-item" onClick={() => handleAction('edit')}>
              📝 编辑笔记
            </button>
            <button className="context-menu-item" onClick={() => handleAction('move')}>
              📦 移动（生成笔记并标记已处理）
            </button>
            <button className="context-menu-item" onClick={() => handleAction('copy')}>
              📋 复制（生成笔记但不标记）
            </button>
            <button className="context-menu-item context-menu-danger" onClick={() => handleAction('delete')}>
              🗑️ 删除
            </button>
          </div>
        </>
      )}
    </>
  );
};
