---
name: "career-ops"
description: "AI job search command center -- evaluate offers, generate CVs, scan portals, track applications. Invoke when user wants to manage job applications, evaluate offers, generate CVs, or use any job search related functionality."
---

# career-ops -- Router

## Interaction Strategy

Use `AskUserQuestion` tool for structured dialogue. This provides a menu-driven experience instead of text-based command lists.

### When to use AskUserQuestion:
1. **Discovery mode**: No specific command provided → present full menu of options
2. **Ambiguous input**: User input could be interpreted multiple ways
3. **Confirmations**: Before irreversible or resource-intensive operations
4. **Gathering required info**: When a mode needs additional context

### AskUserQuestion Pattern:
```
AskUserQuestion({
  questions: [{
    question: "<clear question>",
    header: "<short label>",
    options: [
      { label: "<option1>", description: "<what it does>" },
      { label: "<option2>", description: "<what it does>" }
    ],
    multiSelect: false
  }],
  answers: [{ selected_options: ["<recommended option>"] }]
})
```

---

## Mode Routing

| Input | Mode | Description |
|-------|------|-------------|
| (empty / no specific command) | `discovery` | Show **full interactive menu** |
| JD text or URL (no sub-command) | `auto-pipeline` | Full evaluation pipeline (with confirmation) |
| `oferta` | `oferta` | Evaluate single offer (A-F scoring) |
| `ofertas` | `ofertas` | Compare and rank multiple offers |
| `contacto` | `contacto` | LinkedIn outreach: find contacts + draft message |
| `deep` | `deep` | Deep company research |
| `pdf` | `pdf` | Generate ATS-optimized CV PDF |
| `training` | `training` | Evaluate course/cert against North Star |
| `project` | `project` | Evaluate portfolio project idea |
| `tracker` | `tracker` | Application status overview |
| `pipeline` | `pipeline` | Process pending URLs from inbox |
| `apply` | `apply` | Live application assistant |
| `scan` | `scan` | Scan portals for new offers |
| `batch` | `batch` | Batch processing with parallel workers |
| `patterns` | `patterns` | Analyze rejection patterns |
| `followup` | `followup` | Follow-up cadence tracker |

**Auto-pipeline detection**: If input is not a known sub-command AND contains JD keywords ("responsibilities", "requirements", "qualifications", "about the role") or a URL, execute `auto-pipeline` confirmation flow.

---

## Discovery Mode (First Interaction - Full Menu)

When no specific command is provided, **show all available options** grouped by category:

```
AskUserQuestion({
  questions: [{
    question: "What would you like to do with career-ops?",
    header: "Action",
    options: [
      { label: "Evaluate a job offer", description: "Paste JD or URL for full A-F scoring + legitimacy check" },
      { label: "Compare multiple offers", description: "Compare and rank 2+ job offers side by side" },
      { label: "Scan for new offers", description: "Scan configured portals for new opportunities" },
      { label: "Generate CV PDF", description: "Create ATS-optimized CV, optionally tailored to a JD" },
      { label: "Process pending URLs", description: "Evaluate offers saved in your pipeline inbox" },
      { label: "Check application status", description: "View tracker, update statuses, see statistics" },
      { label: "Apply to a job", description: "Live assistance filling out application forms" },
      { label: "Deep company research", description: "Detailed research about a specific company" },
      { label: "Evaluate training/cert", description: "Assess if a course or certification is worth it" },
      { label: "Evaluate project idea", description: "Assess if a portfolio project will help your job search" },
      { label: "Batch processing", description: "Evaluate multiple offers in parallel" },
      { label: "Analyze rejections", description: "Find patterns in your rejections and improve targeting" },
      { label: "Follow-up tracker", description: "Check follow-up status and generate reminder drafts" },
      { label: "LinkedIn outreach", description: "Find contacts at a company and draft outreach messages" }
    ],
    multiSelect: false
  }],
  answers: [{ selected_options: ["Evaluate a job offer"] }]
})
```

### Follow-up Actions Based on Selection:

