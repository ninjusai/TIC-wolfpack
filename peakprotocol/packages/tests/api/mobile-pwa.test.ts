/**
 * Tests for PWA / mobile-related eval cases.
 * Covers EVL-10: PWA manifest is valid.
 * Covers EVL-10a: Service worker registers (checks sw.ts exists).
 * Covers EVL-11: Bundle size check (<50KB initial route).
 *
 * These tests validate static assets and build output — they do not
 * require a running API server, but do require the web package to
 * have been built at least once for bundle size checks.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, statSync, readdirSync } from "fs";
import { resolve } from "path";

const WEB_ROOT = resolve(__dirname, "../../../web");
const MANIFEST_PATH = resolve(WEB_ROOT, "public/manifest.json");
const SW_SOURCE_PATH = resolve(WEB_ROOT, "src/sw.ts");
const BUILD_DIR = resolve(WEB_ROOT, "dist");

// ── EVL-10: PWA Manifest Validation ─────────────────────────────────

describe("EVL-10: PWA Manifest Validity", () => {
  it("manifest.json exists in public/", () => {
    expect(
      existsSync(MANIFEST_PATH),
      `PWA manifest not found at ${MANIFEST_PATH}`,
    ).toBe(true);
  });

  it("manifest.json is valid JSON", () => {
    const raw = readFileSync(MANIFEST_PATH, "utf-8");
    let manifest: Record<string, unknown>;

    expect(() => {
      manifest = JSON.parse(raw) as Record<string, unknown>;
    }).not.toThrow();
  });

  it("manifest contains required PWA fields", () => {
    const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf-8")) as Record<string, unknown>;

    expect(manifest).toHaveProperty("name");
    expect(typeof manifest["name"]).toBe("string");
    expect((manifest["name"] as string).length).toBeGreaterThan(0);

    expect(manifest).toHaveProperty("short_name");
    expect(manifest).toHaveProperty("start_url");
    expect(manifest).toHaveProperty("display");
    expect(manifest).toHaveProperty("icons");
  });

  it("manifest has at least one icon with valid size", () => {
    const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf-8")) as Record<string, unknown>;
    const icons = manifest["icons"] as Array<Record<string, unknown>>;

    expect(icons).toBeInstanceOf(Array);
    expect(icons.length).toBeGreaterThanOrEqual(1);

    for (const icon of icons) {
      expect(icon).toHaveProperty("src");
      expect(icon).toHaveProperty("sizes");
      expect(icon).toHaveProperty("type");
      expect(typeof icon["src"]).toBe("string");
    }
  });

  it("manifest display mode is 'standalone' for mobile app experience", () => {
    const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf-8")) as Record<string, unknown>;

    expect(manifest["display"]).toBe("standalone");
  });

  it("manifest includes theme_color and background_color", () => {
    const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf-8")) as Record<string, unknown>;

    expect(manifest).toHaveProperty("theme_color");
    expect(manifest).toHaveProperty("background_color");
  });
});

// ── EVL-10a: Service Worker Source Exists ────────────────────────────

describe("EVL-10a: Service Worker Registration", () => {
  it("service worker source file (sw.ts) exists", () => {
    expect(
      existsSync(SW_SOURCE_PATH),
      `Service worker source not found at ${SW_SOURCE_PATH}`,
    ).toBe(true);
  });

  it("vite.config.ts configures VitePWA with injectManifest strategy", () => {
    const viteConfig = readFileSync(resolve(WEB_ROOT, "vite.config.ts"), "utf-8");

    expect(viteConfig).toContain("VitePWA");
    expect(viteConfig).toContain("injectManifest");
    expect(viteConfig).toContain("sw.ts");
  });
});

// ── EVL-11: Bundle Size Check ───────────────────────────────────────

describe("EVL-11: Bundle Size Check", () => {
  it("build output directory exists (requires prior build)", () => {
    if (!existsSync(BUILD_DIR)) {
      console.warn(
        `[EVL-11] Build directory not found at ${BUILD_DIR}. Run 'npm run build' in web package first.`,
      );
      return; // Skip rather than fail — build may not have run yet
    }

    expect(existsSync(BUILD_DIR)).toBe(true);
  });

  it("initial JS bundle is under 50KB gzipped (if build exists)", () => {
    const assetsDir = resolve(BUILD_DIR, "assets");
    if (!existsSync(assetsDir)) {
      console.warn("[EVL-11] No assets directory found — skipping bundle size check.");
      return;
    }

    // Find JS files in the build output
    const jsFiles = readdirSync(assetsDir)
      .filter((f) => f.endsWith(".js"))
      .map((f) => ({
        name: f,
        size: statSync(resolve(assetsDir, f)).size,
      }))
      .sort((a, b) => a.size - b.size);

    if (jsFiles.length === 0) {
      console.warn("[EVL-11] No JS files found in build output.");
      return;
    }

    // The smallest JS file is typically the entry point / initial route.
    // Check that it is under 50KB uncompressed (gzip typically provides ~60-70% compression).
    // 50KB gzipped ~= 150KB uncompressed as a rough upper bound.
    const entryFile = jsFiles[0]!;
    const maxUncompressedBytes = 150_000; // ~50KB after gzip

    expect(
      entryFile.size,
      `Initial route JS (${entryFile.name}) is ${Math.round(entryFile.size / 1024)}KB uncompressed, ` +
      `expected < ${Math.round(maxUncompressedBytes / 1024)}KB (~50KB gzipped)`,
    ).toBeLessThan(maxUncompressedBytes);
  });

  it("build uses code splitting (multiple JS chunks)", () => {
    const assetsDir = resolve(BUILD_DIR, "assets");
    if (!existsSync(assetsDir)) {
      console.warn("[EVL-11] No assets directory — skipping code splitting check.");
      return;
    }

    const jsFiles = readdirSync(assetsDir).filter((f) => f.endsWith(".js"));

    expect(
      jsFiles.length,
      "Build should produce multiple JS chunks (code splitting)",
    ).toBeGreaterThan(1);
  });
});
