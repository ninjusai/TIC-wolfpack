---
title: "Bookingtimes.com Content Creation Emulator — Problem Definition"
version: "0.1.0"
status: draft
last-updated: "2026-04-02"
author: framer
project: bookingtimes-content-emulator
problem-id: PRB-bookingtimes-content-emulator-001
source: intake-brief.json
---

# Problem Definition: Bookingtimes.com Content Creation Emulator

## 1. Problem Statement

Managing content across 5 driving school websites on the bookingtimes.com booking platform in Queensland, Australia is painful and manual. The platform is a booking system, not a CMS — its WYSIWYG editor is basic, there is no visibility into available CSS classes or styles, and there is no way to preview styled content before deploying to the live site.

Previous attempts at template-based batch content creation produced insufficient quality. Creating and maintaining consistent, high-quality content at scale across all 5 sites requires repetitive manual work with no feedback loop on how content will actually render.

### Core Pain Points

1. **No style visibility.** The platform does not expose which CSS classes or styles are available, forcing blind trial-and-error when styling content.
2. **No preview capability.** Content cannot be previewed in context before it goes live, meaning errors are only discovered after deployment to production.
3. **Manual repetition at scale.** The same or similar content must be manually created and maintained across 5 separate sites with no tooling for reuse or batch operations.
4. **Quality gap in batch generation.** Prior template-based approaches failed to produce content of acceptable quality, indicating that simple find-and-replace templating is insufficient.
5. **No version control.** Changes cannot be tracked or rolled back, making iterative content improvement risky.

## 2. Scope

### In Scope

- Discovering and cataloguing available styles from live bookingtimes.com sites by scraping CSS and class information
- Rendering a preview of content as it would appear on the real bookingtimes.com site, providing a feedback loop before deployment
- Iterative content generation with an AI assistant — generate, review, provide feedback, regenerate — until content meets quality standards
- A template system supporting defined sections, per-section style rules, and content randomization/variation
- Producing export-ready output that can be directly pasted into the bookingtimes.com WYSIWYG editor
- Tracking content versions with the ability to roll back to previous states
- Batch generation of localized suburb-specific pages from a list of suburbs, incorporating local data and datasets for each target location
- Understanding the capabilities and constraints of the bookingtimes.com platform through its knowledge base

### Out of Scope

- Direct programmatic integration with bookingtimes.com (no API exists on the platform)
- Multi-user collaboration features or role-based access control
- Any booking, scheduling, or business operations management
- Mobile-optimized editing interfaces
- User authentication systems

## 3. Users

### Persona 1: Business Owner (Primary)

- **Role:** Owner/operator of all 5 driving school businesses
- **Goal:** Efficiently create, preview, and deploy high-quality styled content across all 5 sites without manual repetition
- **Context:** Currently does all content work manually through the bookingtimes.com WYSIWYG editor. Is the sole content manager across all sites. Needs to produce suburb-specific pages at scale and maintain consistent branding/quality.
- **Frequency of use:** Regular — ongoing content creation and maintenance across 5 sites

### Persona 2: Staff / Delegated Site Managers (Secondary)

- **Role:** Select individuals with full access to specific sites
- **Goal:** Create and update content on their assigned sites using the same tooling
- **Context:** Small number of trusted users. No need for permission differentiation in the initial version — all users have full access to all capabilities.
- **Frequency of use:** Occasional — as directed by the business owner

## 4. Success Criteria

| # | Criterion | Measurement | Testable |
|---|-----------|-------------|----------|
| SC-1 | Exported content uses only CSS classes that are verified to exist on the live bookingtimes.com site | Validate every class name in exported output against the scraped class catalogue from the live site. Pass condition: zero unknown or unverified classes. | Yes |
| SC-2 | Preview rendering closely matches the actual bookingtimes.com site rendering | Side-by-side visual comparison (screenshot-based) between the emulator preview and the same content rendered on bookingtimes.com. Pass condition: consistent layout, typography, and spacing with no major visual discrepancies. | Yes |
| SC-3 | Batch-generated suburb pages all pass content and structural validation | Automated checks on every generated page: (a) no placeholder tokens or template variables remain, (b) suburb-specific local data is present and accurate, (c) output structure conforms to template rules. Pass condition: 100% of generated pages pass all checks. | Yes |

## 5. Constraints

- **No deadline pressure.** The project ships when it is ready — quality over speed.
- **No platform API.** All interaction with bookingtimes.com is through scraping (read) and manual copy-paste (write). There is no programmatic write path to the platform.
- **Internal tool.** This is used by a small known group, not the public. No authentication system is required.
- **AI integration.** Content generation uses a conversational AI assistant via an OAuth-based connection. The tool is internal, so no separate credential management is needed.

