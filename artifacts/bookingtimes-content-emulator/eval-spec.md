---
title: "Bookingtimes.com Content Creation Emulator — Eval Specification"
version: "1.0.0"
status: draft
eval-id: EVL-bookingtimes-content-emulator-001
references: PRB-bookingtimes-content-emulator-001
created: 2026-04-02
author: Eval
domain: content-management
project: bookingtimes-content-emulator
total-cases: 32
---

# Eval Specification: Bookingtimes.com Content Creation Emulator

## 1. Overview

This document defines the evaluation specification for the Bookingtimes.com Content Creation Emulator. It translates the 3 success criteria from PRB-bookingtimes-content-emulator-001 into formal, testable eval cases and adds coverage for all major subsystems: CSS scraping, export validation, preview fidelity, batch generation, template system, AI content generation, version history, and edge cases.

## 2. Eval Summary

| Category | Primary Cases | Additional Cases | Total |
|----------|---------------|------------------|-------|
| CSS Scraping | 3 | 1 | 4 |
| Export HTML Validation (SC-1) | 3 | 1 | 4 |
| Preview Fidelity (SC-2) | 3 | 1 | 4 |
| Batch Generation (SC-3) | 3 | 1 | 4 |
| Template System | 3 | 1 | 4 |
| AI Content Generation | 3 | 1 | 4 |
| Version History | 3 | 1 | 4 |
| Edge Cases | 0 | 4 | 4 |
| **Total** | **21** | **11** | **32** |

---

## 3. Eval Cases — CSS Scraping

### EVAL-BCE-001: CSS Class Catalogue Completeness

| Attribute | Value |
|-----------|-------|
| **Test ID** | EVAL-BCE-001 |
| **Category** | CSS Scraping |
| **Priority** | Critical |

**Preconditions:**
1. A live bookingtimes.com driving school site is accessible
2. Network connectivity is available for scraping
3. The scraper module is initialized with the target site URL

**Test Steps:**
1. Run the CSS scraper against one of the 5 live driving school sites
2. Collect all CSS class names referenced in the site's stylesheets and inline styles
3. Manually inspect the live site and compile a reference list of at least 20 known classes used in content areas
4. Compare the scraped catalogue against the reference list

**Expected Result:**
- The scraped catalogue contains >= 95% of the classes in the reference list
- No content-area classes are missing from the catalogue

**Pass/Fail Criteria:**
- PASS: >= 95% of reference classes present in scraped catalogue
- FAIL: < 95% coverage or any content-area class missing

**Scorer Type:** Algorithmic

**Test Data:**
```json
{
  "target_site": "bookingtimes.com/driving-school-1",
  "reference_class_count": 20,
  "coverage_threshold": 0.95
}
```

---

### EVAL-BCE-002: CSS Property Extraction Accuracy

| Attribute | Value |
|-----------|-------|
| **Test ID** | EVAL-BCE-002 |
| **Category** | CSS Scraping |
| **Priority** | Critical |

**Preconditions:**
1. CSS scraper has completed a full scan of a target site
2. A set of 10 known class-to-property mappings has been manually prepared as ground truth

**Test Steps:**
1. Run the scraper against the target site
2. For each of the 10 reference classes, extract the scraped CSS properties
3. Compare scraped properties (font-family, font-size, color, margin, padding) against ground truth

**Expected Result:**
- All 10 reference classes have their CSS properties correctly extracted
- Property values match ground truth exactly (accounting for shorthand equivalences)

**Pass/Fail Criteria:**
- PASS: 100% of reference class properties match ground truth
- FAIL: Any property mismatch or missing property

**Scorer Type:** Algorithmic

**Test Data:**
```json
{
  "reference_classes": 10,
  "properties_checked": ["font-family", "font-size", "color", "margin", "padding", "line-height"],
  "match_threshold": 1.0
}
```

---

### EVAL-BCE-003: Cross-Site Class Overlap Detection

| Attribute | Value |
|-----------|-------|
| **Test ID** | EVAL-BCE-003 |
| **Category** | CSS Scraping |
| **Priority** | Medium |

**Preconditions:**
1. CSS scraper has completed scans of all 5 driving school sites
2. Per-site class catalogues are available

**Test Steps:**
1. Run the scraper against all 5 sites
2. Compute the intersection and difference of class catalogues across all sites
3. Generate a report showing shared vs. site-specific classes
4. Verify the report accurately identifies at least 5 known shared classes and at least 1 known site-specific class

**Expected Result:**
- Overlap report is generated with shared and site-specific class sets
- Known shared classes appear in the intersection
- Known site-specific classes appear only in their respective site catalogues

**Pass/Fail Criteria:**
- PASS: All known shared classes found in intersection AND all known site-specific classes correctly isolated
- FAIL: Any misclassification of shared vs. site-specific classes

