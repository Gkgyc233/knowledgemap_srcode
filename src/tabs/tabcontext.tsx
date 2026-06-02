// 标签页系统 — 上下文管理

import React, { createContext, useContext, useState, useCallback, useRef, type ReactNode } from 'react';

export interface Tab {
  id: string;
  title: string;
  type: 'summary' | 'longText' | 'multiText' | 'settings' | 'addKP' | 'noteEditor' | 'draft' | 'history' | 'noteSelector' | 'editKP';
  data?: Record<string, unknown>;
  closable?: boolean;
}

interface TabContextType {
  tabs: Tab[];
  activeTabId: string;
  openTab: (tab: Omit<Tab, 'id'> & { id?: string }) => string;
  closeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  goHome: () => void;
  updateTabData: (id: string, data: Record<string, unknown>) => void;
}

const TabContext = createContext<TabContextType | null>(null);

let tabCounter = 0;

export const TabProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [tabs, setTabs] = useState<Tab[]>([{
    id: 'main',
    title: '知识导图',
    type: 'addKP' as any,
    closable: false,
    data: { isMain: true },
  }]);
  const [activeTabId, _setActiveTabId] = useState('main');
  const activeTabIdRef = useRef(activeTabId);
  activeTabIdRef.current = activeTabId;

  const setActiveTabId = useCallback((id: string) => {
    activeTabIdRef.current = id;
    _setActiveTabId(id);
  }, []);

  const goHome = useCallback(() => {
    activeTabIdRef.current = 'main';
    _setActiveTabId('main');
  }, []);

  const openTab = useCallback((tab: Omit<Tab, 'id'> & { id?: string }) => {
    let newId: string | null = null;
    setTabs(prev => {
      const existing = prev.find(t => t.id !== 'main' && t.type === tab.type && t.closable !== false);
      if (existing) {
        newId = existing.id;
        // 即使 tab 已存在也返回新数组引用，确保 React 检测到变化并重渲染
        return prev.map(t => t.id === newId ? { ...t, data: { ...t.data, ...(tab.data || {}) } } : t);
      }
      newId = tab.id || `tab_${++tabCounter}`;
      return [...prev, { ...tab, id: newId, closable: tab.closable !== false }];
    });
    if (newId) {
      activeTabIdRef.current = newId;
      _setActiveTabId(newId);
    }
    return newId || '';
  }, []);

  const closeTab = useCallback((id: string) => {
    setTabs(prev => {
      const filtered = prev.filter(t => t.id !== id);
      if (activeTabIdRef.current === id && filtered.length > 0) {
        // 关闭标签页后优先回到主界面
        const mainTab = filtered.find(t => t.id === 'main');
        const nextId = mainTab ? 'main' : filtered[filtered.length - 1].id;
        activeTabIdRef.current = nextId;
        _setActiveTabId(nextId);
      }
      return filtered;
    });
  }, []);

  const updateTabData = useCallback((id: string, data: Record<string, unknown>) => {
    setTabs(prev => prev.map(t => t.id === id ? { ...t, data: { ...t.data, ...data } } : t));
  }, []);

  return (
    <TabContext.Provider value={{ tabs, activeTabId, openTab, closeTab, setActiveTab: setActiveTabId, goHome, updateTabData }}>
      {children}
    </TabContext.Provider>
  );
};

export const useTabContext = (): TabContextType => {
  const ctx = useContext(TabContext);
  if (!ctx) throw new Error('useTabContext must be used within TabProvider');
  return ctx;
};
