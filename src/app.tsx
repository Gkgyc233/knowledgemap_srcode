// ============================================================
// 主应用 — 标签页架构
// ============================================================

import React, { useState, useCallback, useEffect } from 'react';
import { TabProvider, useTabContext } from './tabs/tabcontext';
import { TabBar } from './tabs/tabbar';
import { useKnowledgeStore } from './store';
import { KnowledgeList } from './components/knowledgelist';
import { Toolbar } from './components/toolbar';
import { KnowledgeDisplay } from './components/knowledgedisplay';
import { AIChat, SettingsPanel } from './components/aichat';
import { AddKnowledge, NoteEditor, KnowledgeSelector } from './components/modals';
import { SummaryWindow, LongTextInput, MultiTextUpload } from './components/summary';
import { DraftBox } from './drafts/draftbox';
import { callAISummary } from './utils';
import type { DraftEntry, DraftAction } from './drafts/types';
import {
  listDrafts,
  listProcessed,
  markProcessed,
  deleteDraftFile,
  entryToNoteContent,
  entryToNoteAnnotation,
} from './drafts/api';

// ---- 自动保存间隔 ----
const SAVE_INTERVAL = 5 * 60 * 1000;

// ---- 主应用内层 ----
const AppInner: React.FC = () => {
  const { state, dispatch, getKPByName } = useKnowledgeStore();
  const { tabs, activeTabId, openTab, closeTab, goHome, updateTabData } = useTabContext();
  const [saveToast, setSaveToast] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [draftFiles, setDraftFiles] = useState<File[]>([]);
  const [draftRefreshKey, setDraftRefreshKey] = useState(0);
  const [selectedText, setSelectedText] = useState<{ text: string; start: number; end: number } | null>(null);
  const [pendingDraftNote, setPendingDraftNote] = useState<{
    content: string;
    annotation: string;
    draftEntry: DraftEntry | null;
    draftAction: DraftAction | null;
  } | null>(null);

  // 添加链接时锁定选中文本
  const linkModeActive = tabs.some(t => t.data?.linkMode === true);
  useEffect(() => {
    if (!linkModeActive) setSelectedText(null);
  }, [linkModeActive]);

  // 自动保存
  useEffect(() => {
    localStorage.setItem('knowledge-mindmap-state', JSON.stringify(state));
  }, [state]);
  useEffect(() => {
    const timer = setInterval(() => {
      localStorage.setItem('knowledge-mindmap-state', JSON.stringify(state));
    }, SAVE_INTERVAL);
    return () => clearInterval(timer);
  }, [state]);

  const handleManualSave = () => {
    localStorage.setItem('knowledge-mindmap-state', JSON.stringify(state));
    setSaveToast(true);
    setTimeout(() => setSaveToast(false), 2000);
  };

  // ---- 工具栏操作 ----

  const handleAddKP = () => openTab({ title: '添加知识点', type: 'addKP' });
  const handleLongDoc = () => openTab({ title: '长文档辅助总结', type: 'longText' });
  const handleMultiText = () => openTab({ title: '多文本辅助总结', type: 'multiText' });
  const handleSettings = () => {
    // SettingsPanel needs to be in a modal overlay still (it expects onClose to work)
    // Or we can render it as tab content
    openTab({ title: '⚙️ 设置', type: 'settings' });
  };

  const handleAddLink = () => {
    if (state.selectedKPId) {
      openTab({ title: '添加链接', type: 'noteEditor', data: { targetKPId: state.selectedKPId, initialContent: '', linkMode: true, linkText: selectedText?.text || '', linkStart: selectedText?.start, linkEnd: selectedText?.end } });
    } else alert('请先选择一个知识点');
  };

  const handleAddNote = () => {
    if (state.selectedKPId) {
      openTab({ title: '添加笔记', type: 'noteEditor', data: { targetKPId: state.selectedKPId, initialContent: '' } });
    } else alert('请先选择一个知识点');
  };

  // 编辑已有笔记
  const handleEditNote = (kpId: string, noteId: string, content: string, annotation: string) => {
    openTab({
      title: '📝 编辑笔记',
      type: 'noteEditor',
      data: {
        targetKPId: kpId,
        initialContent: content,
        initialAnnotation: annotation,
        editNoteId: noteId,
      },
    });
  };

  const handleEditKP = (kpId: string, kpName: string, kpDescription: string) => {
    openTab({
      title: `📝 ${kpName}`,
      type: 'editKP',
      data: { kpId, kpName, kpDescription },
    });
  };

  // ---- AI 总结 ----

  const handleLongTextSubmit = async (text: string) => {
    const cfg = state.aiConfig;
    if (!cfg.apiEndpoint || !cfg.apiKey) { alert('请先配置AI模型'); return; }
    const tabId = openTab({ title: 'AI 总结中…', type: 'summary', data: { loading: true } });
    try {
      const result = await callAISummary(text, cfg);
      updateTabData(tabId, { summaryText: result, loading: false });
    } catch (err: unknown) {
      updateTabData(tabId, { summaryText: `总结失败: ${err instanceof Error ? err.message : String(err)}`, loading: false });
    }
  };

  const handleMultiTextSubmit = async (texts: string[]) => {
    const cfg = state.aiConfig;
    if (!cfg.apiEndpoint || !cfg.apiKey) { alert('请先配置AI模型'); return; }
    const combined = texts.join('\n\n---\n\n');
    const tabId = openTab({ title: 'AI 总结中…', type: 'summary', data: { loading: true } });
    try {
      const result = await callAISummary(combined, cfg);
      updateTabData(tabId, { summaryText: result, loading: false });
    } catch (err: unknown) {
      updateTabData(tabId, { summaryText: `总结失败: ${err instanceof Error ? err.message : String(err)}`, loading: false });
    }
  };

  // ---- 草稿操作 ----

  const openDraftBox = () => openTab({ title: '📦 草稿箱', type: 'draft' });
  const openHistory = () => openTab({ title: '📋 历史记录', type: 'history' });

  const handleDraftAction = async (entry: DraftEntry, action: DraftAction) => {
    if (action === 'delete') {
      if (!confirm(`确定删除 "${entry.name}"？`)) return;
      await deleteDraftFile(entry);
      setDraftRefreshKey(k => k + 1);
      return;
    }
    if (action === 'move' || action === 'copy' || action === 'edit') {
      const noteContent = entryToNoteContent(entry);
      const noteAnnotation = entryToNoteAnnotation(entry);
      // 始终打开笔记编辑页（草稿模式），确认后弹出知识点选择页
      openTab({
        title: `📝 ${entry.data.title || entry.name}`,
        type: 'noteEditor',
        data: {
          targetKPId: '', // draft mode → uses onConfirm
          initialContent: noteContent,
          initialAnnotation: noteAnnotation,
          draftEntry: entry,
          draftAction: action,
        },
      });
    }
  };

  // ---- 草稿笔记确认：关闭笔记页 → 弹出知识点选择页 ----
  const handleDraftNoteConfirm = (tabId: string) => (content: string, annotation: string) => {
    const tab = tabs.find(t => t.id === tabId);
    const data = tab?.data;
    const draftEntry = data?.draftEntry as DraftEntry | undefined;
    const draftAction = data?.draftAction as DraftAction | undefined;

    closeTab(tabId);

    if (state.knowledgePoints.length === 0) {
      alert('请先创建知识点');
      return;
    }

    setPendingDraftNote({ content, annotation, draftEntry: draftEntry || null, draftAction: draftAction || null });
    openTab({ title: '选择知识点', type: 'noteSelector' });
  };

  // ---- 知识点选择完成：添加笔记 + 标记已处理 ----
  const handleKPSelect = async (kpName: string) => {
    if (!pendingDraftNote) return;
    const kp = getKPByName(kpName);
    if (!kp) { alert('未找到知识点'); return; }

    dispatch({
      type: 'ADD_NOTE',
      kpId: kp.id,
      note: {
        id: `note_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        content: pendingDraftNote.content,
        annotation: pendingDraftNote.annotation,
      },
    });

    if (pendingDraftNote.draftEntry && pendingDraftNote.draftAction === 'move') {
      await markProcessed(pendingDraftNote.draftEntry);
      setDraftRefreshKey(k => k + 1);
    }

    // 关闭选择页
    const selectorTab = tabs.find(t => t.type === 'noteSelector');
    if (selectorTab) closeTab(selectorTab.id);
    setPendingDraftNote(null);

    // 选中该知识点，让用户看到笔记已添加
    dispatch({ type: 'SELECT_KNOWLEDGE_POINT', id: kp.id });
    goHome();
  };

  // ---- 渲染活跃标签页 ----

  const showMain = activeTabId === 'main';

  return (
    <div className="app-shell">
      <TabBar />
      <div className="tab-content-area">
        {/* —— 主界面（始终挂载） —— */}
        <div className="main-layout" style={{ display: showMain ? 'flex' : 'none' }}>
          <div className="sidebar">
            <KnowledgeList onEditKP={handleEditKP} />
          </div>
          <div className="main-content">
            <KnowledgeDisplay
              onSelectText={(sel) => { if (!linkModeActive) setSelectedText(sel); }}
              selectedText={selectedText}
              onEditNote={handleEditNote}
            />
            {showChat ? (
              <div className="chat-panel">
                <button style={{ position: 'absolute', top: 4, right: 8, background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 16, zIndex: 1 }} onClick={() => setShowChat(false)}>✕</button>
                <AIChat />
              </div>
            ) : (
              <button className="chat-toggle-btn" onClick={() => setShowChat(true)}>💬 AI 对话</button>
            )}
          </div>
        </div>

        {/* —— 标签页内容（全部挂载，仅活跃的可见） —— */}
        {tabs.filter(t => t.id !== 'main').map(tab => {
          const isActive = tab.id === activeTabId;
          const data = tab.data || {};
          return (
            <div key={tab.id} className="tab-page-wrapper" style={{ display: isActive ? 'flex' : 'none' }}>
              {tab.type === 'summary' ? (
                data.loading ? (
                  <div className="tab-content-loading">⏳ AI 正在总结中…</div>
                ) : (
                  <SummaryWindow summaryText={(data.summaryText as string) || ''} onClose={() => closeTab(tab.id)} />
                )
              ) : tab.type === 'longText' ? (
                <LongTextInput title="长文档辅助总结" onSubmit={handleLongTextSubmit} onClose={() => closeTab(tab.id)} />
              ) : tab.type === 'multiText' ? (
                <MultiTextUpload onSubmit={handleMultiTextSubmit} onClose={() => closeTab(tab.id)} onOpenDrafts={openDraftBox} onOpenHistory={openHistory} />
              ) : tab.type === 'settings' ? (
                <SettingsPanel onClose={() => closeTab(tab.id)} embedded />
              ) : tab.type === 'addKP' ? (
                <AddKnowledge defaultDescription="" onClose={() => { closeTab(tab.id); goHome(); }} embedded />
              ) : tab.type === 'editKP' ? (
                <AddKnowledge
                  defaultName={(data.kpName as string) || ''}
                  defaultDescription={(data.kpDescription as string) || ''}
                  editMode
                  editKPId={(data.kpId as string) || ''}
                  onClose={() => { closeTab(tab.id); goHome(); }}
                  embedded
                />
              ) : tab.type === 'noteEditor' ? (
                (data.targetKPId as string) ? (
                  /* 普通模式：添加/编辑笔记到指定知识点 */
                  <NoteEditor
                    initialContent={(data.initialContent as string) || ''}
                    initialAnnotation={(data.initialAnnotation as string) || ''}
                    targetKPId={(data.targetKPId as string) || ''}
                    editNoteId={data.editNoteId as string | undefined}
                    linkMode={!!data.linkMode}
                    linkText={(data.linkText as string) || ''}
                    linkStart={data.linkStart as number | undefined}
                    linkEnd={data.linkEnd as number | undefined}
                    onClose={() => closeTab(tab.id)}
                    onSuccess={goHome}
                    embedded
                  />
                ) : (
                  /* 草稿模式：确认后弹出知识点选择页 */
                  <NoteEditor
                    initialContent={(data.initialContent as string) || ''}
                    initialAnnotation={(data.initialAnnotation as string) || ''}
                    targetKPId=""
                    onClose={() => closeTab(tab.id)}
                    onConfirm={handleDraftNoteConfirm(tab.id)}
                    embedded
                  />
                )
              ) : tab.type === 'noteSelector' ? (
                <KnowledgeSelector
                  embedded
                  onSelect={handleKPSelect}
                  onClose={() => { setPendingDraftNote(null); closeTab(tab.id); }}
                />
              ) : tab.type === 'draft' ? (
                <DraftTabContent key={tab.id + draftRefreshKey} files={draftFiles} onAction={handleDraftAction} onBack={() => closeTab(tab.id)} />
              ) : tab.type === 'history' ? (
                <HistoryTabContent key={tab.id + draftRefreshKey} files={draftFiles} onAction={handleDraftAction} onBack={() => closeTab(tab.id)} />
              ) : (
                <div className="tab-content-empty">未知标签页</div>
              )}
            </div>
          );
        })}
      </div>
      <Toolbar
        onAddLink={handleAddLink}
        onAddNote={handleAddNote}
        onAddKnowledgePoint={handleAddKP}
        onLongDocSummary={handleLongDoc}
        onMultiTextSummary={handleMultiText}
        onOpenSettings={handleSettings}
        onSave={handleManualSave}
        hasSelection={state.selectedKPId !== null}
        isKPSelected={state.selectedKPId !== null}
      />
      {saveToast && <div className="save-toast">✅ 已保存</div>}
    </div>
  );
};

// ---- 草稿/历史 标签页内容（独立组件，方便数据加载） ----

const DraftTabContent: React.FC<{
  files: File[];
  onAction: (entry: DraftEntry, action: DraftAction) => void;
  onBack: () => void;
}> = ({ files, onAction, onBack }) => {
  const [entries, setEntries] = useState<DraftEntry[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => { setLoading(true); const r = await listDrafts(files.length ? files : undefined); setEntries(r); setLoading(false); })();
  }, [files]);
  if (loading) return <div className="tab-content-loading">⏳ 加载草稿中…</div>;
  return <DraftBox entries={entries} title="草稿箱" emptyMessage="暂无未处理草稿" onAction={onAction} onBack={onBack} />;
};

const HistoryTabContent: React.FC<{
  files: File[];
  onAction: (entry: DraftEntry, action: DraftAction) => void;
  onBack: () => void;
}> = ({ files, onAction, onBack }) => {
  const [entries, setEntries] = useState<DraftEntry[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => { setLoading(true); const r = await listProcessed(files.length ? files : undefined); setEntries(r); setLoading(false); })();
  }, [files]);
  if (loading) return <div className="tab-content-loading">⏳ 加载历史中…</div>;
  return <DraftBox entries={entries} title="历史记录" emptyMessage="暂无已处理文件" onAction={onAction} onBack={onBack} />;
};

// ---- 外层入口 ----

export const App: React.FC = () => (
  <TabProvider><AppInner /></TabProvider>
);

export default App;
