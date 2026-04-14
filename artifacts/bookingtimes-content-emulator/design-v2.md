---
title: "Design V2: Multi-Brand AI Content Platform"
version: "0.1.0"
status: draft
created: "2026-04-02"
author: architect
project: bookingtimes-content-emulator
type: design-thinking-document
---

# Design V2: Multi-Brand AI Content Platform

## 1. Problem Reframe

### What we thought we were building

A content emulator -- a tool that scrapes CSS from bookingtimes.com sites, lets an AI generate HTML using those classes, previews it in an iframe, and exports it for pasting into a WYSIWYG editor. Essentially a sophisticated clipboard tool with an AI assistant.

### What this system actually wants to be

A **brand-aware content factory** with institutional memory.

The core insight is this: the user does not want to generate content and then forget everything. Every piece of content created for "Affordable Driving School Brisbane" teaches the system something about that brand -- its tone, its preferred phrases, its visual patterns, what works and what does not. Today that knowledge lives exclusively in the user's head. The system should capture and compound it.

The real problem is not "generating HTML." It is **scaling the user's judgment across 5 brands and 50+ suburbs without diluting brand identity or quality.**

This reframes every technical decision. The CSS scraper, the iframe preview, the template system -- those are plumbing. The hard problem is: how does a system develop taste for a brand it has never seen before, and how does that taste improve over time without manual curation becoming the bottleneck?

### The machine this describes

```
           INPUT                    TRANSFORMATION                OUTPUT
    
    [Brand Identity]  ─────>  [Context-Aware AI]  ─────>  [Branded Content]
    [Suburb Data]              with accumulated               validated
    [User Intent]              brand knowledge                against CSS
    [Feedback]                                                catalogue
         │                                                       │
         └───────── Learning Loop (feedback → rules) ────────────┘
```

This is not a CMS. It is not a template engine. It is a **brand knowledge amplifier** -- a system that takes a small number of human-provided signals (voice guidelines, feedback on generated content, explicit rules) and applies them consistently at scale.

---

## 2. Core Tensions

These are the fundamental trade-offs in the design space. They cannot be resolved -- only navigated.

### T1: Autonomy vs. Control

The system should generate content without hand-holding, but the user must remain in control. Too autonomous and it produces off-brand content. Too controlled and it is just a sophisticated text box.

**Navigation:** Start controlled (templates, explicit rules), earn autonomy through accumulated feedback. The system should propose, not decide.

### T2: Memory Growth vs. Prompt Efficiency

Every piece of brand knowledge makes the system smarter but also makes each Claude call more expensive and slower. The system prompt cannot grow forever.

**Navigation:** Tiered memory (see Section 7). Hot knowledge in the prompt, warm knowledge queryable on demand, cold knowledge in the database. The system must be an aggressive curator of its own context.

### T3: Brand Isolation vs. Shared Learning

The 5 sites are all driving schools in Queensland. They share domain knowledge (road rules, licensing process, common suburb characteristics). But they must not share voice. "Affordable" speaks differently than "Metro."

**Navigation:** Separate brand identity from domain knowledge. Domain knowledge is shared. Brand voice is isolated. Never cross-pollinate voice; freely cross-pollinate facts.

### T4: Structure vs. Emergence

Templates provide structure (consistent section ordering, required elements). But the best content often emerges from the user discovering what works through iteration. Too rigid and the system fights the user. Too loose and batch generation becomes unreliable.

**Navigation:** Templates define structure. Brand profiles define voice. Rules emerge from use and are captured, not prescribed. Templates answer "what sections?" Brand profiles answer "how should they sound?"

### T5: Single-Turn Constraint vs. Continuous Learning

Each Claude CLI call is a fresh subprocess with no memory. The system must simulate continuity from discrete, stateless calls. This is not a fundamental limitation -- it is a design constraint that shapes every decision about state management.

**Navigation:** The application is the memory. Claude is the muscle. Never ask Claude to remember -- always tell it what it needs to know.

---

## 3. Architectural Patterns

### 3.1 Pattern: Retrieval-Augmented Generation (RAG) -- Adapted

The classic RAG pattern (query a knowledge base, inject context, generate) applies but with a twist. Instead of retrieving from documents, we retrieve from **brand state**: accumulated rules, examples, and feedback for a specific brand.

