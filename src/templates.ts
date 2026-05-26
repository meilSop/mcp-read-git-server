/**
 * 文档模板系统
 * 支持内置模板和自定义模板，使用 {{变量}} 占位符语法
 */
import type {
  ComponentAnalysis,
  EventInfo,
  ExportInfo,
  ImportInfo,
  MethodInfo,
  PropInfo,
  SlotInfo
} from './code-analyzer.js';

// ==================== 内置模板定义 ====================

export const BUILT_IN_TEMPLATES: Record<string, string> = {
  component: `# {{componentName}}

{{#if description}}
{{description}}
{{/if}}

## 基本信息

| 属性 | 值 |
|------|------|
| 文件路径 | \`{{filePath}}\` |
| 语言类型 | {{language}} |
| Props 数量 | {{propsCount}} |
| Methods 数量 | {{methodsCount}} |
| Events 数量 | {{eventsCount}} |
| Slots 数量 | {{slotsCount}} |

{{#if props}}
## Props

| 名称 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
{{propsTable}}
{{/if}}

{{#if methods}}
## Methods

| 名称 | 参数 | 返回值 | 可见性 | 说明 |
|------|------|--------|--------|------|
{{methodsTable}}
{{/if}}

{{#if events}}
## Events

| 事件名 | 载荷类型 | 说明 |
|--------|----------|------|
{{eventsTable}}
{{/if}}

{{#if slots}}
## Slots

| 名称 | 说明 |
|------|------|
{{slotsTable}}
{{/if}}

{{#if imports}}
## 依赖

{{importsList}}
{{/if}}

{{#if exports}}
## 导出

{{exportsList}}
{{/if}}`,

  'api-reference': `# {{componentName}} API 参考

{{#if description}}
> {{description}}
{{/if}}

---

{{#if props}}
## 属性 (Props)

{{propsDetailed}}
{{/if}}

{{#if events}}
## 事件 (Events)

{{eventsDetailed}}
{{/if}}

{{#if methods}}
## 方法 (Methods)

{{methodsDetailed}}
{{/if}}

{{#if slots}}
## 插槽 (Slots)

{{slotsDetailed}}
{{/if}}`,

  'quick-start': `# {{componentName}} 快速上手

{{#if description}}
{{description}}
{{/if}}

## 引入

\`\`\`typescript
import {{componentName}} from '{{filePath}}'
\`\`\`

## 基础用法

{{#if props}}
### 可用属性

{{propsList}}
{{/if}}

{{#if events}}
### 事件监听

{{eventsList}}
{{/if}}

{{#if slots}}
### 插槽

{{slotsList}}
{{/if}}

{{#if imports}}
## 依赖项

{{importsList}}
{{/if}}`,

  minimal: `# {{componentName}}

{{#if description}}
{{description}}
{{/if}}

{{#if props}}
**Props**: {{propsInline}}
{{/if}}

{{#if events}}
**Events**: {{eventsInline}}
{{/if}}

{{#if methods}}
**Methods**: {{methodsInline}}
{{/if}}`,

  'ui-doc': `# {{componentName}} {{componentNameZh}}

{{#if description}}
{{description}}
{{/if}}

{{demosBlock}}

## API

{{#if props}}
### Attributes

| 属性名 | 说明 | 类型 | 可选值 | 默认值 |
| ------ | --- | ---- | ------ | ------ |
{{propsApiTable}}
{{/if}}

{{#if events}}
### Events

| 事件名 | 说明 | 回调参数 |
| ------ | --- | -------- |
{{eventsApiTable}}
{{/if}}

{{#if slots}}
### Slots

| 插槽名 | 说明 |
| ------- | --- |
{{slotsApiTable}}
{{/if}}

{{#if methods}}
### Methods

| 方法名 | 说明 | 参数 | 返回值 |
| ------ | --- | ---- | ------ |
{{methodsApiTable}}
{{/if}}

{{specialUsageSection}}`
};

// ==================== 子模板渲染函数 ====================

function renderPropsTable(props: PropInfo[]): string {
  return props
    .map((p) => {
      const required = p.required ? '是' : '否';
      const defaultVal = p.defaultValue || '-';
      const desc = p.description || '-';
      return `| \`${p.name}\` | \`${p.type}\` | ${required} | \`${defaultVal}\` | ${desc} |`;
    })
    .join('\n');
}

