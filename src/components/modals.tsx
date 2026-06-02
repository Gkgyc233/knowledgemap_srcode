// ============================================================
// 知识点选择页面 + 添加知识点 + 笔记编辑器 (Modals)
// ============================================================

import React, { useState, useMemo } from 'react';
import { useKnowledgeStore } from '../store';
import type { KnowledgePoint } from '../types';

// ---- KnowledgeSelector ----

interface SelectorProps {
  embedded?: boolean;
  allowDrop?: boolean;
  onDropOnKP?: (kpName: string, text: string) => void;
  onSelect?: (kpName: string) => void;
  onClose?: () => void;
}

export const KnowledgeSelector: React.FC<SelectorProps> = ({
  embedded = false,
  allowDrop = false,
  onDropOnKP,
  onSelect,
  onClose,
}) => {
  const { state } = useKnowledgeStore();
  const [search, setSearch] = useState('');
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const filteredKPs = useMemo(() => {
    if (!search.trim()) return state.knowledgePoints;
    const q = search.toLowerCase();
    return state.knowledgePoints.filter(
      (kp: KnowledgePoint) =>
        kp.name.toLowerCase().includes(q) ||
        kp.description.toLowerCase().includes(q)
    );
  }, [state.knowledgePoints, search]);

  const handleDragOver = (e: React.DragEvent, kpId: string) => {
    if (!allowDrop) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'link';
    setDragOverId(kpId);
  };

  const handleDragLeave = () => {
    setDragOverId(null);
  };

  const handleDrop = (e: React.DragEvent, kp: KnowledgePoint) => {
    e.preventDefault();
    setDragOverId(null);
    const text = e.dataTransfer.getData('text/plain');
    if (text && onDropOnKP) {
      onDropOnKP(kp.name, text);
    }
  };

  const content = (
    <div className={`selector-container ${embedded ? 'selector-embedded' : ''}`}>
      <div className="selector-header">
        <h3>{embedded ? '知识点列表' : '选择知识点'}</h3>
        {!embedded && onClose && (
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        )}
      </div>
      <input
        className="sidebar-search selector-search"
        type="text"
        placeholder="搜索知识点..."
        value={search}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
      />
      <div className="selector-list">
        {filteredKPs.map((kp: KnowledgePoint) => (
          <div
            key={kp.id}
            className={`selector-item ${dragOverId === kp.id ? 'drag-over' : ''}`}
            onClick={() => onSelect?.(kp.name)}
            onDragOver={(e: React.DragEvent) => handleDragOver(e, kp.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e: React.DragEvent) => handleDrop(e, kp)}
          >
            <span className="selector-item-icon">📝</span>
            <span className="selector-item-name">{kp.name}</span>
            {allowDrop && <span className="selector-drop-hint">拖放到此</span>}
          </div>
        ))}
        {filteredKPs.length === 0 && (
          <div className="selector-empty">无匹配知识点</div>
        )}
      </div>
    </div>
  );

  if (embedded) return content;

  return (
    <div className="modal-overlay"
      onMouseDown={(e: React.MouseEvent) => {
        const el = e.currentTarget as HTMLElement;
        if (e.target === el) el.dataset.mdOnOverlay = '1';
      }}
      onClick={(e: React.MouseEvent) => {
        const el = e.currentTarget as HTMLElement;
        if (e.target === el && el.dataset.mdOnOverlay === '1') onClose?.();
        delete el.dataset.mdOnOverlay;
      }}>
      <div className="modal-content modal-selector">{content}</div>
    </div>
  );
};

// ---- AddKnowledge ----

interface AddKPProps {
  defaultDescription?: string;
  defaultName?: string;
  editMode?: boolean;
  editKPId?: string;
  onClose: () => void;
  embedded?: boolean;
}