**Application here:** Before each Claude call, the prompt builder queries the brand profile database and constructs a focused context window. This is already partially implemented in `prompt-builder.ts` with class selection budgets. Extend it to brand knowledge.

### 3.2 Pattern: Expert Profile / Persona System

Multi-agent systems use "profiles" to specialize behavior. Each profile carries a system prompt, constraints, and examples.

**Application here:** One profile per brand-site, not per specialist role. The user is not asking 5 different writers to produce content. They are asking one writer to speak in 5 different voices. A "brand profile" is the right abstraction -- it carries voice, style rules, preferred examples, and anti-patterns.

Why not specialist roles (Designer, Writer, Localizer, QA)? Because the CLI subprocess constraint makes multi-agent coordination expensive (each is a separate process). The prompt builder can encode specialist knowledge (design constraints, localization rules, QA checks) directly. One call, one profile, one output.

### 3.3 Pattern: Template Inheritance / Cascade

CSS has cascading specificity. Templates can follow the same pattern:

```
Global defaults (all sites, all pages)
  └── Domain defaults (driving school content in QLD)
       └── Site-specific overrides (Affordable's voice)
            └── Page-type overrides (suburb landing page)
                 └── Instance overrides (Springfield specifically)
```

**Application here:** Template rules and brand knowledge merge through a cascade. Global rules set the floor. Brand profiles override where they diverge. Suburb-specific notes override further. The prompt builder resolves the cascade before constructing the system prompt.

### 3.4 Pattern: Feedback Capture Loop (Active Learning Lite)

Full active learning requires a model that updates its weights. We cannot do that with Claude. But we can capture feedback as structured rules that modify future prompts.

```
Generate content → User reviews → User provides feedback
                                         │
                  ┌──────────────────────┘
                  ▼
     Is this feedback brand-level or instance-level?
          │                        │
          ▼                        ▼
     Add to brand profile     Apply to this page only
     (affects all future       (one-time adjustment)
      content for this brand)
```

**Application here:** After each feedback cycle, the system asks: "Should this apply to future content for this brand?" If yes, extract a rule and add it to the brand profile. If no, treat it as a one-time edit.

### 3.5 Pattern: Content Pipeline with Validation Gates

Industrial content systems (newspapers, marketing platforms) use staged pipelines:

```
Draft → Structural Check → Brand Check → Export Check → Approved
```

**Application here:** Already partially implemented in the batch pipeline (generate, validate classes, review gate). Extend to include brand voice validation -- does this content sound like this brand?

---

## 4. Proposed Mental Model

### How the user should think about the system

**"I am training 5 content assistants, one per brand. Each assistant starts knowing nothing about my brand. As I work with it -- generating content, giving feedback, setting rules -- it gets better. After 20 pages, it should know how Affordable talks. After 50 pages, it should rarely need correction."**

The key metaphor is **apprenticeship**, not automation. The system is not a factory that stamps out content. It is an apprentice that learns the user's preferences for each brand through practice.

### Workflow from the user's perspective

1. **Choose a brand** (site). The system loads that brand's profile.
2. **Start creating** content. Choose a template, a suburb, a page type.
3. **Generate** -- the AI produces a draft using the brand profile + template rules + suburb data.
4. **Review and refine** -- the user provides feedback, the AI adjusts.
5. **Capture learning** -- if the feedback is reusable ("never say 'cheap', always say 'affordable'"), it becomes a brand rule.
6. **Approve and export** -- validated content goes to the clipboard.
7. **Repeat** -- each cycle, the brand profile gets richer, the AI gets better.

For batch operations, the user trusts the accumulated brand profile to generate 50 suburb pages with minimal review. If many pages need the same correction, that is a signal to add a new brand rule and regenerate.

---

## 5. Key Abstractions

### The Right Nouns

| Abstraction | What It Represents | Persisted Where |
|---|---|---|
| **Site** | A bookingtimes.com site (URL, CSS catalogue, theme). Technical identity. | `sites` table |
| **Brand Profile** | The accumulated voice, style, and rules for a site. Creative identity. | New: `brand_profiles` table + `brand_rules` table |
| **Template** | Structural definition of a page type (sections, ordering, required elements). | `templates` + `template_sections` tables |
| **Rule** | An explicit instruction derived from feedback or manual entry. Attached to a brand or globally. | New: `brand_rules` table |
| **Example** | A piece of approved content that exemplifies the brand's voice. Few-shot fuel. | New: `brand_examples` table |
| **Page** | A specific piece of content (brand + template + suburb). | `pages` table |
| **Version** | A snapshot of a page's content at a point in time. | `page_versions` table |
| **Session** | A conversation thread for creating/refining a page. | `ai_sessions` + `ai_turns` tables |
| **Suburb** | Location data for a target area. | `suburb_data` table |

