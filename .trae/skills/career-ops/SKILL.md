---
name: "career-ops"
description: "AI job search command center -- evaluate offers, generate CVs, scan portals, track applications. Invoke when user wants to manage job applications, evaluate offers, generate CVs, or use any job search related functionality."
---

# career-ops -- Router

## Interaction Strategy

Use `AskUserQuestion` tool for structured dialogue with users. This provides a more intuitive, menu-driven experience instead of text-based command lists.

### When to use AskUserQuestion:
1. **Discovery mode**: When no specific command is provided, present a menu of options
2. **Ambiguous input**: When user input could be interpreted multiple ways
3. **Confirmations**: Before executing irreversible or resource-intensive operations
4. **Gathering required info**: When a mode needs additional context before execution

---

## Mode Routing

Determine the mode from user input:

| Input | Mode |
|-------|------|
| (empty / no specific command) | `discovery` -- Show interactive menu via AskUserQuestion |
| JD text or URL (no sub-command) | **`auto-pipeline`** (with confirmation) |
| `oferta` | `oferta` |
| `ofertas` | `ofertas` |
| `contacto` | `contacto` |
| `deep` | `deep` |
| `pdf` | `pdf` |
| `training` | `training` |
| `project` | `project` |
| `tracker` | `tracker` |
| `pipeline` | `pipeline` |
| `apply` | `apply` |
| `scan` | `scan` |
| `batch` | `batch` |
| `patterns` | `patterns` |
| `followup` | `followup` |

**Auto-pipeline detection:** If user input is not a known sub-command AND contains JD text (keywords: "responsibilities", "requirements", "qualifications", "about the role", "we're looking for", company name + role) or a URL to a JD, execute `auto-pipeline` confirmation flow.

If user input is not a sub-command AND doesn't look like a JD, show discovery menu.

---

## Discovery Mode (no arguments)

Instead of showing a text menu, use `AskUserQuestion` to present an interactive menu:

```
AskUserQuestion({
  questions: [
    {
      question: "What would you like to do with career-ops?",
      header: "Action",
      options: [
        {
          label: "Evaluate a job offer",
          description: "Paste a job description or URL to get a full evaluation (A-F scoring + legitimacy check)"
        },
        {
          label: "Scan for new offers",
          description: "Scan configured job portals and discover new opportunities matching your profile"
        },
        {
          label: "Generate CV PDF",
          description: "Create an ATS-optimized CV tailored to a specific job description"
        },
        {
          label: "Check application status",
          description: "View your application tracker and update statuses"
        }
      ],
      multiSelect: false
    }
  ],
  answers: [
    {
      selected_options: ["Evaluate a job offer"]
    }
  ]
})
```

### Follow-up based on selection:

**If "Evaluate a job offer" is selected:**
Ask for the job description or URL:
```
AskUserQuestion({
  questions: [
    {
      question: "Please provide the job description or URL you want to evaluate:",
      header: "Job Info",
      options: [
        {
          label: "I'll paste the JD text",
          description: "Copy and paste the complete job description"
        },
        {
          label: "I have a URL",
          description: "Provide a link to the job posting"
        }
      ],
      multiSelect: false
    }
  ],
  answers: [
    {
      selected_options: ["I'll paste the JD text"]
    }
  ]
})
```

**If "Scan for new offers" is selected:**
Confirm before starting the scan:
```
AskUserQuestion({
  questions: [
    {
      question: "Ready to scan for new job offers?",
      header: "Confirm",
      options: [
        {
          label: "Start scan now",
          description: "Scan all configured portals and add new offers to your pipeline"
        },
        {
          label: "View configuration first",
          description: "Check which companies and portals are configured before scanning"
        }
      ],
      multiSelect: false
    }
  ],
  answers: [
    {
      selected_options: ["Start scan now"]
    }
  ]
})
```

**If "Generate CV PDF" is selected:**
Ask for the job description to tailor the CV:
```
AskUserQuestion({
  questions: [
    {
      question: "Do you have a specific job description to tailor the CV for?",
      header: "Tailor CV",
      options: [
        {
          label: "Yes, use this JD",
          description: "Optimize keywords and framing for a specific role"
        },
        {
          label: "No, generate generic CV",
          description: "Create a standard CV without job-specific optimization"
        }
      ],
      multiSelect: false
    }
  ],
  answers: [
    {
      selected_options: ["Yes, use this JD"]
    }
  ]
})
```

**If "Check application status" is selected:**
Load tracker mode and display current status.

---

## Auto-pipeline Confirmation Flow

When user pastes a JD or URL (auto-pipeline detection), confirm before executing the full pipeline:

```
AskUserQuestion({
  questions: [
    {
      question: "I detected a job description/URL. What would you like to do?",
      header: "Action",
      options: [
        {
          label: "Full pipeline (Recommended)",
          description: "Evaluate + generate report + create tailored CV PDF + update tracker"
        },
        {
          label: "Evaluation only",
          description: "Just score the offer (A-F) and check legitimacy, no PDF generation"
        },
        {
          label: "Add to pipeline for later",
          description: "Save this URL to your pipeline inbox and process it later"
        }
      ],
      multiSelect: false
    }
  ],
  answers: [
    {
      selected_options: ["Full pipeline (Recommended)"]
    }
  ]
})
```