export const AddKnowledge: React.FC<AddKPProps> = ({ defaultDescription = '', defaultName = '', editMode = false, editKPId, onClose, embedded }) => {
  const { dispatch } = useKnowledgeStore();
  const [name, setName] = useState(defaultName);
  const [description, setDescription] = useState(defaultDescription);

  const handleSubmit = () => {
    if (!name.trim()) {
      alert('请输入知识点名称');
      return;
    }
    if (!description.trim()) {
      alert('请输入知识点释义');
      return;
    }
    if (editMode && editKPId) {
      dispatch({
        type: 'UPDATE_KNOWLEDGE_POINT',
        id: editKPId,
        name: name.trim(),
        description: description.trim(),
      });
    } else {
      dispatch({
        type: 'ADD_KNOWLEDGE_POINT',
        name: name.trim(),
        description: description.trim(),
      });
    }
    onClose();
  };

  const content = (
    <div className="modal-content modal-add-kp">
      <div className="modal-header">
        <h3>{editMode ? '📝 更改释义' : '➕ 添加知识点'}</h3>
        {!embedded && <button className="modal-close-btn" onClick={onClose}>✕</button>}
      </div>
      <div className="modal-body">
        <label className="form-label">
          知识点名称
          <input
            className="form-input"
            type="text"
            placeholder="例如：牛顿第二定律"
            value={name}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
            autoFocus
          />
        </label>
        <label className="form-label">
          知识点释义（支持LaTeX，行内公式用 $...$，块级公式用 $$...$$）
          <textarea
            className="form-textarea"
            placeholder="输入释义内容..."
            value={description}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
            rows={10}
          />
        </label>
      </div>
      <div className="modal-footer">
        <button className="btn btn-secondary" onClick={onClose}>取消</button>
        <button className="btn btn-primary" onClick={handleSubmit}>{editMode ? '确认修改' : '确认添加'}</button>
      </div>
    </div>
  );

  if (embedded) return content;

  return (
    <div className="modal-overlay"
      onMouseDown={(e: React.MouseEvent) => {
        const el = e.currentTarget as HTMLElement;
        if (e.target === el) el.dataset.mdOnOverlay = '1';
      }}
      onClick={(e: React.MouseEvent) => {
        const el = e.currentTarget as HTMLElement;
        if (e.target === el && el.dataset.mdOnOverlay === '1') onClose();
        delete el.dataset.mdOnOverlay;
      }}>
      {content}
    </div>
  );
};

// ---- NoteEditor ----

interface NoteEditorProps {
  initialContent: string;
  initialAnnotation?: string;
  targetKPId: string;
  onClose: () => void;
  onConfirm?: (content: string, annotation: string) => void;
  /** 提交成功后回调（用于跳转到主界面） */
  onSuccess?: () => void;
  /** 编辑模式：已有笔记ID，确认时更新而非新增 */
  editNoteId?: string;
  /** 链接模式：选择释义文本后链接到其他知识点 */
  linkMode?: boolean;
  /** 链接模式下，用户选中的文本（只读展示） */
  linkText?: string;
  /** 链接模式下，选中文本在释义中的起始/结束偏移 */
  linkStart?: number;
  linkEnd?: number;
  embedded?: boolean;
}

