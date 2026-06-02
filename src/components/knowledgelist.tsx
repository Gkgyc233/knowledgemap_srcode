// ============================================================
// 左侧边栏 - 知识点列表（带搜索 + 右键菜单）
// ============================================================

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useKnowledgeStore } from '../store';
import type { KnowledgePoint } from '../types';

// 右键菜单位置
interface ContextMenuState {
  x: number;
  y: number;
  kpId: string;
  kpName: string;
  kpDescription: string;
}

export const KnowledgeList: React.FC<{ onEditKP?: (kpId: string, kpName: string, kpDescription: string) => void }> = ({ onEditKP }) => {
  const { state, dispatch } = useKnowledgeStore();
  const [search, setSearch] = useState('');
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filteredKPs = useMemo(() => {
    if (!search.trim()) return state.knowledgePoints;
    const q = search.toLowerCase();
    return state.knowledgePoints.filter(
      (kp: KnowledgePoint) =>
        kp.name.toLowerCase().includes(q) ||
        kp.description.toLowerCase().includes(q)
    );
  }, [state.knowledgePoints, search]);

  // 点击其他地方关闭右键菜单
  useEffect(() => {
    const handler = () => setContextMenu(null);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, kp: KnowledgePoint) => {
      e.preventDefault();
      e.stopPropagation();
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        kpId: kp.id,
        kpName: kp.name,
        kpDescription: kp.description,
      });
    },
    []
  );

  const handleOpen = useCallback(
    (kpId: string) => {
      dispatch({ type: 'SELECT_KNOWLEDGE_POINT', id: kpId });
      setContextMenu(null);
    },
    [dispatch]
  );

  const handleDelete = useCallback(
    (kpId: string, kpName: string) => {
      if (window.confirm(`确定要移除知识点「${kpName}」吗？\n\n此操作将同时清理其他知识点中对该知识点的引用。`)) {
        dispatch({ type: 'DELETE_KNOWLEDGE_POINT', id: kpId });
      }
      setContextMenu(null);
    },
    [dispatch]
  );

  const handleEditDescription = useCallback(
    (kpId: string, kpName: string, kpDescription: string) => {
      onEditKP?.(kpId, kpName, kpDescription);
      setContextMenu(null);
    },
    [onEditKP]
  );

  return (
    <div className="sidebar-left" ref={listRef}>
      <div className="sidebar-header">📚 知识点列表</div>
      <input
        className="sidebar-search"
        type="text"
        placeholder="搜索知识点..."
        value={search}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
      />
      <div className="sidebar-list">
        {filteredKPs.map((kp: KnowledgePoint) => (
          <div
            key={kp.id}
            className={`sidebar-item ${state.selectedKPId === kp.id ? 'active' : ''}`}
            onClick={() => dispatch({ type: 'SELECT_KNOWLEDGE_POINT', id: kp.id })}
            onContextMenu={(e: React.MouseEvent) => handleContextMenu(e, kp)}
            title={`${kp.name}\n右键查看更多操作`}
          >
            <span className="sidebar-item-icon">📝</span>
            <span className="sidebar-item-name">{kp.name}</span>
          </div>
        ))}
        {filteredKPs.length === 0 && (
          <div className="sidebar-empty">
            {state.knowledgePoints.length === 0
              ? '暂无知识点'
              : '无匹配结果'}
          </div>
        )}
      </div>

      {/* 右键菜单 */}
      {contextMenu && (
        <div
          className="context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <div
            className="context-menu-item"
            onClick={() => handleOpen(contextMenu.kpId)}
          >
            📖 打开该知识点
          </div>
          <div
            className="context-menu-item"
            onClick={() => handleEditDescription(contextMenu.kpId, contextMenu.kpName, contextMenu.kpDescription)}
          >
            📝 更改释义
          </div>
          <div className="context-menu-divider" />
          <div
            className="context-menu-item context-menu-danger"
            onClick={() => handleDelete(contextMenu.kpId, contextMenu.kpName)}
          >
            🗑️ 移除该知识点
          </div>
        </div>
      )}
    </div>
  );
};
