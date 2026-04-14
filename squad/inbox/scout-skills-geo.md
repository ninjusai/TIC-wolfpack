# GEO Specialist - Skills, Tools, and Knowledge Research

**Agent:** Scout (Talent Research Specialist)
**Date:** 2026-04-02
**Status:** Complete
**For:** Peter (Recruitment Lead) - Agent file creation
**Prior Work:** `squad/inbox/scout-seo-geo-schema-research.md` covers GEO fundamentals and driving-school-specific patterns. This document goes DEEPER on what the GEO Specialist agent needs to know as a permanent pack member.

---

## Table of Contents

1. [Foundational Knowledge](#1-foundational-knowledge)
2. [Core Skills](#2-core-skills)
3. [Tools and Platforms](#3-tools-and-platforms)
4. [Platform-Specific Optimization](#4-platform-specific-optimization)
5. [Content Structuring Playbook](#5-content-structuring-playbook)
6. [GEO Auditing Framework](#6-geo-auditing-framework)
7. [Measurement and Metrics](#7-measurement-and-metrics)
8. [Anti-Patterns](#8-anti-patterns)
9. [SEO-GEO Alignment](#9-seo-geo-alignment)
10. [Technical GEO](#10-technical-geo)
11. [Proven vs Speculative](#11-proven-vs-speculative)
12. [Recommended Agent Configuration](#12-recommended-agent-configuration)

---

## 1. Foundational Knowledge {#1-foundational-knowledge}

### 1.1 What GEO Is (and Is Not)

GEO (Generative Engine Optimization) is the practice of structuring content to maximize citation probability in AI-generated responses across ChatGPT, Perplexity, Google AI Overviews, Claude, Gemini, and Microsoft Copilot.

**GEO IS:**
- Optimizing for citation (being the source an AI pulls from)
- Structuring content for machine extraction
- Building entity authority across the web
- Managing brand representation in AI responses
- An ongoing discipline requiring continuous monitoring

**GEO IS NOT:**
- Traditional SEO (though SEO is its foundation)
- Schema markup (that's a technical implementation detail)
- One-time optimization
- A replacement for quality content
- Keyword stuffing for AI

### 1.2 Academic Foundation

The foundational research comes from the Princeton/Georgia Tech/IIT Delhi/Allen AI study (ACM KDD 2024), which tested 9 optimization methods across 10,000 queries. Key findings the agent MUST internalize:

| Technique | Visibility Improvement | Notes |
|-----------|----------------------|-------|
| Statistics Addition | +41% | Single largest gain. Embed quantitative data every 150-200 words |
| Quotation Addition | +28% | Include expert quotes for authenticity |
| Citation of Sources | +115% (for lower-ranked pages) | Cite credible sources throughout |
| Fluency Optimization | +15-30% | Smooth, coherent, readable prose |
| FAQ Content | Top-5 correlated feature | Question-answer pairs are GEO gold |

**Critical insight:** Lower-ranked pages (position ~5) benefit MOST from GEO optimization (+115%), while position-1 pages see little change. This means GEO is especially powerful for sites that aren't already dominating traditional search.

### 1.3 Market Context (2026)

- GEO market: $848M in 2025, projected $33.7B by 2034 (50.5% CAGR)
- ChatGPT: 2.5B queries/day, 800M weekly active users
- Google AI Overviews: appear on ~57% of SERPs (up from 40% mid-2025)
- Perplexity: 153M monthly visits (191.9% YoY growth)
- AI-referred web sessions: grew 527% YoY in first five months of 2025
- 54% of US marketers plan to implement GEO within 3-6 months
- Only 11% of domains are cited by BOTH ChatGPT and Perplexity (platform-specific strategies essential)

---

## 2. Core Skills {#2-core-skills}

### 2.1 AI Citation Optimization

The agent must be able to:

**Content Architecture for Citation:**
- Write "citation blocks" -- self-contained 40-60 word paragraphs that directly answer a specific question
- Structure every page opening with a complete answer in the first 200 words (TLDR-first)
- Place the most citation-worthy content in the first 30% of the page (44.2% of ChatGPT citations come from this zone)
- Create "extractable ranked summaries" above the fold for listicle/comparison content

**Factual Density Management:**
- Embed a specific statistic, percentage, or data point every 150-200 words
- Always cite the source of statistics (AI engines preferentially cite content with sourced data)
- Use named attribution (author bylines) -- named authors cited 2.3x more than anonymous content
- Include "Last verified" or "Last updated" timestamps

**Answer Completeness:**
- Anticipate and answer follow-up questions within the same content
- Cover a topic comprehensively enough that the AI doesn't need to synthesize from multiple sources
- Balance completeness with conciseness -- be thorough but not bloated

### 2.2 Content Structuring for AI

The agent must enforce these patterns on all content it advises on:

**The GEO Content Template:**
```
1. Direct Answer Block (40-60 words) -- immediately answers the primary query
2. Key Facts/Stats (bulleted, with sources)
3. Detailed Explanation (H2 sections with question-format headers)
4. Comparison/Context (tables, pros-cons where applicable)
5. FAQ Section (5-10 Q&A pairs using exact questions people ask AI)
6. Author Attribution (named author with credentials)
7. Last Updated timestamp
```

**Header Hierarchy Rules:**
- H1: Primary question/topic (one per page)
- H2s: Question-format sub-topics ("How much does X cost?" not "Pricing")
- H3s: Specific sub-answers
- Pages with proper H1-H2-H3 hierarchy are 2.8x more likely to be cited by AI

**Content Formatting:**
- Use semantic HTML (not just visual formatting)
- Tables for comparisons (AI engines extract tabular data well)
- Ordered lists for processes/steps
- Unordered lists for features/attributes
- Bold key terms and definitions

### 2.3 GEO Content Strategies

**Strategy 1: Named Attribution (2.3x Citation Boost)**
- Every piece of content gets a named author with relevant credentials
- Author pages with bios, qualifications, and links to their content
- Author schema markup on every article
- This is one of the highest-ROI GEO interventions

**Strategy 2: Freshness Signals (Critical)**
- 50% of content cited in AI responses is less than 13 weeks old
- Content updated within 30 days gets 3.2x more Perplexity citations
- Update cornerstone content every 7-14 days based on observed citation decay
- Update all GEO content at minimum every 90 days (quarterly)
- Use visible "Last updated: [date]" timestamps
- Maintain version history signals

**Strategy 3: Statistics Inclusion (+30-40% Visibility)**
- Embed original data points wherever possible
- Cite third-party statistics from authoritative sources
- Use specific numbers, not vague qualifiers ("95% pass rate" not "high pass rate")
- Tables with data outperform prose with data

**Strategy 4: Multi-Source Corroboration**
- AI engines cross-reference claims across multiple domains
- If your brand is mentioned positively on 5+ independent domains, AI assigns higher confidence
- Earn mentions on: trade publications, review sites, news outlets, directories, forums
- This makes digital PR a direct GEO lever

**Strategy 5: Listicle/Comparison Content**
- 74.2% of all AI citations come from structured "Top N" content
- Deploy triple JSON-LD schema stacking: Article + ItemList + FAQPage
- Place quick answer block above the fold

### 2.4 Multi-Platform Optimization

The agent must understand each platform's retrieval mechanism and preferences:

| Platform | Primary Source | Key Preference | Update Sensitivity |
|----------|---------------|----------------|-------------------|
| Google AI Overviews | Google index | E-E-A-T signals (96% of citations from strong E-E-A-T) | Moderate |
| ChatGPT | Bing index + training data | Wikipedia/encyclopedic content (47.9% of citations) | Low-moderate |
| Perplexity | Real-time web crawling | Recency + Reddit (46.7% of citations) | Very high |
| Claude | Training data + search | Directory/database presence, authoritative sources | Low (training-based) |
| Gemini | Google index | Multi-modal content, YouTube (23.3%) | Moderate |
| Copilot | Bing index | FAQ schema (1.8x higher citation rate with FAQPage schema) | Moderate |

### 2.5 GEO Auditing

The agent must be able to perform and advise on GEO audits using this framework:

**GEO Audit Scoring (100 points):**

| Category | Weight | What to Assess |
|----------|--------|---------------|
| Access & Indexability | 20 pts | AI crawler access (robots.txt), llms.txt, sitemap, indexation |
| Entity Clarity & Consistency | 20 pts | Brand mentions, NAP consistency, knowledge panel, Wikipedia |
| Content Citation Readiness | 30 pts | Direct answer blocks, FAQ sections, stats density, header hierarchy, author attribution |
| Trust & E-E-A-T Signals | 20 pts | Author bios, credentials, reviews, backlinks, third-party mentions |
| Measurement & Monitoring | 10 pts | Tracking setup, baseline data, competitor monitoring |

**Priority Tiers:**
- **Fix Immediately:** Crawler blocks in robots.txt, missing schema markup, no author bylines (binary fixes that unlock visibility)
- **Fix This Week:** Vague opening paragraphs, non-question headings, missing statistics (directly impact extractability)
- **Fix This Month:** Missing FAQ sections, no freshness signals, incomplete entity presence
- **Ongoing:** Content freshness cadence, review generation, digital PR, competitive monitoring

### 2.6 SEO-GEO Alignment

The agent must manage the relationship between SEO and GEO:

**Complementary Areas (No Tension):**
- Structured data benefits both
- Quality content benefits both
- FAQ content benefits both
- Authority/backlinks benefit both
- Mobile optimization benefits both

**Tension Points (Agent Must Navigate):**
- **Answer completeness vs. engagement:** GEO rewards complete upfront answers; SEO rewards engagement metrics (time on page). Resolution: For conversion-focused pages, complete answers actually help conversion. For informational content, use the "answer then expand" pattern.
- **Content freshness cadence:** GEO demands updates every 7-14 days; SEO is more forgiving. Resolution: Prioritize freshness on top-20 pages; use "Last verified" dates on others.
- **Content length:** GEO favors concise, extractable content; SEO often rewards comprehensive long-form. Resolution: Write comprehensively but structure with clear extractable sections at the top.

---

## 3. Tools and Platforms {#3-tools-and-platforms}

### 3.1 GEO Tracking and Monitoring (RECOMMENDED)

**Tier 1 -- Dedicated GEO Platforms:**

| Tool | What It Does | Pricing | Best For |
|------|-------------|---------|----------|
| **Otterly.ai** | Track brand mentions/citations across Google AI Overviews, ChatGPT, Perplexity, Gemini, Copilot, AI Mode | Lite $29/mo (10 prompts), Standard $189/mo (100 prompts), Pro $989/mo (1,000 prompts) | Prompt-level AI ranking tracking |
| **Superlines** | Cross-platform AI visibility across 10 AI engines, citation gap analysis, MCP server integration | ~74 EUR/mo (annual, unlimited brands) | Broadest multi-engine coverage at best price |
| **Semrush AI Toolkit** | AI Share of Voice, brand sentiment across ChatGPT/Gemini/Copilot, competitive gap tracking | $99/mo per domain | Teams already using Semrush for SEO |

**Tier 2 -- Specialized/Emerging:**

| Tool | Niche |
|------|-------|
| **Profound** (Apify) | Competitor analysis, Share of Voice gap finder |
| **Siftly.ai** | AI citation tracking for brands |
| **Sight AI** | Automated prompt monitoring across models |
| **HubSpot AEO Grader** | Free AI Share of Voice assessment |
| **LLMrefs** | AI search visibility tracking |

**Scout's Recommendation:** Start with **Superlines** for broadest coverage at the best price point. Add **Otterly.ai Standard** when you need deeper prompt-level tracking. Use **HubSpot AEO Grader** (free) for quick baseline assessments.

### 3.2 Content Optimization Tools

| Tool | Purpose |
|------|---------|
| **Frase.io** | AI content optimization, answer engine optimization, SERP analysis |
| **Clearscope** | Content optimization with NLP analysis (useful for factual density) |
| **SurferSEO** | Content scoring and optimization |
| **MarketMuse** | Topical authority mapping and content gap analysis |

### 3.3 Schema and Technical Tools

| Tool | Purpose |
|------|---------|
| **Schema.org Validator** | Validate JSON-LD markup |
| **Google Rich Results Test** | Test schema implementation |
| **Screaming Frog** | Crawl sites for technical GEO issues |
| **Ahrefs/Semrush** | Domain authority, backlink analysis, competitor research |

### 3.4 Manual Testing (Essential -- No Tool Replaces This)

The agent must regularly:
1. Run target queries in ChatGPT, Perplexity, Google AI Overviews, and Claude
2. Note whether the brand/content is cited, recommended, or absent
3. Analyze competitor citations
4. Track changes over time
5. Test variations of queries (different phrasings, locations, specifics)

This is non-negotiable. Automated tools miss nuance. Manual sampling catches what tools cannot.

---

## 4. Platform-Specific Optimization {#4-platform-specific-optimization}

### 4.1 Google AI Overviews

- 96% of citations come from sources with strong E-E-A-T signals
- Pulls from Google's existing index -- traditional SEO ranking is a prerequisite
- Favors YouTube (23.3%) and Reddit (20%) heavily
- Schema markup is heavily weighted
- Multi-modal content (images, video) increases citation probability
- **Action:** Ensure top-ranking Google pages are also GEO-optimized. Create YouTube content for key topics.

### 4.2 ChatGPT

- 47.9% of top citations come from Wikipedia and encyclopedic content
- 44.2% of citations come from the first 30% of a page's content
- Uses Bing index primarily for web-browsing mode
- Favors authoritative domains with strong domain authority
- Wikipedia presence is disproportionately important
- **Action:** Pursue Wikipedia mentions/pages where warranted. Ensure Bing indexation. Front-load content. Build encyclopedic authority content.

### 4.3 Perplexity

- 46.7% of citations come from Reddit
- Content updated within 30 days gets 3.2x more citations
- Uses real-time web crawling -- freshness is king
- Prioritizes factual density and community validation
- Cites sources explicitly with links
- **Action:** Maintain aggressive content freshness cadence. Encourage genuine community presence (Reddit, forums). Keep content factually dense.

### 4.4 Claude

- Heavily weighted toward directory/database presence (Tier 1: 65% influence)
- Awards, accreditations, affiliations weighted at 19% (highest of all platforms)
- Primarily relies on training data, not real-time search
- Favors authoritative third-party sources over brand-owned content
- **Action:** Ensure presence in high-authority directories. Publicize accreditations. Earn third-party mentions.

### 4.5 Gemini

- Draws from Google index
- Multi-modal content weighted (YouTube at 23.3%)
- General directories important (30% influence)
- Social sentiment growing in importance
- **Action:** Diversify content formats. Maintain directory presence. Monitor social sentiment.

### 4.6 Microsoft Copilot

- Uses Bing index
- FAQPage schema provides 1.8x higher citation rate
- **Action:** Implement FAQPage schema on all content pages. Ensure Bing Webmaster Tools setup.

---

## 5. Content Structuring Playbook {#5-content-structuring-playbook}

### 5.1 The Citation Block Pattern

Every key section should contain a "citation block" -- a self-contained 40-60 word paragraph that answers one specific question completely. This is the atomic unit of GEO content.

**Format:**
```
[Question as H2/H3]
[40-60 word direct answer with at least one statistic or specific fact]
[Source attribution if citing data]
```

**Example:**
```
## How many supervised driving hours are required in Queensland?

Queensland learner drivers must complete 100 hours of supervised driving,
including 10 hours at night, before sitting their practical test. Each hour
with a TMR-accredited instructor counts as 3 logbook hours, up to 30 hours
maximum (10 actual instructor hours). — Source: Queensland Department of
Transport and Main Roads, 2026.
```

### 5.2 The TLDR-First Pattern

The first 200 words of every page must:
1. Directly and completely answer the primary query
2. Include at least one specific statistic
3. Name the brand/author
4. Mention the geographic scope (for local content)
5. Be extractable as a standalone answer

### 5.3 The FAQ Gold Mine

FAQ sections are one of the top-5 correlated features for AI citation. Rules:

- Use exact questions people ask AI assistants (not marketing-speak)
- 5-10 Q&A pairs per page
- Each answer: 40-80 words, self-contained, includes a specific fact
- Implement FAQPage schema markup for each FAQ section
- Pages with FAQPage schema: 1.4x higher citation in Perplexity, 1.8x in Copilot

### 5.4 The Statistics Rhythm

Maintain a statistic every 150-200 words throughout content:
- Use specific numbers, not vague qualifiers
- Always cite the source
- Prefer original/proprietary data where possible
- Tables with statistics outperform inline statistics

### 5.5 Triple Schema Stacking

For maximum GEO impact on key pages, implement three schema types simultaneously:
1. **Article** (or appropriate content type schema)
2. **ItemList** (for listicle/comparison content)
3. **FAQPage** (for the FAQ section)

All in JSON-LD format (preferred by all AI engines for clean programmatic extraction).

---

## 6. GEO Auditing Framework {#6-geo-auditing-framework}

### 6.1 The 30-Minute Quick Audit

The agent should be able to perform a rapid GEO assessment of any page:

1. **Crawler Access (2 min):** Check robots.txt for AI crawler blocks (GPTBot, ClaudeBot, PerplexityBot). Check for llms.txt.
2. **First 200 Words (3 min):** Does the opening directly answer the primary query? Is it extractable as a standalone answer?
3. **Header Hierarchy (2 min):** Are H2s in question format? Is the hierarchy clean (H1 > H2 > H3)?
4. **Statistics Density (3 min):** Count stats per 200 words. Target: at least 1.
5. **FAQ Section (2 min):** Does it exist? Does it use real questions? Is FAQPage schema present?
6. **Author Attribution (2 min):** Named author? Bio page linked? Author schema?
7. **Freshness Signals (2 min):** Last updated date visible? How old is the content?
8. **Schema Markup (3 min):** Run through Rich Results Test. Check for Article, FAQ, Organization schemas.
9. **AI Test (10 min):** Query the topic in ChatGPT, Perplexity, and Google AI. Is the page/brand cited?

### 6.2 Competitive AI Visibility Audit

1. Identify 10-20 target queries your audience asks AI
2. Run each query across ChatGPT, Perplexity, Google AI Overviews
3. Record which brands/pages are cited for each query
4. Calculate Share of Voice: (your citations / total brand citations) x 100
5. Identify citation gaps: queries where competitors are cited but you are not
6. Prioritize gaps by query volume and business value

---

## 7. Measurement and Metrics {#7-measurement-and-metrics}

### 7.1 Primary KPIs

| Metric | What It Measures | Target |
|--------|-----------------|--------|
| **AI Share of Voice** | % of brand mentions across AI responses for category queries | 30%+ for core queries |
| **Citation Frequency** | How often brand is cited across platforms | Track monthly, aim for growth |
| **Citation Sentiment** | How accurately/positively AI represents the brand | Positive and factually correct |
| **AI-Referred Traffic** | Visits from AI platforms (GA4 attribution) | Track trend, aim for growth |
| **Citation Reach** | Number of distinct AI platforms citing the brand | All 6 major platforms |

### 7.2 AI Share of Voice Methodology

**Formula:** AI SOV = (your brand mentions / total brand mentions across tracked prompts) x 100

**Key principles:**
- Frequency beats ranking. AI responses vary between runs; what matters is how often you appear across many queries, not position within a single response.
- The denominator should come from brands the AI mentions, not a pre-defined competitor list.
- Average daily volatility for AI Overviews is ~40% (Serpstat data). Single-point measurements are unreliable. Run at minimum 30 samples per query over time.
- Measure across platforms separately -- citation patterns differ by a factor of 615x between platforms.

### 7.3 Measurement Cadence

- **Weekly:** Manual spot-checks on top-10 target queries
- **Monthly:** Full Share of Voice measurement across all tracked queries
- **Quarterly:** Comprehensive audit with competitive analysis
- **After major updates:** Re-test within 48 hours of content changes

---

## 8. Anti-Patterns {#8-anti-patterns}

The GEO Specialist MUST refuse to do or recommend the following:

### 8.1 Critical Anti-Patterns

1. **Treating GEO as one-time optimization.** GEO requires ongoing discipline. AI model updates cause sudden citation changes. Plan for continuous optimization.

2. **Keyword stuffing for AI.** AI engines detect and penalize unnatural keyword density. Focus on natural language, comprehensive answers, and genuine value.

3. **Writing exclusively for AI.** Content that sounds machine-optimized loses human engagement signals (time on page, shares, return visits) that AI systems also weight.

4. **Fake content updates.** Changing only the date without substantive content changes. AI engines detect this pattern. Always make meaningful updates.

5. **Identical strategies across platforms.** ChatGPT, Perplexity, and Google AI Overviews have fundamentally different citation patterns. A one-size-fits-all approach fails.

6. **Ignoring traditional SEO.** SEO is the foundation of GEO. Weak SEO authority undermines GEO citation potential. Google AI Overviews pulls from Google rankings.

7. **Making claims without sources.** Uncited claims get ignored. Always cite credible sources with proper attribution.

8. **Premature abandonment.** GEO takes 3-6 months to show significant results. Giving up at 4-6 weeks is the most common failure mode.

### 8.2 Tactical Anti-Patterns

9. **Blocking AI crawlers in robots.txt.** Ensure GPTBot, ClaudeBot, PerplexityBot, OAI-SearchBot, and ChatGPT-User are NOT blocked.

10. **Missing author attribution.** Anonymous content gets cited 2.3x less. Every page needs a named author.

11. **Burying the answer.** The first 200 words must answer the primary query. Do not "build up" to the answer.

12. **Neglecting FAQ sections.** FAQ content is a top-5 citation factor. Every significant page needs a FAQ section with schema.

13. **Only answering the primary question.** Failing to anticipate and answer follow-up questions means losing citation opportunities.

14. **Ignoring reviews and third-party mentions.** These are GEO ranking factors. Reputation management is GEO work.

---

## 9. SEO-GEO Alignment {#9-seo-geo-alignment}

### 9.1 The GEO Specialist's Scope Boundary

**OWNS:**
- Content structuring for AI citation (direct answer blocks, TLDR-first, FAQ patterns)
- GEO-specific content strategies (named attribution, freshness signals, statistics inclusion)
- Multi-platform AI optimization
- GEO auditing and measurement (Share of Voice, citation tracking)
- Advising content agents on GEO patterns

**DOES NOT OWN:**
- Traditional SEO (keyword research, backlink building, technical SEO)
- Schema markup implementation (technical implementation detail -- advises on which schemas, doesn't write them)
- Content creation (advises patterns, doesn't write the content)
- Digital PR execution (identifies the need, doesn't execute campaigns)

### 9.2 Collaboration Model

The GEO Specialist should work alongside:
- **SEO agent:** GEO provides citation requirements; SEO provides keyword/authority foundation
- **Content agents:** GEO provides structural patterns and review; content agents write
- **Schema/technical agents:** GEO specifies needed schema types; technical agents implement
- **PR/outreach agents:** GEO identifies citation gaps needing third-party mentions; PR executes

---

## 10. Technical GEO {#10-technical-geo}

### 10.1 AI Crawler Configuration

**robots.txt -- Ensure these are NOT blocked:**
```
User-agent: GPTBot          # OpenAI training
User-agent: OAI-SearchBot   # OpenAI search/retrieval
User-agent: ChatGPT-User    # ChatGPT browsing mode
User-agent: ClaudeBot        # Anthropic (Claude)
User-agent: PerplexityBot    # Perplexity
User-agent: Google-Extended  # Google AI training
User-agent: Googlebot        # Google (including AI Overviews)
```

Currently: ClaudeBot blocked by 69% of sites, GPTBot by 62%. Unblocking these is a quick GEO win.

### 10.2 llms.txt

A proposed specification (Jeremy Howard, September 2024) that provides AI systems with a structured map of your site's most relevant content. Placed at domain root (`/llms.txt`).

**Current status:** Only 10.13% of domains have one. Adoption is growing but not yet universal. Major LLM crawlers have begun requesting it during inference (2026). Early adoption = competitive advantage.

**Recommendation:** Implement llms.txt for all projects. Low effort, potential upside, no downside.

### 10.3 Schema Markup Priorities for GEO

The GEO Specialist should advise on these schema types (in priority order):

1. **FAQPage** -- 1.4-1.8x higher citation rates across platforms
2. **Article** (with author, datePublished, dateModified) -- freshness and attribution signals
3. **Organization** / **LocalBusiness** -- entity clarity
4. **ItemList** -- for comparison/listicle content
5. **HowTo** -- for process/tutorial content
6. **Breadcrumb** -- site structure clarity
7. **Person** (for authors) -- author entity recognition

All in JSON-LD format. Triple-stacking (Article + ItemList + FAQPage) on key pages for maximum GEO impact.

---

## 11. Proven vs Speculative {#11-proven-vs-speculative}

### 11.1 Proven (High Confidence -- Implement Immediately)

- Statistics inclusion boosts visibility by 30-41% (Princeton study, widely replicated)
- Named author attribution provides 2.3x citation boost (multiple studies)
- FAQ content with schema is a top-5 citation factor (CMU KDD 2024)
- Content freshness matters enormously (50% of cited content < 13 weeks old)
- TLDR-first / direct answer blocks improve citation probability
- Platform-specific strategies are necessary (only 11% domain overlap between ChatGPT and Perplexity)
- Traditional SEO ranking is a prerequisite for Google AI Overviews citations
- E-E-A-T signals matter (96% of AI Overview citations from strong E-E-A-T sources)

### 11.2 Emerging (Medium Confidence -- Implement but Monitor)

- llms.txt adoption and its actual impact on citations
- Triple JSON-LD schema stacking effectiveness
- The specific 7-14 day freshness cadence as optimal
- AI Share of Voice as a stable, measurable KPI (40% daily volatility is a challenge)
- Agentic search optimization (AI agents browsing, comparing, completing tasks)
- Social sentiment as a citation factor (growing but still small)

### 11.3 Speculative (Low Confidence -- Watch but Don't Bet On)

- Specific citation rate percentages by platform (these shift with every model update)
- Exact content length/word count targets for optimal citation
- Any "hack" or shortcut claiming guaranteed AI citations
- Video/audio transcription as a primary GEO strategy (emerging but unproven at scale)
- Paid inclusion in AI results (no major platform offers this yet in 2026)

---

## 12. Recommended Agent Configuration {#12-recommended-agent-configuration}

### 12.1 Agent Identity

**Name:** GEO Specialist
**Mission:** Owns optimization for AI answer engines -- getting content cited by ChatGPT, Perplexity, Google AI Overviews, Claude, Gemini, and Copilot.

### 12.2 Knowledge the Agent Must Internalize

1. Princeton GEO study findings (Section 1.2 above)
2. Platform-specific citation patterns (Section 4 above)
3. Content structuring playbook (Section 5 above)
4. The anti-patterns list (Section 8 above)
5. Scope boundaries (Section 9.1 above)
6. Proven vs speculative distinction (Section 11 above)

### 12.3 Tools the Agent Should Reference

- **Primary monitoring:** Superlines (broadest coverage, best price) or Otterly.ai (deeper prompt tracking)
- **Content optimization:** Frase.io for answer engine optimization
- **Technical validation:** Schema.org Validator, Google Rich Results Test
- **Manual testing:** Direct queries across ChatGPT, Perplexity, Google AI, Claude (non-negotiable)
- **Free baseline:** HubSpot AEO Grader

### 12.4 Key Decision Frameworks

**When advising on content structure:** Always enforce TLDR-first, citation blocks, FAQ sections, statistics rhythm, and named attribution.

**When auditing:** Use the 100-point framework (Section 6.1) with priority tiers for remediation.

**When measuring:** AI Share of Voice as primary KPI, measured monthly with 30+ samples per query, tracked per platform.

**When navigating SEO-GEO tension:** Answer completeness wins. For conversion pages, complete answers help conversion anyway. For informational pages, use "answer then expand."

### 12.5 Output Formats

The agent should produce:
- **GEO Audit Reports** -- 100-point scoring with prioritized recommendations
- **Content Structure Templates** -- Per-page structural requirements for content agents
- **Citation Tracking Reports** -- Monthly Share of Voice with competitive analysis
- **Platform Briefs** -- Per-platform optimization checklists
- **Freshness Schedules** -- Content update cadence plans

---

## Research Sources

- Princeton/Georgia Tech/IIT Delhi/Allen AI GEO Study (ACM KDD 2024) -- https://arxiv.org/abs/2311.09735
- First Page Sage GEO Best Practices -- https://firstpagesage.com/seo-blog/generative-engine-optimization-best-practices/
- Search Engine Land GEO Guide 2026 -- https://searchengineland.com/mastering-generative-engine-optimization-in-2026-full-guide-469142
- Frase.io GEO Guide -- https://www.frase.io/blog/what-is-generative-engine-optimization-geo
- Semrush AI Content Optimization Guide -- https://www.semrush.com/blog/how-to-optimize-content-for-ai-search-engines/
- Profound AI Platform Citation Patterns -- https://www.tryprofound.com/blog/ai-platform-citation-patterns
- Averi.ai GEO Metrics Guide -- https://www.averi.ai/how-to/how-to-track-ai-citations-and-measure-geo-success-the-2026-metrics-guide
- Superlines AI Visibility Tools Comparison -- https://www.superlines.io/articles/best-ai-visibility-tools/
- GenOptima GEO Best Practices 2026 -- https://www.gen-optima.com/geo/generative-engine-optimization-best-practices-2026/
- Waikay AI Share of Voice Guide -- https://waikay.io/ai-brand-visibility-guide/share-of-voice/
