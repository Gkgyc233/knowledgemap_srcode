// ============================================================
// 工具函数：LaTeX渲染、自动链接检查、AI调用
// ============================================================

import katex from 'katex';
import type { KnowledgePoint, KPLink, AIModelConfig } from './types';
import { findAllOccurrences } from './types';

/**
 * 渲染包含LaTeX公式和内联链接的文本为HTML
 */
export function renderDescriptionHTML(
  description: string,
  links: KPLink[],
  _onLinkClick: (kpName: string) => void
): string {
  const sorted = [...links].sort((a: KPLink, b: KPLink) => a.start - b.start);
  const parts: Array<{ type: 'text' | 'link'; content: string; target?: string }> = [];

  let cursor = 0;
  for (const link of sorted) {
    if (link.start > cursor) {
      parts.push({ type: 'text', content: description.slice(cursor, link.start) });
    }
    parts.push({
      type: 'link',
      content: description.slice(link.start, link.end),
      target: link.target,
    });
    cursor = link.end;
  }
  if (cursor < description.length) {
    parts.push({ type: 'text', content: description.slice(cursor) });
  }

  return parts
    .map((part) => {
      if (part.type === 'link') {
        const escaped = escapeHTML(part.content);
        return `<span class="kp-link" data-target="${escapeAttr(part.target || '')}" style="color:#4fc3f7;cursor:pointer;text-decoration:underline;" title="跳转到「${escapeAttr(part.target || '')}」">${escaped}</span>`;
      }
      return renderLaTeXToHTML(part.content);
    })
    .join('');
}

/**
 * 将包含$...$和$$...$$的文本渲染为HTML
 */
export function renderLaTeXToHTML(text: string): string {
  const blockParts = text.split(/(\$\$[\s\S]*?\$\$)/g);
  return blockParts
    .map((block: string) => {
      if (block.startsWith('$$') && block.endsWith('$$')) {
        const formula = block.slice(2, -2).trim();
        try {
          return katex.renderToString(formula, {
            displayMode: true,
            throwOnError: false,
          });
        } catch {
          return `<pre style="color:#ff8a65;">${escapeHTML(block)}</pre>`;
        }
      }
      const inlineParts = block.split(/(\$[^$]+\$)/g);
      return inlineParts
        .map((part: string) => {
          if (part.startsWith('$') && part.endsWith('$') && part.length > 2) {
            const formula = part.slice(1, -1);
            try {
              return katex.renderToString(formula, {
                displayMode: false,
                throwOnError: false,
              });
            } catch {
              return `<span style="color:#ff8a65;">${escapeHTML(part)}</span>`;
            }
          }
          return escapeHTML(part);
        })
        .join('');
    })
    .join('');
}