## 6. Assumptions

| # | Assumption | Impact If Wrong |
|---|-----------|----------------|
| A-1 | The CSS classes and styles on bookingtimes.com sites are relatively stable and do not change frequently without notice. | **High.** If styles change frequently, scraped class catalogues become stale quickly, breaking SC-1. Would require a freshness/re-scraping strategy and possibly change detection alerts. |
| A-2 | The bookingtimes.com WYSIWYG editor accepts raw HTML paste without stripping or transforming significant markup. | **Critical.** If the editor sanitizes or restructures pasted HTML, the entire export workflow breaks. Must be validated early. The degree of HTML transformation tolerance defines what output formats are viable. |
| A-3 | All 5 driving school sites on bookingtimes.com share a common or substantially overlapping set of CSS classes and styles. | **Medium.** If sites have divergent style sets, templates and generated content cannot be reused across sites without per-site style mapping, significantly increasing complexity. |
| A-4 | Suburb-specific local data (names, distances, landmarks, demographics, etc.) is available in a structured or semi-structured form that can be fed into the generation pipeline. | **Medium.** If local data must be manually researched per suburb, batch generation loses much of its value. Need to identify data sources and their coverage early. |
| A-5 | The existing 5 sites represent the full scope of sites to be managed. No rapid expansion to many more sites is planned. | **Low.** If the number of sites grows significantly, the tool may need features like site grouping, bulk operations across sites, or more sophisticated template inheritance — but the core workflow remains valid. |
| A-6 | A small, trusted user base means that concurrent editing conflicts are not a practical concern. | **Low.** If usage patterns change and multiple people edit simultaneously, data corruption or overwrites could occur. Mitigated by the small user count and explicit out-of-scope decision on collaboration features. |
| A-7 | "Closely matches" for visual preview (SC-2) means layout, typography, and spacing fidelity, not pixel-perfect rendering. | **Medium.** If the business owner expects pixel-perfect match, the effort required for the emulator increases dramatically. Need to agree on acceptable visual deviation thresholds. |

## 7. Background & Prior Art

- **Previous template system.** A prior attempt at template-based batch content creation was made but produced insufficient quality. The specific failure modes are not documented in the intake — understanding why it failed (e.g., too rigid, no style awareness, no preview, poor content quality) would inform the design of the replacement.
- **Existing sites.** 5 driving school websites are already live on bookingtimes.com, providing both the target environment and a source of truth for styles and rendering behaviour.

## 8. Open Questions

| # | Question | Why It Matters |
|---|----------|---------------|
| OQ-1 | What exactly does the bookingtimes.com WYSIWYG editor accept when HTML is pasted? Does it strip tags, classes, inline styles, or specific elements? | Directly determines what the export format can contain. If the editor strips classes, the entire CSS-class-based approach may need to pivot to inline styles. (See Assumption A-2.) |
| OQ-2 | Why did the previous template-based system produce "insufficient quality"? What were the specific failure modes? | Understanding past failures prevents repeating them. Was it content quality, structural issues, styling problems, or lack of localization? |
| OQ-3 | How are the 5 sites structured on bookingtimes.com? Do they share a theme/template, or does each have independent styling? | Affects whether a single style catalogue works across all sites or whether per-site catalogues and templates are needed. (See Assumption A-3.) |
| OQ-4 | What local data sources exist for the suburb pages? Is there a defined list of suburbs, and what per-suburb data is available? | The batch generation feature depends on having structured local data. If this data doesn't exist yet, its creation becomes a prerequisite. (See Assumption A-4.) |
| OQ-5 | How frequently do styles or layouts change on the bookingtimes.com platform? | Determines how aggressively scraped styles need to be refreshed and whether change detection is needed. (See Assumption A-1.) |
| OQ-6 | What does "randomization" mean in the context of the template system? Random selection from a set of approved variants? Dynamic content variation per page? | Affects template system design complexity significantly. |
| OQ-7 | What constitutes "local data and datasets" for suburb pages? Are these existing structured datasets, or data that needs to be researched/compiled? | Determines whether a data pipeline is needed upstream of the content generation pipeline. |
| OQ-8 | What is the acceptable threshold for "closely matches" in SC-2 visual comparison? What level of rendering deviation is tolerable? | Without a defined threshold, SC-2 becomes subjectively testable. Need agreement on what "close enough" means. (See Assumption A-7.) |
