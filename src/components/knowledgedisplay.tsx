// ============================================================
// 知识点显示页面（中心面板）
// ============================================================

import React, { useRef, useEffect, useCallback, useState } from 'react';
import { useKnowledgeStore } from '../store';
import { renderDescriptionHTML, renderLaTeXToHTML } from '../utils';
import type { KnowledgePoint, Note } from '../types';

interface Props {
  onSelectText: (sel: { text: string; start: number; end: number } | null) => void;
  selectedText: { text: string; start: number; end: number } | null;
  onEditNote?: (kpId: string, noteId: string, content: string, annotation: string) => void;
}

export const KnowledgeDisplay: React.FC<Props> = ({ onSelectText, selectedText, onEditNote }) => {
  const { state, dispatch } = useKnowledgeStore();
  const contentRef = useRef<HTMLDivElement>(null);

  // 笔记 / 引用 / 引述 的右键菜单
  const [ctxMenu, setCtxMenu] = useState<{
    x: number; y: number;
    kind: 'note' | 'reference' | 'citation';
    noteId?: string;
    targetName?: string;
  } | null>(null);

  const selectedKP = state.knowledgePoints.find(
    (kp: KnowledgePoint) => kp.id === state.selectedKPId
  );

  const handleContentClick = useCallback(
    (e: React.MouseEvent) => {
      const target = e.target as HTMLElement;
      const linkEl = target.closest('.kp-link') as HTMLElement | null;
      if (linkEl) {
        const targetName = linkEl.getAttribute('data-target');
        if (targetName) {
          const targetKP = state.knowledgePoints.find(
            (kp: KnowledgePoint) => kp.name === targetName
          );
          if (targetKP) {
            dispatch({ type: 'SELECT_KNOWLEDGE_POINT', id: targetKP.id });
          }
        }
      }
    },
    [state.knowledgePoints, dispatch]
  );

  const handleTextSelect = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || !selection.toString().trim()) {
      onSelectText(null);
      return;
    }
    const text = selection.toString();
    if (!selectedKP) return;
    // 在原始释义中查找选中文本的位置
    const desc = selectedKP.description;
    const start = desc.indexOf(text);
    if (start === -1) {
      onSelectText(null);
      return;
    }
    onSelectText({ text, start, end: start + text.length });
  }, [onSelectText, selectedKP]);

  // ---- 右键菜单 ----
  const handleNoteContextMenu = useCallback((e: React.MouseEvent, noteId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setCtxMenu({ x: e.clientX, y: e.clientY, kind: 'note', noteId });
  }, []);

  const handleRefContextMenu = useCallback((e: React.MouseEvent, targetName: string, kind: 'reference' | 'citation') => {
    e.preventDefault();
    e.stopPropagation();
    setCtxMenu({ x: e.clientX, y: e.clientY, kind, targetName });
  }, []);

  const closeCtxMenu = useCallback(() => setCtxMenu(null), []);

  const handleRemoveFromMenu = useCallback(() => {
    if (!ctxMenu || !selectedKP) return;
    const kpId = selectedKP.id;
    if (ctxMenu.kind === 'note' && ctxMenu.noteId) {
      dispatch({ type: 'DELETE_NOTE', kpId, noteId: ctxMenu.noteId });
    } else if (ctxMenu.kind === 'reference' && ctxMenu.targetName) {
      dispatch({ type: 'REMOVE_REFERENCE', kpId, targetName: ctxMenu.targetName });
    } else if (ctxMenu.kind === 'citation' && ctxMenu.targetName) {
      dispatch({ type: 'REMOVE_CITATION', kpId, sourceName: ctxMenu.targetName });
    }
    setCtxMenu(null);
  }, [ctxMenu, selectedKP, dispatch]);

  const handleEditFromMenu = useCallback(() => {
    if (!ctxMenu || !selectedKP || ctxMenu.kind !== 'note' || !ctxMenu.noteId) return;
    const note = selectedKP.notes.find((n: Note) => n.id === ctxMenu.noteId);
    if (note && onEditNote) {
      onEditNote(selectedKP.id, note.id, note.content, note.annotation);
    }
    setCtxMenu(null);
  }, [ctxMenu, selectedKP, onEditNote]);

  useEffect(() => {
    if (contentRef.current && selectedKP) {
      const html = renderDescriptionHTML(
        selectedKP.description,
        selectedKP.links,
        () => {}
      );
      contentRef.current.innerHTML = html;
    }
  }, [selectedKP]);

  if (!selectedKP) {
    return (
      <div className="display-empty">
        <div className="display-empty-icon">🧠</div>
        <div className="display-empty-text">
          请从左侧列表中选择一个知识点，或点击「添加知识点」创建新的知识点
        </div>
      </div>
    );
  }

  return (
    <div className="display-container">
      <div className="display-header">
        <h1 className="display-title">{selectedKP.name}</h1>
      </div>

      <div className="display-body">
        <div className="display-description-wrapper">
          <div className="display-section-label">释义</div>
          <div
            ref={contentRef}
            className="display-description"
            onClick={handleContentClick}
            onMouseUp={handleTextSelect}
            onKeyUp={handleTextSelect}
          />
          {selectedText && (
            <div className="display-selection-indicator">
              已选择: 「{selectedText.text.slice(0, 50)}{selectedText.text.length > 50 ? '...' : ''}」
            </div>
          )}
        </div>

        <div className="display-sidebar">
          <KPNameList
            title="📌 引述此知识点的"
            items={selectedKP.citations}
            kps={state.knowledgePoints}
            onSelect={(name: string) => {
              const kp = state.knowledgePoints.find((k: KnowledgePoint) => k.name === name);
              if (kp) dispatch({ type: 'SELECT_KNOWLEDGE_POINT', id: kp.id });
            }}
            onContextMenu={(e, name) => handleRefContextMenu(e, name, 'citation')}
            emptyText="暂无其他知识点引述此知识点"
          />

          <KPNameList
            title="🔍 此知识点参考了"
            items={selectedKP.references}
            kps={state.knowledgePoints}
            onSelect={(name: string) => {
              const kp = state.knowledgePoints.find((k: KnowledgePoint) => k.name === name);
              if (kp) dispatch({ type: 'SELECT_KNOWLEDGE_POINT', id: kp.id });
            }}
            onContextMenu={(e, name) => handleRefContextMenu(e, name, 'reference')}
            emptyText="暂无参考其他知识点"
          />

          <div className="display-section">
            <div className="display-section-label">📝 笔记 ({selectedKP.notes.length})</div>
            <div className="display-notes-list">
              {selectedKP.notes.length === 0 ? (
                <div className="display-empty-hint">暂无笔记</div>
              ) : (
                selectedKP.notes.map((note: Note) => (
                  <div
                    key={note.id}
                    className="display-note-item"
                    onContextMenu={(e: React.MouseEvent) => handleNoteContextMenu(e, note.id)}
                  >
                    <div
                      className="display-note-content"
                      dangerouslySetInnerHTML={{
                        __html: renderLaTeXToHTML(note.content),
                      }}
                    />
                    {note.annotation && (
                      <div className="display-note-annotation">
                        <span className="display-note-label">💭 批注：</span>
                        {note.annotation}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 右键菜单：笔记 / 引用 / 引述 */}
      {ctxMenu && (
        <>
          <div className="context-menu-backdrop" onClick={closeCtxMenu} />
          <div
            className="context-menu"
            style={{ left: ctxMenu.x, top: ctxMenu.y }}
          >
            <div
              className="context-menu-item context-menu-danger"
              onClick={handleRemoveFromMenu}
            >
              🗑️ {ctxMenu.kind === 'note' ? '移除该笔记' : '移除此条目'}
            </div>
            {ctxMenu.kind === 'note' && onEditNote && (
              <div
                className="context-menu-item"
                onClick={handleEditFromMenu}
              >
                📝 编辑笔记
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

interface KPNameListProps {
  title: string;
  items: string[];
  kps: KnowledgePoint[];
  onSelect: (name: string) => void;
  onContextMenu?: (e: React.MouseEvent, name: string) => void;
  emptyText: string;
}

const KPNameList: React.FC<KPNameListProps> = ({
  title,
  items,
  kps: _kps,
  onSelect,
  onContextMenu,
  emptyText,
}) => {
  return (
    <div className="display-section">
      <div className="display-section-label">{title} ({items.length})</div>
      <div className="display-kp-links">
        {items.length === 0 ? (
          <div className="display-empty-hint">{emptyText}</div>
        ) : (
          items.map((name: string) => (
            <span
              key={name}
              className="display-kp-link-item"
              onClick={() => onSelect(name)}
              onContextMenu={(e: React.MouseEvent) => onContextMenu?.(e, name)}
              title={`跳转到「${name}」\n右键可移除`}
            >
              {name}
            </span>
          ))
        )}
      </div>
    </div>
  );
};
