/**
 * Integration Test Helpers — WRK-BCE2-052
 *
 * Shared utilities for cross-layer integration tests.
 * Creates an isolated in-memory SQLite database with the full schema,
 * seeds multi-site test data, and provides assertion helpers.
 */

import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

// ---------------------------------------------------------------------------
// Database setup
// ---------------------------------------------------------------------------

const APP_ROOT = path.resolve(__dirname, '../../app');
const MIGRATIONS_DIR = path.join(APP_ROOT, 'src/lib/db/migrations');

/**
 * Create a fresh in-memory database with the full schema applied.
 * Returns the database instance.
 */
export function createTestDb(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  db.pragma('journal_mode = WAL');

  // Apply all migrations in order
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f: string) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    // Skip the seed data — we'll seed our own test data
    if (file.includes('seed')) continue;
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8');
    db.exec(sql);
  }

  return db;
}

/**
 * Seed the test database with two driving school sites and associated data
 * for cross-site isolation testing.
 */
export function seedTestData(db: Database.Database): { siteA: number; siteB: number } {
  // Two sites for isolation testing
  db.exec(`
    INSERT INTO sites (id, name, url, slug, bootstrap_version, pipeline_stage) VALUES
      (1, 'Alpha Driving School', 'https://alphadriving.com.au', 'alpha-driving', '5.0.2', 'not_started'),
      (2, 'Beta Driving School', 'https://betadriving.com.au', 'beta-driving', '5.0.2', 'not_started');
  `);

  // Brand profiles for both sites
  db.exec(`
    INSERT INTO brand_profiles (site_id, voice_description, tone_keywords, inference_confidence) VALUES
      (1, 'Professional and reassuring', 'calm, professional, supportive', 0.7),
      (2, 'Energetic and youth-focused', 'fun, engaging, modern', 0.6);
  `);

  // Work backlog items
  db.exec(`
    INSERT INTO work_backlog (id, site_id, page_type, target_url, action, priority, status) VALUES
      (1, 1, 'service-area', '/driving-lessons-sydney', 'create', 1, 'blueprinted'),
      (2, 1, 'faq', '/faq', 'create', 2, 'blueprinted'),
      (3, 2, 'service-area', '/driving-lessons-melbourne', 'create', 1, 'blueprinted');
  `);

  // Page blueprints
  db.exec(`
    INSERT INTO page_blueprints (id, backlog_id, site_id, working_title, canonical_url, schema_spec, section_count) VALUES
      (1, 1, 1, 'Driving Lessons in Sydney', '/driving-lessons-sydney',
       '{"@context":"https://schema.org","@graph":[{"@type":"WebPage","name":"Driving Lessons in Sydney","url":"https://alphadriving.com.au/driving-lessons-sydney"}]}',
       3),
      (2, 2, 1, 'Frequently Asked Questions', '/faq',
       '{"@context":"https://schema.org","@graph":[{"@type":"FAQPage","mainEntity":[],"name":"FAQ","url":"https://alphadriving.com.au/faq"}]}',
       2),
      (3, 3, 2, 'Driving Lessons in Melbourne', '/driving-lessons-melbourne',
       '{"@context":"https://schema.org","@graph":[{"@type":"WebPage","name":"Driving Lessons in Melbourne","url":"https://betadriving.com.au/driving-lessons-melbourne"}]}',
       2);
  `);

  // Section specs for blueprint 1 (Site A)
  db.exec(`
    INSERT INTO section_specs (id, blueprint_id, section_type, section_order, heading_text, target_word_count_min, target_word_count_max, status, generated_html) VALUES
      (1, 1, 'hero', 1, 'Sydney Driving Lessons', 50, 150, 'generated',
       '<section class="container py-5"><div class="row"><div class="col-lg-8"><h2>Sydney Driving Lessons</h2><p>Learn to drive with Alpha Driving School in Sydney. Our experienced instructors provide patient and professional driving lessons tailored to your needs. Whether you are a beginner or need a refresher course we have the right program for you. Book your first lesson today and start your journey to becoming a confident driver on Sydney roads.</p></div></div></section>'),
      (2, 1, 'features', 2, 'Why Choose Us', 80, 300, 'generated',
       '<section class="container py-5"><div class="row"><div class="col-12"><h2>Why Choose Alpha Driving School</h2></div><div class="col-md-4"><h3>Expert Instructors</h3><p>All our instructors are fully accredited and have years of experience teaching students of all skill levels. They create a calm and supportive learning environment that builds your confidence behind the wheel.</p></div><div class="col-md-4"><h3>Flexible Scheduling</h3><p>We offer morning, afternoon, and weekend lessons to fit your busy schedule. Book online anytime and choose the time that works best for you.</p></div><div class="col-md-4"><h3>High Pass Rates</h3><p>Our structured curriculum and practice test routes help our students achieve consistently high pass rates. We prepare you thoroughly for the driving test.</p></div></div></section>'),
      (3, 1, 'cta', 3, 'Book Now', 30, 80, 'generated',
       '<section class="container py-5 text-center"><h2>Ready to Start Driving?</h2><p>Book your first lesson with Alpha Driving School today. Our friendly team is ready to help you get on the road with confidence and skill.</p><a href="/booking" class="btn btn-primary btn-lg">Book Your Lesson</a></section>');
  `);

  // Section specs for blueprint 2 (Site A - FAQ)
  db.exec(`
    INSERT INTO section_specs (id, blueprint_id, section_type, section_order, heading_text, target_word_count_min, target_word_count_max, status, generated_html) VALUES
      (4, 2, 'faq', 1, 'Common Questions', 100, 500, 'generated',
       '<section class="container py-5"><h2>Frequently Asked Questions</h2><h3>How long is a driving lesson?</h3><p>Each lesson is 60 minutes long, giving you plenty of time to practice and improve your driving skills.</p><h3>What do I need for my first lesson?</h3><p>Bring your learner permit, comfortable shoes, and a positive attitude. We provide the rest including a dual-control training vehicle.</p></section>'),
      (5, 2, 'cta', 2, 'Get Started', 30, 80, 'generated',
       '<section class="container py-5 text-center"><h2>Have More Questions?</h2><p>Contact us today and our friendly team will be happy to answer all your questions about driving lessons.</p><a href="/contact" class="btn btn-primary">Contact Us</a></section>');
  `);

  // Section specs for blueprint 3 (Site B)
  db.exec(`
    INSERT INTO section_specs (id, blueprint_id, section_type, section_order, heading_text, target_word_count_min, target_word_count_max, status, generated_html) VALUES
      (6, 3, 'hero', 1, 'Melbourne Driving Lessons', 50, 150, 'generated',
       '<section class="container py-5"><div class="row"><div class="col-lg-8"><h2>Melbourne Driving Lessons</h2><p>Beta Driving School offers the best driving lessons in Melbourne. Our young and dynamic instructors make learning to drive fun and engaging. Start your driving journey with us today and discover why Melbourne students love learning with Beta.</p></div></div></section>'),
      (7, 3, 'cta', 2, 'Book Now', 30, 80, 'generated',
       '<section class="container py-5 text-center"><h2>Start Your Journey</h2><p>Join hundreds of happy Melbourne drivers. Book your first lesson with Beta Driving School now and get behind the wheel with confidence.</p><a href="/book" class="btn btn-primary btn-lg">Book Now</a></section>');
  `);

  // CSS audit entries (Tier 2) — site-specific
  db.exec(`
    INSERT INTO css_audit (site_id, class_name, tier, usage_count) VALUES
      (1, 'alpha-hero-banner', 2, 5),
      (1, 'alpha-cta-box', 2, 3),
      (2, 'beta-brand-header', 2, 4),
      (2, 'beta-testimonial-card', 2, 2);
  `);

  // CSS decisions (Tier 3) — site-specific
  db.exec(`
    INSERT INTO css_decisions (site_id, decision_type, class_name, rationale) VALUES
      (1, 'custom', 'bce-alpha-step-number', 'Custom step indicator for Alpha'),
      (1, 'custom', 'bce-alpha-icon-circle', 'Custom icon container for Alpha'),
      (2, 'custom', 'bce-beta-hero-overlay', 'Custom hero overlay for Beta'),
      (2, 'custom', 'bce-beta-rating-badge', 'Custom rating badge for Beta');
  `);

  // Page taxonomy for export validation
  db.exec(`
    INSERT INTO page_taxonomy (page_type, hierarchy_level, display_name, required_sections, optional_sections) VALUES
      ('service-area', 2, 'Service Area Page', '["hero","features"]', '["cta","testimonials"]'),
      ('faq', 2, 'FAQ Page', '["faq"]', '["cta"]');
  `);

  return { siteA: 1, siteB: 2 };
}