### Based on user selection:
- **Full pipeline**: Execute `auto-pipeline` mode (evaluate + report + PDF + tracker)
- **Evaluation only**: Execute `oferta` mode
- **Add to pipeline**: Add URL to `data/pipeline.md` and confirm with user

---

## Mode-Specific Structured Dialogues

### PDF Mode
When user selects `pdf` mode or asks to generate a CV:

1. **Check for JD context**:
   - If JD already in context → confirm tailoring
   - If no JD → ask if they want to provide one

```
AskUserQuestion({
  questions: [
    {
      question: "How would you like to generate your CV?",
      header: "CV Style",
      options: [
        {
          label: "ATS-optimized PDF",
          description: "Clean single-column layout, maximum ATS compatibility (fast)"
        },
        {
          label: "Visual Canva CV",
          description: "Use your Canva resume template for a more visual design"
        }
      ],
      multiSelect: false
    }
  ],
  answers: [
    {
      selected_options: ["ATS-optimized PDF"]
    }
  ]
})
```

### Scan Mode
Before executing a scan:

```
AskUserQuestion({
  questions: [
    {
      question: "Scan configuration:",
      header: "Scan Options",
      options: [
        {
          label: "Full scan",
          description: "All tracked companies + all search queries (comprehensive but slower)"
        },
        {
          label: "Quick scan",
          description: "Only tracked companies with direct career page URLs (faster)"
        }
      ],
      multiSelect: false
    }
  ],
  answers: [
    {
      selected_options: ["Full scan"]
    }
  ]
})
```

### Oferta (Evaluation) Mode
When evaluating a single offer:

1. **After evaluation but before saving report**:
```
AskUserQuestion({
  questions: [
    {
      question: "Evaluation complete. What would you like to do next?",
      header: "Next Steps",
      options: [
        {
          label: "Generate tailored CV",
          description: "Create an ATS-optimized CV for this specific role"
        },
        {
          label: "Save report only",
          description: "Just save the evaluation report without generating a PDF"
        },
        {
          label: "Discard this offer",
          description: "Score too low, don't save to tracker"
        }
      ],
      multiSelect: false
    }
  ],
  answers: [
    {
      selected_options: ["Generate tailored CV"]
    }
  ]
})
```

### Tracker Mode
When updating application status:

```
AskUserQuestion({
  questions: [
    {
      question: "What would you like to do with your applications?",
      header: "Tracker Action",
      options: [
        {
          label: "View current status",
          description: "See all applications with their current status and scores"
        },
        {
          label: "Update a status",
          description: "Change the status of an existing application"
        },
        {
          label: "View statistics",
          description: "See summary metrics: total applications, success rate, average score"
        }
      ],
      multiSelect: false
    }
  ],
  answers: [
    {
      selected_options: ["View current status"]
    }
  ]
})
```

---

## Confirmation Before Irreversible Actions

### Before Generating PDF (resource-intensive):
```
AskUserQuestion({
  questions: [
    {
      question: "Ready to generate your tailored CV PDF?",
      header: "Confirm",
      options: [
        {
          label: "Generate now",
          description: "Create ATS-optimized PDF with JD keywords injected"
        },
        {
          label: "Review changes first",
          description: "Show me what will change in my CV before generating"
        }
      ],
      multiSelect: false
    }
  ],
  answers: [
    {
      selected_options: ["Generate now"]
    }
  ]
})
```

### Before Batch Processing:
```
AskUserQuestion({
  questions: [
    {
      question: "Batch processing will evaluate multiple offers. This may take several minutes.",
      header: "Batch Confirm",
      options: [
        {
          label: "Start batch processing",
          description: "Evaluate all pending offers in the pipeline"
        },
        {
          label: "Process subset only",
          description: "Let me choose which offers to evaluate now"
        }
      ],
      multiSelect: false
    }
  ],
  answers: [
    {
      selected_options: ["Start batch processing"]
    }
  ]
})
```

---

## Context Loading by Mode

After determining the mode and gathering any required information via AskUserQuestion, load the necessary files before executing:

### Modes that require `_shared.md` + their mode file:
Read `modes/_shared.md` + `modes/{mode}.md`

Applies to: `auto-pipeline`, `oferta`, `ofertas`, `pdf`, `contacto`, `apply`, `pipeline`, `scan`, `batch`

### Standalone modes (only their mode file):
Read `modes/{mode}.md`

Applies to: `tracker`, `deep`, `training`, `project`, `patterns`, `followup`

### Modes delegated to subagent:
For `scan`, `apply` (with Playwright), and `pipeline` (3+ URLs): launch as Agent with the content of `_shared.md` + `modes/{mode}.md` injected into the subagent prompt.

```
Agent(
  subagent_type="general-purpose",
  prompt="[content of modes/_shared.md]\n\n[content of modes/{mode}.md]\n\n[invocation-specific data]",
  description="career-ops {mode}"
)
```

Execute the instructions from the loaded mode file.

---

## Fallback Strategy

If AskUserQuestion is not available or fails, fall back to the original text-based menu approach as described in the discovery section. Always provide a clear text-based alternative for users who prefer command-line style interaction.