**Scorer Type:** Algorithmic

---

### EVAL-BCE-004: Scraper Resilience to CSS Changes

| Attribute | Value |
|-----------|-------|
| **Test ID** | EVAL-BCE-004 |
| **Category** | CSS Scraping |
| **Priority** | Medium |

**Preconditions:**
1. A previously scraped CSS catalogue exists (baseline)
2. A modified version of the site's CSS is available (simulated change: 3 classes renamed, 2 classes added, 1 class removed)

**Test Steps:**
1. Run the scraper against the modified CSS
2. Compare the new catalogue against the baseline
3. Verify the scraper detects and reports added, removed, and renamed classes

**Expected Result:**
- The 2 added classes appear in the new catalogue
- The 1 removed class is absent from the new catalogue
- A diff report correctly identifies all changes

**Pass/Fail Criteria:**
- PASS: Diff report correctly identifies all 6 changes (3 renames, 2 additions, 1 removal)
- FAIL: Any change missed or misreported

**Scorer Type:** Algorithmic

---

## 4. Eval Cases — Export HTML Validation (SC-1)

### EVAL-BCE-005: Zero Unknown Classes in Export

| Attribute | Value |
|-----------|-------|
| **Test ID** | EVAL-BCE-005 |
| **Source** | SC-1 |
| **Category** | Export HTML Validation |
| **Priority** | Critical |

**Preconditions:**
1. A valid CSS class catalogue has been scraped from the target site
2. Content has been created using the emulator with various styled sections
3. The content has been exported as HTML

**Test Steps:**
1. Create a content page using at least 5 different styled sections (headings, paragraphs, lists, callouts, buttons)
2. Export the content as HTML
3. Parse the exported HTML and extract every `class` attribute value
4. Validate each class name against the scraped catalogue

**Expected Result:**
- Every class name in the exported HTML exists in the scraped catalogue
- Zero unknown or unverified classes

**Pass/Fail Criteria:**
- PASS: 0 unknown classes found
- FAIL: >= 1 unknown class found

**Scorer Type:** Algorithmic

**Test Data:**
```json
{
  "section_types": ["heading", "paragraph", "list", "callout", "button"],
  "expected_unknown_classes": 0
}
```

---

### EVAL-BCE-006: Export HTML Structure Validity

| Attribute | Value |
|-----------|-------|
| **Test ID** | EVAL-BCE-006 |
| **Source** | SC-1 |
| **Category** | Export HTML Validation |
| **Priority** | Critical |

**Preconditions:**
1. Content has been created and exported as HTML
2. HTML validator is available

**Test Steps:**
1. Export a content page containing headings, paragraphs, images, lists, and styled divs
2. Validate the exported HTML for well-formedness (proper nesting, closed tags, valid attributes)
3. Verify no JavaScript, `<script>`, or `<style>` tags are present in the export (only class-based styling)
4. Verify the HTML uses only elements and attributes supported by the WYSIWYG editor

**Expected Result:**
- HTML is well-formed with zero parsing errors
- No `<script>` or `<style>` tags present
- All elements are within the expected allowlist

**Pass/Fail Criteria:**
- PASS: Zero HTML validation errors AND zero disallowed elements/tags
- FAIL: Any validation error or disallowed element

**Scorer Type:** Algorithmic

---

### EVAL-BCE-007: Multi-Site Export Class Isolation

| Attribute | Value |
|-----------|-------|
| **Test ID** | EVAL-BCE-007 |
| **Source** | SC-1 |
| **Category** | Export HTML Validation |
| **Priority** | High |

**Preconditions:**
1. CSS catalogues for all 5 sites are scraped and stored separately
2. Content has been created targeting a specific site (e.g., site 3)

**Test Steps:**
1. Select site 3 as the target site
2. Create content using the emulator
3. Export the HTML
4. Validate all classes in the export against site 3's catalogue specifically
5. Identify any classes that exist in other site catalogues but not in site 3's

**Expected Result:**
- All exported classes belong to site 3's catalogue
- No cross-site class contamination

**Pass/Fail Criteria:**
- PASS: 100% of classes found in site 3's catalogue
- FAIL: Any class not in site 3's catalogue

**Scorer Type:** Algorithmic

---

### EVAL-BCE-008: WYSIWYG Paste Acceptance

| Attribute | Value |
|-----------|-------|
| **Test ID** | EVAL-BCE-008 |
| **Source** | SC-1 / A-2 |
| **Category** | Export HTML Validation |
| **Priority** | Critical |

**Preconditions:**
1. Exported HTML is available
2. Access to the bookingtimes.com WYSIWYG editor (or a simulation of its paste behavior)

**Test Steps:**
1. Export a content page with various styled elements
2. Copy the exported HTML to the clipboard
3. Paste into the bookingtimes.com WYSIWYG editor
4. Compare the pasted result (DOM) with the original exported HTML
5. Identify any stripped tags, removed classes, or modified attributes

