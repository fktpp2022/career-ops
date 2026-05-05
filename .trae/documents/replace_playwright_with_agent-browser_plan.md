# Playwright 到 agent-browser 替换计划

## 1. 项目调研结论

### 1.1 当前 Playwright 使用情况分析

项目中 Playwright 有两层不同的使用：

#### A. Node.js 脚本（直接使用 Playwright 库）

| 文件 | 功能 | Playwright 使用方式 |
|------|------|---------------------|
| `check-liveness.mjs` | 检查 URL 活跃度 | `import { chromium } from 'playwright'` → `chromium.launch()` → `page.goto()` → `page.evaluate()` |
| `generate-pdf.mjs` | HTML 转 PDF | `import { chromium } from 'playwright'` → `chromium.launch()` → `page.setContent()` → `page.pdf()` |
| `doctor.mjs` | 环境检查 | 检查 Playwright chromium 是否安装 |

#### B. 模式/文档文件（术语引用）

这些文件中使用 "Playwright" 术语，但实际上指的是 `browser_navigate` + `browser_snapshot` 等 **MCP 工具**（来自 `integrated_browser` MCP 服务器）：

**核心模式文件：**
- `modes/_shared.md` - 工具配置表第 123 行：`| Playwright | Verify offers (browser_navigate + browser_snapshot)...`
- `modes/scan.md` - 扫描模式，多处使用 `browser_navigate` + `browser_snapshot`
- `modes/pipeline.md` - 管道模式，JD 提取使用
- `modes/apply.md` - 申请模式，表单填写使用
- `modes/oferta.md` - 评估模式，snapshot 使用
- `modes/auto-pipeline.md` - 自动管道模式

**多语言版本模式文件：**
| 语言 | _shared.md | pipeline.md | apply.md |
|------|------------|-------------|----------|
| German (de) | ✅ | ✅ | - |
| French (fr) | ✅ | ✅ | - |
| Japanese (ja) | ✅ | ✅ | - |
| Portuguese (pt) | ✅ | ✅ | - |
| Russian (ru) | ✅ | ✅ | ✅ |

**文档文件：**
- `CLAUDE.md` - 主文档，第 284-285 行：`browser_navigate` + `browser_snapshot`
- `README.md` 及其多语言版本
- `docs/ARCHITECTURE.md`, `docs/SETUP.md`, `docs/SCRIPTS.md`
- `GEMINI.md`
- `flake.nix`

**依赖配置：**
- `package.json` - `"playwright": "^1.58.1"`

### 1.2 agent-browser 功能分析

agent-browser 是一个 Rust 编写的 CLI 工具，提供以下核心功能：

| 功能 | agent-browser 命令 | 原 Playwright/MCP 对应 |
|------|---------------------|------------------------|
| 导航到 URL | `agent-browser open <url>` | `browser_navigate` / `page.goto()` |
| 获取页面结构 | `agent-browser snapshot -i` | `browser_snapshot` |
| 获取当前 URL | `agent-browser get url` | `page.url()` |
| 获取页面标题 | `agent-browser get title` | `page.title()` |
| 获取页面文本 | `agent-browser get text body` | `page.evaluate(() => document.body.innerText)` |
| 执行 JS | `agent-browser eval <js>` | `page.evaluate()` |
| 生成 PDF | `agent-browser pdf <path>` | `page.pdf()` |
| 截图 | `agent-browser screenshot --full` | `page.screenshot({fullPage: true})` |
| 填写表单 | `agent-browser fill @eN <text>` | `browser_type` / `page.fill()` |
| 点击元素 | `agent-browser click @eN` | `browser_click` / `page.click()` |
| 等待加载 | `agent-browser wait --load networkidle` | `page.waitForLoadState('networkidle')` |
| 关闭浏览器 | `agent-browser close` | `browser.close()` |

### 1.3 关键发现

1. **术语混淆**：项目中的 "Playwright" 实际上指的是 `integrated_browser` MCP 服务器提供的 `browser_navigate` + `browser_snapshot` 工具，而非直接使用 Playwright 库。

2. **两层使用**：
   - **Node.js 脚本层**：直接使用 Playwright 库（需要替换）
   - **模式描述层**：使用 MCP 工具，术语上称为 "Playwright"（需要更新术语和命令）

3. **替换可行性**：
   - agent-browser CLI 可以完全替代 Node.js 脚本中的 Playwright 库功能
   - 模式文件中的 MCP 工具调用需要改为 CLI 命令调用描述

