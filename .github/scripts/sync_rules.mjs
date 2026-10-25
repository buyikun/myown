#!/usr/bin/env node
/**
 * 把 Rule/ 目录下的 Loon 规则同步进 json/Mihono/mihomoScript.js 的内嵌规则块。
 *
 * 只替换四段模板字符串的内容，脚本其余部分（策略映射、解析逻辑、开关）一律不动。
 *
 * 用法：
 *   node .github/scripts/sync_rules.mjs          写入文件
 *   node .github/scripts/sync_rules.mjs --check  只检查，存在差异时以退出码 1 结束
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const target = path.join(root, 'json/Mihono/mihomoScript.js');

const SOURCES = [
  { file: 'airport', varName: 'customRuleSourceAirport' },
  { file: 'direct', varName: 'customRuleSourceDirect' },
  { file: 'outdoor', varName: 'customRuleSourceOutdoor' },
  { file: 'unsure', varName: 'customRuleSourceUnsure' },
];

/** 读取规则文件：去 BOM、统一换行、去首尾空白 */
function readRuleFile(file) {
  const filePath = path.join(root, 'Rule', file);
  if (!fs.existsSync(filePath)) {
    throw new Error(`找不到规则文件：Rule/${file}`);
  }

  const text = fs
    .readFileSync(filePath, 'utf8')
    .replace(/^\uFEFF/, '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+$/gm, '')
    .replace(/\s+$/, '');

  // 规则文本会原样嵌入模板字符串，反引号或 ${ 会破坏脚本
  if (text.includes('`')) {
    throw new Error(`Rule/${file} 含有反引号（\`），无法安全嵌入模板字符串`);
  }
  if (text.includes('${')) {
    throw new Error(`Rule/${file} 含有 \${ 序列，无法安全嵌入模板字符串`);
  }

  return text;
}

let source = fs.readFileSync(target, 'utf8');
let next = source;
const updated = [];

for (const { file, varName } of SOURCES) {
  const text = readRuleFile(file);
  const block = `const ${varName} = \`\n${text}\n\`;`;
  const pattern = new RegExp(`const ${varName} = \`[\\s\\S]*?\`;`);

  if (!pattern.test(next)) {
    throw new Error(`在 mihomoScript.js 中找不到 ${varName} 的定义`);
  }

  const current = next.match(pattern)[0];
  if (current !== block) {
    next = next.replace(pattern, () => block);
    updated.push(`Rule/${file} → ${varName}`);
  }
}

if (next === source) {
  console.log('规则已是最新，无需更新。');
} else if (process.argv.includes('--check')) {
  console.error('检测到未同步的规则：');
  for (const item of updated) console.error(`  - ${item}`);
  process.exit(1);
} else {
  fs.writeFileSync(target, next);
  console.log('已同步以下规则：');
  for (const item of updated) console.log(`  - ${item}`);
}
