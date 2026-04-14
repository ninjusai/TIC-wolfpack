"""
Shared fixtures for the BCE V2.1 Algorithmic Eval Harness.

Provides:
  - In-memory SQLite database with full schema + seed data
  - Sample HTML content fixtures
  - Sample JSON-LD fixtures
  - CSS catalogue fixtures (Tier 1/2/3)
  - Link graph fixtures
  - Freshness data fixtures
"""

import json
import sqlite3
import textwrap
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

import pytest

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

APP_ROOT = Path(__file__).resolve().parent.parent.parent / "app"
MIGRATIONS_DIR = APP_ROOT / "src" / "lib" / "db" / "migrations"


# ---------------------------------------------------------------------------
# Database fixture
# ---------------------------------------------------------------------------


def _apply_migrations(conn: sqlite3.Connection) -> None:
    """Apply all SQL migration files in order."""
    conn.execute("PRAGMA foreign_keys = ON")
    migration_files = sorted(MIGRATIONS_DIR.glob("*.sql"))
    for mf in migration_files:
        conn.executescript(mf.read_text(encoding="utf-8"))


def _seed_test_data(conn: sqlite3.Connection) -> dict[str, Any]:
    """Insert comprehensive test data and return a reference dict of IDs."""
    cur = conn.cursor()
    refs: dict[str, Any] = {}

    # --- Sites (two sites for isolation tests) ---
    cur.execute(
        "INSERT INTO sites (name, url, slug, bootstrap_version, pipeline_stage) "
        "VALUES ('Alpha Driving School', 'https://alphadriving.com.au', 'alpha-driving', '5.0.2', 'stage_3')"
    )
    refs["site_a_id"] = cur.lastrowid

    cur.execute(
        "INSERT INTO sites (name, url, slug, bootstrap_version, pipeline_stage) "
        "VALUES ('Beta Driving School', 'https://betadriving.com.au', 'beta-driving', '5.0.2', 'stage_1')"
    )
    refs["site_b_id"] = cur.lastrowid

    cur.execute(
        "INSERT INTO sites (name, url, slug, bootstrap_version, pipeline_stage) "
        "VALUES ('Gamma Driving School', 'https://gammadriving.com.au', 'gamma-driving', '5.0.2', 'not_started')"
    )
    refs["site_c_id"] = cur.lastrowid

    # --- CSS Audit (Tier 2 classes for site A) ---
    site_a_custom_classes = [
        "alpha-hero", "alpha-cta-btn", "alpha-card", "alpha-footer-link",
        "alpha-sidebar", "alpha-section-heading",
    ]
    for cls in site_a_custom_classes:
        cur.execute(
            "INSERT INTO css_audit (site_id, class_name, tier, source_file, properties) "
            "VALUES (?, ?, 2, 'custom.css', '{}')",
            (refs["site_a_id"], cls),
        )

    # Site B custom classes (different set)
    site_b_custom_classes = ["beta-banner", "beta-btn-primary", "beta-card"]
    for cls in site_b_custom_classes:
        cur.execute(
            "INSERT INTO css_audit (site_id, class_name, tier, source_file, properties) "
            "VALUES (?, ?, 2, 'custom-beta.css', '{}')",
            (refs["site_b_id"], cls),
        )

    # Bootstrap (Tier 1) classes stored for site A
    bs_classes = [
        "container", "row", "col-md-6", "col-lg-4", "d-flex", "text-center",
        "mb-3", "p-4", "btn", "btn-primary", "card", "card-body",
        "justify-content-center", "align-items-center", "mt-5", "h1", "h2",
    ]
    for cls in bs_classes:
        cur.execute(
            "INSERT OR IGNORE INTO css_audit (site_id, class_name, tier, source_file, properties) "
            "VALUES (?, ?, 1, 'bootstrap.min.css', '{}')",
            (refs["site_a_id"], cls),
        )

    # --- Page Taxonomy ---
    taxonomy = [
        ("homepage", 0, "Homepage", "{service} | {brand}", "hero,services_overview,testimonials,cta", None),
        ("service", 1, "Service Page", "{service} in {location} | {brand}", "hero,service_detail,faq,cta", None),
        ("location", 2, "Location Page", "{service} in {suburb} | {brand}", "hero,local_info,services,faq,cta", "locations"),
    ]
    for pt, hl, dn, h1p, req, silo in taxonomy:
        cur.execute(
            "INSERT INTO page_taxonomy (page_type, hierarchy_level, display_name, h1_pattern, required_sections, silo) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (pt, hl, dn, h1p, req, silo),
        )

    # --- Site Structure Map (existing pages for site A) ---
    site_a_pages = [
        ("https://alphadriving.com.au/", "homepage", 0),
        ("https://alphadriving.com.au/driving-lessons", "service", 1),
        ("https://alphadriving.com.au/brisbane", "location", 2),
        ("https://alphadriving.com.au/about", "about", 1),
        ("https://alphadriving.com.au/faq", "faq", 1),
    ]
    for url, pt, hl in site_a_pages:
        cur.execute(
            "INSERT INTO site_structure_map (site_id, url, page_type, hierarchy_level, status) "
            "VALUES (?, ?, ?, ?, 'audited')",
            (refs["site_a_id"], url, pt, hl),
        )

    # --- Work Backlog ---
    cur.execute(
        "INSERT INTO work_backlog (site_id, page_type, target_url, action, priority, status) "
        "VALUES (?, 'homepage', 'https://alphadriving.com.au/', 'improve', 1, 'approved')",
        (refs["site_a_id"],),
    )
    refs["backlog_homepage_id"] = cur.lastrowid

    cur.execute(
        "INSERT INTO work_backlog (site_id, page_type, target_url, action, priority, status) "
        "VALUES (?, 'service', 'https://alphadriving.com.au/driving-lessons', 'improve', 2, 'blueprinted')",
        (refs["site_a_id"],),
    )
    refs["backlog_service_id"] = cur.lastrowid

    cur.execute(
        "INSERT INTO work_backlog (site_id, page_type, target_url, action, priority, status) "
        "VALUES (?, 'location', 'https://alphadriving.com.au/brisbane', 'improve', 3, 'pending')",
        (refs["site_a_id"],),
    )
    refs["backlog_location_id"] = cur.lastrowid

    # --- Page Blueprints ---
    schema_spec_homepage = json.dumps({
        "@context": "https://schema.org",
        "@graph": [
            {
                "@type": "AutomotiveBusiness",
                "@id": "#org",
                "name": "Alpha Driving School",
                "url": "https://alphadriving.com.au",
                "telephone": "0400 000 000",
                "address": {
                    "@type": "PostalAddress",
                    "streetAddress": "123 Queen St",
                    "addressLocality": "Brisbane",
                    "addressRegion": "QLD",
                    "postalCode": "4000",
                },
                "geo": {
                    "@type": "GeoCoordinates",
                    "latitude": -27.4698,
                    "longitude": 153.0251,
                },
                "areaServed": [{"@type": "City", "name": "Brisbane"}],
            },
            {
                "@type": "WebSite",
                "name": "Alpha Driving School",
                "url": "https://alphadriving.com.au",
            },
            {
                "@type": "BreadcrumbList",
                "itemListElement": [
                    {"@type": "ListItem", "position": 1, "name": "Home", "item": "https://alphadriving.com.au/"}
                ],
            },
        ],
    })

    cur.execute(
        "INSERT INTO page_blueprints (backlog_id, site_id, target_keywords, working_title, "
        "h1_text, meta_title, meta_description, canonical_url, schema_spec, section_count) "
        "VALUES (?, ?, 'driving lessons brisbane', "
        "'Driving Lessons Brisbane | Alpha Driving School', "
        "'Driving Lessons Brisbane', "
        "'Driving Lessons Brisbane | Alpha', "
        "'Book driving lessons in Brisbane with Alpha Driving School. TMR approved instructors, auto and manual.', "
        "'https://alphadriving.com.au/', ?, 4)",
        (refs["backlog_homepage_id"], refs["site_a_id"], schema_spec_homepage),
    )
    refs["blueprint_homepage_id"] = cur.lastrowid

    cur.execute(
        "INSERT INTO page_blueprints (backlog_id, site_id, target_keywords, working_title, "
        "h1_text, meta_title, meta_description, canonical_url, schema_spec, section_count) "
        "VALUES (?, ?, 'driving lessons', "
        "'Driving Lessons | Alpha Driving School', "
        "'Professional Driving Lessons', "
        "'Driving Lessons | Alpha Driving School', "
        "'Learn to drive with Alpha Driving School. Professional instructors, flexible scheduling.', "
        "'https://alphadriving.com.au/driving-lessons', NULL, 5)",
        (refs["backlog_service_id"], refs["site_a_id"]),
    )
    refs["blueprint_service_id"] = cur.lastrowid

    # --- Section Specs ---
    cur.execute(
        "INSERT INTO section_specs (blueprint_id, section_type, section_order, heading_text, "
        "target_word_count_min, target_word_count_max, status) "
        "VALUES (?, 'hero', 1, 'Driving Lessons Brisbane', 80, 150, 'generated')",
        (refs["blueprint_homepage_id"],),
    )
    refs["section_hero_id"] = cur.lastrowid

    cur.execute(
        "INSERT INTO section_specs (blueprint_id, section_type, section_order, heading_text, "
        "target_word_count_min, target_word_count_max, status) "
        "VALUES (?, 'services_overview', 2, 'Our Driving Services', 150, 250, 'pending')",
        (refs["blueprint_homepage_id"],),
    )

    # --- Silo Definitions ---
    cur.execute(
        "INSERT INTO silo_definitions (site_id, silo_name, hub_page_type, hub_url) "
        "VALUES (?, 'locations', 'homepage', 'https://alphadriving.com.au/')",
        (refs["site_a_id"],),
    )

    # --- Internal Link Graph ---
    link_graph_edges = [
        ("https://alphadriving.com.au/", "https://alphadriving.com.au/driving-lessons", "hub-spoke", "services_overview"),
        ("https://alphadriving.com.au/", "https://alphadriving.com.au/brisbane", "contextual", "service_areas"),
        ("https://alphadriving.com.au/", "https://alphadriving.com.au/about", "navigation", "navigation"),
        ("https://alphadriving.com.au/", "https://alphadriving.com.au/faq", "navigation", "navigation"),
        ("https://alphadriving.com.au/driving-lessons", "https://alphadriving.com.au/", "navigation", "breadcrumb"),
        ("https://alphadriving.com.au/driving-lessons", "https://alphadriving.com.au/brisbane", "contextual", "service_areas"),
        ("https://alphadriving.com.au/brisbane", "https://alphadriving.com.au/", "navigation", "breadcrumb"),
        ("https://alphadriving.com.au/brisbane", "https://alphadriving.com.au/driving-lessons", "contextual", "services"),
        ("https://alphadriving.com.au/about", "https://alphadriving.com.au/", "navigation", "breadcrumb"),
        ("https://alphadriving.com.au/faq", "https://alphadriving.com.au/", "navigation", "breadcrumb"),
    ]
    for src, tgt, lt, sec in link_graph_edges:
        cur.execute(
            "INSERT INTO internal_link_graph (site_id, source_url, target_url, link_type, section, status) "
            "VALUES (?, ?, ?, ?, ?, 'existing')",
            (refs["site_a_id"], src, tgt, lt, sec),
        )

    # --- Anchor Text Bank ---
    anchor_entries = [
        ("https://alphadriving.com.au/driving-lessons", "exact", "driving lessons", 2),
        ("https://alphadriving.com.au/driving-lessons", "partial", "learn to drive", 1),
        ("https://alphadriving.com.au/driving-lessons", "branded", "Alpha driving lessons", 1),
        ("https://alphadriving.com.au/driving-lessons", "natural", "our professional instructors", 1),
        ("https://alphadriving.com.au/driving-lessons", "generic", "learn more", 0),
        ("https://alphadriving.com.au/brisbane", "exact", "Brisbane driving", 1),
        ("https://alphadriving.com.au/brisbane", "partial", "driving in Brisbane", 1),
        ("https://alphadriving.com.au/brisbane", "localized", "Brisbane area lessons", 0),
    ]
    for tgt, vt, text, usage in anchor_entries:
        cur.execute(
            "INSERT INTO anchor_text_bank (site_id, target_url, variant_type, anchor_text, usage_count) "
            "VALUES (?, ?, ?, ?, ?)",
            (refs["site_a_id"], tgt, vt, text, usage),
        )

    # --- Content Freshness ---
    now = datetime.utcnow()
    freshness_entries = [
        (refs["site_a_id"], "https://alphadriving.com.au/",
         (now - timedelta(weeks=3)).isoformat(), (now - timedelta(weeks=3)).isoformat(),
         (now - timedelta(weeks=3)).isoformat(), "fresh"),
        (refs["site_a_id"], "https://alphadriving.com.au/driving-lessons",
         (now - timedelta(weeks=8)).isoformat(), (now - timedelta(weeks=8)).isoformat(),
         (now - timedelta(weeks=8)).isoformat(), "aging"),
        (refs["site_a_id"], "https://alphadriving.com.au/brisbane",
         (now - timedelta(weeks=12)).isoformat(), (now - timedelta(weeks=12)).isoformat(),
         (now - timedelta(weeks=12)).isoformat(), "stale"),
        (refs["site_a_id"], "https://alphadriving.com.au/about",
         None, None, None, "unknown"),
    ]
    for sid, url, gen, appr, dep, status in freshness_entries:
        cur.execute(
            "INSERT INTO content_freshness (site_id, page_url, last_generated_at, last_approved_at, "
            "last_deployed_at, freshness_status, alert_sent) "
            "VALUES (?, ?, ?, ?, ?, ?, ?)",
            (sid, url, gen, appr, dep, status, 1 if status in ("aging", "stale") else 0),
        )

    conn.commit()
    return refs


