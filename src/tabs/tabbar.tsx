// 浏览器风格的标签栏

import React from 'react';
import { useTabContext } from './tabcontext';

export const TabBar: React.FC = () => {
  const { tabs, activeTabId, setActiveTab, closeTab } = useTabContext();

  return (
    <div className="tab-bar">
      {tabs.map((tab) => (
        <div
          key={tab.id}
          className={`tab-bar-item ${tab.id === activeTabId ? 'tab-bar-item-active' : ''}`}
          onClick={() => setActiveTab(tab.id)}
        >
          <span className="tab-bar-title">{tab.title}</span>
          {tab.closable !== false && (
            <button
              className="tab-bar-close"
              onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}
              title="关闭标签页"
            >
              ✕
            </button>
          )}
        </div>
      ))}
    </div>
  );
};
