/**
 * Link Graph Construction (WRK-BCE2-025)
 *
 * Builds an internal link graph for a site by:
 * 1. Loading all pages (existing from site_structure_map + planned from work_backlog)
 * 2. Loading silo definitions and page taxonomy
 * 3. Applying linking rules (hub-spoke, sibling, contextual, breadcrumb, navigation, footer)
 * 4. Storing edges in internal_link_graph
 * 5. Validating orphan pages and max depth from homepage
 *
 * Architecture: Hybrid Two-Page Model — Service Pages + Location Pages, three silos.
 */

import db from '$lib/db';

// ── Types ───────────────────────────────────────────────────────────────────

export interface LinkGraphResult {
  siteId: number;
  totalNodes: number;
  totalEdges: number;
  orphanPages: string[];
  maxClicksFromHome: number;
  valid: boolean;
  issues: string[];
}

interface PageNode {
  url: string;
  pageType: string;
  status: 'existing' | 'planned';
  silo: string | null;
  hierarchyLevel: number;
}

interface LinkEdge {
  sourceUrl: string;
  targetUrl: string;
  linkType: string;
  section: string | null;
  status: 'existing' | 'planned';
}

// Internal DB row types

interface StructureMapRow {
  id: number;
  site_id: number;
  url: string;
  page_type: string | null;
  hierarchy_level: number | null;
  status: string;
}

interface BacklogRow {
  id: number;
  site_id: number;
  page_type: string;
  target_url: string | null;
  action: string;
}

interface SiloRow {
  id: number;
  site_id: number;
  silo_name: string;
  hub_page_type: string;
  hub_url: string | null;
}

interface TaxonomyRow {
  page_type: string;
  hierarchy_level: number;
  silo: string | null;
}

interface LinkGraphRow {
  id: number;
  site_id: number;
  source_url: string;
  target_url: string;
  link_type: string;
  anchor_text: string | null;
  anchor_variant: string | null;
  section: string | null;
  status: string;
  created_at: string;
}

interface SiteRow {
  url: string;
}

// ── Prepared Statements ─────────────────────────────────────────────────────

