// ============================================================
// 总结窗口 + 长文本输入 + 多文本上传
// ============================================================

import React, { useState, useRef } from 'react';
import { KnowledgeSelector, AddKnowledge, NoteEditor } from './modals';
import { useKnowledgeStore } from '../store';
import { renderLaTeXToHTML } from '../utils';
import type { KnowledgePoint } from '../types';

interface SummaryWindowProps {
  summaryText: string;
  onClose: () => void;
}

type DragAction = {
  text: string;
  targetKPId: string;
} | null;

export const SummaryWindow: React.FC<SummaryWindowProps> = ({ summaryText, onClose }) => {
  const { state } = useKnowledgeStore();
  const [showAddKP, setShowAddKP] = useState(false);
  const [defaultDesc, setDefaultDesc] = useState('');
  const [dragAction, setDragAction] = useState<DragAction>(null);
  const summaryRef = useRef<HTMLDivElement>(null);

  const getSelectedText = (): string => {
    const selection = window.getSelection();
    if (selection && summaryRef.current?.contains(selection.anchorNode)) {
      return selection.toString().trim();
    }
    return '';
  };

  const handleAddKPFromSelection = () => {
    const text = getSelectedText();
    if (!text) {
      alert('请先在总结内容中选择一段文本');
      return;
    }
    setDefaultDesc(text);
    setShowAddKP(true);
  };

  const handleAddNoteFromSelection = () => {
    const text = getSelectedText();
    if (!text) {
      alert('请先在总结内容中选择一段文本');
      return;
    }
    if (state.knowledgePoints.length === 1) {
      setDragAction({
        text,
        targetKPId: state.knowledgePoints[0].id,
      });
    } else {
      alert('请将选择的文本拖动到右侧知识点列表中的目标知识点上');
    }
  };

  const handleDropOnKP = (kpName: string, text: string) => {
    const kp = state.knowledgePoints.find((k: KnowledgePoint) => k.name === kpName);
    if (kp) {
      setDragAction({ text, targetKPId: kp.id });
    }
  };

  const handleDragStart = (e: React.DragEvent) => {
    const text = getSelectedText();
    if (!text) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData('text/plain', text);
    e.dataTransfer.effectAllowed = 'link';
  };

  const summaryHTML = renderLaTeXToHTML(summaryText);

  return (
    <>
      <div className="modal-overlay"
        onMouseDown={(ev: React.MouseEvent) => {
          const el = ev.currentTarget as HTMLElement;
          if (ev.target === el) el.dataset.mdOnOverlay = '1';
        }}
        onClick={(ev: React.MouseEvent) => {
          const el = ev.currentTarget as HTMLElement;
          if (ev.target === el && el.dataset.mdOnOverlay === '1') onClose();
          delete el.dataset.mdOnOverlay;
        }}>
        <div className="modal-content modal-summary">
          <div className="modal-header">
            <h3>📄 AI 总结</h3>
            <div className="summary-toolbar">
              <button className="btn btn-sm" onClick={handleAddKPFromSelection}>
                ➕ 从选择新建知识点
              </button>
              <button className="btn btn-sm" onClick={handleAddNoteFromSelection}>
                📝 从选择添加笔记
              </button>
              <button className="modal-close-btn" onClick={onClose}>✕</button>
            </div>
          </div>
          <div className="summary-body">
            <div
              ref={summaryRef}
              className="summary-content"
              dangerouslySetInnerHTML={{ __html: summaryHTML }}
              onDragStart={handleDragStart}
            />
            <div className="summary-selector">
              <KnowledgeSelector
                embedded
                allowDrop
                onDropOnKP={handleDropOnKP}
              />
            </div>
          </div>
        </div>
      </div>

      {showAddKP && (
        <AddKnowledge
          defaultDescription={defaultDesc}
          onClose={() => setShowAddKP(false)}
        />
      )}

      {dragAction && (
        <NoteEditor
          initialContent={dragAction.text}
          targetKPId={dragAction.targetKPId}
          onClose={() => setDragAction(null)}
        />
      )}
    </>
  );
};