**Expected Result:**
- The WYSIWYG editor preserves all class attributes on pasted content
- No structural elements are stripped or modified
- Content renders with expected styling after paste

**Pass/Fail Criteria:**
- PASS: >= 95% of HTML structure and classes preserved after paste
- FAIL: < 95% preservation or any class attribute stripped

**Scorer Type:** AI Rubric (requires human-validated ground truth for WYSIWYG behavior)

---

## 5. Eval Cases — Preview Fidelity (SC-2)

### EVAL-BCE-009: Layout Fidelity — Side-by-Side Comparison

| Attribute | Value |
|-----------|-------|
| **Test ID** | EVAL-BCE-009 |
| **Source** | SC-2 |
| **Category** | Preview Fidelity |
| **Priority** | Critical |

**Preconditions:**
1. Content has been created in the emulator
2. The same content has been deployed to the live bookingtimes.com site
3. Screenshots of both the emulator preview and the live site are available

**Test Steps:**
1. Create a content page with heading, paragraph, list, and image sections
2. Capture a screenshot of the emulator preview at 1280x800 viewport
3. Deploy the same content to the live site
4. Capture a screenshot of the live site rendering at 1280x800 viewport
5. Perform structural similarity comparison (SSIM) between the two screenshots
6. Additionally, compare DOM bounding-box positions of major elements

**Expected Result:**
- SSIM score >= 0.85 between preview and live site screenshots
- All major element bounding boxes align within 10px tolerance

**Pass/Fail Criteria:**
- PASS: SSIM >= 0.85 AND all bounding box deltas <= 10px
- FAIL: SSIM < 0.85 OR any bounding box delta > 10px

**Scorer Type:** Algorithmic (SSIM) + AI Rubric (visual assessment)

**Test Data:**
```json
{
  "viewport": "1280x800",
  "ssim_threshold": 0.85,
  "bounding_box_tolerance_px": 10
}
```

---

### EVAL-BCE-010: Typography Fidelity

| Attribute | Value |
|-----------|-------|
| **Test ID** | EVAL-BCE-010 |
| **Source** | SC-2 |
| **Category** | Preview Fidelity |
| **Priority** | High |

**Preconditions:**
1. Emulator preview is rendering content with scraped CSS styles applied
2. Reference typography values (font-family, font-size, font-weight, line-height, color) are known from the live site

**Test Steps:**
1. Create content with h1, h2, h3, body text, and small/caption text
2. In the emulator preview, extract computed styles for each text element
3. Compare computed styles against the reference values from the live site

**Expected Result:**
- Font-family matches for all elements
- Font-size within 1px of live site values
- Font-weight matches exactly
- Line-height within 2px
- Color values match exactly (hex comparison)

**Pass/Fail Criteria:**
- PASS: All typography properties within stated tolerances
- FAIL: Any property outside tolerance

**Scorer Type:** Algorithmic

---

### EVAL-BCE-011: Spacing and Margins Fidelity

| Attribute | Value |
|-----------|-------|
| **Test ID** | EVAL-BCE-011 |
| **Source** | SC-2 |
| **Category** | Preview Fidelity |
| **Priority** | High |

**Preconditions:**
1. Emulator preview is rendering content with scraped CSS applied
2. Reference spacing values (margin, padding) are known from the live site

**Test Steps:**
1. Create content with multiple sections separated by spacing (headings, paragraphs, dividers)
2. Measure computed margin and padding values in the emulator preview
3. Compare against reference values from the live site

**Expected Result:**
- Margin values within 5px of live site values
- Padding values within 5px of live site values

**Pass/Fail Criteria:**
- PASS: All spacing values within 5px tolerance
- FAIL: Any spacing value outside 5px tolerance

**Scorer Type:** Algorithmic

---

### EVAL-BCE-012: Preview Refresh on Style Re-Scrape

| Attribute | Value |
|-----------|-------|
| **Test ID** | EVAL-BCE-012 |
| **Source** | SC-2 |
| **Category** | Preview Fidelity |
| **Priority** | Medium |

**Preconditions:**
1. Content exists in the emulator with an initial CSS catalogue applied
2. A re-scrape of the live site produces an updated CSS catalogue with at least 2 changed property values

**Test Steps:**
1. Note the current preview rendering (screenshot A)
2. Trigger a CSS re-scrape that picks up updated styles
3. Verify the emulator updates its preview to reflect the new styles (screenshot B)
4. Confirm screenshot B reflects the CSS changes (e.g., changed colors, font sizes)

**Expected Result:**
- Preview updates to reflect new CSS values without manual intervention
- Changed properties are visually confirmed in the updated preview

