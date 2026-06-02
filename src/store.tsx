// ============================================================
// 全局状态管理 - Context + Reducer
// ============================================================

import React, { createContext, useContext, useReducer, useEffect, type ReactNode } from 'react';
import type { KnowledgePoint, Note, KPLink, AppState, AIModelConfig } from './types';
import { generateId } from './types';
import { autoLinkCheck } from './utils';

// ---- Actions ----

type Action =
  | { type: 'ADD_KNOWLEDGE_POINT'; name: string; description: string }
  | { type: 'DELETE_KNOWLEDGE_POINT'; id: string }
  | { type: 'UPDATE_KNOWLEDGE_POINT'; id: string; name: string; description: string }
  | { type: 'SELECT_KNOWLEDGE_POINT'; id: string | null }
  | { type: 'ADD_LINK'; kpId: string; link: KPLink }
  | { type: 'ADD_NOTE'; kpId: string; note: Note }
  | { type: 'UPDATE_NOTE'; kpId: string; noteId: string; content: string; annotation: string }
  | { type: 'DELETE_NOTE'; kpId: string; noteId: string }
  | { type: 'REMOVE_REFERENCE'; kpId: string; targetName: string }
  | { type: 'REMOVE_CITATION'; kpId: string; sourceName: string }
  | { type: 'UPDATE_AI_CONFIG'; config: Partial<AIModelConfig> }
  | { type: 'LOAD_STATE'; state: AppState }
  | { type: 'ADD_MANUAL_LINK'; kpId: string; targetName: string }
  | { type: 'ADD_MANUAL_CITATION'; kpId: string; sourceName: string };

// ---- Initial State ----

const defaultAIConfig: AIModelConfig = {
  apiEndpoint: 'https://api.openai.com/v1/chat/completions',
  apiKey: '',
  modelName: 'gpt-4o',
};

const initialState: AppState = {
  knowledgePoints: [],
  selectedKPId: null,
  aiConfig: defaultAIConfig,
};

