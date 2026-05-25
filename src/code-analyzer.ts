/**
 * 代码结构分析器
 * 支持分析 Vue/React/TypeScript 组件的代码结构
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

function detectLanguage(filePath: string): string {
  if (filePath.endsWith('.vue')) return 'vue';
  if (filePath.endsWith('.tsx') || filePath.endsWith('.jsx')) return 'react';
  if (filePath.endsWith('.ts')) return 'typescript';
  if (filePath.endsWith('.js')) return 'javascript';
  return 'unknown';
}

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

  const scriptSetupMatch =
    content.match(/<script\s+setup[^>]*lang=["']ts["'][^>]*>([\s\S]*?)<\/script>/) ||
    content.match(/<script\s+setup[^>]*>([\s\S]*?)<\/script>/);
  const scriptMatch =
    content.match(/<script[^>]*lang=["']ts["'][^>]*>([\s\S]*?)<\/script>/) ||
    content.match(/<script[^>]*>([\s\S]*?)<\/script>/);

  const scriptContent = scriptSetupMatch?.[1] || scriptMatch?.[1] || '';
  const isSetup = !!scriptSetupMatch;

  analysis.imports = extractImports(scriptContent);

  if (isSetup) {
    analysis.props = extractVueDefineProps(scriptContent);
    analysis.events = extractVueDefineEmits(scriptContent);
    analysis.methods = extractVueDefineExpose(scriptContent);
  } else {
    analysis.props = extractVue2Props(scriptContent);
    analysis.methods = extractVue2Methods(scriptContent);
    analysis.events = extractVue2Events(scriptContent);
  }

  analysis.slots = extractVueSlots(content);
  analysis.description = extractDescription(content) || extractDescription(scriptContent);
  return analysis;
}

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

// ==================== 提取函数 ====================

function extractComponentName(filePath: string): string {
  const parts = filePath.split('/');
  const fileName = parts[parts.length - 1];
  return fileName.replace(/\.\w+$/, '');
}

function extractDescription(content: string): string {
  const commentMatch = content.match(/\/\*\*[\s\S]*?\*\//);
  if (commentMatch) {
    return commentMatch[0]
      .replace(/\/\*\*|\*\//g, '')
      .replace(/\s*\*\s*/g, ' ')
      .trim();
  }
  return '';
}

function extractImports(content: string): ImportInfo[] {
  const imports: ImportInfo[] = [];
  const importRegex = /import\s+(?:\{([^}]+)\}|(\w+))\s+from\s+['"]([^'"]+)['"]/g;
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    const destructured = match[1];
    const defaultImport = match[2];
    const source = match[3];
    const items = destructured
      ? destructured
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : defaultImport
        ? [defaultImport]
        : [];
    imports.push({ source, items });
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

function extractVueDefineProps(content: string): PropInfo[] {
  const props: PropInfo[] = [];

  // defineProps({ ... }) 对象形式
  const propsObjMatch = content.match(/defineProps\s*\(\s*\{([\s\S]*?)\}\s*\)/);
  if (propsObjMatch) {
    const propsContent = propsObjMatch[1];
    const propRegex = /(\w+)\s*:\s*\{([^}]*)\}/g;
    let match;
    while ((match = propRegex.exec(propsContent)) !== null) {
      const name = match[1];
      const definition = match[2];
      const typeMatch = definition.match(/type\s*:\s*(\w+)/);
      const requiredMatch = definition.match(/required\s*:\s*(true|false)/);
      const defaultMatch = definition.match(/default\s*:\s*([^,}\n]+)/);
      props.push({
        name,
        type: typeMatch?.[1] || 'any',
        required: requiredMatch?.[1] === 'true',
        defaultValue: defaultMatch?.[1]?.trim()
      });
    }
  }

  // defineProps<{}> TypeScript 泛型形式
  const propsGenericMatch = content.match(/defineProps\s*<\s*\{([\s\S]*?)\}\s*>/);
  if (propsGenericMatch && props.length === 0) {
    const propsContent = propsGenericMatch[1];
    const propRegex = /(\w+)(\?)?\s*:\s*([^;\n]+)/g;
    let match;
    while ((match = propRegex.exec(propsContent)) !== null) {
      props.push({ name: match[1], type: match[3].trim(), required: !match[2] });
    }
  }

  // withDefaults defaults
  const withDefaultsMatch = content.match(
    /withDefaults\s*\(\s*defineProps\s*<[^>]*>\s*\(\s*\)\s*,\s*\{([\s\S]*?)\}\s*\)/
  );
  if (withDefaultsMatch) {
    const defaultsContent = withDefaultsMatch[1];
    const defaultRegex = /(\w+)\s*:\s*(?:\(\s*\)\s*=>\s*([^,}\n]+)|([^,}\n]+))/g;
    let match: RegExpExecArray | null;
    while ((match = defaultRegex.exec(defaultsContent)) !== null) {
      const m = match!;
      const existing = props.find((p) => p.name === m[1]);
      if (existing) {
        existing.defaultValue = (m[2] || m[3])?.trim();
      }
    }
  }

  return props;
}