@pytest.fixture
def db_conn():
    """Yield an in-memory SQLite connection with schema + test data."""
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    _apply_migrations(conn)
    _seed_test_data(conn)
    yield conn
    conn.close()


@pytest.fixture
def test_refs(db_conn):
    """Return a dict of reference IDs for the seeded test data.

    NOTE: This re-seeds, but since the db_conn fixture already seeds,
    we query the existing data instead.
    """
    cur = db_conn.cursor()
    sites = cur.execute("SELECT id, slug FROM sites").fetchall()
    refs = {}
    for s in sites:
        if s["slug"] == "alpha-driving":
            refs["site_a_id"] = s["id"]
        elif s["slug"] == "beta-driving":
            refs["site_b_id"] = s["id"]
        elif s["slug"] == "gamma-driving":
            refs["site_c_id"] = s["id"]

    bp = cur.execute("SELECT id, site_id FROM page_blueprints ORDER BY id").fetchall()
    if len(bp) >= 1:
        refs["blueprint_homepage_id"] = bp[0]["id"]
    if len(bp) >= 2:
        refs["blueprint_service_id"] = bp[1]["id"]

    return refs


# ---------------------------------------------------------------------------
# HTML content fixtures
# ---------------------------------------------------------------------------

VALID_HTML_FRAGMENT = textwrap.dedent("""\
    <section class="container mb-3">
      <div class="row">
        <div class="col-md-6">
          <h1>Driving Lessons Brisbane</h1>
          <p>Looking for driving lessons in Brisbane? Alpha Driving School offers
          professional driving instruction with TMR approved instructors. We have
          taught over 500 students across Brisbane suburbs. Our pass rate is 92%
          on first attempt. Book your driving lessons in Brisbane today and get
          started on the road to your licence.</p>
        </div>
        <div class="col-md-6">
          <img src="/images/hero.jpg" alt="Driving lesson in Brisbane" />
        </div>
      </div>
    </section>
    <section class="container mt-5">
      <h2>Our Driving Services</h2>
      <div class="row">
        <div class="col-lg-4">
          <div class="card">
            <div class="card-body">
              <h3>Automatic Lessons</h3>
              <p>Learn in our modern automatic vehicles with patient instructors.
              We offer flexible scheduling to fit your busy lifestyle. Prices from
              $65 per hour.</p>
              <a href="/driving-lessons" class="btn btn-primary">driving lessons</a>
            </div>
          </div>
        </div>
        <div class="col-lg-4">
          <div class="card">
            <div class="card-body">
              <h3>Manual Lessons</h3>
              <p>Master manual driving with expert guidance. Learn clutch control
              and gear shifting in a safe environment. 10-hour package available
              for $600.</p>
              <a href="/brisbane" class="btn btn-primary">driving in Brisbane</a>
            </div>
          </div>
        </div>
      </div>
    </section>
""")