---

## 2. 需要修改的文件清单

### 2.1 Node.js 脚本（高优先级）

| 文件 | 修改内容 |
|------|----------|
| `check-liveness.mjs` | 完全重写，使用 agent-browser CLI 替代 Playwright 库 |
| `generate-pdf.mjs` | 完全重写，使用 agent-browser CLI 替代 Playwright 库 |
| `doctor.mjs` | 更新检查逻辑，从检查 Playwright 改为检查 agent-browser |
| `package.json` | 移除 `playwright` 依赖，添加 agent-browser 相关说明 |

### 2.2 核心模式文件（高优先级）

| 文件 | 修改内容 |
|------|----------|
| `modes/_shared.md` | 更新工具配置表，将 "Playwright" 替换为 "agent-browser"，更新命令说明 |
| `modes/scan.md` | 更新所有 `browser_navigate` + `browser_snapshot` 为 agent-browser 命令 |
| `modes/pipeline.md` | 更新 JD 提取流程描述 |
| `modes/apply.md` | 更新表单自动化描述 |
| `modes/oferta.md` | 更新 Posting Legitimacy 中的 snapshot 描述 |
| `modes/auto-pipeline.md` | 更新 JD 提取方式描述 |

### 2.3 多语言模式文件（中优先级）

| 语言 | 文件 |
|------|------|
| German | `modes/de/_shared.md`, `modes/de/pipeline.md` |
| French | `modes/fr/_shared.md`, `modes/fr/pipeline.md` |
| Japanese | `modes/ja/_shared.md`, `modes/ja/pipeline.md` |
| Portuguese | `modes/pt/_shared.md`, `modes/pt/pipeline.md` |
| Russian | `modes/ru/_shared.md`, `modes/ru/pipeline.md`, `modes/ru/apply.md` |

### 2.4 文档文件（低优先级）

| 文件 | 修改内容 |
|------|----------|
| `CLAUDE.md` | 更新 "Offer Verification" 部分，替换 Playwright 为 agent-browser |
| `README.md` | 更新依赖说明和安装步骤 |
| `docs/ARCHITECTURE.md` | 更新技术栈描述 |
| `docs/SETUP.md` | 更新安装指南 |
| `docs/SCRIPTS.md` | 更新脚本说明 |
| `GEMINI.md` | 更新工具描述 |
| `flake.nix` | 移除 Playwright 相关配置（如有） |

---

## 3. 修改步骤

### Phase 1: Node.js 脚本替换

#### 3.1 重写 check-liveness.mjs

**原 Playwright 逻辑：**
```javascript
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const response = await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2000);
const finalUrl = page.url();
const bodyText = await page.evaluate(() => document.body.innerText);
// ... 提取 apply controls
await browser.close();
```

**新 agent-browser 逻辑：**
```javascript
// 使用 child_process 调用 agent-browser CLI
import { exec } from 'child_process';
import { promisify } from 'util';
const execAsync = promisify(exec);

// 1. 打开 URL
await execAsync(`agent-browser open "${url}"`);

// 2. 等待加载
await execAsync('agent-browser wait --load networkidle');
await execAsync('agent-browser wait 2000'); // 额外等待 SPA  hydration

// 3. 获取信息
const { stdout: finalUrl } = await execAsync('agent-browser get url');
const { stdout: title } = await execAsync('agent-browser get title');
const { stdout: bodyText } = await execAsync('agent-browser get text body');

// 4. 获取 snapshot 分析 apply controls
const { stdout: snapshot } = await execAsync('agent-browser snapshot -i');

// 5. 关闭
await execAsync('agent-browser close');
```

**关键改动点：**
- 移除 `playwright` import
- 使用 `child_process.exec` 调用 agent-browser CLI
- 使用 `agent-browser snapshot -i` 替代 `page.evaluate()` 获取页面元素
- `classifyLiveness` 逻辑保持不变（复用 `liveness-core.mjs`）

#### 3.2 重写 generate-pdf.mjs

**原 Playwright 逻辑：**
```javascript
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.setContent(html, { waitUntil: 'networkidle', baseURL: ... });
await page.evaluate(() => document.fonts.ready);
const pdfBuffer = await page.pdf({ format: 'a4', printBackground: true, margin: {...} });
await browser.close();
```