| Selection | Next Step |
|-----------|-----------|
| Evaluate a job offer | Ask: "Please provide the job description or URL" |
| Compare multiple offers | Ask: "Please provide the job descriptions or URLs to compare" |
| Scan for new offers | Confirm: "Ready to scan all configured portals?" → options: [Start now, View config first] |
| Generate CV PDF | Ask: "Tailor to a specific JD?" → options: [Yes (provide JD), No (generic)] |
| Process pending URLs | Load pipeline mode, show pending count |
| Check application status | Load tracker mode, show overview |
| Apply to a job | Ask: "Please provide the application URL or form details" |
| Deep company research | Ask: "Which company would you like to research?" |
| Evaluate training/cert | Ask: "Please provide the course details or URL" |
| Evaluate project idea | Ask: "Describe the portfolio project you're considering" |
| Batch processing | Confirm: "This may take several minutes. Proceed?" |
| Analyze rejections | Load patterns mode |
| Follow-up tracker | Load followup mode |
| LinkedIn outreach | Ask: "Which company and role are you targeting?" |

---

## Auto-pipeline Confirmation Flow

When user pastes a JD or URL:

```
AskUserQuestion({
  questions: [{
    question: "Detected a job description/URL. What would you like to do?",
    header: "Action",
    options: [
      { label: "Full pipeline (Recommended)", description: "Evaluate + report + tailored CV + update tracker" },
      { label: "Evaluation only", description: "Score only (A-F + legitimacy), no PDF" },
      { label: "Save for later", description: "Add to pipeline inbox, process later" }
    ],
    multiSelect: false
  }],
  answers: [{ selected_options: ["Full pipeline (Recommended)"] }]
})
```

---

## Confirmation Before Key Operations

### Before PDF Generation:
```
AskUserQuestion({
  questions: [{
    question: "Ready to generate your tailored CV PDF?",
    header: "Confirm",
    options: [
      { label: "Generate now", description: "Create ATS-optimized PDF with JD keywords" },
      { label: "Review changes first", description: "Show what will change in your CV" }
    ],
    multiSelect: false
  }],
  answers: [{ selected_options: ["Generate now"] }]
})
```

### Before Batch Processing:
```
AskUserQuestion({
  questions: [{
    question: "Batch processing will evaluate multiple offers. This may take several minutes.",
    header: "Confirm",
    options: [
      { label: "Start batch", description: "Evaluate all pending offers" },
      { label: "Process subset", description: "Choose which offers to evaluate now" }
    ],
    multiSelect: false
  }],
  answers: [{ selected_options: ["Start batch"] }]
})
```

---

## Context Loading by Mode

After determining mode and gathering info via AskUserQuestion, load necessary files:

### Modes requiring `_shared.md` + mode file:
Read `modes/_shared.md` + `modes/{mode}.md`

Applies to: `auto-pipeline`, `oferta`, `ofertas`, `pdf`, `contacto`, `apply`, `pipeline`, `scan`, `batch`

### Standalone modes (only mode file):
Read `modes/{mode}.md`

Applies to: `tracker`, `deep`, `training`, `project`, `patterns`, `followup`

### Modes delegated to subagent:
For `scan`, `apply` (with Playwright), and `pipeline` (3+ URLs):
```
Agent(
  subagent_type="general-purpose",
  prompt="[modes/_shared.md]\n\n[modes/{mode}.md]\n\n[invocation data]",
  description="career-ops {mode}"
)
```

Execute instructions from loaded mode file.

---

## Fallback Strategy

If `AskUserQuestion` is unavailable, fall back to text-based menu:

```
career-ops -- Command Center

Available commands:
  /career-ops {JD}      → AUTO-PIPELINE: evaluate + report + PDF + tracker
  /career-ops pipeline  → Process pending URLs
  /career-ops oferta    → Evaluation only A-F
  /career-ops ofertas   → Compare multiple offers
  /career-ops contacto  → LinkedIn outreach
  /career-ops deep      → Deep company research
  /career-ops pdf       → Generate CV PDF
  /career-ops training  → Evaluate course/cert
  /career-ops project   → Evaluate portfolio project
  /career-ops tracker   → Application status
  /career-ops apply     → Live application assistant
  /career-ops scan      → Scan portals
  /career-ops batch     → Batch processing
  /career-ops patterns  → Analyze rejections
  /career-ops followup  → Follow-up tracker
```