// ---- LongTextInput ----

interface LongTextInputProps {
  onSubmit: (text: string) => void;
  onClose: () => void;
  title: string;
}

export const LongTextInput: React.FC<LongTextInputProps> = ({
  onSubmit,
  onClose,
  title,
}) => {
  const [text, setText] = useState('');

  const handleSubmit = () => {
    if (!text.trim()) {
      alert('请输入文本内容');
      return;
    }
    onSubmit(text.trim());
    onClose();
  };

  return (
    <div className="modal-overlay"
      onMouseDown={(ev: React.MouseEvent) => {
        const el = ev.currentTarget as HTMLElement;
        if (ev.target === el) el.dataset.mdOnOverlay = '1';
      }}
      onClick={(ev: React.MouseEvent) => {
        const el = ev.currentTarget as HTMLElement;
        if (ev.target === el && el.dataset.mdOnOverlay === '1') onClose();
        delete el.dataset.mdOnOverlay;
      }}>
      <div className="modal-content modal-long-text">
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <label className="form-label">
            请粘贴/输入文本（支持LaTeX和其他格式的数学公式）
            <textarea
              className="form-textarea long-text-input"
              value={text}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setText(e.target.value)}
              placeholder="在此粘贴文本..."
              rows={20}
              autoFocus
            />
          </label>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>取消</button>
          <button className="btn btn-primary" onClick={handleSubmit}>开始总结</button>
        </div>
      </div>
    </div>
  );
};

// ---- MultiTextUpload ----

interface MultiTextUploadProps {
  onSubmit: (texts: string[]) => void;
  onClose: () => void;
  onOpenDrafts?: () => void;
  onOpenHistory?: () => void;
}

export const MultiTextUpload: React.FC<MultiTextUploadProps> = ({
  onSubmit,
  onClose,
  onOpenDrafts,
  onOpenHistory,
}) => {
  const [files, setFiles] = useState<File[]>([]);

  const handleFileSelect = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.multiple = true;
    input.onchange = async (e: Event) => {
      const selected = Array.from((e.target as HTMLInputElement).files || []);
      setFiles((prev: File[]) => [...prev, ...selected]);
    };
    input.click();
  };

  const handleSubmit = async () => {
    if (files.length === 0) {
      alert('请先选择JSON文件');
      return;
    }
    const texts: string[] = [];
    for (const file of files) {
      try {
        const content = await file.text();
        const data: { text?: string; annotation?: string } = JSON.parse(content);
        const t = data.text || '';
        const a = data.annotation || '';
        texts.push(`文件: ${file.name}\n文本内容: ${t}\n批注: ${a}`);
      } catch {
        texts.push(`[文件 ${file.name} 解析失败]`);
      }
    }
    onSubmit(texts);
    onClose();
  };

  return (
    <div className="modal-content modal-multi-text tab-page">
      <div className="modal-header">
        <h3>📑 多文本辅助总结</h3>
        <button className="modal-close-btn" onClick={onClose}>✕</button>
      </div>
      <div className="modal-body">
        <div className="multi-text-area">
          <div className="multi-text-actions">
            <button className="btn btn-primary" onClick={handleFileSelect}>
              📤 选择JSON文件
            </button>
            {onOpenDrafts && (
              <button className="btn btn-secondary" onClick={onOpenDrafts}>
                📦 草稿箱
              </button>
            )}
            {onOpenHistory && (
              <button className="btn btn-secondary" onClick={onOpenHistory}>
                📋 历史记录
              </button>
            )}
          </div>
            {files.length > 0 && (
              <div className="multi-text-file-list">
                <div className="form-label">已选择 {files.length} 个文件：</div>
                <ul>
                  {files.map((f: File, i: number) => (
                    <li key={i}>
                      {f.name}
                      <button
                        className="btn btn-sm btn-secondary"
                        style={{ marginLeft: 8 }}
                        onClick={() => setFiles(files.filter((_: File, j: number) => j !== i))}
                      >
                        移除
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>取消</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={files.length === 0}>
            开始总结
          </button>
        </div>
      </div>
  );
};
