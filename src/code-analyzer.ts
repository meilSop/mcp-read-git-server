/**
 * 代码结构分析器
 * 支持分析 Vue 2 / Vue 3 / React / TypeScript 组件的代码结构
 */

export interface ComponentAnalysis {
  filePath: string;
  language: string;
  componentName: string;
  description: string;
  props: PropInfo[];
  methods: MethodInfo[];
  events: EventInfo[];
  imports: ImportInfo[];
  exports: ExportInfo[];
  slots: SlotInfo[];
}

export interface PropInfo {
  name: string;
  type: string;
  required: boolean;
  defaultValue?: string;
  description?: string;
}

export interface MethodInfo {
  name: string;
  params: string;
  returnType: string;
  description?: string;
  visibility: 'public' | 'private' | 'protected';
}

export interface EventInfo {
  name: string;
  payload: string;
  description?: string;
}

export interface ImportInfo {
  source: string;
  items: string[];
}

export interface ExportInfo {
  name: string;
  type: 'default' | 'named';
}

export interface SlotInfo {
  name: string;
  description?: string;
}

// ==================== 工具函数 ====================

function detectLanguage(filePath: string): string {
  if (filePath.endsWith('.vue')) return 'vue';
  if (filePath.endsWith('.tsx') || filePath.endsWith('.jsx')) return 'react';
  if (filePath.endsWith('.ts')) return 'typescript';
  if (filePath.endsWith('.js')) return 'javascript';
  return 'unknown';
}

/**
 * 从文件路径提取组件名
 * - index.vue / index.ts -> 取父文件夹名
 * - Button.vue -> Button
 */
function extractComponentName(filePath: string): string {
  const parts = filePath.replace(/\\/g, '/').split('/');
  const fileName = parts[parts.length - 1].replace(/\.\w+$/, '');
  if (/^index$/i.test(fileName) && parts.length >= 2) {
    return parts[parts.length - 2];
  }
  return fileName;
}

function extractDescription(content: string): string {
  // 优先取 JSDoc 注释
  const jsdocMatch = content.match(/\/\*\*\s*([\s\S]*?)\s*\*\//);
  if (jsdocMatch) {
    return jsdocMatch[1]
      .replace(/^\s*\*\s?/gm, '')
      .replace(/@\w+[^\n]*/g, '')
      .trim();
  }
  return '';
}

function extractImports(content: string): ImportInfo[] {
  const imports: ImportInfo[] = [];
  // 支持多行 import
  const importRegex =
    /import\s+(?:type\s+)?(?:\{([^}]+)\}|(\w+)(?:\s*,\s*\{([^}]+)\})?)\s+from\s+['"]([^'"]+)['"]/g;
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    const destructured = match[1] || match[3];
    const defaultImport = match[2];
    const source = match[4];
    const items: string[] = [];
    if (defaultImport) items.push(defaultImport);
    if (destructured) {
      destructured
        .split(',')
        .map((s) => s.trim().replace(/\s+as\s+\w+/, ''))
        .filter(Boolean)
        .forEach((s) => items.push(s));
    }
    if (items.length > 0) imports.push({ source, items });
  }
  return imports;
}

function extractExports(content: string): ExportInfo[] {
  const exports: ExportInfo[] = [];
  const defaultExportMatch = content.match(/export\s+default\s+(?:function\s+)?(\w+)/);
  if (defaultExportMatch) {
    exports.push({ name: defaultExportMatch[1], type: 'default' });
  }
  const namedExportRegex = /export\s+(?:const|let|var|function|class|interface|type|enum)\s+(\w+)/g;
  let match;
  while ((match = namedExportRegex.exec(content)) !== null) {
    exports.push({ name: match[1], type: 'named' });
  }
  return exports;
}

// ==================== 主入口 ====================

export function analyzeComponent(filePath: string, content: string): ComponentAnalysis {
  const language = detectLanguage(filePath);
  switch (language) {
    case 'vue':
      return analyzeVueComponent(filePath, content);
    case 'react':
      return analyzeReactComponent(filePath, content);
    case 'typescript':
    case 'javascript':
      return analyzeTsComponent(filePath, content);
    default:
      return analyzeGenericComponent(filePath, content);
  }
}

// ==================== Vue 分析 ====================