**新 agent-browser 逻辑：**
```javascript
// agent-browser 可以直接从 URL 或通过 set-content 生成 PDF

// 方案 A：使用临时 HTML 文件 + file:// URL
import { writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

const tempHtmlPath = join(tmpdir(), `cv-${Date.now()}.html`);
await writeFile(tempHtmlPath, html, 'utf-8');

// 使用 agent-browser 生成 PDF
await execAsync(`agent-browser --allow-file-access open "file://${tempHtmlPath}"`);
await execAsync('agent-browser wait --load networkidle');
await execAsync(`agent-browser pdf "${outputPath}"`);
await execAsync('agent-browser close');

// 或者使用 agent-browser 的 page.pdf 等价功能
```

**关键改动点：**
- ATS 文本归一化逻辑（`normalizeTextForATS`）保持不变
- 需要处理 `file://` URL 访问权限（使用 `--allow-file-access`）
- 字体加载等待：使用 `agent-browser wait` 或依赖 `networkidle`
- 页面设置（viewport、margin）：agent-browser 可能需要不同的配置方式

#### 3.3 更新 doctor.mjs

**原检查逻辑：**
```javascript
async function checkPlaywright() {
  try {
    const { chromium } = await import('playwright');
    const execPath = chromium.executablePath();
    if (existsSync(execPath)) {
      return { pass: true, label: 'Playwright chromium installed' };
    }
    // ...
  } catch {
    // ...
  }
}
```

**新检查逻辑：**
```javascript
async function checkAgentBrowser() {
  try {
    const { stdout, stderr } = await execAsync('agent-browser --version');
    if (stdout || stderr) {
      // 检查浏览器是否安装
      const { stdout: doctorOut } = await execAsync('agent-browser doctor');
      // 解析 doctor 输出判断是否就绪
      return { pass: true, label: `agent-browser installed (${stdout.trim()})` };
    }
  } catch {
    return {
      pass: false,
      label: 'agent-browser not installed',
      fix: [
        'Install: npm install -g agent-browser',
        'Then run: agent-browser install'
      ]
    };
  }
}
```

### Phase 2: 核心模式文件更新

#### 3.4 更新 modes/_shared.md

**原工具配置表（第 117-129 行）：**
```markdown
### Tools

| Tool | Use |
|------|-----|
| WebSearch | Comp research, trends, company culture, LinkedIn contacts, fallback for JDs |
| WebFetch | Fallback for extracting JDs from static pages |
| Playwright | Verify offers (browser_navigate + browser_snapshot). **NEVER 2+ agents with Playwright in parallel.** |
| Read | cv.md, _profile.md, article-digest.md, cv-template.html |
| Write | Temporary HTML for PDF, applications.md, reports .md |
| Edit | Update tracker |
| Canva MCP | Optional visual CV generation. Duplicate base design, edit text, export PDF. Requires `canva_resume_design_id` in profile.yml. |
| Bash | `node generate-pdf.mjs` |
```

**新工具配置表：**
```markdown
### Tools

| Tool | Use |
|------|-----|
| WebSearch | Comp research, trends, company culture, LinkedIn contacts, fallback for JDs |
| WebFetch | Fallback for extracting JDs from static pages |
| agent-browser | Verify offers, extract JDs from SPAs, form automation. Commands: `agent-browser open`, `agent-browser snapshot -i`, `agent-browser pdf`, `agent-browser fill/click`. **NEVER 2+ agents with agent-browser in parallel.** |
| Read | cv.md, _profile.md, article-digest.md, cv-template.html |
| Write | Temporary HTML for PDF, applications.md, reports .md |
| Edit | Update tracker |
| Canva MCP | Optional visual CV generation. Duplicate base design, edit text, export PDF. Requires `canva_resume_design_id` in profile.yml. |
| Bash | `node generate-pdf.mjs`, `agent-browser` commands |
```

#### 3.5 更新 modes/scan.md

**原描述（第 30 行）：**
> Navegar a su `careers_url` con Playwright (`browser_navigate` + `browser_snapshot`)

**新描述：**
> Navegar a su `careers_url` con agent-browser: `agent-browser open <url>` + `agent-browser snapshot -i`

**原工作流程（第 77-78 行）：**
```
a. `browser_navigate` a la `careers_url`
b. `browser_snapshot` para leer todos los job listings
```

**新工作流程：**
```
a. `agent-browser open <careers_url>` 导航到页面
b. `agent-browser wait --load networkidle` 等待加载
c. `agent-browser snapshot -i` 获取交互式元素列表
d. 如需更多内容：`agent-browser scroll down 1000` + 再次 snapshot
```

#### 3.6 更新 modes/pipeline.md

