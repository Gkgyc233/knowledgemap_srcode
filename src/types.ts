// ============================================================
// 核心类型定义 - 知识点 & 笔记
// ============================================================

/** 描述文本中的链接定义 */
export interface KPLink {
  /** 链接文本在description中的起始位置（字符偏移） */
  start: number;
  /** 链接文本在description中的结束位置（字符偏移） */
  end: number;
  /** 链接显示的文本 */
  text: string;
  /** 链接指向的知识点名称 */
  target: string;
}

/** 笔记 */
export interface Note {
  id: string;
  /** 笔记内容（通常是从知识点释义中摘录的文本） */
  content: string;
  /** 用户对内容的批注 */
  annotation: string;
}

/** 知识点 */
export interface KnowledgePoint {
  id: string;
  /** 知识点名称 */
  name: string;
  /** 知识点释义（纯文本 + LaTeX） */
  description: string;
  /** 释义中的链接定义 */
  links: KPLink[];
  /** 引述表：引用此知识点的其他知识点名称列表 */
  citations: string[];
  /** 参考表：此知识点引用的其他知识点名称列表 */
  references: string[];
  /** 笔记表 */
  notes: Note[];
}

/** AI模型配置 */
export interface AIModelConfig {
  /** API端点地址 (OpenAI-compatible) */
  apiEndpoint: string;
  /** API密钥 */
  apiKey: string;
  /** 模型名称 */
  modelName: string;
}

/** JSON笔记导入格式 */
export interface NoteJSON {
  text: string;
  annotation: string;
  [key: string]: unknown;
}

/** 应用状态 */
export interface AppState {
  knowledgePoints: KnowledgePoint[];
  selectedKPId: string | null;
  aiConfig: AIModelConfig;
}

// ============================================================
// 生成唯一ID
// ============================================================
let idCounter = Date.now();
export function generateId(): string {
  idCounter += 1;
  return `kp_${idCounter}_${Math.random().toString(36).slice(2, 8)}`;
}

// ============================================================
// 描述文本渲染辅助
// ============================================================

/** 渲染片段：文本或链接 */
export interface RenderSegment {
  type: 'text' | 'link';
  content: string;
  target?: string; // 仅link类型有值
}

/**
 * 将描述文本按链接位置拆分为渲染片段
 * 注意：链接位置是基于当前描述文本的字符偏移
 */
export function parseDescriptionToSegments(
  description: string,
  links: KPLink[]
): RenderSegment[] {
  if (!links || links.length === 0) {
    return [{ type: 'text', content: description }];
  }

  // 按start排序
  const sorted = [...links].sort((a, b) => a.start - b.start);

  // 验证链接不重叠
  const segments: RenderSegment[] = [];
  let cursor = 0;

  for (const link of sorted) {
    // 添加链接前的文本
    if (link.start > cursor) {
      segments.push({
        type: 'text',
        content: description.slice(cursor, link.start),
      });
    }
    // 添加链接
    segments.push({
      type: 'link',
      content: description.slice(link.start, link.end),
      target: link.target,
    });
    cursor = link.end;
  }

  // 添加剩余文本
  if (cursor < description.length) {
    segments.push({
      type: 'text',
      content: description.slice(cursor),
    });
  }

  return segments;
}

/**
 * 在描述文本中查找指定模式的所有出现位置（严格匹配）
 */
export function findAllOccurrences(
  text: string,
  pattern: string
): Array<{ start: number; end: number }> {
  const results: Array<{ start: number; end: number }> = [];
  if (!pattern) return results;

  let pos = 0;
  while (pos < text.length) {
    const idx = text.indexOf(pattern, pos);
    if (idx === -1) break;
    results.push({ start: idx, end: idx + pattern.length });
    pos = idx + pattern.length; // 不重叠匹配
  }
  return results;
}

/**
 * 在描述文本的指定位置已有的链接中，查找是否有重叠
 */
export function isOverlappingWithLinks(
  start: number,
  end: number,
  links: KPLink[]
): boolean {
  return links.some((link) => start < link.end && end > link.start);
}