const stmts = {
  getStructureMap: db.prepare<[number]>(
    `SELECT id, site_id, url, page_type, hierarchy_level, status
     FROM site_structure_map
     WHERE site_id = ?`
  ),

  getBacklogCreates: db.prepare<[number]>(
    `SELECT id, site_id, page_type, target_url, action
     FROM work_backlog
     WHERE site_id = ? AND action = 'create' AND status != 'skipped'`
  ),

  getSilos: db.prepare<[number]>(
    `SELECT id, site_id, silo_name, hub_page_type, hub_url
     FROM silo_definitions
     WHERE site_id = ?`
  ),

  getTaxonomy: db.prepare(
    `SELECT page_type, hierarchy_level, silo
     FROM page_taxonomy`
  ),

  getSiteUrl: db.prepare<[number]>(
    `SELECT url FROM sites WHERE id = ?`
  ),

  clearLinkGraph: db.prepare<[number]>(
    `DELETE FROM internal_link_graph WHERE site_id = ?`
  ),

  insertLink: db.prepare(
    `INSERT INTO internal_link_graph
       (site_id, source_url, target_url, link_type, anchor_text, section, status)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ),

  getLinkGraph: db.prepare<[number]>(
    `SELECT id, site_id, source_url, target_url, link_type, anchor_text,
            anchor_variant, section, status, created_at
     FROM internal_link_graph
     WHERE site_id = ?
     ORDER BY link_type, source_url`
  ),
};

// ── Main Functions ──────────────────────────────────────────────────────────

/**
 * Build the full internal link graph for a site.
 * Clears existing graph data and rebuilds from scratch.
 */
export function buildLinkGraph(siteId: number): LinkGraphResult {
  // 1. Load all pages
  const nodes = loadPageNodes(siteId);

  // 2. Load silo definitions and taxonomy
  const silos = stmts.getSilos.all(siteId) as SiloRow[];
  const taxonomyRows = stmts.getTaxonomy.all() as TaxonomyRow[];
  const taxonomyMap = new Map(taxonomyRows.map((t) => [t.page_type, t]));

  // Enrich nodes with taxonomy data
  for (const node of nodes) {
    const tax = taxonomyMap.get(node.pageType);
    if (tax) {
      node.silo = tax.silo;
      node.hierarchyLevel = tax.hierarchy_level;
    }
  }

  // 3. Build edges
  const edges = buildEdges(nodes, silos, siteId);

  // 4. Store in DB (transaction)
  const persist = db.transaction(() => {
    stmts.clearLinkGraph.run(siteId);
    for (const edge of edges) {
      stmts.insertLink.run(
        siteId,
        edge.sourceUrl,
        edge.targetUrl,
        edge.linkType,
        null, // anchor_text — populated by WRK-026
        edge.section,
        edge.status
      );
    }
  });
  persist();

  // 5. Validate
  const { orphanPages, maxClicksFromHome, issues } = validate(nodes, edges);

  return {
    siteId,
    totalNodes: nodes.length,
    totalEdges: edges.length,
    orphanPages,
    maxClicksFromHome,
    valid: issues.length === 0,
    issues,
  };
}

/**
 * Retrieve the current link graph for a site.
 */
export function getLinkGraph(siteId: number): LinkGraphRow[] {
  return stmts.getLinkGraph.all(siteId) as LinkGraphRow[];
}

// ── Page Loading ────────────────────────────────────────────────────────────

function loadPageNodes(siteId: number): PageNode[] {
  const nodes: PageNode[] = [];
  const seenUrls = new Set<string>();

  // Existing pages from site_structure_map
  const existingPages = stmts.getStructureMap.all(siteId) as StructureMapRow[];
  for (const page of existingPages) {
    if (!page.url || seenUrls.has(page.url)) continue;
    seenUrls.add(page.url);
    nodes.push({
      url: page.url,
      pageType: page.page_type || 'unknown',
      status: 'existing',
      silo: null,
      hierarchyLevel: page.hierarchy_level ?? 99,
    });
  }

  // Planned pages from work_backlog (action='create')
  const backlogItems = stmts.getBacklogCreates.all(siteId) as BacklogRow[];
  const siteRow = stmts.getSiteUrl.get(siteId) as SiteRow | undefined;
  const siteBaseUrl = siteRow?.url?.replace(/\/$/, '') || '';

  for (const item of backlogItems) {
    const url = item.target_url || generatePlannedUrl(siteBaseUrl, item.page_type, item.id);
    if (seenUrls.has(url)) continue;
    seenUrls.add(url);
    nodes.push({
      url,
      pageType: item.page_type,
      status: 'planned',
      silo: null,
      hierarchyLevel: 99,
    });
  }

  return nodes;
}

function generatePlannedUrl(baseUrl: string, pageType: string, backlogId: number): string {
  return `${baseUrl}/${pageType}-${backlogId}`;
}

// ── Edge Building ───────────────────────────────────────────────────────────

function buildEdges(nodes: PageNode[], silos: SiloRow[], siteId: number): LinkEdge[] {
  const edges: LinkEdge[] = [];
  const edgeSet = new Set<string>(); // Dedup: "source|target|type"

  // Categorise nodes by type for quick lookup
  const homepage = nodes.find((n) => n.pageType === 'homepage') || null;
  const servicePages = nodes.filter((n) => n.pageType === 'service');
  const locationPages = nodes.filter((n) => n.pageType === 'location');
  const trustPages = nodes.filter((n) =>
    ['about', 'faq', 'contact'].includes(n.pageType)
  );

  // Build silo hub map
  const siloHubMap = new Map<string, string>();
  for (const silo of silos) {
    if (silo.hub_url) {
      siloHubMap.set(silo.silo_name, silo.hub_url);
    } else if (silo.hub_page_type) {
      const hubNode = nodes.find((n) => n.pageType === silo.hub_page_type);
      if (hubNode) siloHubMap.set(silo.silo_name, hubNode.url);
    }
  }

  function addEdge(source: string, target: string, type: string, section: string | null): void {
    if (source === target) return;
    const key = `${source}|${target}|${type}`;
    if (edgeSet.has(key)) return;
    edgeSet.add(key);

    const sourceNode = nodes.find((n) => n.url === source);
    const targetNode = nodes.find((n) => n.url === target);
    const status = (sourceNode?.status === 'planned' || targetNode?.status === 'planned')
      ? 'planned'
      : 'existing';

    edges.push({ sourceUrl: source, targetUrl: target, linkType: type, section, status });
  }

  // ── Rule 1: Homepage links ──────────────────────────────────────────────

  if (homepage) {
    // Homepage -> all service pages (hub-spoke)
    for (const sp of servicePages) {
      addEdge(homepage.url, sp.url, 'hub-spoke', 'services_overview');
    }

    // Homepage -> all silo hubs (hub-spoke) — covers location hub if different from homepage
    for (const [, hubUrl] of siloHubMap) {
      if (hubUrl !== homepage.url) {
        addEdge(homepage.url, hubUrl, 'hub-spoke', 'navigation');
      }
    }

    // Homepage -> key location pages (contextual, limit 5-10)
    const keyLocations = locationPages.slice(0, Math.min(locationPages.length, 10));
    for (const loc of keyLocations) {
      addEdge(homepage.url, loc.url, 'contextual', 'service_areas');
    }

    // Homepage -> trust pages (navigation)
    for (const tp of trustPages) {
      addEdge(homepage.url, tp.url, 'navigation', 'navigation');
    }
  }

  // ── Rule 2: Service pages ───────────────────────────────────────────────

  for (const sp of servicePages) {
    // Service -> Homepage (breadcrumb + navigation)
    if (homepage) {
      addEdge(sp.url, homepage.url, 'breadcrumb', 'breadcrumb');
      addEdge(sp.url, homepage.url, 'navigation', 'navigation');
    }

    // Service -> other service pages (sibling)
    for (const otherSp of servicePages) {
      if (otherSp.url !== sp.url) {
        addEdge(sp.url, otherSp.url, 'sibling', 'related_services');
      }
    }

    // Service -> 3-5 relevant location pages (contextual)
    const relevantLocations = locationPages.slice(0, Math.min(locationPages.length, 5));
    for (const loc of relevantLocations) {
      addEdge(sp.url, loc.url, 'contextual', 'service_areas');
    }
  }

  // ── Rule 3: Location pages ──────────────────────────────────────────────

  for (let i = 0; i < locationPages.length; i++) {
    const loc = locationPages[i];

    // Location -> Homepage (breadcrumb + navigation)
    if (homepage) {
      addEdge(loc.url, homepage.url, 'breadcrumb', 'breadcrumb');
      addEdge(loc.url, homepage.url, 'navigation', 'navigation');
    }

    // Location -> relevant service pages (contextual)
    for (const sp of servicePages) {
      addEdge(loc.url, sp.url, 'contextual', 'services_available');
    }

    // Location -> 3-5 nearest/adjacent location pages (sibling)
    // Use proximity in the list order as a proxy for geographic proximity
    const siblings = getNearestSiblings(locationPages, i, 5);
    for (const sib of siblings) {
      addEdge(loc.url, sib.url, 'sibling', 'nearby_areas');
    }

    // Location -> their silo hub (hub-spoke)
    const locHub = siloHubMap.get('locations');
    if (locHub && locHub !== loc.url) {
      addEdge(loc.url, locHub, 'hub-spoke', 'breadcrumb');
    }
  }

  // ── Rule 4: Trust pages ─────────────────────────────────────────────────

  for (const tp of trustPages) {
    // Trust -> Homepage (breadcrumb + navigation)
    if (homepage) {
      addEdge(tp.url, homepage.url, 'breadcrumb', 'breadcrumb');
      addEdge(tp.url, homepage.url, 'navigation', 'navigation');
    }

    // Trust -> other trust pages (sibling)
    for (const otherTp of trustPages) {
      if (otherTp.url !== tp.url) {
        addEdge(tp.url, otherTp.url, 'sibling', 'navigation');
      }
    }

    // Trust -> relevant service pages (contextual)
    for (const sp of servicePages) {
      addEdge(tp.url, sp.url, 'contextual', 'content');
    }
  }

  // ── Footer links (all pages link to key pages) ─────────────────────────

  const footerTargets = [
    homepage,
    ...trustPages,
  ].filter(Boolean) as PageNode[];

  for (const node of nodes) {
    for (const target of footerTargets) {
      addEdge(node.url, target.url, 'footer', 'footer');
    }
  }

  return edges;
}

/**
 * Get up to `count` nearest siblings from a list, excluding the page at `index`.
 * Picks pages adjacent in list order as a proximity proxy.
 */
function getNearestSiblings(pages: PageNode[], index: number, count: number): PageNode[] {
  const result: PageNode[] = [];
  let left = index - 1;
  let right = index + 1;

  while (result.length < count && (left >= 0 || right < pages.length)) {
    if (left >= 0) {
      result.push(pages[left]);
      left--;
    }
    if (result.length < count && right < pages.length) {
      result.push(pages[right]);
      right++;
    }
  }

  return result;
}

// ── Validation ──────────────────────────────────────────────────────────────

function validate(
  nodes: PageNode[],
  edges: LinkEdge[]
): { orphanPages: string[]; maxClicksFromHome: number; issues: string[] } {
  const issues: string[] = [];

  // Count incoming links per page
  const incomingCount = new Map<string, number>();
  for (const node of nodes) {
    incomingCount.set(node.url, 0);
  }
  for (const edge of edges) {
    const current = incomingCount.get(edge.targetUrl) || 0;
    incomingCount.set(edge.targetUrl, current + 1);
  }

  // Orphan pages: fewer than 2 incoming links
  const orphanPages: string[] = [];
  for (const [url, count] of incomingCount) {
    if (count < 2) {
      orphanPages.push(url);
    }
  }

  if (orphanPages.length > 0) {
    issues.push(`${orphanPages.length} orphan page(s) with < 2 incoming links`);
  }

  // BFS from homepage to calculate max depth
  const homepage = nodes.find((n) => n.pageType === 'homepage');
  let maxClicksFromHome = 0;

  if (homepage) {
    // Build adjacency list
    const adj = new Map<string, string[]>();
    for (const node of nodes) {
      adj.set(node.url, []);
    }
    for (const edge of edges) {
      const targets = adj.get(edge.sourceUrl);
      if (targets) targets.push(edge.targetUrl);
    }

    // BFS
    const visited = new Set<string>();
    const queue: Array<{ url: string; depth: number }> = [{ url: homepage.url, depth: 0 }];
    visited.add(homepage.url);

    while (queue.length > 0) {
      const { url, depth } = queue.shift()!;
      if (depth > maxClicksFromHome) maxClicksFromHome = depth;

      const neighbors = adj.get(url) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push({ url: neighbor, depth: depth + 1 });
        }
      }
    }

    // Check unreachable pages
    const unreachable = nodes.filter((n) => !visited.has(n.url));
    if (unreachable.length > 0) {
      issues.push(`${unreachable.length} page(s) unreachable from homepage`);
    }

    // Max depth check
    if (maxClicksFromHome > 3) {
      issues.push(`Max depth from homepage is ${maxClicksFromHome} (should be <= 3)`);
    }
  } else {
    issues.push('No homepage found — cannot compute depth');
  }

  return { orphanPages, maxClicksFromHome, issues };
}