### New Tables

```sql
-- Brand profile: one per site, grows over time
CREATE TABLE brand_profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id INTEGER NOT NULL UNIQUE REFERENCES sites(id),
  voice_description TEXT,         -- e.g., "Friendly, professional, never aggressive"
  target_audience TEXT,           -- e.g., "First-time learners, parents of teens"
  key_differentiators TEXT,       -- e.g., "Cheapest in Brisbane, experienced instructors"
  tone_keywords TEXT,             -- JSON array: ["approachable", "confident", "local"]
  anti_patterns TEXT,             -- JSON array: phrases/patterns to avoid
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Brand rules: emergent rules captured from feedback
CREATE TABLE brand_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id INTEGER REFERENCES sites(id),  -- NULL = global rule (all brands)
  category TEXT NOT NULL CHECK (category IN (
    'voice', 'structure', 'terminology', 'seo', 'localization', 'visual'
  )),
  rule_text TEXT NOT NULL,               -- Human-readable rule
  priority INTEGER DEFAULT 0,           -- Higher = more important
  source TEXT NOT NULL CHECK (source IN (
    'manual', 'feedback', 'inferred'
  )),
  source_session_id TEXT,                -- Session where rule was learned
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Brand examples: approved content snippets for few-shot learning
CREATE TABLE brand_examples (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id INTEGER NOT NULL REFERENCES sites(id),
  section_type TEXT,                     -- e.g., "hero", "intro", "cta"
  html_content TEXT NOT NULL,
  quality_rating INTEGER CHECK (quality_rating BETWEEN 1 AND 5),
  notes TEXT,                            -- Why this is a good example
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### Why These Abstractions

**Site vs. Brand Profile:** Separation of concerns. Site is technical (CSS, URL, scraping). Brand Profile is creative (voice, rules, examples). They happen to be 1:1 today but the abstraction is cleaner separate.

**Rules vs. Examples:** Two modes of brand knowledge. Rules are prescriptive ("always do X"). Examples are demonstrative ("here is what good looks like"). Both inform the AI but in different ways -- rules go into the system prompt as constraints, examples go in as few-shot demonstrations.

**Global vs. Brand Rules:** Some rules apply everywhere ("never use bare element selectors" -- already a platform constraint). Some rules apply to one brand. The `site_id` nullable FK handles this cleanly.

---

## 6. Workflow Diagrams

### 6.1 Content Creation Flow (Single Page)

```
User selects Site + Template + Suburb
         │
         ▼
┌─────────────────────────────┐
│ CONTEXT ASSEMBLY            │
│                             │
│ 1. Load brand profile       │
│ 2. Load active brand rules  │
│ 3. Load top-N examples      │
│ 4. Load template rules      │
│ 5. Load suburb data         │
│ 6. Load CSS class subset    │
│ 7. Build system prompt      │
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│ CLAUDE CLI SUBPROCESS       │
│ (single-turn, stateless)    │
│                             │
│ System prompt = assembled   │
│ User prompt = intent        │
│ Output = HTML               │
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│ VALIDATION                  │
│                             │
│ 1. CSS class check          │
│ 2. HTML well-formedness     │
│ 3. Template structure match │
│ 4. Disallowed elements      │
│ 5. Brand rule compliance*   │
│                             │
│ * = future capability       │
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│ PREVIEW + USER REVIEW       │
│                             │
│ User sees rendered preview  │
│ User can:                   │
│   [Approve] → Export        │
│   [Refine]  → Feedback loop │
│   [Reject]  → Regenerate    │
└──────────────┬──────────────┘
               │
          ┌────┴────┐
          ▼         ▼
     [Approve]  [Refine]
          │         │
          ▼         ▼
     Save version   Feedback → New Claude call
     + Export       with conversation history
                    + brand context
```

### 6.2 Learning Loop

```
User provides feedback on generated content
         │
         ▼