// ---- Reducer ----

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'DELETE_KNOWLEDGE_POINT': {
      const kpToDelete = state.knowledgePoints.find((kp: KnowledgePoint) => kp.id === action.id);
      if (!kpToDelete) return state;
      const deletedName = kpToDelete.name;

      // 从其他KP中清理引用
      const cleanedKPs = state.knowledgePoints
        .filter((kp: KnowledgePoint) => kp.id !== action.id)
        .map((kp: KnowledgePoint) => ({
          ...kp,
          // 清理引述表中指向被删KP的条目
          citations: kp.citations.filter((c: string) => c !== deletedName),
          // 清理参考表中指向被删KP的条目
          references: kp.references.filter((r: string) => r !== deletedName),
          // 清理释义中的链接（指向被删KP的）
          links: kp.links.filter((l: KPLink) => l.target !== deletedName),
        }));

      return {
        ...state,
        knowledgePoints: cleanedKPs,
        // 如果删除的是当前选中的，则取消选中
        selectedKPId: state.selectedKPId === action.id ? null : state.selectedKPId,
      };
    }

    case 'UPDATE_KNOWLEDGE_POINT': {
      return {
        ...state,
        knowledgePoints: state.knowledgePoints.map((kp: KnowledgePoint) => {
          if (kp.id !== action.id) return kp;
          return { ...kp, name: action.name, description: action.description };
        }),
      };
    }

    case 'ADD_KNOWLEDGE_POINT': {
      const newKP: KnowledgePoint = {
        id: generateId(),
        name: action.name,
        description: action.description,
        links: [],
        citations: [],
        references: [],
        notes: [],
      };

      const { updatedNewKP, updatedExistingKPs } = autoLinkCheck(
        newKP,
        state.knowledgePoints
      );

      return {
        ...state,
        knowledgePoints: [...updatedExistingKPs, updatedNewKP],
      };
    }

    case 'SELECT_KNOWLEDGE_POINT': {
      return { ...state, selectedKPId: action.id };
    }

    case 'ADD_LINK': {
      const kps = state.knowledgePoints.map((kp: KnowledgePoint) => {
        if (kp.id !== action.kpId) return kp;
        const exists = kp.links.some(
          (l: KPLink) => l.start === action.link.start && l.end === action.link.end
        );
        if (exists) return kp;
        return { ...kp, links: [...kp.links, action.link] };
      });
      return { ...state, knowledgePoints: kps };
    }

    case 'ADD_NOTE': {
      const kps = state.knowledgePoints.map((kp: KnowledgePoint) => {
        if (kp.id !== action.kpId) return kp;
        return { ...kp, notes: [...kp.notes, action.note] };
      });
      return { ...state, knowledgePoints: kps };
    }

    case 'UPDATE_NOTE': {
      return {
        ...state,
        knowledgePoints: state.knowledgePoints.map((kp: KnowledgePoint) => {
          if (kp.id !== action.kpId) return kp;
          return {
            ...kp,
            notes: kp.notes.map((n: Note) =>
              n.id === action.noteId
                ? { ...n, content: action.content, annotation: action.annotation }
                : n
            ),
          };
        }),
      };
    }

    case 'DELETE_NOTE': {
      return {
        ...state,
        knowledgePoints: state.knowledgePoints.map((kp: KnowledgePoint) => {
          if (kp.id !== action.kpId) return kp;
          return { ...kp, notes: kp.notes.filter((n: Note) => n.id !== action.noteId) };
        }),
      };
    }

    case 'REMOVE_REFERENCE': {
      return {
        ...state,
        knowledgePoints: state.knowledgePoints.map((kp: KnowledgePoint) => {
          if (kp.id !== action.kpId) return kp;
          return { ...kp, references: kp.references.filter((r: string) => r !== action.targetName) };
        }),
      };
    }

    case 'REMOVE_CITATION': {
      return {
        ...state,
        knowledgePoints: state.knowledgePoints.map((kp: KnowledgePoint) => {
          if (kp.id !== action.kpId) return kp;
          return { ...kp, citations: kp.citations.filter((c: string) => c !== action.sourceName) };
        }),
      };
    }

    case 'ADD_MANUAL_LINK': {
      const kps = state.knowledgePoints.map((kp: KnowledgePoint) => {
        if (kp.id === action.kpId) {
          if (kp.references.includes(action.targetName)) return kp;
          return { ...kp, references: [...kp.references, action.targetName] };
        }
        if (kp.name === action.targetName) {
          const sourceKP = state.knowledgePoints.find(
            (k: KnowledgePoint) => k.id === action.kpId
          );
          const sourceName = sourceKP?.name || '';
          if (kp.citations.includes(sourceName)) return kp;
          return { ...kp, citations: [...kp.citations, sourceName] };
        }
        return kp;
      });
      return { ...state, knowledgePoints: kps };
    }

    case 'ADD_MANUAL_CITATION': {
      const kps = state.knowledgePoints.map((kp: KnowledgePoint) => {
        if (kp.id === action.kpId) {
          if (kp.citations.includes(action.sourceName)) return kp;
          return { ...kp, citations: [...kp.citations, action.sourceName] };
        }
        if (kp.name === action.sourceName) {
          const targetKP = state.knowledgePoints.find(
            (k: KnowledgePoint) => k.id === action.kpId
          );
          const targetName = targetKP?.name || '';
          if (kp.references.includes(targetName)) return kp;
          return { ...kp, references: [...kp.references, targetName] };
        }
        return kp;
      });
      return { ...state, knowledgePoints: kps };
    }

    case 'UPDATE_AI_CONFIG': {
      return {
        ...state,
        aiConfig: { ...state.aiConfig, ...action.config },
      };
    }

    case 'LOAD_STATE': {
      return action.state;
    }

    default:
      return state;
  }
}

// ---- Context ----

interface StoreContextType {
  state: AppState;
  dispatch: React.Dispatch<Action>;
  getKPById: (id: string) => KnowledgePoint | undefined;
  getKPByName: (name: string) => KnowledgePoint | undefined;
}

const StoreContext = createContext<StoreContextType | null>(null);

// ---- Provider ----

const STORAGE_KEY = 'knowledge-mindmap-state';

export function KnowledgeStoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as AppState;
        if (parsed.knowledgePoints && parsed.aiConfig) {
          dispatch({ type: 'LOAD_STATE', state: parsed });
        }
      }
    } catch (e) {
      console.warn('无法从localStorage加载数据', e);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn('无法保存数据到localStorage', e);
    }
  }, [state]);

  const getKPById = (id: string) =>
    state.knowledgePoints.find((kp: KnowledgePoint) => kp.id === id);

  const getKPByName = (name: string) =>
    state.knowledgePoints.find((kp: KnowledgePoint) => kp.name === name);

  return (
    <StoreContext.Provider value={{ state, dispatch, getKPById, getKPByName }}>
      {children}
    </StoreContext.Provider>
  );
}

export function useKnowledgeStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) {
    throw new Error('useKnowledgeStore must be used within KnowledgeStoreProvider');
  }
  return ctx;
}