function analyzeVueComponent(filePath: string, content: string): ComponentAnalysis {
  const analysis: ComponentAnalysis = {
    filePath,
    language: 'vue',
    componentName: extractComponentName(filePath),
    description: '',
    props: [],
    methods: [],
    events: [],
    imports: [],
    exports: [],
    slots: []
  };

  // 提取 <script setup> 优先
  const scriptSetupMatch =
    content.match(/<script\s[^>]*\bsetup\b[^>]*>([\s\S]*?)<\/script>/) ||
    content.match(/<script\s+setup>([\s\S]*?)<\/script>/);
  // 普通 <script>
  const scriptMatch = content.match(/<script(?!\s[^>]*\bsetup\b)[^>]*>([\s\S]*?)<\/script>/);

  const isSetup = !!scriptSetupMatch;
  const scriptContent = scriptSetupMatch?.[1] || scriptMatch?.[1] || '';

  analysis.imports = extractImports(scriptContent);
  analysis.description = extractDescription(scriptContent) || extractDescription(content);

  if (isSetup) {
    analysis.props = extractVue3DefineProps(scriptContent);
    analysis.events = extractVue3DefineEmits(scriptContent);
    analysis.methods = extractVue3DefineMethods(scriptContent);
  } else {
    analysis.props = extractVue2Props(scriptContent);
    analysis.methods = extractVue2Methods(scriptContent);
    analysis.events = extractVue2Events(scriptContent);
  }

  analysis.slots = extractVueSlots(content);
  return analysis;
}

/**
 * 从 <script setup> 中提取 Props
 * 支持以下写法：
 * 1. defineProps<{ ... }>()  ← 最常见
 * 2. withDefaults(defineProps<{ ... }>(), { ... })
 * 3. defineProps({ key: { type: X, required: true } })
 * 4. const props = defineProps<{ ... }>()
 */
function extractVue3DefineProps(content: string): PropInfo[] {
  const props: PropInfo[] = [];

  // --- 1. 先收集 withDefaults 的默认值 ---
  const defaultsMap: Record<string, string> = {};
  // withDefaults(defineProps<...>(), { key: value, key2: () => [...] })
  const withDefaultsMatch = content.match(
    /withDefaults\s*\(\s*defineProps[^)]*\)\s*,\s*\{([\s\S]*?)\}\s*\)/
  );
  if (withDefaultsMatch) {
    parseSimpleObjectEntries(withDefaultsMatch[1]).forEach(({ key, value }) => {
      defaultsMap[key] = value;
    });
  }

  // --- 2. TypeScript 泛型形式 defineProps<{ ... }>() ---
  // 用括号深度匹配，避免嵌套类型被截断
  const genericBody = extractDefinePropsGenericBody(content);
  if (genericBody) {
    parseTsInterfaceBody(genericBody).forEach((p) => {
      if (defaultsMap[p.name]) {
        p.defaultValue = defaultsMap[p.name];
        p.required = false;
      }
      props.push(p);
    });
    return props;
  }

  // --- 3. 对象形式 defineProps({ ... }) ---
  const propsObjBody = extractDefinePropsObjectBody(content);
  if (propsObjBody) {
    parseVuePropsObjectBody(propsObjBody).forEach((p) => props.push(p));
    return props;
  }

  return props;
}

/**
 * 从 defineProps<{ ... }>() 的尖括号中提取 interface body
 * 处理嵌套 < > 的情况
 */
function extractDefinePropsGenericBody(content: string): string | null {
  // 找到 defineProps< 的起始位置
  const startIdx = content.search(/defineProps\s*</);
  if (startIdx === -1) return null;

  const ltIdx = content.indexOf('<', startIdx + 'defineProps'.length);
  if (ltIdx === -1) return null;

  // 用深度计数提取对应的 { ... }
  let depth = 0;
  let braceStart = -1;
  let braceEnd = -1;

  for (let i = ltIdx; i < content.length; i++) {
    if (content[i] === '{') {
      if (braceStart === -1) braceStart = i;
      depth++;
    } else if (content[i] === '}') {
      depth--;
      if (depth === 0 && braceStart !== -1) {
        braceEnd = i;
        break;
      }
    }
  }

  if (braceStart === -1 || braceEnd === -1) return null;
  return content.slice(braceStart + 1, braceEnd);
}

/**
 * 从 defineProps({ ... }) 的圆括号中提取对象 body
 */