┌─────────────────────────────┐
│ FEEDBACK CLASSIFICATION     │
│                             │
│ Is this feedback:           │
│                             │
│ A) One-time fix             │
│    "Change the heading"     │
│    → Apply to this page     │
│                             │
│ B) Brand-level rule         │
│    "Never use 'cheap'"      │
│    → Save as brand rule     │
│                             │
│ C) Template-level rule      │
│    "Hero should be shorter" │
│    → Update template rules  │
│                             │
│ (Classification: manual     │
│  now, AI-assisted later)    │
└──────────────┬──────────────┘
               │
          ┌────┼────┐
          ▼    ▼    ▼
       [A]   [B]   [C]
        │     │     │
        │     ▼     ▼
        │  brand_   template_
        │  rules    sections
        │  table    table
        │     │     │
        └─────┴─────┘
               │
               ▼
     Future content generation
     includes updated rules/templates
```

### 6.3 Batch Generation Flow

```
User selects: Template + Site + Suburb list (N suburbs)
         │
         ▼
┌─────────────────────────────┐
│ BATCH JOB CREATION          │
│                             │
│ Create N job records        │
│ Status: pending             │
│ Load brand profile ONCE     │
│ Load template ONCE          │
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│ SEQUENTIAL PROCESSING       │
│ (one Claude call per suburb)│
│                             │
│ For each suburb:            │
│  1. Merge suburb data into  │
│     pre-loaded context      │
│  2. Select template variant │
│     (deterministic shuffle) │
│  3. Call Claude CLI          │
│  4. Validate output         │
│  5. If valid → save version │
│     If invalid → retry (x3) │
│  6. Update job status       │
│  7. Next suburb             │
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│ BATCH REVIEW                │
│                             │
│ Dashboard shows all results │
│ Green = passed validation   │
│ Yellow = warnings           │
│ Red = failed after 3 tries  │
│                             │
│ User reviews, approves/edits│
│ Patterns in edits →         │
│   brand rule candidates     │
└─────────────────────────────┘
```

### 6.4 Context Assembly (Prompt Construction)

```
┌──────────────────────────────────────────────────────┐
│                    SYSTEM PROMPT                      │
│                                                      │
│  ┌──── Layer 1: Platform ────────────────────────┐   │
│  │ Body-level HTML only                          │   │
│  │ No bare selectors, no script/style tags       │   │
│  │ Bootstrap 5 grid system                       │   │
│  └───────────────────────────────────────────────┘   │
│                                                      │
│  ┌──── Layer 2: Brand Profile ───────────────────┐   │
│  │ Voice: "Friendly, professional..."            │   │
│  │ Audience: "First-time learners..."            │   │
│  │ Anti-patterns: ["cheap", "guarantee pass"]    │   │
│  └───────────────────────────────────────────────┘   │
│                                                      │
│  ┌──── Layer 3: Brand Rules (top-N by priority) ─┐   │
│  │ VOICE: Always say "affordable" not "cheap"    │   │
│  │ SEO: Include suburb name in first paragraph   │   │
│  │ TERM: Use "learner driver" not "student"      │   │
│  └───────────────────────────────────────────────┘   │
│                                                      │
│  ┌──── Layer 4: Template Section ────────────────┐   │
│  │ Section: hero                                 │   │
│  │ Required classes: hero-banner, hero-title     │   │
│  │ Word count: 8-12 words                        │   │
│  │ Variant brief: "Focus on local convenience"   │   │
│  └───────────────────────────────────────────────┘   │
│                                                      │
│  ┌──── Layer 5: CSS Classes (budgeted subset) ───┐   │
│  │ Layout: container, row, col-md-6...           │   │
│  │ Typography: h2, lead, text-muted...           │   │
│  │ Components: card, btn, btn-primary...         │   │
│  └───────────────────────────────────────────────┘   │
│                                                      │
│  ┌──── Layer 6: Examples (1-2 approved snippets) ┐   │
│  │ [Example HTML from brand_examples table]      │   │
│  └───────────────────────────────────────────────┘   │
│                                                      │
│  ┌──── Layer 7: Suburb Data ─────────────────────┐   │
│  │ Suburb: Springfield, 4300, 25km from CBD      │   │
│  │ Landmarks: Springfield Central, Orion Mall    │   │
│  └───────────────────────────────────────────────┘   │
│                                                      │
│  ┌──── Layer 8: Output Format ───────────────────┐   │
│  │ Raw HTML only. No markdown. No explanations.  │   │
│  └───────────────────────────────────────────────┘   │
│                                                      │
└──────────────────────────────────────────────────────┘

            │
            ▼
    ┌──────────────┐
    │  USER PROMPT  │
    │  (intent +    │
    │   feedback +  │
    │   history     │
    │   summary)    │
    └──────────────┘