**Pass/Fail Criteria:**
- PASS: Preview reflects all CSS changes after re-scrape
- FAIL: Preview still shows stale styles

**Scorer Type:** AI Rubric (visual comparison of before/after screenshots)

---

## 6. Eval Cases — Batch Generation (SC-3)

### EVAL-BCE-013: No Placeholder Tokens in Output

| Attribute | Value |
|-----------|-------|
| **Test ID** | EVAL-BCE-013 |
| **Source** | SC-3 |
| **Category** | Batch Generation |
| **Priority** | Critical |

**Preconditions:**
1. A template with placeholder tokens (e.g., `{{suburb_name}}`, `{{distance_to_cbd}}`, `{{local_landmark}}`) is configured
2. A batch of at least 10 suburbs with complete local data is available

**Test Steps:**
1. Run batch generation for 10 suburbs
2. For each generated page, scan the full HTML output for any remaining placeholder patterns: `{{...}}`, `{...}`, `[PLACEHOLDER]`, `[TBD]`, `INSERT_`, `TODO`, `XXX`
3. Also scan for the literal template variable names (e.g., the string "suburb_name" without surrounding data)

**Expected Result:**
- Zero placeholder tokens or template variables remain in any generated page
- All 10 pages contain only resolved, human-readable content

**Pass/Fail Criteria:**
- PASS: 0 placeholder tokens across all 10 pages
- FAIL: >= 1 placeholder token in any page

**Scorer Type:** Algorithmic

**Test Data:**
```json
{
  "suburb_count": 10,
  "placeholder_patterns": ["\\{\\{.*?\\}\\}", "\\[PLACEHOLDER\\]", "\\[TBD\\]", "INSERT_", "TODO", "XXX"],
  "expected_matches": 0
}
```

---

### EVAL-BCE-014: Suburb-Specific Local Data Accuracy

| Attribute | Value |
|-----------|-------|
| **Test ID** | EVAL-BCE-014 |
| **Source** | SC-3 |
| **Category** | Batch Generation |
| **Priority** | Critical |

**Preconditions:**
1. Local data for at least 5 suburbs is available with verified ground truth (suburb name, region, distance, landmarks)
2. Batch generation has completed for these 5 suburbs

**Test Steps:**
1. For each generated page, extract the suburb name, distance, and landmark references
2. Compare extracted values against the ground truth dataset
3. Verify no data cross-contamination (suburb A's page does not contain suburb B's data)

**Expected Result:**
- Each page contains the correct suburb name
- Distance and landmark references match ground truth
- No cross-contamination between suburbs

**Pass/Fail Criteria:**
- PASS: 100% data accuracy across all 5 pages AND zero cross-contamination
- FAIL: Any incorrect data or cross-contamination

**Scorer Type:** Algorithmic

**Test Data:**
```json
{
  "suburbs": [
    {"name": "Springfield", "distance_cbd": "25km", "landmark": "Springfield Lakes"},
    {"name": "Ipswich", "distance_cbd": "40km", "landmark": "Queens Park"},
    {"name": "Toowoomba", "distance_cbd": "125km", "landmark": "Picnic Point"},
    {"name": "Caboolture", "distance_cbd": "50km", "landmark": "Caboolture River"},
    {"name": "Redcliffe", "distance_cbd": "35km", "landmark": "Redcliffe Jetty"}
  ]
}
```

---

### EVAL-BCE-015: Batch Output Structure Conformance

| Attribute | Value |
|-----------|-------|
| **Test ID** | EVAL-BCE-015 |
| **Source** | SC-3 |
| **Category** | Batch Generation |
| **Priority** | Critical |

**Preconditions:**
1. A template defining required sections (hero, intro, services, local-info, cta) with ordering rules is configured
2. Batch generation has completed for at least 10 suburbs

**Test Steps:**
1. For each generated page, parse the HTML structure
2. Verify all required sections are present
3. Verify sections appear in the specified order
4. Verify each section conforms to its structural rules (e.g., hero has heading + subheading, services has list of >= 3 items)

**Expected Result:**
- All 10 pages contain all required sections in the correct order
- Each section passes its structural validation rules

**Pass/Fail Criteria:**
- PASS: 100% of pages pass all structural checks
- FAIL: Any page missing a section, wrong order, or failing structural rules

**Scorer Type:** Algorithmic

---

### EVAL-BCE-016: Batch Scale — 50 Suburbs

| Attribute | Value |
|-----------|-------|
| **Test ID** | EVAL-BCE-016 |
| **Source** | SC-3 |
| **Category** | Batch Generation |
| **Priority** | High |

**Preconditions:**
1. Local data for 50 suburbs is available
2. Template and generation pipeline are configured

**Test Steps:**
1. Run batch generation for all 50 suburbs
2. Apply all checks from EVAL-BCE-013, EVAL-BCE-014, and EVAL-BCE-015 to every page
3. Measure total generation time
4. Verify no duplicate pages (each page is unique to its suburb)