function escapeHTML(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/**
 * 自动链接检查
 */
export function autoLinkCheck(
  newKP: KnowledgePoint,
  existingKPs: KnowledgePoint[]
): {
  updatedNewKP: KnowledgePoint;
  updatedExistingKPs: KnowledgePoint[];
} {
  const updatedNewKP = { ...newKP, links: [...newKP.links] };
  const updatedExistingKPs = existingKPs.map((kp: KnowledgePoint) => ({
    ...kp,
    links: [...kp.links],
  }));

  const newName = newKP.name;

  for (let i = 0; i < updatedExistingKPs.length; i++) {
    const kp = updatedExistingKPs[i];
    const occurrences = findAllOccurrences(kp.description, newName);

    if (occurrences.length > 0) {
      for (const occ of occurrences) {
        const overlaps = kp.links.some(
          (l: KPLink) => occ.start < l.end && occ.end > l.start
        );
        if (!overlaps) {
          kp.links.push({
            start: occ.start,
            end: occ.end,
            text: newName,
            target: newName,
          });
        }
      }

      if (!updatedNewKP.citations.includes(kp.name)) {
        updatedNewKP.citations = [...updatedNewKP.citations, kp.name];
      }
      if (!kp.references.includes(newName)) {
        kp.references = [...kp.references, newName];
      }
    }
  }

  for (const kp of updatedExistingKPs) {
    const occurrences = findAllOccurrences(updatedNewKP.description, kp.name);

    if (occurrences.length > 0) {
      for (const occ of occurrences) {
        const overlaps = updatedNewKP.links.some(
          (l: KPLink) => occ.start < l.end && occ.end > l.start
        );
        if (!overlaps) {
          updatedNewKP.links.push({
            start: occ.start,
            end: occ.end,
            text: kp.name,
            target: kp.name,
          });
        }
      }

      if (!updatedNewKP.references.includes(kp.name)) {
        updatedNewKP.references = [...updatedNewKP.references, kp.name];
      }
      if (!kp.citations.includes(newName)) {
        kp.citations = [...kp.citations, newName];
      }
    }
  }

  return { updatedNewKP, updatedExistingKPs };
}

/**
 * AI总结
 */
export async function callAISummary(
  text: string,
  config: AIModelConfig
): Promise<string> {
  // 文本过长时截断提示
  const MAX_CHARS = 50000;
  const truncatedText = text.length > MAX_CHARS
    ? text.slice(0, MAX_CHARS) + '\n\n[文本过长，已截断至前50000字...]'
    : text;

  let response: Response;
  try {
    response = await fetch(config.apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.modelName,
        messages: [
          {
            role: 'system',
            content: `你是一个专业的学术内容总结助手。请对用户提供的文本进行详细、结构化的总结。

要求：
1. 提取文本中的核心知识点、关键概念和重要结论
2. 使用清晰的层次结构组织内容（使用Markdown标题）
3. 保留重要的公式（用LaTeX格式，行内公式用$...$，块级公式用$$...$$）
4. 保留关键数据和具体细节
5. 对每个知识点，标注其所属的主题领域
6. 如果文本中包含对话记录（如与AI的对话），请提取对话中讨论的知识点
7. 字数不做严格限制，以覆盖所有重要内容为准

请用中文输出总结。`,
          },
          {
            role: 'user',
            content: truncatedText,
          },
        ],
        temperature: 0.3,
        max_tokens: 4096,
      }),
    });
  } catch (fetchErr: unknown) {
    // 「Failed to fetch」通常是 CORS 或网络问题
    const msg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
    if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
      throw new Error(
        '网络请求被阻止 (CORS/网络错误)\n\n' +
        '💡 可能原因及解决方案：\n' +
        '1. 浏览器安全策略阻止了跨域请求 → 尝试用无痕模式，或关闭浏览器插件再试\n' +
        '2. API 端点地址拼写错误 → 检查设置中的端点地址\n' +
        '3. 本地开发时某些 API 限制 localhost → 部署到线上后可解决\n' +
        '4. 防火墙/代理拦截 → 检查网络设置\n' +
        `原始错误: ${msg}`
      );
    }
    throw fetchErr;
  }

  if (!response.ok) {
    const err = await response.text();
    let hint = '';
    switch (response.status) {
      case 404:
        hint = '\n💡 提示：检查 API 端点地址是否正确。' +
          '\n   DeepSeek → https://api.deepseek.com/v1/chat/completions' +
          '\n   OpenAI  → https://api.openai.com/v1/chat/completions';
        break;
      case 401:
      case 403:
        hint = '\n💡 提示：API 密钥无效或未设置。请在设置中检查密钥。';
        break;
      case 400:
        hint = '\n💡 提示：请求格式错误，可能是模型名称不正确。' +
          '\n   DeepSeek → deepseek-chat   OpenAI → gpt-4o';
        break;
      case 429:
        hint = '\n💡 提示：请求过于频繁，请稍后再试。';
        break;
    }
    throw new Error(`AI API 调用失败 (${response.status})${hint}\n\n服务器返回: ${err}`);
  }

  const data: { choices?: Array<{ message?: { content?: string } }> } = await response.json();
  return data.choices?.[0]?.message?.content || '（未获取到总结内容）';
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

/**
 * AI聊天
 */
export async function callAIChat(
  messages: ChatMessage[],
  config: AIModelConfig
): Promise<string> {
  let response: Response;
  try {
    response = await fetch(config.apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.modelName,
        messages,
        temperature: 0.7,
        max_tokens: 2048,
      }),
    });
  } catch (fetchErr: unknown) {
    const msg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
    if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
      throw new Error(
        '网络请求被阻止 (CORS/网络错误)\n\n' +
        '💡 可能原因：\n' +
        '1. 浏览器安全策略 → 尝试无痕模式\n' +
        '2. API 端点地址错误 → 检查设置\n' +
        '3. 本地开发时 API 限制 localhost → 部署到线上可解决\n' +
        '4. 防火墙/代理拦截\n' +
        `原始错误: ${msg}`
      );
    }
    throw fetchErr;
  }

  if (!response.ok) {
    const err = await response.text();
    let hint = '';
    switch (response.status) {
      case 404:
        hint = '\n💡 提示：检查 API 端点地址是否正确。' +
          '\n   DeepSeek → https://api.deepseek.com/v1/chat/completions' +
          '\n   OpenAI  → https://api.openai.com/v1/chat/completions';
        break;
      case 401:
      case 403:
        hint = '\n💡 提示：API 密钥无效或未设置。请在设置中检查密钥。';
        break;
      case 400:
        hint = '\n💡 提示：请求格式错误，可能是模型名称不正确。' +
          '\n   DeepSeek → deepseek-chat   OpenAI → gpt-4o';
        break;
      case 429:
        hint = '\n💡 提示：请求过于频繁，请稍后再试。';
        break;
    }
    throw new Error(`AI API 调用失败 (${response.status})${hint}\n\n服务器返回: ${err}`);
  }

  const data: { choices?: Array<{ message?: { content?: string } }> } = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

/**
 * 将markdown的\\(...\\)转换为$...$，\\[...\\]转换为$$...$$
 */
export function normalizeLaTeX(text: string): string {
  return text
    .replace(/\\\(/g, '$')
    .replace(/\\\)/g, '$')
    .replace(/\\\[/g, '$$')
    .replace(/\\\]/g, '$$');
}