function renderMethodsTable(methods: MethodInfo[]): string {
  return methods
    .map((m) => {
      const desc = m.description || '-';
      return `| \`${m.name}\` | \`${m.params}\` | \`${m.returnType}\` | ${m.visibility} | ${desc} |`;
    })
    .join('\n');
}

function renderEventsTable(events: EventInfo[]): string {
  return events
    .map((e) => {
      const desc = e.description || '-';
      return `| \`${e.name}\` | \`${e.payload}\` | ${desc} |`;
    })
    .join('\n');
}

function renderSlotsTable(slots: SlotInfo[]): string {
  return slots
    .map((s) => {
      const desc = s.description || '-';
      return `| \`${s.name}\` | ${desc} |`;
    })
    .join('\n');
}

function renderImportsList(imports: ImportInfo[]): string {
  return imports
    .map((imp) => `- \`${imp.source}\`: ${imp.items.map((i) => `\`${i}\``).join(', ')}`)
    .join('\n');
}

function renderExportsList(exports: ExportInfo[]): string {
  return exports.map((exp) => `- \`${exp.name}\` (${exp.type})`).join('\n');
}

// api-reference 专用
function renderPropsDetailed(props: PropInfo[]): string {
  return props
    .map((p) => {
      const required = p.required ? '**必填**' : '可选';
      const defaultVal = p.defaultValue ? `，默认值: \`${p.defaultValue}\`` : '';
      const desc = p.description ? ` - ${p.description}` : '';
      return `- **${p.name}** \`${p.type}\` ${required}${defaultVal}${desc}`;
    })
    .join('\n');
}

function renderEventsDetailed(events: EventInfo[]): string {
  return events
    .map((e) => {
      const desc = e.description ? ` - ${e.description}` : '';
      return `- **${e.name}** 载荷: \`${e.payload}\`${desc}`;
    })
    .join('\n');
}

function renderMethodsDetailed(methods: MethodInfo[]): string {
  return methods
    .map((m) => {
      const desc = m.description ? ` - ${m.description}` : '';
      return `- **${m.name}**(\`${m.params}\`): \`${m.returnType}\` ${m.visibility}${desc}`;
    })
    .join('\n');
}

function renderSlotsDetailed(slots: SlotInfo[]): string {
  return slots
    .map((s) => {
      const desc = s.description ? ` - ${s.description}` : '';
      return `- **${s.name}**${desc}`;
    })
    .join('\n');
}

// quick-start 专用
function renderPropsList(props: PropInfo[]): string {
  return props
    .map((p) => {
      const required = p.required ? '(必填)' : '(可选)';
      const defaultVal = p.defaultValue ? `，默认 \`${p.defaultValue}\`` : '';
      return `- \`${p.name}\`: \`${p.type}\` ${required}${defaultVal}`;
    })
    .join('\n');
}

function renderEventsList(events: EventInfo[]): string {
  return events.map((e) => `- \`@${e.name}\` - \`${e.payload}\``).join('\n');
}

function renderSlotsList(slots: SlotInfo[]): string {
  return slots.map((s) => `- \`${s.name}\``).join('\n');
}

// minimal 专用
function renderPropsInline(props: PropInfo[]): string {
  return props.map((p) => `\`${p.name}\``).join(', ');
}

function renderEventsInline(events: EventInfo[]): string {
  return events.map((e) => `\`${e.name}\``).join(', ');
}

function renderMethodsInline(methods: MethodInfo[]): string {
  return methods.map((m) => `\`${m.name}\``).join(', ');
}

// ==================== ui-doc 专用渲染 ====================

/** UI 文档 Props 表格 - Element Plus 风格 */
function renderPropsApiTable(props: PropInfo[]): string {
  return props
    .map((p) => {
      const desc = p.description || '-';
      const defaultVal = p.defaultValue || '-';
      // 根据类型推断可选值
      const options = inferOptions(p.type);
      return `| \`${p.name}\` | ${desc} | \`${p.type}\` | ${options} | \`${defaultVal}\` |`;
    })
    .join('\n');
}

/** UI 文档 Events 表格 - Element Plus 风格 */
function renderEventsApiTable(events: EventInfo[]): string {
  return events
    .map((e) => {
      const desc = e.description || '-';
      return `| \`${e.name}\` | ${desc} | \`${e.payload}\` |`;
    })
    .join('\n');
}