```

---

## 7. State Model

### What state lives where

| State | Location | Lifetime | Access Pattern |
|---|---|---|---|
| **Site metadata** (URL, theme, last scraped) | SQLite `sites` | Permanent | Read on every content op |
| **CSS catalogue** (class names, properties, verified) | SQLite `catalogue_classes` | Until re-scrape | Read on generate + validate |
| **Brand profile** (voice, audience, differentiators) | SQLite `brand_profiles` | Permanent, evolving | Read on every generate for this brand |
| **Brand rules** (emergent constraints) | SQLite `brand_rules` | Permanent until deactivated | Read on every generate; filtered by brand + priority |
| **Brand examples** (approved HTML snippets) | SQLite `brand_examples` | Permanent | Read on generate; top-N by quality rating |
| **Templates** (section structure, rules) | SQLite `templates` + `template_sections` | Permanent, editable | Read on generate |
| **Pages** (content instances) | SQLite `pages` + `page_versions` | Permanent | Read/write during content ops |
| **AI sessions** (conversation history) | SQLite `ai_sessions` + `ai_turns` | 90-day retention | Read during refine loop; summarized for long sessions |
| **Batch job state** | SQLite `batch_jobs` | Until batch complete + reviewed | Read/write during batch processing |
| **Suburb data** | SQLite `suburb_data` | Permanent, supplementable | Read during generate + batch |
| **Cached CSS files** | Filesystem `data/storage/` | Until re-scrape | Read by iframe preview |
| **System prompt** (assembled) | Temp file (per-call) | Duration of Claude call | Written before call, deleted after |
| **LRU class cache** | In-memory | 1hr TTL | Hot-path optimization for class lookups |

### State flow during a single Claude call

```
1. App reads from SQLite:
   brand_profiles, brand_rules, brand_examples,
   template_sections, catalogue_classes, suburb_data,
   ai_turns (recent history)

2. prompt-builder.ts assembles these into a system prompt string

3. System prompt written to temp file on disk

4. claude-cli.ts spawns subprocess with --system-prompt-file

5. Claude generates response (no state persisted in Claude)

6. Response validated, stored as page_version + ai_turn

7. Temp file deleted