function extractDefinePropsObjectBody(content: string): string | null {
  const startIdx = content.search(/defineProps\s*\(/);
  if (startIdx === -1) return null;

  const parenIdx = content.indexOf('(', startIdx + 'defineProps'.length - 1);
  if (parenIdx === -1) return null;

  let depth = 0;
  let braceStart = -1;
  let braceEnd = -1;

  for (let i = parenIdx; i < content.length; i++) {
    if (content[i] === '{') {
      if (braceStart === -1) braceStart = i;
      depth++;
    } else if (content[i] === '}') {
      depth--;
      if (depth === 0 && braceStart !== -1) {
        braceEnd = i;
        break;
      }
    }
  }

  if (braceStart === -1 || braceEnd === -1) return null;
  return content.slice(braceStart + 1, braceEnd);
}

/**
 * 解析 TypeScript interface body 中的字段
 * 支持：
 *   name: string
 *   name?: string | number
 *   name: Record<string, any>
 *   name?: string[]
 */
function parseTsInterfaceBody(body: string): PropInfo[] {
  const props: PropInfo[] = [];
  // 按行解析，跳过注释行
  const lines = body
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('//') && !l.startsWith('*'));

  for (const line of lines) {
    // 匹配: name?: Type  或  name: Type
    const m = line.match(/^(\w+)(\?)?:\s*([\s\S]+?)[;,]?\s*$/);
    if (!m) continue;
    const name = m[1];
    const optional = !!m[2];
    const rawType = m[3].trim().replace(/;$/, '').trim();
    // 提取行内注释作为 description
    const descMatch = rawType.match(/\/\/\s*(.+)$/);
    const description = descMatch?.[1]?.trim();
    const type = rawType.replace(/\/\/.*$/, '').trim();
    props.push({
      name,
      type,
      required: !optional,
      description
    });
  }
  return props;
}

/**
 * 解析 Vue 对象式 Props: { key: { type, required, default } }
 */
function parseVuePropsObjectBody(body: string): PropInfo[] {
  const props: PropInfo[] = [];
  const propRegex = /(\w+)\s*:\s*\{([^}]*)\}/g;
  let match;
  while ((match = propRegex.exec(body)) !== null) {
    const name = match[1];
    const def = match[2];
    const typeMatch = def.match(/type\s*:\s*(\w+)/);
    const requiredMatch = def.match(/required\s*:\s*(true|false)/);
    const defaultMatch = def.match(/default\s*:\s*([^,}\n]+)/);
    props.push({
      name,
      type: typeMatch?.[1] || 'any',
      required: requiredMatch?.[1] === 'true',
      defaultValue: defaultMatch?.[1]?.trim()
    });
  }
  // 支持简写: key: String / key: [String, Number]
  const shortRegex = /(\w+)\s*:\s*(String|Number|Boolean|Array|Object|Function|Symbol)(?=[,\s])/g;
  while ((match = shortRegex.exec(body)) !== null) {
    if (!props.find((p) => p.name === match![1])) {
      props.push({ name: match![1], type: match![2], required: false });
    }
  }
  return props;
}

/**
 * 解析简单对象的键值对，用于 withDefaults 的默认值
 * 支持: key: value, key2: () => [...]
 */
function parseSimpleObjectEntries(body: string): Array<{ key: string; value: string }> {
  const entries: Array<{ key: string; value: string }> = [];
  // 按 key: 分割
  const keyValRegex = /(\w+)\s*:\s*/g;
  let m;
  const positions: Array<{ key: string; start: number }> = [];
  while ((m = keyValRegex.exec(body)) !== null) {
    positions.push({ key: m[1], start: m.index + m[0].length });
  }
  for (let i = 0; i < positions.length; i++) {
    const start = positions[i].start;
    const end =
      i + 1 < positions.length
        ? positions[i + 1].start - positions[i + 1].key.length - 2
        : body.length;
    const value = body
      .slice(start, end)
      .trim()
      .replace(/[,\s]+$/, '');
    entries.push({ key: positions[i].key, value });
  }
  return entries;
}

/**
 * 从 <script setup> 中提取 Emits
 * 支持：
 * 1. defineEmits(['change', 'update:modelValue'])
 * 2. defineEmits<{ (e: 'change', val: string): void; }>()  ← Vue 3 TS 签名形式
 * 3. defineEmits<{ change: [val: string] }>()  ← Vue 3.3+ 简写形式
 */