/** UI 文档 Slots 表格 - Element Plus 风格 */
function renderSlotsApiTable(slots: SlotInfo[]): string {
  return slots
    .map((s) => {
      const desc = s.description || '-';
      return `| \`${s.name}\` | ${desc} |`;
    })
    .join('\n');
}

/** UI 文档 Methods 表格 - Element Plus 风格 */
function renderMethodsApiTable(methods: MethodInfo[]): string {
  return methods
    .map((m) => {
      const desc = m.description || '-';
      return `| \`${m.name}\` | ${desc} | \`${m.params}\` | \`${m.returnType}\` |`;
    })
    .join('\n');
}

/** 根据类型推断可选值 */
function inferOptions(type: string): string {
  if (type.includes('boolean')) return 'true / false';
  if (type.includes('number')) return 'number';
  if (type.includes('string')) return 'string';
  if (type.startsWith("'") || type.includes('|')) return type;
  return '-';
}

/**
 * 根据 Props 生成 demo 场景列表
 * 返回 { title, description, src } 数组
 */
export function generateDemoScenarios(analysis: ComponentAnalysis): Array<{
  title: string;
  description: string;
  src: string;
}> {
  const demos: Array<{ title: string; description: string; src: string }> = [];
  const name = analysis.componentName;
  const ext = analysis.language === 'react' ? 'tsx' : 'vue';

  // 1. 基础用法
  demos.push({
    title: '基础用法',
    description: `${name} 组件的基础用法。`,
    src: `./demo.${ext}`
  });

  // 2. 根据 Props 生成不同场景
  for (const prop of analysis.props) {
    // 枚举类型 props -> 每个值一个 demo
    if (prop.type.includes('|') || prop.type.startsWith("'")) {
      const values = prop.type
        .split('|')
        .map((v) => v.trim().replace(/["']/g, ''))
        .filter(Boolean);
      if (values.length >= 2) {
        demos.push({
          title: `${prop.name} 模式`,
          description: `通过 \`${prop.name}\` 属性设置为 ${values.map((v) => `\`${v}\``).join('、')} 切换不同模式。`,
          src: `./demo${demos.length + 1}.${ext}`
        });
      }
    }
    // boolean 类型 prop -> 开启该特性的 demo
    if (prop.type === 'boolean' && prop.defaultValue !== 'true') {
      demos.push({
        title: `${prop.name} 模式`,
        description: `设置 \`${prop.name}\` 为 \`true\` 开启${prop.description || prop.name}功能。`,
        src: `./demo${demos.length + 1}.${ext}`
      });
    }
  }

  // 3. 根据 Events 生成 demo
  for (const event of analysis.events) {
    demos.push({
      title: `${event.name} 事件`,
      description: `监听 \`${event.name}\` 事件${event.description ? '，' + event.description : ''}。`,
      src: `./demo${demos.length + 1}.${ext}`
    });
    // 事件只需一个 demo
    break;
  }

  // 4. 根据 Slots 生成 demo
  if (analysis.slots.length > 0) {
    const slotNames = analysis.slots.map((s) => `\`${s.name}\``).join('、');
    demos.push({
      title: '自定义内容',
      description: `使用${slotNames}插槽自定义内容。`,
      src: `./demo${demos.length + 1}.${ext}`
    });
  }

  return demos;
}

/** HTML 属性转义 */
function escapeHtmlAttr(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** 渲染 demos 区块（<demo> 标签集合） */
function renderDemosBlock(analysis: ComponentAnalysis): string {
  const scenarios = generateDemoScenarios(analysis);
  if (scenarios.length === 0) return '';

  return scenarios
    .map((s) => {
      return `## ${s.title}

<demo title="${escapeHtmlAttr(s.title)}" description="${escapeHtmlAttr(s.description)}" src="${s.src}" />`;
    })
    .join('\n\n');
}

/** 渲染特殊用法说明 */
function renderSpecialUsageSection(analysis: ComponentAnalysis): string {
  const sections: string[] = [];

  // 如果有 Methods，提示方法调用方式
  if (analysis.methods.length > 0) {
    sections.push('### 方法调用');
    sections.push('');
    sections.push('通过 `ref` 获取组件实例后调用方法：');
    sections.push('');
    if (analysis.language === 'vue') {
      sections.push('```vue');
      sections.push('<template>');
      sections.push(`  <${analysis.componentName} ref="compRef" />`);
      sections.push('</template>');
      sections.push('');
      sections.push('<script setup>');
      sections.push(`import { ref } from 'vue'`);
      sections.push(`const compRef = ref()`);
      sections.push('');
      // 示例方法调用
      const method = analysis.methods[0];
      sections.push(`// 调用方法: ${method.name}`);
      sections.push(`compRef.value?.${method.name}()`);
      sections.push('</script>');
    } else {
      sections.push('```tsx');
      sections.push(`import { useRef } from 'react'`);
      sections.push(`import ${analysis.componentName} from '${analysis.filePath}'`);
      sections.push('');
      sections.push(`const ref = useRef()`);
      const method = analysis.methods[0];
      sections.push(`// 调用方法: ${method.name}`);
      sections.push(`ref.current?.${method.name}()`);
    }
    sections.push('```');
  }

  return sections.join('\n');
}

/**
 * 生成 demo 文件内容
 * 根据组件分析结果，为每个 demo 场景生成模板代码
 */
export function generateDemoFiles(analysis: ComponentAnalysis): Array<{
  filename: string;
  content: string;
}> {
  const scenarios = generateDemoScenarios(analysis);
  const name = analysis.componentName;
  const ext = analysis.language === 'react' ? 'tsx' : 'vue';
  const files: Array<{ filename: string; content: string }> = [];

  for (let i = 0; i < scenarios.length; i++) {
    const scenario = scenarios[i];
    const filename = i === 0 ? `demo.${ext}` : `demo${i + 1}.${ext}`;

    let content = '';
    if (analysis.language === 'vue') {
      content = generateVueDemo(name, scenario, analysis, i);
    } else if (analysis.language === 'react') {
      content = generateReactDemo(name, scenario, analysis, i);
    } else {
      content = generateTsDemo(name, scenario, analysis, i);
    }

    files.push({ filename, content });
  }

  return files;
}

function generateVueDemo(
  name: string,
  scenario: { title: string; description: string; src: string },
  analysis: ComponentAnalysis,
  index: number
): string {
  const propsUsage = buildPropsUsage(analysis, index);
  const eventsUsage = index === 0 && analysis.events.length > 0 ? '' : '';
  const slotsUsage =
    scenario.title === '自定义内容' && analysis.slots.length > 0
      ? `\n    <template #${analysis.slots[0].name}>\n      <!-- 自定义 ${analysis.slots[0].name} 内容 -->\n      <span>自定义内容</span>\n    </template>`
      : '';

  return `<template>
  <${name}${propsUsage}${eventsUsage}>${slotsUsage}\n  </${name}>
</template>

<script setup>
/**
 * ${scenario.title} - ${scenario.description}
 */
import ${name} from '${analysis.filePath}'
</script>`;
}

function generateReactDemo(
  name: string,
  scenario: { title: string; description: string },
  analysis: ComponentAnalysis,
  index: number
): string {
  const propsUsage = buildPropsUsage(analysis, index);
  return `/**
 * ${scenario.title} - ${scenario.description}
 */
import ${name} from '${analysis.filePath}'

export default function ${name}Demo${index > 0 ? index + 1 : ''}() {
  return (
    <${name}${propsUsage} />
  )
}`;
}

function generateTsDemo(
  name: string,
  scenario: { title: string; description: string },
  analysis: ComponentAnalysis,
  index: number
): string {
  const importLine =
    analysis.exports[0]?.type === 'default'
      ? `import ${name} from '${analysis.filePath}'`
      : `import { ${name} } from '${analysis.filePath}'`;

  return `/**
 * ${scenario.title} - ${scenario.description}
 */
${importLine}

// 基础调用示例
const result = ${name}()`;
}

/** 根据场景索引构建 Props 使用字符串 */
function buildPropsUsage(analysis: ComponentAnalysis, index: number): string {
  if (index === 0) {
    // 基础用法：只填必填 props
    const requiredProps = analysis.props.filter((p) => p.required);
    if (requiredProps.length === 0) return '';
    return requiredProps.map((p) => `\n    :${p.name}="${p.defaultValue || '...'}"`).join('');
  }

  // 其他场景：基于第几个 demo 选择对应 prop
  const optionalProps = analysis.props.filter(
    (p) => !p.required && (p.type.includes('|') || p.type.startsWith("'") || p.type === 'boolean')
  );
  const targetIndex = index - 1;
  if (targetIndex < optionalProps.length) {
    const prop = optionalProps[targetIndex];
    const value = getDemoPropValue(prop);
    return `\n    ${prop.type === 'boolean' ? ':' : ''}${prop.name}="${value}"`;
  }

  return '';
}

function getDemoPropValue(prop: PropInfo): string {
  if (prop.type === 'boolean') return 'true';
  if (prop.type.includes('|')) {
    const values = prop.type.split('|').map((v) => v.trim().replace(/["']/g, ''));
    return values[0] || prop.defaultValue || "'...'";
  }
  return prop.defaultValue || "'...'";
}

// ==================== 模板变量构建 ====================

function buildTemplateVars(analysis: ComponentAnalysis): Record<string, string> {
  return {
    componentName: analysis.componentName,
    componentNameZh: '', // 中文名，用户可自定义模板时设置
    description: analysis.description,
    filePath: analysis.filePath,
    language: analysis.language,
    propsCount: String(analysis.props.length),
    methodsCount: String(analysis.methods.length),
    eventsCount: String(analysis.events.length),
    slotsCount: String(analysis.slots.length),
    // 表格渲染
    propsTable: renderPropsTable(analysis.props),
    methodsTable: renderMethodsTable(analysis.methods),
    eventsTable: renderEventsTable(analysis.events),
    slotsTable: renderSlotsTable(analysis.slots),
    importsList: renderImportsList(analysis.imports),
    exportsList: renderExportsList(analysis.exports),
    // api-reference 详细渲染
    propsDetailed: renderPropsDetailed(analysis.props),
    eventsDetailed: renderEventsDetailed(analysis.events),
    methodsDetailed: renderMethodsDetailed(analysis.methods),
    slotsDetailed: renderSlotsDetailed(analysis.slots),
    // quick-start 列表渲染
    propsList: renderPropsList(analysis.props),
    eventsList: renderEventsList(analysis.events),
    slotsList: renderSlotsList(analysis.slots),
    // minimal 行内渲染
    propsInline: renderPropsInline(analysis.props),
    eventsInline: renderEventsInline(analysis.events),
    methodsInline: renderMethodsInline(analysis.methods),
    // ui-doc 渲染
    demosBlock: renderDemosBlock(analysis),
    propsApiTable: renderPropsApiTable(analysis.props),
    eventsApiTable: renderEventsApiTable(analysis.events),
    slotsApiTable: renderSlotsApiTable(analysis.slots),
    methodsApiTable: renderMethodsApiTable(analysis.methods),
    specialUsageSection: renderSpecialUsageSection(analysis)
  };
}

// ==================== 模板引擎 ====================

/**
 * 条件块正则: {{#if var}}...{{/if}}
 */
const IF_BLOCK_REGEX = /\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g;

/**
 * 渲染模板
 * @param template 模板字符串
 * @param analysis 组件分析结果
 */
export function renderTemplate(template: string, analysis: ComponentAnalysis): string {
  const vars = buildTemplateVars(analysis);

  // 1. 处理条件块
  let result = template.replace(IF_BLOCK_REGEX, (_match, varName: string, content: string) => {
    const value = vars[varName];
    // 如果变量为空字符串或不存在，移除整个条件块
    if (!value || value.trim() === '') {
      return '';
    }
    return content;
  });

  // 2. 替换变量占位符
  result = result.replace(/\{\{(\w+)\}\}/g, (_match, varName: string) => {
    return vars[varName] ?? '';
  });

  // 3. 清理多余空行（3个以上连续空行压缩为2个）
  result = result.replace(/\n{3,}/g, '\n\n');

  return result.trim();
}

/**
 * 获取内置模板名称列表
 */
export function getTemplateNames(): string[] {
  return Object.keys(BUILT_IN_TEMPLATES);
}

/**
 * 解析模板：如果名称匹配内置模板则使用内置，否则作为自定义模板字符串
 */
export function resolveTemplate(templateNameOrContent: string): string {
  const builtIn = BUILT_IN_TEMPLATES[templateNameOrContent];
  if (builtIn) {
    return builtIn;
  }
  // 不是内置模板名称，视为自定义模板内容
  return templateNameOrContent;
}