**原描述（第 10 行）：**
> b. **Extraer JD** usando Playwright (browser_navigate + browser_snapshot) → WebFetch → WebSearch

**新描述：**
> b. **Extraer JD** usando agent-browser (`agent-browser open` + `agent-browser snapshot -i`) → WebFetch → WebSearch

**原 JD 检测策略（第 36 行）：**
> 1. **Playwright (preferido):** `browser_navigate` + `browser_snapshot`. Funciona con todas las SPAs.

**新策略：**
> 1. **agent-browser (preferido):** `agent-browser open <url>` + `agent-browser wait --load networkidle` + `agent-browser snapshot -i`. Funciona con todas las SPAs.

### Phase 3: 多语言模式文件更新

需要对以下语言版本进行相同的术语更新：

- **German (de)**: `_shared.md`, `pipeline.md`
- **French (fr)**: `_shared.md`, `pipeline.md`
- **Japanese (ja)**: `_shared.md`, `pipeline.md`
- **Portuguese (pt)**: `_shared.md`, `pipeline.md`
- **Russian (ru)**: `_shared.md`, `pipeline.md`, `apply.md`

**关键替换模式：**
| 原术语 | 新术语 |
|--------|--------|
| Playwright | agent-browser |
| `browser_navigate` | `agent-browser open` |
| `browser_snapshot` | `agent-browser snapshot -i` |
| `browser_click` | `agent-browser click` |
| `browser_type` | `agent-browser fill` |

### Phase 4: 文档和依赖更新

#### 3.7 更新 package.json

**原依赖：**
```json
{
  "dependencies": {
    "@google/generative-ai": "^0.21.0",
    "dotenv": "^16.4.5",
    "js-yaml": "^4.1.1",
    "playwright": "^1.58.1"
  }
}
```

**新依赖：**
```json
{
  "dependencies": {
    "@google/generative-ai": "^0.21.0",
    "dotenv": "^16.4.5",
    "js-yaml": "^4.1.1"
  },
  "engines": {
    "node": ">=18.0.0"
  },
  "optionalDependencies": {},
  "peerDependencies": {},
  "devDependencies": {}
}
```

**注意**：agent-browser 是全局 CLI 工具，不通过 npm 安装为项目依赖。需要在 README 中说明安装步骤。

#### 3.8 更新 CLAUDE.md

**原 "Offer Verification" 部分（第 281-289 行）：**
```markdown
## Offer Verification -- MANDATORY

**NEVER trust WebSearch/WebFetch to verify if an offer is still active.** ALWAYS use Playwright:
1. `browser_navigate` to the URL
2. `browser_snapshot` to read content
3. Only footer/navbar without JD = closed. Title + description + Apply = active.

**Exception for batch workers (`claude -p`):** Playwright is not available in headless pipe mode. Use WebFetch as fallback and mark the report header with `**Verification:** unconfirmed (batch mode)`. The user can verify manually later.
```

**新描述：**
```markdown
## Offer Verification -- MANDATORY

**NEVER trust WebSearch/WebFetch to verify if an offer is still active.** ALWAYS use agent-browser:
1. `agent-browser open <url>` to navigate to the URL
2. `agent-browser wait --load networkidle` to wait for SPA hydration
3. `agent-browser snapshot -i` to read interactive elements
4. Only footer/navbar without JD = closed. Title + description + Apply button = active.

**Exception for batch workers (`claude -p`):** agent-browser may not be available in headless pipe mode. Use WebFetch as fallback and mark the report header with `**Verification:** unconfirmed (batch mode)`. The user can verify manually later.
```

---

## 4. 潜在依赖和注意事项

### 4.1 agent-browser 安装要求

用户需要全局安装 agent-browser：
```bash
# npm
npm install -g agent-browser

# Homebrew (macOS)
brew install agent-browser

# Cargo (Rust)
cargo install agent-browser

# 安装浏览器
agent-browser install
```

### 4.2 功能对应关系

| Playwright 功能 | agent-browser 替代 | 注意事项 |
|-----------------|-------------------|----------|
| `page.goto(url)` | `agent-browser open <url>` | 需等待加载完成 |
| `page.waitForLoadState('networkidle')` | `agent-browser wait --load networkidle` | 支持多种加载状态 |
| `page.waitForTimeout(ms)` | `agent-browser wait <ms>` | 毫秒数 |
| `page.url()` | `agent-browser get url` | |
| `page.title()` | `agent-browser get title` | |
| `page.evaluate(() => document.body.innerText)` | `agent-browser get text body` | |
| `page.evaluate(js)` | `agent-browser eval <js>` | |
| `page.pdf({...})` | `agent-browser pdf <path>` | 配置选项可能不同 |
| `page.screenshot({fullPage: true})` | `agent-browser screenshot --full` | |
| `browser.close()` | `agent-browser close` | |