function extractVue3DefineEmits(content: string): EventInfo[] {
  const events: EventInfo[] = [];

  // --- 1. 数组形式 ---
  const arrMatch = content.match(/defineEmits\s*\(\s*\[([\s\S]*?)\]\s*\)/);
  if (arrMatch) {
    const emitRegex = /['"](\w[\w:]*)['"]/g;
    let m;
    while ((m = emitRegex.exec(arrMatch[1])) !== null) {
      if (!events.find((e) => e.name === m![1])) {
        events.push({ name: m![1], payload: 'unknown' });
      }
    }
    return events;
  }

  // --- 2. 提取泛型 body ---
  const genericBody = extractDefineEmitsGenericBody(content);
  if (!genericBody) return events;

  // 2a. Vue 3.3+ 简写: { change: [val: string], 'update:modelValue': [val: string] }
  //     每个 key 是事件名，值是参数列表
  const shortRegex = /['"]?([\w:]+)['"]?\s*:\s*\[([\s\S]*?)\]/g;
  let m;
  let foundShort = false;
  while ((m = shortRegex.exec(genericBody)) !== null) {
    foundShort = true;
    const eventName = m![1];
    const params = m![2].trim();
    events.push({
      name: eventName,
      payload: params || 'void'
    });
  }
  if (foundShort) return events;

  // 2b. 函数签名形式: (e: 'change', val: string): void
  //     (e: 'update:modelValue', val: string): void
  const sigRegex = /\(\s*e\s*:\s*['"](\w[\w:]*)['"]\s*(?:,\s*([^)]*))?\)\s*:\s*[\w\s|]+/g;
  while ((m = sigRegex.exec(genericBody)) !== null) {
    const eventName = m![1];
    const params = m![2]?.trim() || 'void';
    if (!events.find((e) => e.name === eventName)) {
      events.push({ name: eventName, payload: params });
    }
  }

  return events;
}

function extractDefineEmitsGenericBody(content: string): string | null {
  const startIdx = content.search(/defineEmits\s*</);
  if (startIdx === -1) return null;
  const ltIdx = content.indexOf('<', startIdx + 'defineEmits'.length);
  if (ltIdx === -1) return null;

  let depth = 0;
  let start = -1;
  let end = -1;

  for (let i = ltIdx + 1; i < content.length; i++) {
    if (content[i] === '{') {
      if (start === -1) start = i;
      depth++;
    } else if (content[i] === '}') {
      depth--;
      if (depth === 0 && start !== -1) {
        end = i;
        break;
      }
    } else if (content[i] === '>' && start === -1) {
      // 没有 { 直接遇到 >，可能是空泛型
      break;
    }
  }

  if (start === -1 || end === -1) return null;
  return content.slice(start + 1, end);
}

/**
 * 从 <script setup> 中提取公开方法
 * 1. defineExpose 中列出的方法
 * 2. 顶层 function/const 箭头函数（不包含 setup 内部工具函数）
 */
function extractVue3DefineMethods(content: string): MethodInfo[] {
  const methods: MethodInfo[] = [];
  const exposedNames = new Set<string>();

  // defineExpose({ method1, method2 })
  const exposeMatch = content.match(/defineExpose\s*\(\s*\{([\s\S]*?)\}\s*\)/);
  if (exposeMatch) {
    const exposeContent = exposeMatch[1];
    const nameRegex = /(\w+)/g;
    let m;
    while ((m = nameRegex.exec(exposeContent)) !== null) {
      if (!['async', 'const', 'let', 'var', 'true', 'false'].includes(m[1])) {
        exposedNames.add(m[1]);
      }
    }
  }

  // 提取顶层函数声明
  const funcRegex = /(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)(?:\s*:\s*([^{;\n]+))?/g;
  let match: RegExpExecArray | null;
  while ((match = funcRegex.exec(content)) !== null) {
    const m = match!;
    const isExposed = exposedNames.size === 0 || exposedNames.has(m[1]);
    if (isExposed) {
      methods.push({
        name: m[1],
        params: m[2].trim(),
        returnType: m[3]?.trim() || 'void',
        visibility: 'public'
      });
    }
  }

  // const fn = () => {}  / const fn = async () => {}
  const arrowRegex = /const\s+(\w+)\s*=\s*(?:async\s+)?\(([^)]*)\)(?:\s*:\s*([^=>\n{]+))?\s*=>/g;
  while ((match = arrowRegex.exec(content)) !== null) {
    const m = match!;
    const isExposed = exposedNames.has(m[1]);
    if (isExposed && !methods.find((md) => md.name === m[1])) {
      methods.push({
        name: m[1],
        params: m[2].trim(),
        returnType: m[3]?.trim() || 'void',
        visibility: 'public'
      });
    }
  }

  return methods;
}

// ==================== Vue 2 分析 ====================

function extractVue2Props(content: string): PropInfo[] {
  const props: PropInfo[] = [];
  // 支持嵌套括号的 props: { ... }
  const propsIdx = content.search(/\bprops\s*:\s*\{/);
  if (propsIdx === -1) return props;

  const body = extractBraceContent(content, propsIdx + content.slice(propsIdx).indexOf('{'));
  if (!body) return props;

  const propRegex = /(\w+)\s*:\s*\{([^}]*)\}/g;
  let match;
  while ((match = propRegex.exec(body)) !== null) {
    const name = match[1];
    const def = match[2];
    const typeMatch = def.match(/type\s*:\s*(\w+)/);
    const requiredMatch = def.match(/required\s*:\s*(true|false)/);
    const defaultMatch = def.match(/default\s*:\s*([^,}\n]+)/);
    props.push({
      name,
      type: typeMatch?.[1] || 'any',
      required: requiredMatch?.[1] === 'true',
      defaultValue: defaultMatch?.[1]?.trim()
    });
  }
  // 简写: propName: String
  const shortRegex = /(\w+)\s*:\s*(String|Number|Boolean|Array|Object|Function)(?=[,\s\n])/g;
  while ((match = shortRegex.exec(body)) !== null) {
    if (!props.find((p) => p.name === match![1])) {
      props.push({ name: match![1], type: match![2], required: false });
    }
  }
  return props;
}

function extractVue2Methods(content: string): MethodInfo[] {
  const methods: MethodInfo[] = [];
  const methodsIdx = content.search(/\bmethods\s*:\s*\{/);
  if (methodsIdx === -1) return methods;

  const body = extractBraceContent(content, methodsIdx + content.slice(methodsIdx).indexOf('{'));
  if (!body) return methods;

  const methodRegex = /(?:async\s+)?(\w+)\s*\(([^)]*)\)/g;
  let match;
  while ((match = methodRegex.exec(body)) !== null) {
    methods.push({
      name: match[1],
      params: match[2],
      returnType: 'void',
      visibility: 'public'
    });
  }
  return methods;
}

function extractVue2Events(content: string): EventInfo[] {
  const events: EventInfo[] = [];
  const emitRegex = /this\.\$emit\s*\(\s*['"](\w+)['"](?:\s*,\s*([^)]*))?/g;
  let match: RegExpExecArray | null;
  while ((match = emitRegex.exec(content)) !== null) {
    const m = match!;
    if (!events.find((e) => e.name === m[1])) {
      events.push({ name: m[1], payload: m[2]?.trim() || 'unknown' });
    }
  }
  return events;
}

function extractVueSlots(content: string): SlotInfo[] {
  const slots: SlotInfo[] = [];
  // <slot name="xxx"> 或 <slot :name="xxx">
  const namedSlotRegex = /<slot\s+(?::name|name)\s*=\s*["']?([\w-]+)["']?/g;
  let match: RegExpExecArray | null;
  while ((match = namedSlotRegex.exec(content)) !== null) {
    const m = match!;
    if (!slots.find((s) => s.name === m[1])) {
      slots.push({ name: m[1] });
    }
  }
  // 默认 slot（没有 name 属性的 <slot>）
  if (/<slot(?![^>]*\bname\b)[^>]*>/.test(content)) {
    if (!slots.find((s) => s.name === 'default')) {
      slots.push({ name: 'default' });
    }
  }
  return slots;
}

// ==================== React 分析 ====================

function analyzeReactComponent(filePath: string, content: string): ComponentAnalysis {
  const analysis: ComponentAnalysis = {
    filePath,
    language: 'react',
    componentName: extractComponentName(filePath),
    description: '',
    props: [],
    methods: [],
    events: [],
    imports: [],
    exports: [],
    slots: []
  };
  analysis.imports = extractImports(content);
  analysis.exports = extractExports(content);
  analysis.description = extractDescription(content);
  analysis.props = extractReactProps(content);
  analysis.methods = extractReactMethods(content);
  return analysis;
}

function extractReactProps(content: string): PropInfo[] {
  const props: PropInfo[] = [];
  // interface XxxProps / type XxxProps
  const propsInterfaceMatch = content.match(
    /(?:interface|type)\s+\w*[Pp]rops\w*\s*(?:=\s*)?\{([\s\S]*?)\}/
  );
  if (propsInterfaceMatch) {
    parseTsInterfaceBody(propsInterfaceMatch[1]).forEach((p) => props.push(p));
  }
  return props;
}

function extractReactMethods(content: string): MethodInfo[] {
  const methods: MethodInfo[] = [];
  const funcRegex =
    /(?:const|let)\s+(\w+)\s*=\s*(?:async\s+)?(?:\(([^)]*)\)(?:\s*:\s*([^=>\n]+))?)\s*=>/g;
  let match: RegExpExecArray | null;
  while ((match = funcRegex.exec(content)) !== null) {
    methods.push({
      name: match[1],
      params: match[2],
      returnType: match[3]?.trim() || 'void',
      visibility: 'public'
    });
  }
  const methodRegex = /(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)(?:\s*:\s*([^{\n]+))?/g;
  while ((match = methodRegex.exec(content)) !== null) {
    const m = match!;
    if (!methods.find((md) => md.name === m[1])) {
      methods.push({
        name: m[1],
        params: m[2],
        returnType: m[3]?.trim() || 'void',
        visibility: 'public'
      });
    }
  }
  return methods;
}

// ==================== TypeScript 分析 ====================

function analyzeTsComponent(filePath: string, content: string): ComponentAnalysis {
  const analysis: ComponentAnalysis = {
    filePath,
    language: detectLanguage(filePath),
    componentName: extractComponentName(filePath),
    description: '',
    props: [],
    methods: [],
    events: [],
    imports: [],
    exports: [],
    slots: []
  };
  analysis.imports = extractImports(content);
  analysis.exports = extractExports(content);
  analysis.description = extractDescription(content);
  analysis.props = extractTsProps(content);
  analysis.methods = extractTsMethods(content);
  return analysis;
}

function extractTsProps(content: string): PropInfo[] {
  const props: PropInfo[] = [];
  const interfaceRegex = /(?:interface|type)\s+\w+\s*(?:=\s*)?\{([\s\S]*?)\}/g;
  let match;
  while ((match = interfaceRegex.exec(content)) !== null) {
    parseTsInterfaceBody(match[1]).forEach((p) => {
      if (!props.find((existing) => existing.name === p.name)) {
        props.push(p);
      }
    });
  }
  return props;
}

function extractTsMethods(content: string): MethodInfo[] {
  const methods: MethodInfo[] = [];
  const funcRegex =
    /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)(?:\s*:\s*([^{;\n]+))?/g;
  let match;
  while ((match = funcRegex.exec(content)) !== null) {
    methods.push({
      name: match[1],
      params: match[2],
      returnType: match[3]?.trim() || 'void',
      visibility: match[0].startsWith('export') ? 'public' : 'private'
    });
  }
  const arrowRegex =
    /(?:export\s+)?(?:const|let)\s+(\w+)\s*=\s*(?:async\s+)?\(([^)]*)\)(?:\s*:\s*([^=>\n]+))?\s*=>/g;
  while ((match = arrowRegex.exec(content)) !== null) {
    if (!methods.find((m) => m.name === match![1])) {
      methods.push({
        name: match[1],
        params: match[2],
        returnType: match[3]?.trim() || 'void',
        visibility: match[0].startsWith('export') ? 'public' : 'private'
      });
    }
  }
  return methods;
}

// ==================== 通用分析 ====================

function analyzeGenericComponent(filePath: string, content: string): ComponentAnalysis {
  return {
    filePath,
    language: 'unknown',
    componentName: extractComponentName(filePath),
    description: extractDescription(content) || '',
    props: [],
    methods: [],
    events: [],
    imports: extractImports(content),
    exports: extractExports(content),
    slots: []
  };
}

// ==================== 工具：括号深度匹配 ====================

/**
 * 从指定位置提取匹配 { } 的内容
 */
function extractBraceContent(content: string, braceStart: number): string | null {
  let depth = 0;
  let start = -1;
  let end = -1;
  for (let i = braceStart; i < content.length; i++) {
    if (content[i] === '{') {
      if (start === -1) start = i;
      depth++;
    } else if (content[i] === '}') {
      depth--;
      if (depth === 0 && start !== -1) {
        end = i;
        break;
      }
    }
  }
  if (start === -1 || end === -1) return null;
  return content.slice(start + 1, end);
}
