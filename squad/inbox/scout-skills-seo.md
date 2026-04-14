# SEO Specialist -- Skills, Tools, and Best Practices Research

**Agent:** Scout (Talent Research Specialist)
**Date:** 2026-04-02
**Status:** Complete
**For:** Peter (Recruitment Lead) -- Agent file creation
**Scope:** Permanent pack member, broadly capable, immediate need is bookingtimes.com (Bootstrap 5, SvelteKit, local Node.js) for 5 Queensland driving school websites

---

## Table of Contents

1. [Core Competency Areas](#1-core-competency-areas)
2. [Required Tool Stack](#2-required-tool-stack)
3. [On-Page Optimization Skills](#3-on-page-optimization)
4. [Technical SEO Skills](#4-technical-seo)
5. [Local SEO Skills](#5-local-seo)
6. [Content SEO and E-E-A-T](#6-content-seo)
7. [Content Architecture and Internal Linking](#7-content-architecture)
8. [SEO Auditing Framework](#8-seo-auditing)
9. [Anti-Patterns -- What the Agent Must NEVER Do](#9-anti-patterns)
10. [Decision Framework Templates](#10-decision-frameworks)
11. [Handoff Boundaries with Other Agents](#11-handoff-boundaries)
12. [Verification and Quality Gates](#12-verification-gates)

---

## 1. Core Competency Areas {#1-core-competency-areas}

The SEO Specialist must be expert-level in six domains. These are ordered by frequency of use in typical projects:

### Priority 1 -- Every Project
- **On-page optimization** (titles, metas, headers, image alt text, keyword placement)
- **Technical SEO** (canonicals, sitemaps, robots.txt, Core Web Vitals, mobile-first, URL structure)
- **Content architecture** (silo design, hub-spoke linking, anchor text, link equity, orphan prevention)

### Priority 2 -- Local/Multi-Location Projects
- **Local SEO** (Google Business Profile, NAP consistency, citations, local landing pages, map pack)
- **Content SEO** (E-E-A-T signals, content uniqueness enforcement, duplicate prevention, freshness)

### Priority 3 -- Ongoing
- **SEO auditing** (technical audits, content gap analysis, competitor analysis, ranking monitoring)

---

## 2. Required Tool Stack {#2-required-tool-stack}

### Tier 1 -- Must Know (Free / Essential)

| Tool | Purpose | When to Use |
|------|---------|-------------|
| **Google Search Console** | Indexing status, search performance, crawl errors, Core Web Vitals field data | Every project. Primary source of truth for how Google sees the site. |
| **Google PageSpeed Insights** | Lab + field Core Web Vitals data (LCP, INP, CLS) | Every page audit. Uses Lighthouse + CrUX data. |
| **Google Rich Results Test** | Validate structured data renders correctly | After any schema changes (note: schema is owned by another agent, but SEO must validate it renders) |
| **Google Mobile-Friendly Test** | Mobile rendering validation | Every new page template |
| **Lighthouse (Chrome DevTools)** | Performance, accessibility, SEO, best practices scoring | Development-time auditing |
| **robots.txt Tester (GSC)** | Validate robots.txt rules | After any robots.txt change |

### Tier 2 -- Must Know (Paid / Professional)

| Tool | Purpose | Recommendation |
|------|---------|----------------|
| **Screaming Frog SEO Spider** | Desktop crawler for technical audits -- finds broken links, missing metas, duplicate content, redirect chains, canonical issues | **THE standard** for technical SEO. Free up to 500 URLs. Must-have for any site over 50 pages. |
| **Semrush** | All-in-one: keyword research, site audit, competitor analysis, rank tracking, AI Visibility Analytics (tracks brand mentions across ChatGPT, AI Overviews, Perplexity, Claude, Gemini) | **Recommended as primary platform** -- broadest feature set including AI visibility tracking in 2026. |
| **Ahrefs** | Backlink analysis, content gap analysis, keyword difficulty scoring | Best backlink database. Use for competitor backlink research. |

### Tier 3 -- Should Know (Local SEO Specific)

| Tool | Purpose |
|------|---------|
| **BrightLocal** | Local rank tracking, citation auditing, GBP audit, review monitoring |
| **Moz Local** | Automated listing management, real-time citation sync across directories |
| **Whitespark** | Local citation finder, NAP audit, local rank tracker |

### Tier 4 -- Should Know (Content & Duplication)

| Tool | Purpose |
|------|---------|
| **Siteliner** | Internal duplicate content detection across site |
| **Sitebulb** | Near-duplicate detection (critical for location page templates) |
| **Surfer SEO** | Content optimization scoring, SERP analysis, keyword density guidance |
| **Copyscape** | External plagiarism/duplication checking |

### Agent-Accessible Tools (No License Required)

The SEO Specialist agent operates within Claude Code. It should be able to:
- Generate and validate `robots.txt` files
- Generate and validate XML sitemaps
- Audit HTML for on-page SEO issues (title tags, metas, headers, alt text, canonical tags)
- Analyze URL structures
- Check internal linking patterns by parsing HTML
- Calculate content uniqueness percentages between location page variants
- Generate SEO audit reports in Markdown

---

## 3. On-Page Optimization Skills {#3-on-page-optimization}

### 3.1 Title Tags

**Rules the agent must enforce:**
- Under 60 characters (Google truncates beyond this)
- Primary keyword (service + location) at the front
- Brand name included for recognition/trust
- Every page has a UNIQUE title tag -- no duplicates across the site
- Formula for service pages: `[Service] in [Location] | [Brand] - [Differentiator]`
- Formula for location pages: `[Service] in [Suburb], [Region] | [Brand]`

### 3.2 Meta Descriptions

**Rules:**
- 150-160 characters max
- Include a call to action
- Mention a unique selling point
- Include the suburb/region name for local pages
- Every page has a UNIQUE meta description
- Not a ranking factor directly, but affects CTR which affects rankings indirectly

### 3.3 Header Hierarchy

**Rules:**
- ONE H1 per page, always containing the primary keyword
- H2s for major sections, H3s for subsections
- Never skip levels (H1 to H3 without H2)
- Headers must be descriptive with keywords, not generic ("Our Services" = bad; "Manual and Automatic Driving Lessons in Brisbane" = good)

### 3.4 Image Optimization

**Rules:**
- All images must have descriptive alt text with relevant keywords
- File names must be descriptive and hyphenated: `manual-driving-lesson-brisbane.webp`
- WebP format preferred (30% smaller than JPEG)
- Responsive images with `srcset` for mobile
- Lazy-load below-the-fold images
- Width and height attributes on all images (prevents CLS)
- Hero images under 100KB, other images under 200KB

### 3.5 Keyword Placement

**Strategic locations (ordered by importance):**
1. Title tag
2. H1
3. URL slug
4. First 100 words of body content
5. H2/H3 subheadings (naturally)
6. Image alt text
7. Meta description (for CTR, not ranking)
8. Internal link anchor text pointing to the page

**Density guidance:** No fixed percentage. Write naturally. If the primary keyword appears 2-4 times in 1000 words plus once in each strategic location, that is sufficient. Over-optimization is worse than under-optimization.

---

## 4. Technical SEO Skills {#4-technical-seo}

### 4.1 Canonical Tags

**Rules:**
- Every page gets a self-referencing canonical: `<link rel="canonical" href="[full URL]">`
- Do NOT canonicalize location pages to a single "master" page -- this defeats the purpose of having them
- Use cross-page canonicals ONLY when two pages truly serve the same search intent
- Canonical URL must match the URL in the sitemap
- Canonical must use the preferred protocol (HTTPS) and hostname (www vs non-www)

### 4.2 XML Sitemaps

**Rules:**
- Every indexable page must be in the sitemap
- Every URL in the sitemap must return 200, not be noindexed, not be blocked by robots.txt, and have a self-referencing canonical
- Include `<lastmod>` with real dates (not fake dates)
- For sites with 50+ location pages: group by service type or region using sitemap index files
- Update sitemaps when content changes (for SvelteKit: generate at build time or use a dynamic endpoint)
- Submit sitemap via Google Search Console
- Reference sitemap in robots.txt: `Sitemap: https://example.com/sitemap.xml`

### 4.3 Robots.txt

**Rules:**
- Never block CSS, JS, or images needed for rendering
- Block low-value pages: internal search results, admin pages, staging environments
- Include sitemap reference
- Test every change before deploying
- Use specific user-agent directives when targeting AI crawlers (GPTBot, ClaudeBot, Google-Extended)
- In 2026, robots.txt is also used to manage AI crawler access -- make deliberate decisions about which AI crawlers to allow

**Template:**
```
User-agent: *
Allow: /
Disallow: /admin/
Disallow: /search?
Disallow: /api/

# AI Crawlers - allow by default for citation visibility
User-agent: GPTBot
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: Google-Extended
Allow: /

Sitemap: https://example.com/sitemap.xml
```

### 4.4 Core Web Vitals (2026 Thresholds)

| Metric | Good | Needs Improvement | Poor |
|--------|------|-------------------|------|
| **LCP** (Largest Contentful Paint) | < 2.5s | 2.5s - 4.0s | > 4.0s |
| **INP** (Interaction to Next Paint) | < 200ms | 200ms - 500ms | > 500ms |
| **CLS** (Cumulative Layout Shift) | < 0.1 | 0.1 - 0.25 | > 0.25 |

**INP is the most commonly failed metric in 2026** -- 43% of sites fail the 200ms threshold. Key fixes:
- Break long JavaScript tasks into smaller chunks
- Use web workers for heavy computation
- Debounce/throttle scroll and resize handlers
- Use passive event listeners
- Target DOM size under 1,500 nodes
- Islands architecture for hydration (relevant for SvelteKit)

**LCP fixes:**
- Preload the LCP element (usually hero image)
- Use `fetchpriority="high"` on the LCP image
- Inline critical CSS
- Server-side render above-the-fold content

**CLS fixes:**
- Always set width/height on images and embeds
- Reserve space for dynamic content (ads, embeds)
- Use `font-display: swap` for web fonts
- Avoid inserting content above existing content

### 4.5 Mobile-First

**Google uses mobile-first indexing exclusively.** The agent must verify:
- All content accessible on mobile (no hidden-on-mobile content)
- Touch targets minimum 48x48px
- Base font size minimum 16px
- No horizontal scrolling
- Click-to-call phone numbers: `<a href="tel:+61...">`
- Click-to-map addresses linking to Google Maps

### 4.6 URL Structure

**Rules:**
- Hyphens, not underscores
- Lowercase only
- Short and descriptive
- Primary keyword in URL
- Avoid parameter-based URLs (`?location=toowoomba`)
- Max 3 levels of depth
- Trailing slash consistency (pick one pattern, enforce it)

**Recommended patterns:**
```
/driving-lessons/[suburb-name]/
/services/[service-type]/
/services/[service-type]/[suburb-name]/
```

### 4.7 HTTPS and Security

- Every page must load over HTTPS
- HTTP must 301 redirect to HTTPS
- No mixed content (HTTP resources on HTTPS pages)
- HSTS headers recommended

### 4.8 Redirect Management

- Use 301 (permanent) for URL changes, not 302 (temporary)
- Avoid redirect chains (A -> B -> C); each redirect should go directly to the final URL
- Maintain a redirect map when restructuring URLs
- Audit for redirect loops

---

## 5. Local SEO Skills {#5-local-seo}

### 5.1 Google Business Profile (GBP) Optimization

**The agent must know how to advise on (implementation is manual/human task):**

- **Profile completeness:** Every field filled -- business name, category, description, hours, phone, website, photos, attributes, services
- **Primary category selection:** This is the single most important GBP setting. For driving schools: "Driving School" as primary, secondary categories might include "Traffic School", "Adult Education School"
- **Review management:** Review velocity (recent reviews) matters more than lifetime totals. Respond to all reviews -- positive and negative -- promptly and authentically
- **GBP posts:** Regular posts (weekly minimum) improve engagement signals
- **Q&A seeding:** Pre-populate Q&A with real customer questions and detailed answers
- **Photo strategy:** Regular photo uploads; Google rewards active profiles
- **Multi-location management:** Each physical location needs its own GBP listing with unique phone number and consistent NAP

### 5.2 NAP Consistency

**NAP = Name, Address, Phone Number**

**Rules:**
- Exact same format everywhere: website, GBP, directories, social media, citations
- Each location has its own master NAP document
- Use local phone numbers, not 1800/generic numbers
- Format consistency matters: "Suite 1, 123 Main St" everywhere, not "Ste 1, 123 Main Street" on some and "Suite 1, 123 Main St" on others
- Audit quarterly using BrightLocal or Moz Local
- Fixing NAP inconsistencies alone can produce a 16% average ranking boost

### 5.3 Local Citations

**Priority citation sources (Australia):**
1. Google Business Profile
2. Apple Business Connect (Apple Maps)
3. Bing Places
4. Yelp Australia
5. Facebook Business
6. Yellow Pages Australia
7. True Local
8. Hotfrog
9. StartLocal
10. Local industry directories (driving school specific)

**Target: 30-50 high-authority citations per location.** Beyond that, diminishing returns unless directories are niche-specific or geo-relevant.

### 5.4 Local Landing Pages

**Each location page must have:**
- Unique opening paragraph (150+ words) mentioning local landmarks, roads, character of the area
- Local driving conditions specific to that suburb
- Nearest test center/TMR office information
- Local testimonials from students in that area
- Instructor bio tie-in (who covers this suburb)
- Suburb-specific FAQ
- Embedded Google Map for that location
- Click-to-call and click-to-directions CTAs

**Content uniqueness threshold: 40-50% unique content per location page.** Shared content (service descriptions, pricing, process) is acceptable if supplemented with substantial unique local content.

### 5.5 Map Pack Optimization

Factors that influence Google's local 3-pack:
1. **Proximity** -- distance from searcher (uncontrollable)
2. **Relevance** -- category and keyword alignment in GBP
3. **Prominence** -- reviews, citations, backlinks, brand mentions
4. **Website experience** -- Core Web Vitals, mobile-friendliness
5. **Local content** -- on-site content about the specific location
6. **Engagement signals** -- GBP interactions, messaging response times

### 5.6 Geographic Clustering

For multi-location businesses serving overlapping areas:
- Define service area boundaries clearly
- Avoid creating pages for suburbs with no genuine local presence
- Cluster nearby suburbs into geographic groups
- Link within geographic clusters ("Also serving: Darling Heights, Rangeville, Middle Ridge")
- Each geographic cluster should have a hub page

---

## 6. Content SEO and E-E-A-T {#6-content-seo}

### 6.1 E-E-A-T Signals

**Experience:**
- Real instructor photos and bios with qualifications
- Specific testimonials with details ("passed first time at Bundamba")
- Accreditation numbers displayed
- Years of experience prominently shown

**Expertise:**
- Educational content demonstrating deep knowledge
- Content written in plain English but technically accurate
- Instructor qualification details (Certificate IV in Transport and Logistics, etc.)

**Authoritativeness:**
- Links from government/authoritative sites
- Local news mentions, community directory listings
- Industry association memberships
- Consistent NAP across all directories

**Trustworthiness:**
- Clear pricing (no hidden fees)
- Cancellation/refund policies visible
- Privacy policy and terms of service
- HTTPS everywhere
- Physical business address and ABN displayed
- Multiple contact methods

### 6.2 Content Uniqueness Enforcement

**The 40-50% rule for location pages:**
- At least 40-50% of content on each location page must be unique to that page
- The agent should be able to calculate content similarity between pages
- Shared boilerplate (service descriptions, pricing) should be no more than 50-60% of any page

**How to measure:**
- Use Screaming Frog's near-duplicate detection
- Use Siteliner for internal duplicate scanning
- Manual check: strip shared sections, measure word count of unique content vs total

**Freshness signals:**
- Update location pages at least quarterly
- Add seasonal content (e.g., "Holiday driving lesson availability")
- Update testimonials regularly
- Keep instructor information current
- 50% of content cited in AI search responses is less than 13 weeks old -- freshness is critical for AI visibility

### 6.3 Duplicate Content Prevention

**Technical measures:**
- Self-referencing canonical on every page
- Consistent URL format (trailing slash, www/non-www, HTTP/HTTPS)
- Pagination handled with `rel="next"/"prev"` or single-page load-more
- URL parameters handled in GSC (if applicable)
- No identical pages accessible at different URLs

**Content measures:**
- Never copy-paste location page content with just the city name swapped
- Each location page needs genuinely different local information
- Thin content (under 300 words of unique content) should not exist

---

## 7. Content Architecture and Internal Linking {#7-content-architecture}

### 7.1 Silo/Topic Cluster Design

**Structure principle:** Group related content into tightly themed clusters. Pages within a cluster interlink frequently. Cross-cluster linking is intentional and sparse.

**Example silo for a driving school:**
```
SILO 1: Manual Lessons
  Hub: /services/manual-lessons/
  Spokes:
    /driving-lessons/toowoomba/  (links back to hub)
    /driving-lessons/ipswich/    (links back to hub)
    /driving-lessons/brisbane/   (links back to hub)
    /blog/manual-vs-automatic/   (links to hub)

SILO 2: Test Preparation
  Hub: /services/test-preparation/
  Spokes:
    /guides/queensland-driving-test/
    /guides/logbook-hours-explained/
    /guides/test-routes-toowoomba/

Cross-silo: Manual Lessons hub links to Test Preparation hub (and vice versa)
```

### 7.2 Hub-Spoke Internal Linking

**Rules:**
- Every spoke page links back to its hub
- Every hub links to all its spokes
- Spokes within a cluster can link to each other (nearby suburbs)
- Cross-cluster links go hub-to-hub, not spoke-to-spoke
- Every page reachable within 3 clicks from homepage

### 7.3 Anchor Text Strategy

**Distribution targets (internal links):**
- 30-40% descriptive keyword anchors: "manual driving lessons in Toowoomba"
- 20-30% partial match: "our Toowoomba lessons", "lessons in the area"
- 20-30% branded/navigational: "learn more about YourBrand", "[Brand] services"
- 10-20% generic (use sparingly): "learn more", "see details"

**Rules:**
- Vary anchor text -- never use the same anchor text for the same destination across the site
- Anchor text must be contextually relevant to the linked page
- 2-5 contextual internal links per 1,000 words
- Keep total links per page under 150

### 7.4 Link Equity Distribution

**Principle:** High-authority pages (homepage, popular blog posts, pages with external backlinks) pass link equity through internal links. Direct this equity strategically.

- Homepage should link directly to all hub/pillar pages
- Hub pages should link to all their spoke/cluster pages
- New content gets links from established high-authority pages to bootstrap authority
- Monitor for orphan pages (pages with zero internal links pointing to them)

### 7.5 Orphan Page Prevention

**An orphan page is a page that exists on the site but has no internal links pointing to it.** Search engines struggle to discover and value orphan pages.

**Prevention:**
- Every new page must be linked from at least one existing page before publishing
- Run Screaming Frog crawl monthly to detect orphans
- Every page in the sitemap should be reachable via internal links
- Check: if a page is only discoverable via the sitemap, it is effectively orphaned

---

## 8. SEO Auditing Framework {#8-seo-auditing}

### 8.1 Technical Audit Checklist

**Run quarterly or after major site changes:**

**Crawlability & Indexing:**
- [ ] All important pages return 200 status
- [ ] No important pages blocked by robots.txt
- [ ] No important pages set to noindex
- [ ] No broken internal links (404s)
- [ ] No redirect chains or loops
- [ ] XML sitemap is valid and up to date
- [ ] All sitemap URLs return 200
- [ ] Google Search Console shows no indexing errors

**On-Page:**
- [ ] Every page has a unique title tag under 60 chars
- [ ] Every page has a unique meta description under 160 chars
- [ ] Every page has exactly one H1
- [ ] Header hierarchy is correct (no skipped levels)
- [ ] All images have alt text
- [ ] All images have width/height attributes

**Technical:**
- [ ] Self-referencing canonicals on every page
- [ ] HTTPS on every page, no mixed content
- [ ] Core Web Vitals pass in field data (LCP < 2.5s, INP < 200ms, CLS < 0.1)
- [ ] Mobile-friendly on all pages
- [ ] No orphan pages
- [ ] Hreflang correct (if multi-language)

**Content:**
- [ ] No thin pages (under 300 words unique content)
- [ ] Location pages meet 40-50% uniqueness threshold
- [ ] No exact duplicate pages
- [ ] Content freshness: pages updated within last quarter

### 8.2 Content Gap Analysis

**Process:**
1. Identify target keywords for the business
2. Check which keywords the site currently ranks for (GSC or Semrush)
3. Check which keywords competitors rank for that the site does not
4. Prioritize gaps by search volume and business relevance
5. Recommend new content or page optimization to fill gaps

### 8.3 Competitor Analysis

**What to analyze:**
- Competitor URL structure and site architecture
- Competitor page count and content depth
- Competitor backlink profile (Ahrefs)
- Competitor local citations and GBP completeness
- Competitor schema markup
- Competitor Core Web Vitals scores

### 8.4 Ranking Monitoring

**Using Google Search Console API:**
- Track impressions, clicks, CTR, and average position for target keywords
- Monitor for ranking drops (more than 5 position drop week-over-week)
- Track performance by page type (location pages, service pages, blog posts)
- API provides up to 16 months of historical data
- Set up automated alerts for significant ranking changes

**Key metrics to track:**
- Organic traffic by page
- Keyword rankings for priority terms
- Click-through rate by page
- Indexation rate (pages indexed / pages submitted)
- Core Web Vitals pass rate

---

## 9. Anti-Patterns -- What the Agent Must NEVER Do {#9-anti-patterns}

### 9.1 Content Anti-Patterns

| Anti-Pattern | Why It Is Harmful |
|-------------|-------------------|
| Copy-paste location pages with only city name swapped | Google detects near-duplicates; pages compete with each other; wastes crawl budget |
| Keyword stuffing in titles, headers, or body text | Triggers over-optimization filters; reads as spam to users |
| Hidden text or cloaking | Manual penalty from Google |
| Auto-generated content with no human value | Google's Helpful Content System specifically targets this |
| Thin pages (< 300 words unique content) | Drags down entire site authority |
| Fake testimonials or reviews | Legal issues (Australian Consumer Law) + trust penalty |

### 9.2 Technical Anti-Patterns

| Anti-Pattern | Why It Is Harmful |
|-------------|-------------------|
| Canonicalizing location pages to a single master page | Tells Google to ignore all your location pages |
| Blocking CSS/JS/images in robots.txt | Google cannot render the page; ranking impact |
| Using 302 redirects for permanent URL changes | Link equity not passed; old URL stays in index |
| Redirect chains (A -> B -> C -> D) | Crawl budget waste; link equity dilution |
| Parameter-based URLs for important pages | Hard to canonicalize; crawl budget waste |
| Ignoring INP optimization | 43% of sites fail; direct ranking impact in 2026 |
| Setting fake lastmod dates in sitemaps | Google ignores your sitemap signals if caught |

### 9.3 Local SEO Anti-Patterns

| Anti-Pattern | Why It Is Harmful |
|-------------|-------------------|
| Inconsistent NAP across directories | Confuses Google's entity verification; ranking loss |
| Creating GBP listings for areas with no physical presence | Violates Google guidelines; suspension risk |
| Using a P.O. Box as business address | Violates GBP guidelines |
| Buying fake reviews | Google detects patterns; review removal + suspension |
| Using a 1800 number instead of local number | Weakens local signal |
| Mass-creating citation listings on low-quality directories | Spam signal; wastes time |

### 9.4 Link Anti-Patterns

| Anti-Pattern | Why It Is Harmful |
|-------------|-------------------|
| Same exact-match anchor text on every internal link to a page | Over-optimization signal |
| Excessive links per page (> 150) | Dilutes link equity; crawl budget waste |
| Orphan pages with no internal links | Search engines cannot discover or value them |
| Linking to every page from every page (site-wide links in footer/sidebar) | Dilutes link equity; not a substitute for contextual linking |

---

## 10. Decision Framework Templates {#10-decision-frameworks}

### 10.1 New Page Decision

Before creating any new page, the agent must answer:
1. What search intent does this page serve?
2. Does an existing page already serve this intent? (If yes, optimize it instead)
3. What is the target keyword?
4. Where does this page fit in the silo structure?
5. Which hub page will it link back to?
6. What pages will link TO this new page?
7. Can the page achieve 40-50% unique content?

### 10.2 Location Page Decision

Before creating a location page:
1. Does the business genuinely serve this suburb?
2. Is there enough unique local information to write 150+ unique words about this suburb?
3. Is there a nearby TMR/test center or driving route information specific to this area?
4. Can we get a local testimonial or instructor tie-in for this suburb?
5. Which geographic cluster does this suburb belong to?

### 10.3 URL Structure Decision

When proposing a URL:
1. Is the primary keyword in the URL?
2. Is it under 3 levels of depth?
3. Does it use hyphens and lowercase?
4. Is the trailing slash pattern consistent with the rest of the site?
5. Will this URL need to change in the future? (If so, reconsider)

---

## 11. Handoff Boundaries with Other Agents {#11-handoff-boundaries}

### What SEO Specialist OWNS
- Title tags, meta descriptions, header hierarchy recommendations
- Canonical tag strategy
- XML sitemap generation and maintenance
- robots.txt configuration
- URL structure decisions
- Internal linking architecture
- Content uniqueness enforcement and measurement
- Local SEO strategy (GBP optimization advice, NAP auditing, citation strategy)
- Core Web Vitals monitoring and optimization recommendations
- SEO audit reports
- Keyword research and content gap analysis
- Competitor SEO analysis

### What SEO Specialist Does NOT Own (Handoff to Others)
- **Schema/structured data markup:** Owned by Schema Specialist / GEO agent. SEO validates that schema renders correctly but does not write it.
- **Content writing:** Owned by content writers. SEO provides keyword targets, header structures, and uniqueness requirements. Does not write the prose.
- **GEO (Generative Engine Optimization):** Owned by GEO agent. SEO ensures technical compatibility but does not own AI citation strategy.
- **Frontend implementation:** SEO produces specifications (e.g., "this page needs a canonical tag pointing to X"). Forge/Pixel implements it in SvelteKit/Bootstrap.
- **Performance optimization code:** SEO flags Core Web Vitals failures. Forge/Pixel writes the code fixes (lazy loading, code splitting, etc.).

### Collaboration Patterns
- **SEO -> Forge:** "This page template needs: self-referencing canonical, preloaded LCP image, lazy-loaded below-fold images, these meta tags"
- **SEO -> Content Writer:** "This location page needs: H1 with [keyword], 150+ words unique opening about [suburb], these FAQ questions answered, 40-50% unique content"
- **SEO -> Schema Agent:** "Validate that LocalBusiness schema is rendering for this page; here is the data it should contain"
- **SEO -> Alpha:** "Technical audit complete. 3 critical issues found: [list]. Recommend Forge fix canonicals, Content Writer add unique content to 12 thin location pages."

---

## 12. Verification and Quality Gates {#12-verification-gates}

### Before Publishing Any Page

The SEO Specialist must verify:
1. Title tag is unique and under 60 characters
2. Meta description is unique and under 160 characters
3. H1 exists, is unique, contains primary keyword
4. Self-referencing canonical tag is present and correct
5. Page is included in XML sitemap
6. Page is linked from at least one other page (not orphaned)
7. All images have alt text and dimensions
8. Page passes Lighthouse SEO audit (score 90+)
9. URL follows site conventions

### Before Publishing Location Pages

Additional checks:
1. Content uniqueness is >= 40% compared to other location pages
2. Unique local information is present (landmarks, roads, test centers)
3. Local testimonial or instructor tie-in exists
4. Geographic cluster cross-links are in place
5. NAP on the page matches the master NAP document for this location

### Quarterly Audit Gate

Every quarter, the SEO Specialist should produce:
1. Full technical audit report (using checklist from section 8.1)
2. Content gap analysis update
3. Ranking performance summary
4. Core Web Vitals status across all page templates
5. List of action items prioritized by impact

---

## Appendix: Key Statistics for 2026

- Google uses mobile-first indexing exclusively (since 2023)
- 43% of sites fail the INP 200ms threshold (most commonly failed CWV)
- 16% average ranking boost from fixing NAP inconsistencies
- 40% of Google Maps ranking influenced by citation prominence
- 50% of content cited in AI search responses is < 13 weeks old
- AI-referred web sessions grew 527% year-over-year in early 2025
- AI Overviews appear on ~40% of search queries but only ~7% of local queries
- A 1-second load time delay reduces conversions by 7%
- 30-50 high-quality citations per location is the target; beyond that, diminishing returns
- Google recommends DOM size under 1,500 nodes for optimal INP

---

## Sources

- [The Ultimate Technical SEO Checklist for 2026 - The HOTH](https://www.thehoth.com/blog/seo-technical-checklist/)
- [10 Best SEO Audit Tools for 2026 - Semrush](https://www.semrush.com/blog/seo-audit-tools/)
- [Core Web Vitals 2026: Technical SEO That Actually Moves the Needle - ALM Corp](https://almcorp.com/blog/core-web-vitals-2026-technical-seo-guide/)
- [Local SEO: The Definitive Guide for 2026 - Backlinko](https://backlinko.com/local-seo-guide)
- [Google Business Profile Best Practices for 2026 - LocalMighty](https://www.localmighty.com/blog/google-business-profile-optimization-best-practices/)
- [Top Local SEO Ranking Factors in 2026 - Top IT Marketing](https://www.topitmarketing.com/top-local-seo-ranking-factors-in-2026-what-google-prioritizes/)
- [NAP Consistency for Local SEO Complete Guide 2026 - Amigo Studios](https://www.amigostudios.co/blog/nap-consistency-local-seo)
- [Local Citation Guide: Complete 2026 SEO Strategy - Navoto](https://navoto.com/blog/local-citation-guide/)
- [Internal Linking Best Practices for SEO 2026 - Upward Engine](https://upwardengine.com/internal-linking-best-practices-seo/)
- [Silo Structure SEO - Tangence](https://www.tangence.in/blog/silo-structure-seo/)
- [SEO Tools 2026 Compared - Radiant Demand](https://www.radiantdemand.com/the-2026-seo-tool-stack-showdown-semrush-vs-ahrefs-vs-majestic-vs-moz/)
- [Crawl Budget Optimization: Complete Guide for 2026 - LinkGraph](https://www.linkgraph.com/blog/crawl-budget-optimization-2/)
- [Robots.txt Guide 2026 - Vijay Bhabhor](https://vijaybhabhor.com/blog/robots-txt)
- [Google Search Console API: Advanced Guide 2026 - Incremys](https://www.incremys.com/en/resources/blog/google-search-console-api)
- [10 SEO Mistakes Killing Your Organic Traffic in 2026 - Balistro](https://www.balistro.com/seo-mistakes-killing-organic-traffic-2026/)
- [How to Fix Duplicate Content SEO Issues 2026 - Decoding](https://trydecoding.com/blog/how-to-fix-duplicate-content-seo-issues/)
