# Skills Research: Schema Specialist (Structured Data)

**Date:** 2026-04-02
**Requested By:** Peter (via Alpha)
**For Role:** Schema Specialist — Owns all schema.org and structured data implementation

---

## Table of Contents

1. [Core Technical Skills](#1-core-technical-skills)
2. [Schema.org Type Hierarchy Mastery](#2-schemaorg-type-hierarchy-mastery)
3. [JSON-LD Architecture Patterns](#3-json-ld-architecture-patterns)
4. [Google vs Schema.org: The Spec Gap](#4-google-vs-schemaorg-the-spec-gap)
5. [Rich Result Types and Eligibility](#5-rich-result-types-and-eligibility)
6. [Validation Tooling and Workflow](#6-validation-tooling-and-workflow)
7. [Schema for AI and GEO](#7-schema-for-ai-and-geo)
8. [Domain-Specific Schema Patterns](#8-domain-specific-schema-patterns)
9. [Anti-Patterns and Common Mistakes](#9-anti-patterns-and-common-mistakes)
10. [Tools and Ecosystem](#10-tools-and-ecosystem)
11. [Recommended Agent Knowledge Base](#11-recommended-agent-knowledge-base)

---

## 1. Core Technical Skills

### 1.1 JSON-LD Syntax Mastery
**Why it matters:** JSON-LD is the only format Google recommends, and the only format that scales cleanly across any CMS or static site.

- **JSON-LD fundamentals** — `@context`, `@type`, `@id`, `@graph`, nested objects, arrays
- **Script tag injection** — JSON-LD goes in `<script type="application/ld+json">` tags, preferably in the `<head>`
- **Multiple blocks per page** — Multiple `<script>` tags are valid and supported; each can describe a different entity
- **`@graph` usage** — Group multiple entities in a single script tag when they reference each other; use `@graph` as an array of entity objects
- **`@id` references** — Define an entity once with a stable `@id`, reference it elsewhere by `@id` alone instead of duplicating data
- **Hash fragment IDs** — Convention: use URL + hash fragment for IDs (e.g., `https://example.com/#organization`, `https://example.com/page/#webpage`, `https://example.com/#breadcrumb`)
- **`sameAs` linking** — Connect entities to authoritative external profiles (Wikipedia, Wikidata, social profiles, Google Maps)
- **Property value types** — Know when a property expects Text, URL, a nested Type, or an enumeration value

### 1.2 Schema-Content Alignment
**Why it matters:** Google's #1 policy is that structured data must reflect visible page content. Misalignment causes manual actions and rich result loss.

- **Exact match requirement** — Every claim in schema (prices, ratings, names, descriptions) must match what users see on the page
- **Dynamic content awareness** — If prices or availability change dynamically, schema must update in sync
- **Hidden content prohibition** — Schema must not describe content that is hidden from users (CSS display:none, etc.)
- **Review authenticity** — AggregateRating and Review must reflect real, visible reviews on the page
- **Image accuracy** — Images referenced in schema must be the images actually displayed to users

### 1.3 Entity Graph Thinking
**Why it matters:** In 2026, the primary value of structured data is building a machine-readable entity graph — not just triggering rich snippets. AI engines, Google's Knowledge Graph, and LLMs all consume entity relationships.

- **Entity-first mindset** — Think in terms of entities (Organization, Person, Product, Service, Place) and their relationships, not in terms of "which rich result do I want"
- **Graph coherence** — All entities on a site should form a connected graph via `@id` references
- **Disambiguation** — Use `sameAs` to link to Wikipedia/Wikidata to help AI engines disambiguate your entities from others with the same name
- **Consistency across pages** — Organization entity must have identical `@id`, `name`, `url` on every page
- **Cross-page references** — A Service page references the Organization by `@id`; a Person page references the Organization as `worksFor`

---

## 2. Schema.org Type Hierarchy Mastery

### 2.1 Hierarchy Structure
The agent must be able to navigate schema.org's type hierarchy fluently. Key reference: https://schema.org/docs/full.html

**Root:** `Thing` is the root of all types. Everything inherits from Thing.

**Primary branches the agent must know deeply:**

| Branch | Key Types | Common Use Cases |
|--------|-----------|-----------------|
| **Organization** | Organization, LocalBusiness, Corporation, EducationalOrganization, MedicalOrganization | Business identity, about pages |
| **LocalBusiness** subtypes | Restaurant, AutomotiveBusiness, HealthAndBeautyBusiness, LegalService, FinancialService, FoodEstablishment, LodgingBusiness, SportsActivityLocation, Store (and subtypes) | Local SEO, Google Maps integration |
| **CreativeWork** | Article, BlogPosting, WebPage, WebSite, FAQPage, HowTo, Recipe, Course, Book, SoftwareApplication, VideoObject | Content pages, media |
| **Product** | Product, ProductGroup, IndividualProduct, Vehicle | E-commerce, product pages |
| **Service** | Service, FinancialProduct, BroadcastService | Service businesses |
| **Event** | Event, BusinessEvent, EducationEvent, MusicEvent, SportsEvent | Event listings |
| **Person** | Person | Author pages, team pages, expert profiles |
| **Place** | Place, City, Country, State, PostalAddress, GeoCoordinates | Location data |
| **Action** | SearchAction, OrderAction, ReserveAction, BuyAction | Sitelinks search, booking |
| **Intangible** | Offer, AggregateOffer, AggregateRating, Review, BreadcrumbList, ItemList, Rating, OpeningHoursSpecification | Supporting entities embedded in others |

### 2.2 Multi-Typed Entities (MTEs)
**When to use:** When a single real-world entity legitimately belongs to multiple type categories.

**Syntax:**
```json
{
  "@type": ["LocalBusiness", "AutomotiveBusiness", "EducationalOrganization"]
}
```

**Valid use cases:**
- A driving school: `["AutomotiveBusiness", "EducationalOrganization"]`
- A book sold online: `["Book", "Product"]`
- A hotel room for sale: `["HotelRoom", "Product"]`
- A SaaS product: `["SoftwareApplication", "Product"]`

**Rules:**
- All types in the array must legitimately describe the same entity
- Properties from ALL listed types become valid for the entity
- Google may only recognize/use one of the types for rich results
- Use the most specific type first in the array
- Do NOT combine unrelated types (e.g., `["Restaurant", "SoftwareApplication"]`)

### 2.3 Type Selection Decision Framework

The agent should follow this process when selecting types:

1. **Identify the real-world entity** — What is this page actually about?
2. **Find the most specific type** — Navigate the hierarchy downward from Thing. A `Restaurant` is better than `FoodEstablishment` which is better than `LocalBusiness`
3. **Check Google's Search Gallery** — Does Google support this specific type for rich results? If yes, use it exactly as Google documents
4. **Consider MTE if needed** — If the entity legitimately has two natures (a product that is also a creative work), use an MTE
5. **Check property availability** — If the most specific type lacks a needed property, check if a parent type or MTE provides it
6. **Default up, not sideways** — If unsure, use the parent type rather than a sibling type

---

## 3. JSON-LD Architecture Patterns

### 3.1 Single Entity Pattern (Simple Pages)
One script tag, one entity. Used for simple pages with one primary entity.

```json
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "Example Product",
  ...
}
</script>
```

### 3.2 Multiple Script Tags Pattern
Multiple independent script tags. Used when entities are not tightly related.

```json
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  ...
}
</script>
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Product",
  ...
}
</script>
```

### 3.3 @graph Pattern (Connected Entities)
**Recommended for most pages.** Groups related entities in a single block with cross-references via `@id`.

```json
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://example.com/#organization",
      "name": "Example Corp",
      "url": "https://example.com",
      "sameAs": ["https://www.wikidata.org/wiki/Q12345"]
    },
    {
      "@type": "WebSite",
      "@id": "https://example.com/#website",
      "url": "https://example.com",
      "publisher": { "@id": "https://example.com/#organization" }
    },
    {
      "@type": "WebPage",
      "@id": "https://example.com/page/#webpage",
      "url": "https://example.com/page/",
      "isPartOf": { "@id": "https://example.com/#website" },
      "breadcrumb": { "@id": "https://example.com/page/#breadcrumb" }
    },
    {
      "@type": "BreadcrumbList",
      "@id": "https://example.com/page/#breadcrumb",
      "itemListElement": [...]
    }
  ]
}
</script>
```

**Key principles:**
- Define each entity once with a stable `@id`
- Reference related entities by `@id` only (not by duplicating all properties)
- The `@id` convention is URL + hash fragment
- Keep `@id` values consistent across the entire site
- `@context` only needs to appear once at the top level

### 3.4 Nesting Pattern
For simple parent-child relationships where the child entity doesn't need its own `@id`.

```json
{
  "@type": "Product",
  "name": "Running Shoes",
  "offers": {
    "@type": "Offer",
    "price": "89.99",
    "priceCurrency": "AUD"
  }
}
```

**When to nest vs. when to use @id references:**
- **Nest** when the child entity only appears in one place (an Offer that belongs to one Product)
- **Use @id** when the same entity is referenced from multiple places (Organization referenced by many pages)

### 3.5 Site-Wide Entity Architecture

**Every site should have these persistent entities:**

| Entity | @id Convention | Where Defined | Referenced By |
|--------|---------------|---------------|---------------|
| Organization | `/#organization` | Every page (or a shared include) | WebSite, WebPage, Article, Service, etc. |
| WebSite | `/#website` | Every page | WebPage |
| WebPage | `/page-url/#webpage` | Each page (unique) | Breadcrumb, mainEntity |
| BreadcrumbList | `/page-url/#breadcrumb` | Each page (unique) | WebPage |

**Page-specific entities** (the `mainEntity` of each page):
- Article/BlogPosting for blog posts
- Product for product pages
- Service for service pages
- FAQPage for FAQ pages
- LocalBusiness for location pages
- Person for team/author pages
- Event for event pages

---

## 4. Google vs Schema.org: The Spec Gap

### 4.1 Core Differences
This is critical knowledge. Schema.org is a broad vocabulary; Google only supports a subset for rich results and has its own additional requirements on top.

**Schema.org:**
- ~800+ types, ~1400+ properties
- Any valid type/property combination is "correct"
- No required properties (everything is optional)
- Broader than any single consumer

**Google:**
- Supports ~25-30 types for rich results (Search Gallery is the canonical list)
- Has REQUIRED properties for each type (missing them = no rich result)
- Has RECOMMENDED properties (including them improves rich result quality)
- Has additional content policies beyond schema.org's spec
- May ignore types/properties it doesn't support even if schema.org-valid

### 4.2 Google's Currently Supported Rich Result Types (as of April 2026)

**Active and fully supported:**
- Article / NewsArticle / BlogPosting
- BreadcrumbList
- Course (with CourseInstance)
- Discussion Forum (DiscussionForumPosting)
- EmployerAggregateRating
- Event
- FAQ (FAQPage) — **restricted to authoritative health/government sites for rich results since 2023; still useful for AI visibility**
- HowTo — **desktop only since 2023; still useful for AI**
- JobPosting
- LocalBusiness (and subtypes)
- MathSolver
- Movie
- Organization
- Product (with Offer, AggregateRating, Review)
- ProfilePage
- Recipe
- Review / AggregateRating
- SoftwareApplication
- Speakable
- VideoObject
- WebSite (for Sitelinks search box — **being deprecated Jan 2026**)

**Recently deprecated/removed (2025-2026):**
- Book Actions
- Claim Review / Fact Check
- Course Info (old format — replaced by new Course + CourseInstance)
- Estimated Salary
- Learning Video
- Practice Problem
- Special Announcement
- Vehicle Listing
- Dataset (for general search — now only for Dataset Search)
- Q&A (StackOverflow-style)

### 4.3 Google's Content Policies for Structured Data
Beyond schema.org validity, Google requires:

1. **Structured data must represent the main content of the page** — not supplementary or hidden content
2. **Complete and specific** — all required properties must be present and accurate
3. **Up to date** — stale prices, expired events, or outdated info violates policy
4. **Not misleading** — schema claims must match visible content exactly
5. **Not spammy** — no marking up irrelevant content to game rich results
6. **One type per intent** — don't mark up the same content with multiple competing schema types hoping one sticks
7. **Page must be crawlable** — blocked by robots.txt or noindex defeats the purpose

### 4.4 Platform-Specific Differences
Google is not the only consumer:

| Platform | Notable Differences |
|----------|-------------------|
| **Google** | Strictest requirements, most documented, Search Gallery is canonical |
| **Bing** | Supports some types Google doesn't; less documentation |
| **Pinterest** | Uses schema for Rich Pins (Product, Recipe, Article) |
| **Apple (Siri)** | Reads schema for voice results |
| **AI Engines** (ChatGPT, Perplexity, Claude, Gemini) | Read ALL valid schema.org, not limited to Google's subset |
| **Social platforms** | Prefer Open Graph/Twitter Cards over schema.org for previews |

**Key insight for the agent:** Implement schema.org correctly and completely even for types Google doesn't use for rich results, because AI engines consume everything.

---

## 5. Rich Result Types and Eligibility

### 5.1 Rich Result Audit Checklist
For each page type, the agent must know:

1. **Which schema type(s) apply**
2. **Required properties** (no rich result without them)
3. **Recommended properties** (improve quality/appearance)
4. **Image requirements** (dimensions, format, ratio)
5. **Content policies** (what Google actually enforces)
6. **Eligibility restrictions** (some types restricted to certain site types)

### 5.2 High-Value Rich Results by Project Type

**Local Business Sites:**
- LocalBusiness (or specific subtype) — business info in Knowledge Panel
- BreadcrumbList — navigation trail in SERP
- FAQPage — expandable Q&A (restricted sites only for rich results, but useful for AI)
- Review/AggregateRating — star ratings in SERP
- Service — service descriptions
- Event — if applicable

**E-Commerce Sites:**
- Product + Offer — price, availability, reviews in SERP
- BreadcrumbList — navigation
- AggregateRating — stars
- FAQPage — product Q&A
- Organization — brand identity

**Content/Blog Sites:**
- Article/BlogPosting — article rich result
- BreadcrumbList — navigation
- Person (author) — author credibility
- FAQPage — expandable Q&A
- VideoObject — video carousel
- HowTo — step-by-step (desktop)

**SaaS/Software:**
- SoftwareApplication or WebApplication — app info
- Organization — company identity
- FAQPage — product Q&A
- Review/AggregateRating — trust signals
- BreadcrumbList — navigation
- Offer — pricing display

### 5.3 FAQ Rich Results: The 2023+ Reality
FAQ Schema deserves special attention because it changed dramatically:

- **Before August 2023:** FAQPage rich results appeared for all sites
- **After August 2023:** FAQ rich results restricted to "well-known, authoritative government and health websites"
- **Current status (2026):** Rich result eligibility is very limited
- **But:** FAQ schema remains extremely valuable for:
  - AI engine understanding (ChatGPT, Perplexity, Gemini all read it)
  - Google AI Overviews (structured Q&A helps citation)
  - Content organization signals
  - Voice search / Speakable
- **Recommendation:** Still implement FAQPage schema on all relevant pages. The value is in AI visibility, not rich results.

---

## 6. Validation Tooling and Workflow

### 6.1 Essential Tools

**Primary Validation:**

| Tool | Purpose | URL |
|------|---------|-----|
| **Google Rich Results Test** | Tests if your schema qualifies for Google rich results; shows warnings/errors | https://search.google.com/test/rich-results |
| **Schema Markup Validator** (schema.org) | Validates against the full schema.org spec (broader than Google) | https://validator.schema.org/ |
| **Google Search Console** | Monitors live rich result status, errors, and impressions over time | https://search.google.com/search-console |

**Secondary/Supplementary:**

| Tool | Purpose |
|------|---------|
| **SchemaValidator.org** | Independent validator with good error explanations |
| **Screaming Frog** | Crawls entire sites and extracts/validates schema at scale |
| **Sitebulb** | Site audit tool with structured data validation |
| **Ahrefs / Semrush** | SEO suites that include schema auditing in site audits |

**Development/IDE:**

| Tool | Purpose |
|------|---------|
| **JSON-LD Playground** (json-ld.org) | Test JSON-LD syntax and see expanded/compacted forms |
| **VS Code JSON Schema extension** | Inline validation while writing JSON-LD |
| **Browser DevTools** | Inspect rendered JSON-LD in the DOM (especially for JS-rendered schema) |

### 6.2 Validation Workflow

**Pre-deployment (per page/template):**
1. Write JSON-LD in editor/IDE
2. Validate syntax in JSON-LD Playground (catches JSON syntax errors)
3. Validate against schema.org in Schema Markup Validator (catches type/property errors)
4. Test in Google Rich Results Test (catches Google-specific requirement gaps)
5. Review warnings — Google's "recommended" properties should be treated as required

**Post-deployment:**
1. Submit URL to Google Search Console URL Inspection tool
2. Monitor Rich Results report in Search Console for errors
3. Set up alerts for new structured data errors
4. Run periodic site-wide crawl (Screaming Frog / Sitebulb) to catch drift

**At scale (multi-page sites):**
1. Validate the template, not individual pages — if the template is correct, all pages using it will be correct
2. Spot-check 5-10 rendered pages after deployment
3. Monitor Search Console for type-level error counts (e.g., "Product has errors on 47 pages")
4. Use Screaming Frog to bulk-extract and validate schema across all pages

### 6.3 Search Console Monitoring Protocol

The agent should establish and maintain:
- **Weekly check** of Rich Results reports for new errors
- **Monthly audit** of structured data coverage (are all page types covered?)
- **Quarterly review** of Google's documentation for deprecated/new types
- **Immediate response** to any manual action or security issue related to structured data

---

## 7. Schema for AI and GEO

### 7.1 Why Schema Matters More for AI Than for Rich Results

This is the most important strategic shift of 2025-2026:

- **Rich results** are a nice-to-have bonus — they improve CTR on traditional search
- **AI visibility** is the strategic imperative — schema feeds knowledge graphs that AI engines use to understand, verify, and cite your content

**Key data points:**
- Businesses with schema markup are cited in AI Overviews up to 3.2x more often than those without
- Organization and Person schema with `sameAs` identifiers became the highest-leverage implementation after Google's March 2026 core update
- Entity disambiguation schema is the single highest-value implementation for AI visibility

### 7.2 Schema Properties That AI Engines Prioritize

**Entity Identity (highest priority):**
- `@id` — stable unique identifier
- `name` — consistent across all pages
- `sameAs` — links to Wikipedia, Wikidata, LinkedIn, social profiles
- `url` — canonical URL
- `identifier` — business registration numbers, tax IDs

**Entity Relationships:**
- `author` — who created this content (links to Person entity)
- `publisher` — who published this (links to Organization entity)
- `provider` — who provides this service
- `worksFor` — person's employer
- `parentOrganization` / `subOrganization` — corporate hierarchy

**Content Claims (what AI engines verify):**
- `aggregateRating` — must match visible reviews
- `offers` — prices must match visible prices
- `datePublished` / `dateModified` — content freshness signal
- `about` — topic disambiguation

**Geographic:**
- `areaServed` — where the business operates
- `address` — physical location
- `geo` — lat/long coordinates

### 7.3 AI-Optimized Schema Strategy

1. **Entity-first implementation** — Start with Organization, Person, and WebSite schema before worrying about Product or Article schema
2. **sameAs everything** — Link every entity to every authoritative external profile
3. **Consistent @id graph** — Build a coherent site-wide graph where all entities are connected
4. **FAQ schema everywhere** — Even though Google restricts FAQ rich results, AI engines read and cite FAQ schema heavily
5. **Speakable schema** — Mark up content sections that are suitable for voice/audio playback; AI voice assistants use this
6. **Keep schema current** — AI engines penalize stale data; dates, prices, and availability must be accurate

---

## 8. Domain-Specific Schema Patterns

The agent must be ready for any project type. Here are the key patterns:

### 8.1 Local Business (Single Location)
```
Organization > LocalBusiness > [specific subtype]
+ PostalAddress + GeoCoordinates + OpeningHoursSpecification
+ Service (for each service offered)
+ AggregateRating + Review
+ areaServed (cities/suburbs served)
+ sameAs (Google Maps, Facebook, directories)
```

### 8.2 Local Business (Multiple Locations)
```
Organization (parent, /#organization)
  ├── LocalBusiness (location 1, /location-1/#localbusiness)
  ├── LocalBusiness (location 2, /location-2/#localbusiness)
  └── LocalBusiness (location 3, /location-3/#localbusiness)

Each LocalBusiness:
+ parentOrganization: { @id: "/#organization" }
+ Own PostalAddress, GeoCoordinates, OpeningHoursSpecification
+ Own areaServed
+ Own AggregateRating (location-specific)
```

### 8.3 Service Area Business (No Storefront)
```
LocalBusiness
+ address (base/office address — can be hidden from public if home-based)
+ areaServed: [
    { @type: "City", name: "Brisbane" },
    { @type: "City", name: "Gold Coast" },
    { @type: "GeoCircle", geoMidpoint: {...}, geoRadius: "50km" }
  ]
+ Service (for each service, with own areaServed if different)
```

### 8.4 E-Commerce Product Pages
```
Product
+ name, description, image, sku, brand
+ offers: Offer (single variant)
  OR offers: [Offer, Offer, ...] (multiple variants with individual SKUs)
  OR offers: AggregateOffer (price range across variants)
+ aggregateRating + review
+ ProductGroup (for variant groupings — size, color)

BreadcrumbList (site navigation path)
```

**Variant handling decision:**
- **Single price, no variants** → `Offer`
- **Multiple variants, want to show each** → Array of `Offer` with `sku` on each
- **Multiple variants, want to show range** → `AggregateOffer` with `lowPrice` and `highPrice`
- **Complex variant matrix** → `ProductGroup` with `hasVariant` pointing to individual `Product` entries

### 8.5 SaaS / Software Products
```
SoftwareApplication or WebApplication
+ name, description, applicationCategory
+ operatingSystem: "Web" (for WebApplication)
+ offers: [
    { @type: "Offer", name: "Monthly", price: "29", priceCurrency: "USD" },
    { @type: "Offer", name: "Annual", price: "290", priceCurrency: "USD" }
  ]
  OR AggregateOffer for price range
+ aggregateRating + review
+ author/publisher: Organization
```

### 8.6 Content / Blog Sites
```
Article or BlogPosting
+ headline, datePublished, dateModified
+ author: Person (with @id, sameAs, linked to authoritative profiles)
+ publisher: Organization (with @id)
+ image (required for Article rich results — min 696px wide)
+ mainEntityOfPage: WebPage

Person (author entity)
+ name, url, sameAs, jobTitle, worksFor

FAQPage (if page contains Q&A content)
+ mainEntity: [Question, Question, ...]
```

### 8.7 Event Pages
```
Event
+ name, startDate, endDate (ISO 8601)
+ location: Place or VirtualLocation
+ organizer: Organization or Person
+ offers: Offer (ticket pricing)
+ eventStatus: EventScheduled / EventCancelled / EventPostponed
+ eventAttendanceMode: OfflineEventAttendanceMode / OnlineEventAttendanceMode / MixedEventAttendanceMode
+ image, description
```

### 8.8 Course / Educational Content
```
Course
+ name, description, provider: Organization
+ hasCourseInstance: CourseInstance
  + courseMode: "online" / "onsite" / "blended"
  + courseSchedule / startDate / endDate
  + instructor: Person
  + offers: Offer
```

---

## 9. Anti-Patterns and Common Mistakes

### 9.1 Schema Errors That Break Rich Results

| Mistake | Impact | Fix |
|---------|--------|-----|
| Missing required properties | No rich result at all | Always check Google's docs for required properties per type |
| Invalid date format | Parsing failure | Always use ISO 8601: `YYYY-MM-DD` or `YYYY-MM-DDThh:mm:ss+TZ` |
| Mismatched prices | Manual action risk | Schema price must exactly match visible page price |
| Missing images | No Article/Product rich result | Article needs image >= 696px wide; Product needs at least one image |
| Broken JSON syntax | Complete parse failure | Misplaced comma, unclosed bracket, trailing comma — validate JSON first |
| Using Microdata or RDFa instead of JSON-LD | Works but harder to maintain | Always use JSON-LD; it's what Google recommends and what scales |
| Schema on wrong page | Wasted effort | Product schema on the product page, not the category page |
| Mixing markup formats | Confuses parsers | Pick JSON-LD and use it exclusively |

### 9.2 Strategic Anti-Patterns

| Anti-Pattern | Why It's Wrong | Correct Approach |
|-------------|---------------|-----------------|
| **Schema stuffing** — marking up everything hoping something sticks | Dilutes signals, can trigger spam flags | Mark up the primary entity of each page plus supporting types (Breadcrumb, Organization) |
| **Invisible schema** — schema describes content users can't see | Violates Google policy | Every schema claim must match visible content |
| **Copy-paste schema** — same schema block on every page | Duplicate entity confusion | Each page needs unique schema reflecting its unique content |
| **Ignoring deprecated types** — using types Google dropped | Wasted effort, potential errors | Check Search Gallery quarterly |
| **Over-nesting** — deeply nested objects that could use @id references | Hard to maintain, hard to debug | Use @id + @graph for anything referenced from multiple places |
| **Fake reviews** — schema with review data that doesn't exist on page | Manual action from Google | Only mark up reviews that are genuinely visible on the page |
| **Self-serving reviews** — Organization page with its own AggregateRating | Google explicitly prohibits this pattern for LocalBusiness on its own pages | Use third-party review platforms |
| **Orphaned entities** — schema entities with no @id and no connection to the page graph | AI engines can't link them to your brand | Connect everything via @id references |
| **Ignoring non-Google consumers** — only implementing what Google uses for rich results | Misses AI visibility opportunity | Implement full, valid schema.org regardless of Google's rich result support |

### 9.3 Technical Gotchas

- **Trailing commas in JSON** — valid in JavaScript, INVALID in JSON. Will break the entire block.
- **Single quotes** — JSON requires double quotes only
- **Unescaped characters** — Quotes in text values must be escaped: `\"like this\"`
- **URL consistency** — Use the same protocol (https) and format (with or without trailing slash) everywhere
- **Price as number vs string** — Google accepts both, but consistency matters. Use string for JSON-LD: `"price": "29.99"`
- **Currency** — Always include `priceCurrency` with every price. Missing it = no price display.
- **datePublished format** — `2026-04-02` is valid. `April 2, 2026` is NOT valid.

---

## 10. Tools and Ecosystem

### 10.1 Primary Reference Documentation

| Resource | URL | Use |
|----------|-----|-----|
| schema.org Full Hierarchy | https://schema.org/docs/full.html | Type lookup and hierarchy navigation |
| Google Search Gallery | https://developers.google.com/search/docs/appearance/structured-data/search-gallery | Canonical list of Google-supported types |
| Google General SD Guidelines | https://developers.google.com/search/docs/appearance/structured-data/sd-policies | Content policies and quality rules |
| W3C JSON-LD Best Practices | https://w3c.github.io/json-ld-bp/ | JSON-LD syntax reference |

### 10.2 Validation Tools

| Tool | Use Case |
|------|----------|
| Google Rich Results Test | Pre-deployment validation for Google eligibility |
| Schema Markup Validator (validator.schema.org) | Full schema.org spec validation |
| Google Search Console | Post-deployment monitoring |
| Screaming Frog SEO Spider | Site-wide schema extraction and audit |
| JSON-LD Playground (json-ld.org/playground) | Syntax testing and debugging |

### 10.3 Generation and Management Tools

| Tool | Best For |
|------|----------|
| Schema App | Enterprise schema management with knowledge graph approach |
| Milestone Schema Manager | Automated schema discovery and deployment at scale |
| Rank Math (WordPress) | WordPress schema with custom templates |
| Yoast SEO (WordPress) | WordPress schema with graph-style coherent output |
| Merkle Schema Markup Generator | Quick manual generation of common types |
| Custom JSON-LD templates | Best approach for custom CMS / static sites |

### 10.4 Monitoring and Intelligence

| Tool | Purpose |
|------|---------|
| Google Search Console Rich Results report | Track rich result impressions, clicks, errors |
| Ahrefs / Semrush Site Audit | Structured data errors in site-wide audits |
| Schema.org release notes | Track new types, deprecated types, property changes |
| Google Search Central blog | Announcements about supported/deprecated types |
| Search Engine Journal / Search Engine Land | Industry news on structured data changes |

---

## 11. Recommended Agent Knowledge Base

### 11.1 What the Agent File Must Include

The Schema Specialist agent file should encode:

1. **Decision trees** for type selection (given a page type, which schema types?)
2. **Template library** — JSON-LD templates for every common page type (local business, product, article, service, FAQ, event, SaaS, person, organization)
3. **Required properties checklists** — per Google's docs for each type
4. **@id convention** — the hash fragment naming system for the site graph
5. **Validation workflow** — the exact sequence of validation steps
6. **Cross-agent interfaces** — how to work with SEO Specialist (who decides content strategy) and GEO Specialist (who decides AI visibility strategy)
7. **Currency protocol** — how to stay current with schema.org and Google changes

### 11.2 Collaboration Boundaries

| Responsibility | Owner |
|---------------|-------|
| What content goes on a page | SEO Specialist / Content Specialist |
| What structured data describes that content | **Schema Specialist** |
| Which schema types to use | **Schema Specialist** |
| Whether schema aligns with GEO strategy | GEO Specialist advises, **Schema Specialist** implements |
| Schema validation and debugging | **Schema Specialist** |
| Rich result monitoring in Search Console | **Schema Specialist** monitors, SEO Specialist acts on findings |
| Deciding to add FAQ content to a page | SEO Specialist / Content Specialist |
| Marking up that FAQ content as FAQPage schema | **Schema Specialist** |

### 11.3 Key Opinions / Recommendations

Based on this research, the Schema Specialist should be opinionated about:

1. **Always use @graph pattern** — Don't use multiple disconnected script tags. Use a single @graph block with @id references. It's cleaner, more maintainable, and builds a proper entity graph.

2. **Always implement Organization + WebSite + BreadcrumbList** — These three are baseline for every page on every site. No exceptions.

3. **FAQPage schema on every page with Q&A content** — Regardless of Google's rich result restrictions. The AI visibility value alone justifies it.

4. **Entity disambiguation is the highest-value implementation** — Organization and Person schema with `sameAs` links to Wikipedia/Wikidata/LinkedIn provide more long-term value than any rich result.

5. **Template-based implementation** — Build JSON-LD as templates per page type. Never hand-code schema for individual pages if the site has more than 5 pages.

6. **Validate before deploy, monitor after deploy** — No schema goes live without passing Rich Results Test. No schema stays live without Search Console monitoring.

7. **Schema is a living system** — It requires quarterly review as Google deprecates types and schema.org evolves. The agent should flag currency checks proactively.

8. **Google is not the only audience** — Implement complete, valid schema.org even beyond what Google currently uses for rich results. AI engines read everything.

---

## Appendix: Research Sources

- [schema.org Full Hierarchy](https://schema.org/docs/full.html)
- [schema.org Multi-Typed Entities Wiki](https://github.com/schemaorg/schemaorg/wiki/How-to-use-Multi-Typed-Entities-or-MTEs)
- [Google Search Gallery](https://developers.google.com/search/docs/appearance/structured-data/search-gallery)
- [Google General Structured Data Guidelines](https://developers.google.com/search/docs/appearance/structured-data/sd-policies)
- [W3C JSON-LD Best Practices](https://w3c.github.io/json-ld-bp/)
- [JSON-LD Tutorial: Syntax, @id, @graph, Validation (Squin.org)](https://squin.org/structured-data/json-ld-tutorial/)
- [Schema Markup Best Practices 2026 (Geneo)](https://geneo.app/blog/schema-markup-best-practices-2026-json-ld-audit/)
- [Using @id in Schema.org for SEO, LLMs, & Knowledge Graphs (Momentic)](https://momenticmarketing.com/blog/id-schema-for-seo-llms-knowledge-graphs)
- [Structured Data & Knowledge Graphs: Language of GEO (Inter-Dev)](https://inter-dev.co.il/why-structured-data-knowledge-graphs-are-the-true-language-of-geo/)
- [Schema Markup After March 2026 (Digital Applied)](https://www.digitalapplied.com/blog/schema-markup-after-march-2026-structured-data-strategies)
- [Why Structured Data in AI Search Matters (Writesonic)](https://writesonic.com/blog/structured-data-in-ai-search)
- [Google Rich Results: Every Type and CTR Impact 2026 (SchemaValidator.org)](https://schemavalidator.org/guides/google-rich-results)
- [Google Drops 7 Schema Types (ViserX)](https://viserx.com/blog/seo/google-drops-7-schema-types)
- [Google Is Not Diminishing Structured Data in 2026 (SEJ)](https://www.searchenginejournal.com/google-is-not-diminishing-the-use-of-structured-data-in-2026/560516/)
- [Schema for SaaS & Tech Companies (Dan Taylor)](https://dantaylor.online/blog/schema-for-saas-subscription-products/)
- [Local Business Schema for Multiple Locations (Postelniak)](https://postelniak.com/blog/local-business-schema-for-multiple-locations/)
- [E-Commerce Schema Markup Guide 2026 (Koanthic)](https://koanthic.com/en/e-commerce-schema-markup-complete-guide-examples-2026/)
- [Structured Data Testing Tools Guide (SchemaValidator.org)](https://schemavalidator.org/guides/structured-data-testing-tool)
- [Best Schema Markup Generators 2026 (Single Grain)](https://www.singlegrain.com/artificial-intelligence/best-schema-markup-generators-in-2026/)