INVALID_HTML_WITH_HEAD_ELEMENTS = textwrap.dedent("""\
    <html>
    <head>
      <title>Bad Page</title>
      <meta name="description" content="Should not be here" />
    </head>
    <body>
      <h1>This has wrapper elements</h1>
      <p>Content here</p>
    </body>
    </html>
""")

HTML_WITH_PLACEHOLDERS = textwrap.dedent("""\
    <section class="container">
      <h1>{{page_title}}</h1>
      <p>Welcome to [TBD] driving school. TODO fix this later.</p>
      <p>Contact us at INSERT_PHONE_NUMBER</p>
    </section>
""")

HTML_BAD_HEADING_HIERARCHY = textwrap.dedent("""\
    <section class="container">
      <h1>Main Heading</h1>
      <p>Intro text.</p>
      <h3>Skipped H2</h3>
      <p>This skips from H1 to H3.</p>
      <h2>Proper H2</h2>
      <h4>Another Skip</h4>
    </section>
""")

HTML_DUAL_H1 = textwrap.dedent("""\
    <section class="container">
      <h1>First H1</h1>
      <p>Content.</p>
      <h1>Second H1</h1>
      <p>More content.</p>
    </section>
""")

HTML_WITH_UNKNOWN_CLASSES = textwrap.dedent("""\
    <section class="container mb-3 fake-class-xyz">
      <h1>Page Title</h1>
      <p class="text-bg-primary">This uses a BS 5.2+ class</p>
      <div class="hallucinated-widget">Not real</div>
    </section>
""")

