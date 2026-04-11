const fs = require('fs');
const path = require('path');

const SITE_DIR = '_site';
let errors = 0;

console.log('=== Structured Data Check ===\n');

// Helper: extract JSON-LD blocks from HTML
function extractJsonLd(html) {
  const blocks = [];
  const regex = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g;
  let match;
  while ((match = regex.exec(html)) !== null) {
    try {
      blocks.push(JSON.parse(match[1]));
    } catch (e) {
      console.log(`FAIL: Invalid JSON in JSON-LD block: ${e.message}`);
      errors++;
    }
  }
  return blocks;
}

// Check home page — should have Organisation JSON-LD
const homeHtml = fs.readFileSync(path.join(SITE_DIR, 'index.html'), 'utf-8');
const homeBlocks = extractJsonLd(homeHtml);
const orgBlock = homeBlocks.find(b => b['@type'] === 'Organization');

if (orgBlock) {
  console.log('PASS: Organisation JSON-LD found on home page');

  // Check required fields
  const requiredFields = ['@context', '@type', 'name', 'url', 'description'];
  for (const field of requiredFields) {
    if (orgBlock[field]) {
      console.log(`  PASS: ${field} present`);
    } else {
      console.log(`  FAIL: ${field} missing`);
      errors++;
    }
  }
} else {
  console.log('FAIL: No Organisation JSON-LD on home page');
  errors++;
}

// Check non-home pages — should have BreadcrumbList JSON-LD
const pagesToCheck = [
  'about/index.html',
  'our-group/index.html',
  'acquisitions/index.html',
  'contact/index.html'
];

console.log('\nChecking BreadcrumbList on pages...');
for (const pagePath of pagesToCheck) {
  const fullPath = path.join(SITE_DIR, pagePath);
  if (!fs.existsSync(fullPath)) {
    console.log(`SKIP: ${pagePath} not found`);
    continue;
  }

  const html = fs.readFileSync(fullPath, 'utf-8');
  const blocks = extractJsonLd(html);
  const breadcrumb = blocks.find(b => b['@type'] === 'BreadcrumbList');

  if (breadcrumb) {
    console.log(`PASS: BreadcrumbList on /${pagePath.replace('/index.html', '/')}`);

    // Check it has itemListElement with at least 2 items
    if (breadcrumb.itemListElement && breadcrumb.itemListElement.length >= 2) {
      console.log(`  PASS: ${breadcrumb.itemListElement.length} breadcrumb items`);
    } else {
      console.log(`  FAIL: BreadcrumbList has fewer than 2 items`);
      errors++;
    }
  } else {
    console.log(`FAIL: No BreadcrumbList on /${pagePath.replace('/index.html', '/')}`);
    errors++;
  }
}

// Check a brand page has 3-level breadcrumb
const brandDir = path.join(SITE_DIR, 'our-group');
const brandDirs = fs.readdirSync(brandDir).filter(d => {
  const stat = fs.statSync(path.join(brandDir, d));
  return stat.isDirectory() && d !== 'index.html';
});

if (brandDirs.length > 0) {
  const brandPath = path.join(brandDir, brandDirs[0], 'index.html');
  if (fs.existsSync(brandPath)) {
    const brandHtml = fs.readFileSync(brandPath, 'utf-8');
    const brandBlocks = extractJsonLd(brandHtml);
    const brandBreadcrumb = brandBlocks.find(b => b['@type'] === 'BreadcrumbList');

    if (brandBreadcrumb && brandBreadcrumb.itemListElement && brandBreadcrumb.itemListElement.length >= 3) {
      console.log(`PASS: Brand page ${brandDirs[0]} has ${brandBreadcrumb.itemListElement.length}-level breadcrumb`);
    } else {
      console.log(`FAIL: Brand page ${brandDirs[0]} missing 3-level breadcrumb`);
      errors++;
    }
  }
}

console.log('\n=== Summary ===');
if (errors === 0) {
  console.log('PASS: All structured data checks passed.');
  process.exit(0);
} else {
  console.log(`FAIL: ${errors} error(s) found.`);
  process.exit(1);
}