// ---------------------------------------------------------------------------
// Assertion helpers
// ---------------------------------------------------------------------------

export class TestRunner {
  private passed = 0;
  private failed = 0;
  private errors: string[] = [];
  private suiteName: string;

  constructor(suiteName: string) {
    this.suiteName = suiteName;
    console.log(`\n${'='.repeat(70)}`);
    console.log(`  TEST SUITE: ${suiteName}`);
    console.log(`${'='.repeat(70)}\n`);
  }

  assert(condition: boolean, description: string, details?: string): void {
    if (condition) {
      this.passed++;
      console.log(`  [PASS] ${description}`);
    } else {
      this.failed++;
      const msg = details ? `${description} — ${details}` : description;
      this.errors.push(msg);
      console.log(`  [FAIL] ${description}`);
      if (details) console.log(`         ${details}`);
    }
  }

  assertEqual<T>(actual: T, expected: T, description: string): void {
    const pass = JSON.stringify(actual) === JSON.stringify(expected);
    this.assert(
      pass,
      description,
      pass ? undefined : `Expected: ${JSON.stringify(expected)}, Got: ${JSON.stringify(actual)}`
    );
  }

  assertNotEqual<T>(actual: T, notExpected: T, description: string): void {
    const pass = JSON.stringify(actual) !== JSON.stringify(notExpected);
    this.assert(
      pass,
      description,
      pass ? undefined : `Values should differ but both are: ${JSON.stringify(actual)}`
    );
  }