8. If user provides feedback → goto 1 (new call, fresh context)
```

### Memory Tiering Strategy

As brand knowledge grows, not everything can fit in the system prompt. Use a three-tier approach:

**Hot (in system prompt, every call):**
- Brand profile summary (voice, audience, anti-patterns): ~200 tokens
- Top 10 active brand rules by priority: ~300 tokens
- 1-2 best examples for the target section type: ~400 tokens
- Template section rules: ~200 tokens
- CSS class subset: ~2000 tokens (already budgeted)
- Suburb data: ~100 tokens
- Platform constraints: ~150 tokens
- **Total: ~3,350 tokens** -- well within budget

**Warm (queryable, included on demand):**
- Full brand rule set (when user asks "why did you do X?")
- All examples for a section type (when quality is low)
- Full CSS catalogue (when unknown class errors appear)
- Extended conversation history (beyond the last 6 turns)

**Cold (archived, rarely accessed):**
- Old AI sessions (>90 days)
- Previous brand profile versions (for auditing evolution)
- Superseded brand rules (deactivated)
- Old batch job records

### When does the system prompt become too large?

At ~3,350 tokens for the hot tier, we are nowhere near Claude's context limits. The overflow strategy activates when:

- Brand rules exceed ~50 active rules: switch to top-20 by priority, summarize the rest as "and 30 additional rules about [categories]"
- Examples exceed ~10 per section type: keep top-3 by quality rating
- Conversation history exceeds ~6 turns: already handled by `summarizeHistory()`
- CSS classes: already handled by `selectClassSubset()`

**Practical ceiling estimate:** Even at maximum growth (100 rules, 50 examples, 20 conversation turns, full catalogue), the system prompt stays under 15,000 tokens. Claude's context window is 200K+. This is not a near-term risk.

---

## 8. Risk Map

### Known Risks (Carry-Forward)

| Risk | Severity | Status | Mitigation |
|---|---|---|---|
| **WYSIWYG paste strips classes** | CRITICAL | Untested | EVAL-BCE-008 must be the first manual test. Inline style fallback designed but not built. |
| **Claude CLI rate limits** | HIGH | Partially mitigated | Sequential batch processing. If Max subscription rate limits tighten, batch processing slows but does not break. |
| **D1 (SQLite) data loss** | MEDIUM | Mitigated | Local SQLite with filesystem backups. Data is reconstructible (can re-scrape, re-generate). |
| **CSS changes on bookingtimes.com** | MEDIUM | Designed for | Re-scrape capability exists. Change detection (CSS diff) is built. |

### New Risks from the Multi-Brand Evolution

| Risk | Severity | Description | Mitigation |
|---|---|---|---|
| **Brand contamination** | HIGH | Brand A's voice leaking into Brand B's content. Could happen if brand rules are misloaded, if the user switches brands mid-session, or if Claude picks up patterns from examples of the wrong brand. | Strict brand isolation in context assembly. `buildSystemPrompt()` takes a single `site_id` and loads only that brand's profile, rules, and examples. Add a validation check: does the generated content contain phrases from other brand profiles' anti-patterns? |
| **Rule explosion** | MEDIUM | As the user captures more feedback as rules, the rule set grows unboundedly. Eventually rules conflict ("always mention price" vs. "never mention specific prices"). | Rule priority system with conflict detection. When adding a new rule, check for semantic conflicts with existing rules. Surface conflicts to the user. Cap hot-tier rules at 20, require prioritization. |
| **Example quality drift** | MEDIUM | If the user marks mediocre content as "approved" to save time, examples degrade, and future content follows suit. Garbage in, garbage out. | Quality rating on examples (1-5 stars). Only 4-5 star examples used for few-shot prompting. Periodic example review prompt: "You have 15 examples for hero sections. Review and update ratings?" |
| **False learning** | MEDIUM | The system infers a "rule" from feedback that was actually a one-time edit. Example: user changes "Brisbane" to "Brisbane CBD" once, system infers "always say Brisbane CBD." | All feedback-derived rules start as "proposed" and require user confirmation before becoming active. Show proposed rules in a review queue. Never auto-activate. |
| **Session context limits** | LOW-MEDIUM | Long refinement sessions (10+ turns) accumulate large conversation histories. Each new call must replay (or summarize) the history. Eventually the history overwhelms the system prompt budget. | Already mitigated by `summarizeHistory()` in the existing code. Keep first turn + last 6 turns. Summarize middle turns. Budget: conversation history should not exceed 30% of total system prompt token budget. |
| **Batch consistency** | MEDIUM | In a batch of 50 suburb pages, tone and quality may drift because each call is independent. Suburb #1 and suburb #50 may feel like different brands if the AI's interpretation varies. | Pre-batch "calibration": generate 3 sample pages, user approves one as the reference. Include that reference as an example in all subsequent batch calls. This anchors the AI's interpretation. |

### The Unforeseeables (What We Cannot Predict)

1. **Platform changes.** Bookingtimes.com could update Bootstrap versions, change their CSS structure, or modify the WYSIWYG editor behavior. The scraper handles CSS changes, but a WYSIWYG editor overhaul could break the entire export workflow.

2. **Claude behavioral shifts.** Model updates change output characteristics. A content style that worked perfectly with `claude-sonnet-4-20250514` might shift with the next model version. Brand profiles mitigate this (explicit constraints override model tendencies), but drifts will happen.

3. **Emerging content patterns.** The user will discover content types that do not fit existing templates (testimonials pages, seasonal promotions, FAQ sections). The template system must be extensible without requiring code changes.

4. **Scale beyond 5 sites.** The user said 5 sites. But if the tool works well, it could expand to other businesses or other bookingtimes.com customers. The brand profile abstraction supports this, but the UI assumptions (sidebar with 5 items) may not.

5. **Content interdependencies.** Suburb pages are treated as independent, but they are not. If 30 suburb pages all mention "closest to Brisbane CBD", the user may want to vary this. Template variants partially address this, but cross-page coordination is a deeper problem.

6. **Regulatory content.** Driving schools in QLD may have regulatory requirements for website content (disclaimers, licensing information). These rules should be global, mandatory, and not overridable by brand rules.

---

## 9. Open Questions

### Must Decide Before Building

| # | Question | Options | Recommendation |
|---|---|---|---|
| OQ-V2-1 | How does the user create/edit brand profiles? | A) Dedicated settings page per brand. B) The system extracts profiles from initial content samples. C) Both -- seed from samples, refine manually. | **C.** Start with a manual form (name, voice, audience, differentiators, anti-patterns). Later add "import from existing content" as a convenience feature. |
| OQ-V2-2 | How are brand rules captured from feedback? | A) Manual only -- user writes rules in a settings page. B) Automatic -- system proposes rules from feedback patterns. C) Prompted -- after a refine cycle, system asks "Save this as a rule?" | **C.** Manual rules in settings (A) for deliberate rules. Prompted capture (C) during refine cycles for emergent rules. Automatic (B) is risky (false learning) and should wait. |
| OQ-V2-3 | What is the granularity of Claude calls for batch generation? | A) One call per page (full page in one shot). B) One call per section (more control, more calls, higher cost). C) Configurable. | **A.** One call per page. Sections are defined in the template and the AI generates all of them in one call. Per-section calls multiply API time by 4-6x and introduce section coherence problems. |
| OQ-V2-4 | How do we handle conversation context across refine cycles? | A) Replay full history each call. B) Summarize old turns, keep recent. C) Include only the latest content + feedback. | **B.** Already implemented in `summarizeHistory()`. Keep first turn + last 6. This balances context with cost. |
| OQ-V2-5 | Should brand profiles have versions/history? | A) No, just overwrite. B) Yes, full version history like pages. | **B** but lightweight. Store `updated_at` and keep a `brand_profile_history` table with snapshots on change. The user should be able to see how a brand's profile evolved and roll back if a bad rule was added. |

### Can Decide During Implementation

| # | Question | Notes |
|---|---|---|
| OQ-V2-6 | What categories should brand rules support? | Starting set: voice, structure, terminology, seo, localization, visual. Add more as needed. |
| OQ-V2-7 | How many examples should be included in few-shot prompts? | Start with 1-2 per section type. Measure quality impact. Adjust. |
| OQ-V2-8 | Should the batch calibration page be shown in the preview or just stored? | Preview is better for user confidence. Store for prompt injection. |
| OQ-V2-9 | How should brand rules be surfaced in the UI? | Sortable table with priority, category, source, active toggle. Filter by category. |
| OQ-V2-10 | When should CSS re-scraping happen? | Manual trigger is fine for now. Scheduled re-scrape is a future nicety. |

### Need More Information (From the User)

| # | Question | Why It Matters |
|---|---|---|
| OQ-V2-11 | What are the actual voice differences between the 5 sites? Can the user describe each brand in 2-3 sentences? | This seeds the initial brand profiles and validates the brand isolation strategy. |
| OQ-V2-12 | Are there existing content samples for each brand that the user considers "good"? | Seeds the brand examples table. Gives the AI initial few-shot context. |
| OQ-V2-13 | Does the user want to manually manage brand rules or would they prefer the system to propose rules? | Determines whether to build the rule proposal UI in the first iteration or defer it. |
| OQ-V2-14 | How much time does the user spend per page today (manually)? | Establishes the baseline for measuring productivity improvement. |
| OQ-V2-15 | The original WYSIWYG paste test (EVAL-BCE-008) -- has this been done yet? | This is still the single highest-risk item. If classes are stripped, the export architecture must change before brand features are built. |

---

## 10. Recommendation

### What to Build Next

**Do not build brand profiles yet.** Three things must happen first:

#### Step 1: Validate the Foundation (1-2 sessions)

The existing 42-item build has never been tested end-to-end with real content. Before adding brand intelligence:

1. **Run the WYSIWYG paste test** (EVAL-BCE-008). This is overdue. If classes are stripped, stop everything and pivot the export strategy.
2. **Scrape one real site.** The scraper has not been tested against a live bookingtimes.com site. Validate that CSS discovery, catalogue assembly, and preview rendering work with real data.
3. **Generate one real page.** Use the Claude CLI subprocess to generate a suburb landing page for one site. Validate the full pipeline: prompt construction, generation, validation, preview, export.

If any of these fail, fix them before proceeding.

#### Step 2: Add Brand Profiles (2-3 sessions)

Once the foundation is validated:

1. **Create the `brand_profiles` table** and a simple settings page per site. Fields: voice description, target audience, key differentiators, tone keywords, anti-patterns.
2. **Extend `prompt-builder.ts`** to include brand profile in context assembly (Layer 2 in the prompt diagram above). This is a surgical change -- add a `brandProfile` field to `PromptContext` and format it into the system prompt.
3. **Have the user fill in profiles** for all 5 sites. This is a one-time setup that immediately improves generation quality.
4. **Test** by generating the same suburb page for 2 different brands and verifying the output sounds different.

#### Step 3: Add Brand Rules (2-3 sessions)

1. **Create the `brand_rules` table** and a rules management UI (sortable table with priority, category, active toggle).
2. **Extend the prompt builder** to load and format top-N rules by priority.
3. **Add the "Save as rule?" prompt** to the refine workflow. After the user provides feedback and the AI adjusts, ask: "Should this feedback apply to future content for [Brand Name]?"
4. **Test** by adding a few rules and verifying they are consistently applied across multiple pages.

#### Step 4: Add Brand Examples (1-2 sessions)

1. **Create the `brand_examples` table** and a way to mark approved content as an example.
2. **Extend the prompt builder** to include 1-2 examples in the system prompt as few-shot demonstrations.
3. **Test** by comparing generation quality with and without examples.

#### Step 5: Batch with Brand Intelligence (2-3 sessions)

1. **Add batch calibration** -- generate 3 sample pages, user approves one as the reference.
2. **Include the reference + brand profile + brand rules** in all batch calls.
3. **Add post-batch review** with pattern detection -- "5 pages needed the same edit, propose a rule?"
4. **Test** a full batch of 50 suburbs for one brand.

### What NOT to Build

- **Multi-agent specialist profiles** (Designer, Writer, Localizer, QA). One profile per brand is sufficient. The prompt builder encodes specialist knowledge without the overhead of multi-process coordination.
- **Automatic rule inference.** Too risky for false learning. Keep rule creation human-initiated (manual or prompted, not automatic).
- **Vector embeddings for brand knowledge.** The knowledge is small and structured. A few dozen rules and examples fit in a direct SQL query. Embeddings add complexity without benefit at this scale.
- **Real-time collaboration.** One user, five brands. No concurrent editing scenarios.

---

## Appendix A: Prompt Builder Extension Sketch

The existing `prompt-builder.ts` needs minimal changes to support brand profiles. Here is a sketch of the extended `PromptContext` and `buildSystemPrompt()`:

```typescript
// Extended PromptContext
export interface PromptContext {
  site_id: string;
  available_classes: string[];
  template_rules?: TemplateSectionRule;
  suburb_data?: SuburbData;
  content_wrapper?: string;
  platform_constraints: string[];
  // NEW: Brand intelligence
  brand_profile?: BrandProfile;
  brand_rules?: BrandRule[];
  brand_examples?: BrandExample[];
}