HTML_WITH_UNCLOSED_TAGS = textwrap.dedent("""\
    <section class="container">
      <h1>Title</h1>
      <div class="row">
        <div class="col-md-6">
          <p>Unclosed paragraph
        </div>
      </div>
    </section>
""")

HTML_WITH_KEYWORDS_IN_POSITION = textwrap.dedent("""\
    <section class="container">
      <h1>Driving Lessons in Brisbane</h1>
      <p>Our driving lessons in Brisbane are the best choice for learner drivers.
      We have been providing quality driving lessons for over 15 years in the
      Brisbane area. Our TMR approved instructors have a 92% pass rate. Alpha
      Driving School is your local choice for driving lessons in Brisbane and
      surrounding suburbs.</p>
      <h2>Why Choose Our Brisbane Driving Lessons</h2>
      <p>We offer automatic and manual driving lessons across Brisbane.</p>
    </section>
""")

VALID_JSONLD_BLOCK = textwrap.dedent("""\
    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "AutomotiveBusiness",
          "@id": "#org",
          "name": "Alpha Driving School",
          "url": "https://alphadriving.com.au",
          "telephone": "0400 000 000",
          "address": {
            "@type": "PostalAddress",
            "streetAddress": "123 Queen St",
            "addressLocality": "Brisbane",
            "addressRegion": "QLD",
            "postalCode": "4000"
          },
          "geo": {
            "@type": "GeoCoordinates",
            "latitude": -27.4698,
            "longitude": 153.0251
          },
          "areaServed": [{"@type": "City", "name": "Brisbane"}]
        },
        {
          "@type": "WebSite",
          "name": "Alpha Driving School",
          "url": "https://alphadriving.com.au"
        },
        {
          "@type": "BreadcrumbList",
          "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "Home", "item": "https://alphadriving.com.au/"}
          ]
        }
      ]
    }
    </script>
""")

INVALID_JSONLD_BLOCK = textwrap.dedent("""\
    <script type="application/ld+json">
    { this is not valid JSON }
    </script>
""")

JSONLD_WITH_PLACEHOLDERS = textwrap.dedent("""\
    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "AutomotiveBusiness",
      "name": "{{site_name}}",
      "telephone": "INSERT_PHONE",
      "address": {
        "@type": "PostalAddress",
        "streetAddress": "[TBD]"
      }
    }
    </script>
""")

JSONLD_MISSING_REQUIRED = textwrap.dedent("""\
    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "AutomotiveBusiness"
    }
    </script>
""")


@pytest.fixture
def valid_html():
    return VALID_HTML_FRAGMENT


@pytest.fixture
def valid_jsonld():
    return VALID_JSONLD_BLOCK
