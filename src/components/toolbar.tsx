// ============================================================
// 工具栏
// ============================================================

import React from 'react';

export interface ToolbarActions {
  onAddLink: () => void;
  onAddNote: () => void;
  onAddKnowledgePoint: () => void;
  onLongDocSummary: () => void;
  onMultiTextSummary: () => void;
  onOpenSettings: () => void;
  onSave: () => void;
  hasSelection: boolean;
  isKPSelected: boolean;
}

export const Toolbar: React.FC<ToolbarActions> = ({
  onAddLink,
  onAddNote,
  onAddKnowledgePoint,
  onLongDocSummary,
  onMultiTextSummary,
  onOpenSettings,
  onSave,
  hasSelection,
  isKPSelected,
}) => {
  return (
    <div className="toolbar">
      <div className="toolbar-left">
        <span className="toolbar-title">🧠 知识导图</span>
      </div>
      <div className="toolbar-actions">
        <button className="toolbar-btn" onClick={onAddKnowledgePoint} title="添加新知识点">
          ➕ 添加知识点
        </button>
        <button
          className="toolbar-btn"
          onClick={onAddLink}
          disabled={!hasSelection || !isKPSelected}
          title="选择释义中的文本后，添加指向另一个知识点的链接"
        >
          🔗 添加链接
        </button>
        <button
          className="toolbar-btn"
          onClick={onAddNote}
          disabled={!hasSelection || !isKPSelected}
          title="选择释义中的文本后，为当前知识点添加笔记"
        >
          📝 添加笔记
        </button>
        <button className="toolbar-btn" onClick={onLongDocSummary} title="粘贴长文本，AI辅助总结">
          📄 长文档辅助总结
        </button>
        <button className="toolbar-btn" onClick={onMultiTextSummary} title="上传多个JSON文件，AI辅助总结">
          📑 多文本辅助总结
        </button>
      </div>
      <div className="toolbar-right">
        <button
          className="toolbar-btn toolbar-btn-save"
          onClick={onSave}
          title="保存当前所有数据到本地（也会每5分钟自动保存）"
        >
          💾 保存
        </button>
        <button className="toolbar-btn toolbar-btn-icon" onClick={onOpenSettings} title="设置">
          ⚙️ 设置
        </button>
      </div>
    </div>
  );
};
