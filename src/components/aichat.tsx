// ============================================================
// AI聊天助手面板 + 设置面板
// ============================================================

import React, { useState, useRef, useEffect } from 'react';
import { useKnowledgeStore } from '../store';
import { callAIChat, renderLaTeXToHTML } from '../utils';
import type { ChatMessage } from '../utils';
import type { KnowledgePoint } from '../types';

export const AIChat: React.FC = () => {
  const { state } = useKnowledgeStore();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content:
        '你好！我是AI学习助手。你可以问我关于当前知识点的问题，或者让我帮你解释概念、总结内容。\n\n提示：确保在设置中配置了API端点和密钥。',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const selectedKP = state.knowledgePoints.find(
    (kp: KnowledgePoint) => kp.id === state.selectedKPId
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMsg: ChatMessage = { role: 'user', content: input.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    const systemMsg: ChatMessage = {
      role: 'system',
      content: selectedKP
        ? `你是一个学习助手。用户当前正在学习知识点「${selectedKP.name}」。\n该知识点的释义如下：\n${selectedKP.description}\n\n请基于以上上下文回答用户的问题。回答中如有公式请使用LaTeX格式（行内 $...$，块级 $$...$$）。`
        : '你是一个学习助手。请帮助用户解答问题。回答中如有公式请使用LaTeX格式（行内 $...$，块级 $$...$$）。',
    };

    try {
      const reply = await callAIChat(
        [systemMsg, ...newMessages],
        state.aiConfig
      );
      setMessages((prev: ChatMessage[]) => [...prev, { role: 'assistant', content: reply }]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setMessages((prev: ChatMessage[]) => [
        ...prev,
        {
          role: 'assistant',
          content: `❌ 请求失败: ${msg}\n\n请检查设置中的API配置是否正确。`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="sidebar-right">
      <div className="sidebar-header">🤖 AI 助手</div>

      {selectedKP && (
        <div className="chat-context">
          当前知识点: <strong>{selectedKP.name}</strong>
        </div>
      )}

      <div className="chat-messages">
        {messages.map((msg: ChatMessage, i: number) => (
          <div key={i} className={`chat-message chat-${msg.role}`}>
            <div className="chat-role">
              {msg.role === 'user' ? '👤 你' : '🤖 AI'}
            </div>
            <div
              className="chat-content"
              dangerouslySetInnerHTML={{
                __html: renderLaTeXToHTML(msg.content),
              }}
            />
          </div>
        ))}
        {loading && (
          <div className="chat-message chat-assistant">
            <div className="chat-role">🤖 AI</div>
            <div className="chat-loading">
              <span className="loading-dot" />
              <span className="loading-dot" />
              <span className="loading-dot" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input-area">
        <textarea
          className="chat-input"
          value={input}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="输入问题，Enter发送，Shift+Enter换行..."
          rows={2}
          disabled={loading}
        />
        <button
          className="chat-send-btn"
          onClick={handleSend}
          disabled={loading || !input.trim()}
        >
          发送
        </button>
      </div>
    </div>
  );
};

// ---- SettingsPanel ----

interface SettingsPanelProps {
  onClose: () => void;
  embedded?: boolean;
}

// API预设
const API_PRESETS: Array<{
  label: string;
  endpoint: string;
  model: string;
}> = [
  {
    label: 'DeepSeek (代理)',
    endpoint: '/api/deepseek/v1/chat/completions',
    model: 'deepseek-chat',
  },
  {
    label: 'DeepSeek (直连)',
    endpoint: 'https://api.deepseek.com/v1/chat/completions',
    model: 'deepseek-chat',
  },
  {
    label: 'OpenAI',
    endpoint: 'https://api.openai.com/v1/chat/completions',
    model: 'gpt-4o',
  },
  {
    label: '自定义',
    endpoint: '',
    model: '',
  },
];

const SETTINGS_TABS = [
  { key: 'ai' as const, label: 'AI 模型配置' },
  { key: 'plugin' as const, label: '🔌 插件设置' },
];

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ onClose, embedded }) => {
  const { state, dispatch } = useKnowledgeStore();

  const [settingsTab, setSettingsTab] = useState<'ai' | 'plugin'>('ai');

  // AI settings
  const [endpoint, setEndpoint] = useState(state.aiConfig.apiEndpoint);
  const [apiKey, setApiKey] = useState(state.aiConfig.apiKey);
  const [modelName, setModelName] = useState(state.aiConfig.modelName);

  // Plugin settings
  const [freshDirPath, setFreshDirPath] = useState<string | null>(null);
  const [freshDirInput, setFreshDirInput] = useState('');
  const [freshDirLoaded, setFreshDirLoaded] = useState(false);
  const [freshDirSaved, setFreshDirSaved] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState(false);
  const [isElectron, setIsElectron] = useState(false);

  // 加载 fresh 目录路径
  useEffect(() => {
    import('../drafts/api').then((m) => {
      const electron = m.isElectronEnv();
      setIsElectron(electron);
      if (electron) {
        m.getFreshDir().then((dir: string | null) => {
          setFreshDirPath(dir);
          setFreshDirInput(dir || '');
          setFreshDirLoaded(true);
        });
      } else {
        m.getStoredDirName().then((name: string | null) => {
          if (name) {
            const p = name + '/fresh';
            setFreshDirPath(p);
            setFreshDirInput(p);
          }
          setFreshDirLoaded(true);
        });
      }
    });
  }, []);

  // 保存 fresh 目录路径
  const handleSaveFreshDir = async () => {
    const path = freshDirInput.trim();
    if (!path) {
      alert('请输入 fresh 文件夹路径');
      return;
    }
    if (isElectron) {
      await (window as any).appConfig?.setSetting('freshDir', path);
    }
    setFreshDirPath(path);
    setFreshDirSaved(true);
    setTimeout(() => setFreshDirSaved(false), 2000);
  };

  // 重置为默认路径
  const handleResetFreshDir = async () => {
    if (isElectron) {
      // 清除自定义路径 → getFreshDir 会回退到 Downloads/fresh
      await (window as any).appConfig?.setSetting('freshDir', null);
      const defaultDir = await (window as any).draftFS?.getDownloadsDir();
      const defaultPath = defaultDir ? defaultDir + '\\fresh' : '';
      setFreshDirInput(defaultPath);
      setFreshDirPath(defaultPath);
    }
  };

  const handlePreset = (preset: typeof API_PRESETS[number]) => {
    if (preset.endpoint) setEndpoint(preset.endpoint);
    if (preset.model) setModelName(preset.model);
  };

  const handleSave = () => {
    const ep = endpoint.trim();
    if (!ep) {
      alert('请输入API端点地址');
      return;
    }
    dispatch({
      type: 'UPDATE_AI_CONFIG',
      config: {
        apiEndpoint: ep,
        apiKey: apiKey.trim(),
        modelName: modelName.trim(),
      },
    });
    onClose();
  };

  // 拼接 PowerShell 命令（使用当前编辑中的路径）
  const cmdDir = freshDirInput || freshDirPath;
  const poweredShellCmd = cmdDir
    ? `Remove-Item "$env:USERPROFILE\\Downloads\\SavedSelections" -Force -ErrorAction SilentlyContinue\nNew-Item -ItemType Directory -Path "${cmdDir}" -Force\nNew-Item -ItemType Junction -Path "$env:USERPROFILE\\Downloads\\SavedSelections" -Target "${cmdDir}"`
    : '';

  const handleCopyCmd = async () => {
    try {
      await navigator.clipboard.writeText(poweredShellCmd.replace(/\\n/g, '\n'));
      setCopiedCmd(true);
      setTimeout(() => setCopiedCmd(false), 2000);
    } catch {
      // fallback
      const ta = document.createElement('textarea');
      ta.value = poweredShellCmd.replace(/\\n/g, '\n');
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopiedCmd(true);
      setTimeout(() => setCopiedCmd(false), 2000);
    }
  };

  const contentEl = (
    <div className="modal-content modal-settings">
      <div className="modal-header">
        <h3>⚙️ 设置</h3>
        {!embedded && <button className="modal-close-btn" onClick={onClose}>✕</button>}
      </div>

      {/* 标签页切换 */}
      <div className="settings-tabs">
        {SETTINGS_TABS.map((tab) => (
          <button
            key={tab.key}
            className={`settings-tab ${settingsTab === tab.key ? 'active' : ''}`}
            onClick={() => setSettingsTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="modal-body">
        {settingsTab === 'ai' && (
          <div className="settings-section">
            <h4>AI 模型配置</h4>
            <p className="settings-hint">
              支持任何 OpenAI 兼容的 API。选择预设可自动填入端点和模型名，密钥需自行填入。
            </p>

            <div className="settings-presets">
              {API_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  className="btn btn-sm btn-secondary"
                  onClick={() => handlePreset(preset)}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <label className="form-label">
              API 端点地址
              <input
                className="form-input"
                type="text"
                placeholder="https://api.deepseek.com/v1/chat/completions"
                value={endpoint}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEndpoint(e.target.value)}
              />
            </label>

            <label className="form-label">
              模型名称
              <input
                className="form-input"
                type="text"
                placeholder="deepseek-chat"
                value={modelName}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setModelName(e.target.value)}
              />
            </label>

            <label className="form-label">
              API 密钥
              <input
                className="form-input"
                type="password"
                placeholder="sk-..."
                value={apiKey}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setApiKey(e.target.value)}
              />
            </label>

            <div className="settings-help">
              <h4>🔧 常见问题</h4>
              <ul>
                <li><strong>404 错误</strong>：检查端点地址是否正确（DeepSeek 应为 <code>https://api.deepseek.com/v1/chat/completions</code>）</li>
                <li><strong>401 错误</strong>：API 密钥无效或未填入</li>
                <li><strong>400 错误</strong>：模型名不正确（DeepSeek 使用 <code>deepseek-chat</code>，OpenAI 使用 <code>gpt-4o</code>）</li>
                <li><strong>Failed to fetch / CORS</strong>：选择「DeepSeek (代理)」预设，利用开发服务器转发请求，避免浏览器跨域限制</li>
                <li><strong>「DeepSeek (代理)」仅开发模式可用</strong>：部署到线上后需改用「DeepSeek (直连)」</li>
                <li>密钥仅保存在浏览器本地，不会上传到任何服务器</li>
              </ul>
            </div>
          </div>
        )}

        {settingsTab === 'plugin' && (
          <div className="settings-section">
            <h4>🔌 浏览器插件设置</h4>
            <p className="settings-hint">
              将浏览器插件"Save Selected Text v3"连接到本程序的 fresh 文件夹，
              这样插件保存的内容会自动出现在程序的草稿箱中。只需设置一次。
            </p>

            <div className="settings-dir-display">
              <div className="settings-dir-label">📂 Fresh 文件夹路径</div>
              {freshDirLoaded ? (
                <>
                  {isElectron ? (
                    <div className="settings-dir-edit">
                      <input
                        className="form-input settings-dir-input"
                        type="text"
                        value={freshDirInput}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFreshDirInput(e.target.value)}
                        placeholder="C:\Users\...\Downloads\fresh"
                      />
                      <button
                        className={`btn btn-sm ${freshDirSaved ? 'btn-success' : 'btn-primary'}`}
                        onClick={handleSaveFreshDir}
                      >
                        {freshDirSaved ? '✅ 已保存' : '💾 保存路径'}
                      </button>
                      <button
                        className="btn btn-sm btn-secondary"
                        onClick={handleResetFreshDir}
                        title="恢复为默认 Downloads/fresh"
                      >
                        🔄 默认
                      </button>
                    </div>
                  ) : (
                    <div className="settings-dir-path">
                      {freshDirPath ? (
                        <code>{freshDirPath}</code>
                      ) : (
                        <span className="settings-dir-missing">尚未选择文件夹</span>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div className="settings-dir-path">
                  <span className="settings-dir-missing">正在获取路径…</span>
                </div>
              )}
            </div>

            <div className="settings-steps">
              <h5>按照以下步骤完成配置：</h5>

              <div className="settings-step">
                <span className="settings-step-num">1</span>
                <div>
                  <strong>打开插件设置页</strong>
                  <p>
                    在 Chrome 右上角点击 <span className="key-label">🧩 扩展程序</span> 图标，
                    找到 <strong>Save Selected Text v3</strong>，
                    右键点击 → <strong>「选项」</strong>。
                  </p>
                  <p className="settings-hint">
                    或者在地址栏输入 <code>chrome://extensions/</code>，
                    找到插件，点击「详细信息」→「扩展程序选项」。
                  </p>
                </div>
              </div>

              <div className="settings-step">
                <span className="settings-step-num">2</span>
                <div>
                  <strong>填写链接名和目标目录</strong>
                  <p>在插件设置页中：</p>
                  <table className="settings-table">
                    <thead>
                      <tr>
                        <th>字段</th>
                        <th>请填写</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td><strong>链接名</strong></td>
                        <td><code>SavedSelections</code></td>
                      </tr>
                      <tr>
                        <td><strong>目标目录</strong></td>
                        <td>
                          {cmdDir
                            ? <code className="copyable-path">{cmdDir}</code>
                            : '（上方显示的 fresh 文件夹路径）'}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="settings-step">
                <span className="settings-step-num">3</span>
                <div>
                  <strong>复制命令并执行</strong>
                  <p>
                    在插件设置页中点击「📋 复制命令」按钮。
                    或者你也可以直接复制下面的命令：
                  </p>
                  {cmdDir ? (
                    <>
                      <pre className="settings-cmd">{poweredShellCmd.replace(/\\n/g, '\n')}</pre>
                      <button
                        className={`btn btn-sm ${copiedCmd ? 'btn-success' : 'btn-primary'}`}
                        onClick={handleCopyCmd}
                      >
                        {copiedCmd ? '✅ 已复制' : '📋 复制命令'}
                      </button>
                    </>
                  ) : (
                    <p className="settings-hint">
                      ⚠️ 请先等待上方 fresh 文件夹路径加载完成
                    </p>
                  )}
                </div>
              </div>

              <div className="settings-step">
                <span className="settings-step-num">4</span>
                <div>
                  <strong>在 PowerShell 中执行</strong>
                  <p>
                    按 <span className="key-label">Win</span> 键，输入 <code>powershell</code>，回车。
                    在打开的蓝色窗口中<strong>右键粘贴</strong>，然后按回车。
                  </p>
                  <p className="settings-hint">
                    看到绿色的 ✅ 就说明成功了。如果提示权限不足，
                    右键点 PowerShell 图标选「以管理员身份运行」。
                  </p>
                </div>
              </div>

              <div className="settings-step">
                <span className="settings-step-num">5</span>
                <div>
                  <strong>验证效果</strong>
                  <p>
                    在任意网页上选中一段文字，右键 →「保存选中内容到本地」。
                    然后回到本程序，点击底部「📑 多文本辅助总结」→「📦 草稿箱」，
                    你刚保存的内容应该出现在这里了。
                  </p>
                </div>
              </div>
            </div>

            <div className="settings-help" style={{ marginTop: '16px' }}>
              <h5>💡 原理说明</h5>
              <p className="settings-hint">
                这步操作是在下载目录里创建了一个名为 <code>SavedSelections</code> 的"快捷方式"
                （Windows 叫 Junction），指向 fresh 文件夹。
                插件往下载目录存文件时，Windows 会自动把它们放进 fresh 文件夹。
                你无需理解原理，只需要知道设置完成后再也不用管了。
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="modal-footer">
        <button className="btn btn-secondary" onClick={onClose}>关闭</button>
        {settingsTab === 'ai' && (
          <button className="btn btn-primary" onClick={handleSave}>保存设置</button>
        )}
      </div>
    </div>
  );

  if (embedded) return contentEl;

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
      {contentEl}
    </div>
  );
};