**Expected Result:**
- All 50 pages pass placeholder, data accuracy, and structural checks
- No two pages are identical
- Generation completes within a reasonable time (< 5 minutes per page average)

**Pass/Fail Criteria:**
- PASS: 100% of pages pass all checks AND no duplicates AND average generation time < 5 min/page
- FAIL: Any page fails checks OR duplicate found OR timeout

**Scorer Type:** Algorithmic

---

## 7. Eval Cases — Template System

### EVAL-BCE-017: Section Definition and Rendering

| Attribute | Value |
|-----------|-------|
| **Test ID** | EVAL-BCE-017 |
| **Category** | Template System |
| **Priority** | High |

**Preconditions:**
1. A template with 5 defined sections is configured, each with specific HTML structure and CSS class rules

**Test Steps:**
1. Load the template
2. Render each section independently
3. Verify each section's output matches its defined structure
4. Verify CSS classes applied match the section's style rules

**Expected Result:**
- Each section renders with the correct HTML structure
- CSS classes match the template's section-level rules

**Pass/Fail Criteria:**
- PASS: All 5 sections render correctly with correct classes
- FAIL: Any section misrendered or wrong classes applied

**Scorer Type:** Algorithmic

---

### EVAL-BCE-018: Content Randomization / Variation

| Attribute | Value |
|-----------|-------|
| **Test ID** | EVAL-BCE-018 |
| **Category** | Template System |
| **Priority** | High |

**Preconditions:**
1. A template section is configured with 4 approved content variants for the intro paragraph
2. Batch generation is configured for 20 suburbs

**Test Steps:**
1. Generate pages for 20 suburbs using the template
2. Extract the intro paragraph from each page
3. Verify that at least 3 of the 4 variants are used across the 20 pages
4. Verify no intro paragraph is a verbatim duplicate of another (allowing for suburb-specific substitutions)
5. Verify every intro paragraph is one of the 4 approved variants (no hallucinated variants)

**Expected Result:**
- At least 3 of 4 variants appear across 20 pages
- Distribution is not pathologically skewed (no variant used more than 40% of the time)
- All paragraphs are approved variants (post-substitution)

**Pass/Fail Criteria:**
- PASS: >= 3 variants used AND no variant > 40% usage AND all variants from approved set
- FAIL: < 3 variants OR skew > 40% OR unapproved variant

**Scorer Type:** Algorithmic

---

### EVAL-BCE-019: Per-Section Style Rules Enforcement

| Attribute | Value |
|-----------|-------|
| **Test ID** | EVAL-BCE-019 |
| **Category** | Template System |
| **Priority** | High |

**Preconditions:**
1. Template defines style rules per section: e.g., hero section must use `.hero-banner` class, services section must use `.service-list` class, CTA must use `.btn-primary` class
2. Content has been generated

**Test Steps:**
1. Generate a page using the template
2. Parse the output HTML
3. For each section, verify the required classes are present on the appropriate elements
4. Verify no section uses classes designated for a different section (no cross-section class leakage)

**Expected Result:**
- Each section contains its required classes
- No cross-section class contamination

**Pass/Fail Criteria:**
- PASS: All section class rules satisfied AND zero cross-section contamination
- FAIL: Any missing required class or cross-section leak

**Scorer Type:** Algorithmic

---

### EVAL-BCE-020: Template Reuse Across Sites

| Attribute | Value |
|-----------|-------|
| **Test ID** | EVAL-BCE-020 |
| **Category** | Template System |
| **Priority** | Medium |

**Preconditions:**
1. A template is configured as reusable across sites
2. CSS catalogues for 2 sites are loaded, with a known shared class set and site-specific classes

**Test Steps:**
1. Apply the same template to site 1 and site 2
2. Verify shared sections use shared classes correctly on both sites
3. Verify site-specific sections use the correct site-specific classes
4. Verify no site-1-specific class appears in site-2 output and vice versa

**Expected Result:**
- Shared classes used correctly on both sites
- Site-specific classes correctly isolated

**Pass/Fail Criteria:**
- PASS: Correct class selection for both sites
- FAIL: Any class misapplied to wrong site

**Scorer Type:** Algorithmic

---

## 8. Eval Cases — AI Content Generation

### EVAL-BCE-021: Initial Generation Quality

| Attribute | Value |
|-----------|-------|
| **Test ID** | EVAL-BCE-021 |
| **Category** | AI Content Generation |
| **Priority** | High |

**Preconditions:**
1. AI assistant (Claude via OAuth) is connected
2. A content brief is provided: "Write an intro paragraph for a driving school page targeting Springfield, QLD"
3. Template section rules and style constraints are loaded

