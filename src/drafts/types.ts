// 草稿箱类型定义

/** 浏览器插件 v3.3 保存的 JSON 格式 */
export interface DraftJson {
  text: string;
  /** v3.3 新增：HTML 格式，\(...\) / \[...\] → KaTeX 直接渲染 */
  html?: string;
  /** v3.3 新增：Markdown 格式，$$...$$ / $...$ → Obsidian/Typora 渲染 */
  markdown?: string;
  /** v3.3 新增：裸 LaTeX 公式数组 */
  formulas?: string[];
  annotation: string;
  savedAt: string;
  url: string;
  title: string;
}

/** 从 fresh/ 目录读取的文件条目 */
export interface DraftEntry {
  /** 文件名 */
  name: string;
  /** 完整路径（Electron）/ 虚拟路径（Web） */
  path: string;
  /** 解析后的 JSON 数据 */
  data: DraftJson;
  /** 是否已处理 */
  processed: boolean;
}

/** 草稿操作的上下文 */
export type DraftAction = 'move' | 'copy' | 'delete' | 'edit';