### 4.3 PDF 生成配置差异

Playwright 的 `page.pdf()` 支持详细配置：
- `format`: 'a4' | 'letter'
- `printBackground`: boolean
- `margin`: { top, right, bottom, left }
- `preferCSSPageSize`: boolean

agent-browser 的 `pdf` 命令可能需要通过其他方式配置（如 viewport、CSS 样式等）。需要测试确认。

### 4.4 并行执行限制

原规则：**NEVER 2+ agents with Playwright in parallel**

新规则：**NEVER 2+ agents with agent-browser in parallel**

原因：agent-browser 使用守护进程模式，多个并发调用可能共享同一浏览器实例，导致冲突。

---

## 5. 风险处理

### 5.1 高风险项

| 风险 | 缓解措施 |
|------|----------|
| agent-browser PDF 生成功能与 Playwright 行为不一致 | 先创建测试脚本验证 PDF 输出质量，对比原 Playwright 输出 |
| 快照解析逻辑变化（`browser_snapshot` → `agent-browser snapshot -i`） | 更新 `check-liveness.mjs` 时，保持 `classifyLiveness` 核心逻辑不变，只调整输入数据提取方式 |
| 多语言文件翻译准确性 | 保持原有句式结构，只替换术语和命令，避免语义变化 |

### 5.2 测试计划

**测试 check-liveness.mjs：**
```bash
# 测试活跃 URL
node check-liveness.mjs https://example.com

# 测试 404 URL
node check-liveness.mjs https://example.com/notfound

# 测试批量 URL
node check-liveness.mjs --file urls.txt
```

**测试 generate-pdf.mjs：**
```bash
# 使用测试 HTML 生成 PDF
node generate-pdf.mjs test.html output.pdf --format=a4

# 对比原 Playwright 输出
# 检查：字体渲染、页面边距、背景打印、分页
```

**测试 doctor.mjs：**
```bash
npm run doctor
# 验证 agent-browser 检查是否正常工作
```

### 5.3 回滚方案

如果替换后出现问题，可以快速回滚：

1. **恢复 package.json：**
   ```bash
   npm install playwright@^1.58.1
   ```

2. **恢复脚本文件：**
   - 使用 Git 恢复 `check-liveness.mjs`、`generate-pdf.mjs`、`doctor.mjs`

3. **恢复模式文件：**
   - 使用 Git 恢复 `modes/` 目录

---

## 6. 执行顺序建议

```
Phase 1: Node.js 脚本（必须按顺序）
├── 1.1 重写 check-liveness.mjs
├── 1.2 重写 generate-pdf.mjs
├── 1.3 更新 doctor.mjs
├── 1.4 测试脚本功能
└── 1.5 更新 package.json 依赖

Phase 2: 核心模式文件
├── 2.1 更新 modes/_shared.md
├── 2.2 更新 modes/scan.md
├── 2.3 更新 modes/pipeline.md
├── 2.4 更新 modes/apply.md
├── 2.5 更新 modes/oferta.md
└── 2.6 更新 modes/auto-pipeline.md

Phase 3: 多语言模式文件
├── 3.1 German (de)
├── 3.2 French (fr)
├── 3.3 Japanese (ja)
├── 3.4 Portuguese (pt)
└── 3.5 Russian (ru)

Phase 4: 文档更新
├── 4.1 更新 CLAUDE.md
├── 4.2 更新 README.md
├── 4.3 更新 docs/ 目录
└── 4.4 更新 flake.nix（如有）
```

---

## 7. 成功标准

替换完成后，验证以下标准：

1. **依赖清理**：`package.json` 中无 `playwright` 依赖
2. **脚本可执行**：
   - `node check-liveness.mjs <url>` 正常工作
   - `node generate-pdf.mjs input.html output.pdf` 生成正确的 PDF
   - `npm run doctor` 所有检查通过
3. **模式文件更新**：所有 "Playwright" 术语替换为 "agent-browser"
4. **命令更新**：所有 `browser_*` 命令替换为对应的 `agent-browser` 命令
5. **文档一致性**：所有文档反映新的工具链