function extractVueDefineEmits(content: string): EventInfo[] {
  const events: EventInfo[] = [];
  const emitsArrMatch = content.match(/defineEmits\s*\(\s*\[([\s\S]*?)\]\s*\)/);
  if (emitsArrMatch) {
    const emitsContent = emitsArrMatch[1];
    const emitRegex = /['"](\w+)['"]/g;
    let match;
    while ((match = emitRegex.exec(emitsContent)) !== null) {
      events.push({ name: match[1], payload: 'unknown' });
    }
  }

  const emitsGenericMatch = content.match(/defineEmits\s*<\s*\{([\s\S]*?)\}\s*>/);
  if (emitsGenericMatch && events.length === 0) {
    const emitsContent = emitsGenericMatch[1];
    const emitRegex = /['"]?(\w+)['"]?\s*[:=]\s*\[?([^;\n\]]+)\]?/g;
    let match;
    while ((match = emitRegex.exec(emitsContent)) !== null) {
      events.push({ name: match[1], payload: match[2].trim() });
    }
  }
  return events;
}

function extractVueDefineExpose(content: string): MethodInfo[] {
  const methods: MethodInfo[] = [];
  const exposeMatch = content.match(/defineExpose\s*\(\s*\{([\s\S]*?)\}\s*\)/);
  if (exposeMatch) {
    const exposeContent = exposeMatch[1];
    const methodRegex = /(\w+)/g;
    let match;
    while ((match = methodRegex.exec(exposeContent)) !== null) {
      if (!['async', 'const', 'let', 'var'].includes(match[1])) {
        methods.push({ name: match[1], params: '', returnType: 'void', visibility: 'public' });
      }
    }
  }

  const funcRegex = /(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)(?:\s*:\s*([^{\n]+))?/g;
  let funcMatch: RegExpExecArray | null;
  while ((funcMatch = funcRegex.exec(content)) !== null) {
    const fm = funcMatch!;
    if (!methods.find((m) => m.name === fm[1])) {
      methods.push({
        name: fm[1],
        params: fm[2],
        returnType: fm[3]?.trim() || 'void',
        visibility: 'public'
      });
    }
  }
  return methods;
}

function extractVue2Props(content: string): PropInfo[] {
  const props: PropInfo[] = [];
  const propsMatch = content.match(/props\s*:\s*\{([\s\S]*?)\}/);
  if (propsMatch) {
    const propsContent = propsMatch[1];
    const propRegex = /(\w+)\s*:\s*\{([^}]*)\}/g;
    let match;
    while ((match = propRegex.exec(propsContent)) !== null) {
      const name = match[1];
      const definition = match[2];
      const typeMatch = definition.match(/type\s*:\s*(\w+)/);
      const requiredMatch = definition.match(/required\s*:\s*(true|false)/);
      const defaultMatch = definition.match(/default\s*:\s*([^,}\n]+)/);
      props.push({
        name,
        type: typeMatch?.[1] || 'any',
        required: requiredMatch?.[1] === 'true',
        defaultValue: defaultMatch?.[1]?.trim()
      });
    }
  }
  return props;
}

function extractVue2Methods(content: string): MethodInfo[] {
  const methods: MethodInfo[] = [];
  const methodsMatch = content.match(/methods\s*:\s*\{([\s\S]*?)\n\s*\}/);
  if (methodsMatch) {
    const methodsContent = methodsMatch[1];
    const methodRegex = /(?:async\s+)?(\w+)\s*\(([^)]*)\)/g;
    let match;
    while ((match = methodRegex.exec(methodsContent)) !== null) {
      methods.push({
        name: match[1],
        params: match[2],
        returnType: 'void',
        visibility: 'public'
      });
    }
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
  const slotRegex = /<slot\s+name=["'](\w+)["']\s*\/?>/g;
  let match: RegExpExecArray | null;
  while ((match = slotRegex.exec(content)) !== null) {
    const m = match!;
    if (!slots.find((s) => s.name === m[1])) {
      slots.push({ name: m[1] });
    }
  }
  // 默认 slot
  if (/<slot(?:\s*\/?>|\s*><\/slot>)/.test(content) && !/<slot\s+name=/.test(content)) {
    slots.push({ name: 'default' });
  }
  return slots;
}

function extractReactProps(content: string): PropInfo[] {
  const props: PropInfo[] = [];

  // interface Props { ... }
  const propsInterfaceMatch = content.match(
    /(?:interface|type)\s+\w*Props\w*\s*(?:=\s*)?\{([\s\S]*?)\}/
  );
  if (propsInterfaceMatch) {
    const propsContent = propsInterfaceMatch[1];
    const propRegex = /(\w+)(\?)?\s*:\s*([^;\n]+)/g;
    let match;
    while ((match = propRegex.exec(propsContent)) !== null) {
      props.push({ name: match[1], type: match[3].trim(), required: !match[2] });
    }
  }

  // FC<Props> or React.FunctionComponent<Props>
  const fcMatch = content.match(
    /(?:React\.)?(?:FC|FunctionComponent|PropsWithChildren)<\s*(\w+)\s*>/
  );
  if (fcMatch) {
    const propsTypeName = fcMatch[1];
    const typeMatch = content.match(
      new RegExp(`(?:interface|type)\\s+${propsTypeName}\\s*(?:=\\s*)?\\{([\\s\\S]*?)\\}`)
    );
    if (typeMatch && props.length === 0) {
      const propsContent = typeMatch[1];
      const propRegex = /(\w+)(\?)?\s*:\s*([^;\n]+)/g;
      let match;
      while ((match = propRegex.exec(propsContent)) !== null) {
        props.push({ name: match[1], type: match[3].trim(), required: !match[2] });
      }
    }
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

  const methodRegex = /(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)(?:\s*:\s*([^\{\n]+))?/g;
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

function extractTsProps(content: string): PropInfo[] {
  const props: PropInfo[] = [];
  const interfaceMatch = content.match(/(?:interface|type)\s+\w+\s*(?:=\s*)?\{([\s\S]*?)\}/g);
  if (interfaceMatch) {
    for (const iface of interfaceMatch) {
      const bodyMatch = iface.match(/\{([\s\S]*?)\}/);
      if (bodyMatch) {
        const propRegex = /(\w+)(\?)?\s*:\s*([^;\n]+)/g;
        let match;
        while ((match = propRegex.exec(bodyMatch[1])) !== null) {
          props.push({ name: match[1], type: match[3].trim(), required: !match[2] });
        }
      }
    }
  }
  return props;
}

function extractTsMethods(content: string): MethodInfo[] {
  const methods: MethodInfo[] = [];
  const funcRegex =
    /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)(?:\s*:\s*([^{\n]+))?/g;
  let match;
  while ((match = funcRegex.exec(content)) !== null) {
    methods.push({
      name: match[1],
      params: match[2],
      returnType: match[3]?.trim() || 'void',
      visibility: match[0].includes('export') ? 'public' : 'private'
    });
  }

  const arrowRegex =
    /(?:export\s+)?(?:const|let)\s+(\w+)\s*=\s*(?:async\s+)?\(([^)]*)\)(?:\s*:\s*([^=>\n]+))?\s*=>/g;
  while ((match = arrowRegex.exec(content)) !== null) {
    methods.push({
      name: match[1],
      params: match[2],
      returnType: match[3]?.trim() || 'void',
      visibility: match[0].includes('export') ? 'public' : 'private'
    });
  }
  return methods;
}