**Test Steps:**
1. Submit the content brief to the AI assistant
2. Receive the generated content
3. Evaluate against quality rubric:
   - Relevance: mentions Springfield and driving school
   - Tone: professional, approachable
   - Length: 50-150 words
   - Structure: single cohesive paragraph
   - Accuracy: no factual errors about Springfield, QLD

**Expected Result:**
- Generated content scores >= 4/5 on each rubric dimension
- Content is usable without major rewrites

**Pass/Fail Criteria:**
- PASS: All 5 rubric dimensions score >= 4/5
- FAIL: Any dimension < 4/5

**Scorer Type:** AI Rubric

**Rubric:**
```yaml
dimensions:
  relevance:
    5: Explicitly mentions Springfield and driving school context
    4: Mentions location or driving context but not both explicitly
    3: Generic driving school content, location vaguely implied
    2: Partially relevant
    1: Off-topic
  tone:
    5: Professional, welcoming, confident
    4: Generally appropriate tone with minor issues
    3: Acceptable but bland
    2: Inappropriate tone for a business page
    1: Clearly wrong tone
  length:
    5: 50-150 words
    4: 30-49 or 151-200 words
    3: 20-29 or 201-250 words
    2: Very short or very long
    1: < 10 or > 300 words
  structure:
    5: Single well-formed paragraph, logical flow
    4: Good structure, minor flow issues
    3: Acceptable structure
    2: Disjointed or poorly structured
    1: Incoherent
  accuracy:
    5: All facts about Springfield correct
    4: Minor inaccuracy or unverifiable claim
    3: One factual error
    2: Multiple errors
    1: Significantly wrong facts
```

---

### EVAL-BCE-022: Iterative Refinement Loop

| Attribute | Value |
|-----------|-------|
| **Test ID** | EVAL-BCE-022 |
| **Category** | AI Content Generation |
| **Priority** | High |

**Preconditions:**
1. AI assistant is connected
2. An initial content generation has been completed (from EVAL-BCE-021)
3. Specific feedback is prepared: "Make it more conversational and mention the nearby Springfield Lakes area"

**Test Steps:**
1. Submit the feedback to the AI assistant along with the original content
2. Receive the revised content
3. Verify the revision addresses the feedback:
   a. Tone is more conversational than the original
   b. Springfield Lakes is mentioned
4. Verify the revision preserves strengths of the original (no regression)
5. Verify the revision still conforms to template section rules

**Expected Result:**
- Feedback items are addressed (conversational tone, Springfield Lakes mentioned)
- No quality regression from the original
- Output still conforms to template rules

**Pass/Fail Criteria:**
- PASS: All feedback items addressed AND no regression AND template compliance
- FAIL: Any feedback item not addressed OR quality regression OR template non-compliance

**Scorer Type:** AI Rubric

---

### EVAL-BCE-023: AI Output HTML Conformance

| Attribute | Value |
|-----------|-------|
| **Test ID** | EVAL-BCE-023 |
| **Category** | AI Content Generation |
| **Priority** | Critical |

**Preconditions:**
1. AI assistant is generating content with HTML markup
2. CSS class catalogue and template rules are provided to the AI as context

**Test Steps:**
1. Request the AI to generate a full content section with HTML markup
2. Validate the generated HTML:
   a. All class names exist in the CSS catalogue
   b. HTML is well-formed
   c. No inline styles are used (unless explicitly allowed by template rules)
   d. No disallowed tags (script, style, iframe)
3. Verify the output conforms to the template section structure

**Expected Result:**
- AI-generated HTML uses only verified CSS classes
- HTML is well-formed
- No inline styles or disallowed tags
- Structure matches template definition

**Pass/Fail Criteria:**
- PASS: Zero class violations AND zero structural errors AND no disallowed elements
- FAIL: Any violation

**Scorer Type:** Algorithmic + AI Rubric (for content quality of the HTML)

---

### EVAL-BCE-024: AI Content Uniqueness Across Suburbs

| Attribute | Value |
|-----------|-------|
| **Test ID** | EVAL-BCE-024 |
| **Category** | AI Content Generation |
| **Priority** | High |

**Preconditions:**
1. AI-generated content exists for at least 10 different suburbs
2. All content was generated from the same template and brief structure

**Test Steps:**
1. Extract the main content body from each of the 10 suburb pages
2. Compute pairwise text similarity (cosine similarity on TF-IDF vectors)
3. Verify that no two pages have similarity > 0.80 (accounting for structural template overlap)
4. Verify each page contains suburb-specific details unique to its target suburb

**Expected Result:**
- Maximum pairwise similarity < 0.80
- Each page contains at least 3 suburb-specific details not found in any other page

**Pass/Fail Criteria:**
- PASS: Max similarity < 0.80 AND >= 3 unique suburb details per page
- FAIL: Any pair > 0.80 similarity OR < 3 unique details