export interface BrandProfile {
  voice_description: string;
  target_audience: string;
  key_differentiators: string;
  tone_keywords: string[];
  anti_patterns: string[];
}

export interface BrandRule {
  category: string;
  rule_text: string;
  priority: number;
}

export interface BrandExample {
  section_type: string;
  html_content: string;
  notes?: string;
}
```

The system prompt adds two new sections after Platform Constraints:

```
## Brand Voice

You are writing for [Brand Name].
Voice: [voice_description]
Target audience: [target_audience]
Key differentiators: [key_differentiators]
Tone: [tone_keywords joined]

AVOID these patterns: [anti_patterns joined]

## Brand Rules

[rules sorted by priority, formatted as bullet list]

## Examples of Good Content for This Brand

[1-2 examples with section_type labels]
```

This is approximately 400-700 additional tokens -- negligible cost.

## Appendix B: Brand Isolation Verification

To prevent brand contamination, the system should verify at two points:

1. **Input isolation:** `buildSystemPrompt()` takes a single `site_id`. All brand data queries filter by that `site_id`. No cross-brand data enters the prompt.

2. **Output verification (future):** After generation, cross-check the output against other brands' anti-patterns. If Brand A's output contains Brand B's key phrases, flag it. This is a lightweight check -- compare output text against the `anti_patterns` arrays of ALL brands, not just the target brand.

This is cheap to implement (string matching against a small set of phrases) and catches the most egregious contamination cases.