  assertIncludes(haystack: string, needle: string, description: string): void {
    const pass = haystack.includes(needle);
    this.assert(
      pass,
      description,
      pass ? undefined : `String does not contain "${needle}"`
    );
  }

  assertNotIncludes(haystack: string, needle: string, description: string): void {
    const pass = !haystack.includes(needle);
    this.assert(
      pass,
      description,
      pass ? undefined : `String unexpectedly contains "${needle}"`
    );
  }

  assertGreaterThan(actual: number, threshold: number, description: string): void {
    this.assert(
      actual > threshold,
      description,
      actual > threshold ? undefined : `${actual} is not greater than ${threshold}`
    );
  }

  assertThrows(fn: () => void, description: string, expectedMessage?: string): void {
    try {
      fn();
      this.assert(false, description, 'Expected function to throw but it did not');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (expectedMessage) {
        this.assert(
          message.includes(expectedMessage),
          description,
          `Error message "${message}" does not contain "${expectedMessage}"`
        );
      } else {
        this.assert(true, description);
      }
    }
  }

  section(name: string): void {
    console.log(`\n  --- ${name} ---\n`);
  }

  summary(): { passed: number; failed: number; errors: string[] } {
    console.log(`\n${'-'.repeat(70)}`);
    console.log(`  ${this.suiteName} Results: ${this.passed} passed, ${this.failed} failed`);
    if (this.errors.length > 0) {
      console.log(`  Failures:`);
      for (const err of this.errors) {
        console.log(`    - ${err}`);
      }
    }
    console.log(`${'-'.repeat(70)}\n`);
    return { passed: this.passed, failed: this.failed, errors: this.errors };
  }
}