**Scorer Type:** Algorithmic (similarity) + AI Rubric (uniqueness assessment)

---

## 9. Eval Cases — Version History

### EVAL-BCE-025: Version Save on Edit

| Attribute | Value |
|-----------|-------|
| **Test ID** | EVAL-BCE-025 |
| **Category** | Version History |
| **Priority** | High |

**Preconditions:**
1. A content page exists in the system
2. Version history module is active

**Test Steps:**
1. Load an existing content page (version 1)
2. Make an edit to the heading text
3. Save the edit
4. Verify version 2 is created in the version history
5. Verify version 1 is still accessible
6. Verify the diff between version 1 and version 2 shows only the heading change

**Expected Result:**
- Version 2 is created upon save
- Version 1 remains accessible
- Diff is accurate and minimal (shows only the heading change)

**Pass/Fail Criteria:**
- PASS: New version created AND old version accessible AND diff accurate
- FAIL: Any of the above not met

**Scorer Type:** Algorithmic

---

### EVAL-BCE-026: Rollback to Previous Version

| Attribute | Value |
|-----------|-------|
| **Test ID** | EVAL-BCE-026 |
| **Category** | Version History |
| **Priority** | High |

**Preconditions:**
1. A content page has at least 3 versions in its history
2. Each version has identifiable differences

**Test Steps:**
1. View the page at version 3 (current)
2. Initiate rollback to version 1
3. Verify the content matches version 1 exactly
4. Verify a new version 4 is created (rollback creates a new version, not destructive rewrite)
5. Verify versions 2 and 3 remain in history

**Expected Result:**
- Content after rollback matches version 1 exactly
- A new version entry is created for the rollback action
- Full version history is preserved (versions 1, 2, 3, 4)

**Pass/Fail Criteria:**
- PASS: Content matches version 1 AND version 4 created AND full history preserved
- FAIL: Content mismatch OR destructive rollback OR history lost

**Scorer Type:** Algorithmic

---

### EVAL-BCE-027: Version History Metadata

| Attribute | Value |
|-----------|-------|
| **Test ID** | EVAL-BCE-027 |
| **Category** | Version History |
| **Priority** | Medium |

**Preconditions:**
1. Multiple versions of a page exist

**Test Steps:**
1. Access the version history for a page with >= 3 versions
2. For each version, verify the following metadata is recorded:
   a. Version number (sequential)
   b. Timestamp (ISO 8601 format)
   c. Author/source (manual edit vs. AI generation vs. batch generation)
   d. Change summary or diff size

**Expected Result:**
- All metadata fields are present for every version
- Timestamps are chronologically ordered
- Version numbers are sequential without gaps

**Pass/Fail Criteria:**
- PASS: All metadata present AND timestamps ordered AND sequential version numbers
- FAIL: Missing metadata OR out-of-order timestamps OR version gaps

**Scorer Type:** Algorithmic

---

### EVAL-BCE-028: Version History Survives App Restart

| Attribute | Value |
|-----------|-------|
| **Test ID** | EVAL-BCE-028 |
| **Category** | Version History |
| **Priority** | High |

**Preconditions:**
1. A page has at least 3 versions saved
2. Version history is verified as present before restart

**Test Steps:**
1. Record the version count and latest version content
2. Shut down and restart the application
3. Access the same page's version history
4. Verify version count matches pre-restart
5. Verify latest version content is identical

**Expected Result:**
- Version history persists across application restarts
- No data loss or corruption

**Pass/Fail Criteria:**
- PASS: Version count and content identical before and after restart
- FAIL: Any data loss or corruption

**Scorer Type:** Algorithmic

---

## 10. Eval Cases — Edge Cases

### EVAL-BCE-029: Empty Suburb Data Handling

| Attribute | Value |
|-----------|-------|
| **Test ID** | EVAL-BCE-029 |
| **Category** | Edge Cases |
| **Priority** | High |

**Preconditions:**
1. A suburb entry exists in the batch list with missing data fields (no landmarks, no distance, no population)
2. Batch generation is initiated including this suburb

**Test Steps:**
1. Include a suburb with empty/null local data fields in the batch
2. Run batch generation
3. Check the generated page for the suburb with missing data

**Expected Result:**
- The system either: (a) skips the suburb and logs a warning, OR (b) generates a page with graceful fallback content (no empty strings, no broken HTML, no placeholder tokens)
- In either case, the system does not crash or produce corrupt output

**Pass/Fail Criteria:**
- PASS: Graceful handling (skip with warning OR valid fallback content) AND no crash
- FAIL: Crash, corrupt output, empty strings in content, or placeholder tokens

**Scorer Type:** Algorithmic

---

### EVAL-BCE-030: Malformed CSS Handling