export const NoteEditor: React.FC<NoteEditorProps> = ({
  initialContent,
  initialAnnotation,
  targetKPId,
  onClose,
  onConfirm,
  onSuccess,
  editNoteId,
  linkMode,
  linkText,
  linkStart,
  linkEnd,
  embedded,
}) => {
  const { state, dispatch } = useKnowledgeStore();
  const [content, setContent] = useState(initialContent);
  const [annotation, setAnnotation] = useState(initialAnnotation || '');
  // 链接模式：选中的目标知识点
  const [linkTarget, setLinkTarget] = useState('');

  const handleConfirm = () => {
    if (linkMode) {
      if (!linkTarget) {
        alert('请选择一个目标知识点');
        return;
      }
      if (linkTarget === state.knowledgePoints.find(kp => kp.id === targetKPId)?.name) {
        alert('不能链接到自身');
        return;
      }
      // 在释义中注册可视化链接（位置偏移）
      if (linkText && linkStart !== undefined && linkEnd !== undefined) {
        dispatch({
          type: 'ADD_LINK',
          kpId: targetKPId,
          link: { start: linkStart, end: linkEnd, text: linkText, target: linkTarget },
        });
      }
      // 同时建立参考/引述关系
      dispatch({ type: 'ADD_MANUAL_LINK', kpId: targetKPId, targetName: linkTarget });
      onClose();
      return;
    }
    if (!content.trim()) {
      alert('笔记内容不能为空');
      return;
    }
    if (onConfirm) {
      onConfirm(content.trim(), annotation.trim());
      return;
    }
    if (editNoteId) {
      dispatch({
        type: 'UPDATE_NOTE',
        kpId: targetKPId,
        noteId: editNoteId,
        content: content.trim(),
        annotation: annotation.trim(),
      });
      onClose();
      onSuccess?.();
      return;
    }
    dispatch({
      type: 'ADD_NOTE',
      kpId: targetKPId,
      note: {
        id: `note_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        content: content.trim(),
        annotation: annotation.trim(),
      },
    });
    onClose();
    onSuccess?.();
  };

  const handleUploadJSON = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data: { text?: string; annotation?: string } = JSON.parse(text);
        if (data.text !== undefined) setContent(data.text);
        if (data.annotation !== undefined) setAnnotation(data.annotation);
      } catch {
        alert('JSON文件解析失败，请检查文件格式。');
      }
    };
    input.click();
  };

  // 链接模式 UI
  if (linkMode) {
    const linkContentEl = (
      <div className="modal-content modal-note-editor">
        <div className="modal-header">
          <h3>🔗 添加链接</h3>
          {!embedded && <button className="modal-close-btn" onClick={onClose}>✕</button>}
        </div>
        <div className="modal-body note-editor-body">
          <div className="note-editor-pane">
            <div className="form-label">链接文本（释义中选中的内容）</div>
            <div className="link-mode-text">{linkText || '（未选中文本）'}</div>
          </div>
          <div className="note-editor-pane">
            <div className="form-label">目标知识点</div>
            <KnowledgeSelector
              embedded
              onSelect={(kpName: string) => setLinkTarget(kpName)}
            />
          </div>
          {linkTarget && (
            <div className="link-mode-target">
              已选择目标：<strong>{linkTarget}</strong>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>取消</button>
          <button className="btn btn-primary" onClick={handleConfirm}>确认链接</button>
        </div>
      </div>
    );
    if (embedded) return linkContentEl;
    return (
      <div className="modal-overlay"
        onMouseDown={(e: React.MouseEvent) => {
          const el = e.currentTarget as HTMLElement;
          if (e.target === el) el.dataset.mdOnOverlay = '1';
        }}
        onClick={(e: React.MouseEvent) => {
          const el = e.currentTarget as HTMLElement;
          if (e.target === el && el.dataset.mdOnOverlay === '1') onClose();
          delete el.dataset.mdOnOverlay;
        }}>
        {linkContentEl}
      </div>
    );
  }

  // 笔记模式 UI
  const contentEl = (
    <div className="modal-content modal-note-editor">
      <div className="modal-header">
        <h3>{editNoteId ? '📝 编辑笔记' : '📝 编辑笔记'}</h3>
        {!embedded && <button className="modal-close-btn" onClick={onClose}>✕</button>}
      </div>
      <div className="modal-body note-editor-body">
        <div className="note-editor-pane">
          <div className="form-label">内容（文本）</div>
          <textarea
            className="form-textarea note-editor-content"
            value={content}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setContent(e.target.value)}
            placeholder="笔记内容..."
          />
        </div>
        <div className="note-editor-pane">
          <div className="form-label">批注（你的思考）</div>
          <textarea
            className="form-textarea note-editor-annotation"
            value={annotation}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setAnnotation(e.target.value)}
            placeholder="输入你的批注..."
          />
        </div>
      </div>
      <div className="modal-footer">
        <button className="btn btn-secondary" onClick={handleUploadJSON}>📤 上传JSON</button>
        <button className="btn btn-secondary" onClick={onClose}>取消</button>
        <button className="btn btn-primary" onClick={handleConfirm}>确定</button>
      </div>
    </div>
  );

  if (embedded) return contentEl;

  return (
    <div className="modal-overlay"
      onMouseDown={(e: React.MouseEvent) => {
        const el = e.currentTarget as HTMLElement;
        if (e.target === el) el.dataset.mdOnOverlay = '1';
      }}
      onClick={(e: React.MouseEvent) => {
        const el = e.currentTarget as HTMLElement;
        if (e.target === el && el.dataset.mdOnOverlay === '1') onClose();
        delete el.dataset.mdOnOverlay;
      }}>
      {contentEl}
    </div>
  );
};