| Attribute | Value |
|-----------|-------|
| **Test ID** | EVAL-BCE-030 |
| **Category** | Edge Cases |
| **Priority** | Medium |

**Preconditions:**
1. A CSS source containing malformed rules (unclosed braces, invalid property values, @import loops) is provided to the scraper

**Test Steps:**
1. Feed the malformed CSS to the scraper
2. Observe scraper behavior
3. Verify the scraper extracts valid classes while skipping or logging malformed rules
4. Verify no crash or hang

**Expected Result:**
- Scraper completes without crash
- Valid classes are extracted correctly
- Malformed rules are logged as warnings
- No invalid entries in the catalogue

**Pass/Fail Criteria:**
- PASS: No crash AND valid classes extracted AND malformed rules logged
- FAIL: Crash, hang, or invalid entries in catalogue

**Scorer Type:** Algorithmic

---

### EVAL-BCE-031: Network Failure During Scrape

| Attribute | Value |
|-----------|-------|
| **Test ID** | EVAL-BCE-031 |
| **Category** | Edge Cases |
| **Priority** | Medium |

**Preconditions:**
1. Scraper is configured to scrape a live site
2. Network interruption is simulated mid-scrape (e.g., after fetching 2 of 5 stylesheets)

**Test Steps:**
1. Begin a CSS scrape of the target site
2. Simulate network failure after partial completion
3. Observe scraper behavior

**Expected Result:**
- Scraper reports the failure clearly with details of what was and was not scraped
- Partial results are not silently committed as a complete catalogue
- Retry or resume mechanism is offered or documented

**Pass/Fail Criteria:**
- PASS: Clear error reporting AND partial results not treated as complete AND no crash
- FAIL: Silent partial commit OR crash OR unclear error

**Scorer Type:** Algorithmic

---

### EVAL-BCE-032: Very Long Content Page Generation

| Attribute | Value |
|-----------|-------|
| **Test ID** | EVAL-BCE-032 |
| **Category** | Edge Cases |
| **Priority** | Medium |

**Preconditions:**
1. A template with 15+ sections is configured
2. Each section has substantial content (200+ words)

**Test Steps:**
1. Generate a page with all 15 sections filled with full content
2. Export the page as HTML
3. Verify the exported HTML is well-formed and complete (no truncation)
4. Verify the preview renders all sections without layout breakage
5. Verify the export can be pasted into the WYSIWYG without hitting size limits

**Expected Result:**
- HTML export is complete and not truncated
- Preview renders all sections
- No performance degradation (preview loads in < 5 seconds)

**Pass/Fail Criteria:**
- PASS: Complete export AND full preview AND load time < 5s
- FAIL: Truncation OR rendering failure OR load time > 5s

**Scorer Type:** Algorithmic

---

## 11. Scoring Summary

| Scorer Type | Count | Use Case |
|-------------|-------|----------|
| Algorithmic | 25 | Deterministic validation: class matching, placeholder scanning, structure checks, data accuracy, metadata verification |
| AI Rubric | 5 | Subjective quality: content generation quality, iterative refinement, visual fidelity assessment |
| Algorithmic + AI Rubric | 2 | Combined: AI HTML conformance, content uniqueness |

## 12. Dependencies and Assumptions

| Dependency | Eval Cases Affected | Mitigation |
|------------|---------------------|------------|
| Live bookingtimes.com site access | EVAL-BCE-001/002/003/009/010/011 | Use cached/snapshotted site data for offline runs; require periodic live validation |
| WYSIWYG editor access | EVAL-BCE-008 | Document editor behavior and build a simulation layer; validate against simulation |
| Suburb local data availability | EVAL-BCE-013/014/015/016/029 | Prepare a minimal test dataset of 10 suburbs with verified data |
| AI assistant (Claude) availability | EVAL-BCE-021/022/023/024 | Mock AI responses for automated testing; run live AI evals periodically |
| Network connectivity | EVAL-BCE-031 | Test with simulated network conditions |

## 13. Execution Order

**Phase 1 — Foundation (run first):**
- EVAL-BCE-001, 002: CSS scraping works correctly
- EVAL-BCE-005, 006: Export HTML is valid

**Phase 2 — Core Features:**
- EVAL-BCE-009, 010, 011: Preview fidelity
- EVAL-BCE-013, 014, 015: Batch generation
- EVAL-BCE-017, 018, 019: Template system

**Phase 3 — Integration:**
- EVAL-BCE-003, 007, 020: Cross-site capabilities
- EVAL-BCE-021, 022, 023, 024: AI content generation
- EVAL-BCE-008: WYSIWYG paste acceptance

**Phase 4 — Robustness:**
- EVAL-BCE-025, 026, 027, 028: Version history
- EVAL-BCE-029, 030, 031, 032: Edge cases
- EVAL-BCE-004, 012, 016: Scale and change resilience
