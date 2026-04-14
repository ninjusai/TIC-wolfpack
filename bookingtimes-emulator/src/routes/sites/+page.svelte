<svelte:head>
	<title>Sites - Bookingtimes Emulator</title>
</svelte:head>

<script lang="ts">
	// ── Types ──────────────────────────────────────────────────────────────
	interface Site {
		id: string;
		name: string;
		url: string;
		theme: string;
	}

	interface SiteStatus {
		site_id: string;
		has_catalogue: boolean;
		catalogue_id: string | null;
		scraped_at: string | null;
		total_classes: number;
		bootstrap_classes: number;
		fontawesome_classes: number;
		custom_classes: number;
		verified_classes: number;
		status: string;
		stylesheet_urls: string[];
		content_wrapper: unknown | null;
	}

	interface ScrapeResult {
		catalogue_id: string;
		site_id: string;
		stylesheets_found: number;
		cdn_stylesheets: string[];
		custom_stylesheets: string[];
		custom_stylesheets_failed: number;
		inline_styles: number;
		classes_in_html: number;
		pages_scraped: number;
		pages_failed: number;
		content_wrapper: unknown | null;
		status: string;
	}

	interface AssembleResult {
		catalogue_id: string;
		total_classes: number;
		bootstrap_classes: number;
		fontawesome_classes: number;
		custom_classes: number;
		verified_classes: number;
		cached: boolean;
	}

	interface PageScrapeResult {
		site_id: string;
		url: string;
		title: string;
		content_html: string;
		full_html: string;
		meta: {
			description: string;
			classes_found: number;
		};
	}

	// ── State ──────────────────────────────────────────────────────────────
	let sites = $state<Site[]>([]);
	let statuses = $state<Record<string, SiteStatus>>({});
	let loading = $state(true);
	let scrapingIds = $state<Set<string>>(new Set());
	let scrapeAllRunning = $state(false);
	let expandedId = $state<string | null>(null);

	// Page scraping state (keyed by site_id)
	let pageScrapeUrls = $state<Record<string, string>>({});
	let pageScraping = $state<Set<string>>(new Set());
	let pageScrapeResults = $state<Record<string, PageScrapeResult>>({});
	let pageImporting = $state<Set<string>>(new Set());

	// Toast notifications
	let toasts = $state<Array<{ id: number; message: string; type: string }>>([]);
	let toastCounter = $state(0);

	// Scrape results (keyed by site_id)
	let lastScrapeResults = $state<Record<string, { scrape: ScrapeResult; assemble: AssembleResult }>>({});

	// ── Toast helpers ──────────────────────────────────────────────────────
	function showToast(message: string, type: string = 'success') {
		const id = ++toastCounter;
		toasts = [...toasts, { id, message, type }];
		setTimeout(() => {
			toasts = toasts.filter(t => t.id !== id);
		}, 5000);
	}

	// ── Data fetching ──────────────────────────────────────────────────────
	async function fetchSites() {
		try {
			const res = await fetch('/api/sites');
			const data: { sites?: Site[] } = await res.json();
			sites = data.sites ?? [];
		} catch {
			sites = [];
			showToast('Failed to load sites.', 'danger');
		}
	}

	async function fetchStatus(siteId: string) {
		try {
			const res = await fetch(`/api/sites/${encodeURIComponent(siteId)}/status`);
			if (res.ok) {
				const data: SiteStatus = await res.json();
				statuses = { ...statuses, [siteId]: data };
			}
		} catch {
			// silently fail for individual status
		}
	}

	async function fetchAllStatuses() {
		await Promise.all(sites.map(s => fetchStatus(s.id)));
	}

	// ── Init ───────────────────────────────────────────────────────────────
	$effect(() => {
		loadAll();
	});

	async function loadAll() {
		loading = true;
		await fetchSites();
		await fetchAllStatuses();
		loading = false;
	}

	// ── Scrape a single site ──────────────────────────────────────────────
	async function scrapeSite(siteId: string) {
		if (scrapingIds.has(siteId)) return;

		const next = new Set(scrapingIds);
		next.add(siteId);
		scrapingIds = next;

		const siteName = sites.find(s => s.id === siteId)?.name ?? siteId;

		try {
			// Step 1: Scrape CSS
			const scrapeRes = await fetch('/api/scrape', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ site_id: siteId })
			});

			if (!scrapeRes.ok) {
				const errBody = await scrapeRes.json().catch(() => null) as { message?: string } | null;
				throw new Error(errBody?.message || `Scrape failed (${scrapeRes.status})`);
			}

			const scrapeData: ScrapeResult = await scrapeRes.json();

			// Step 2: Assemble catalogue
			const assembleRes = await fetch('/api/catalogue/assemble', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ catalogue_id: scrapeData.catalogue_id })
			});

			if (!assembleRes.ok) {
				const errBody = await assembleRes.json().catch(() => null) as { message?: string } | null;
				throw new Error(errBody?.message || `Assembly failed (${assembleRes.status})`);
			}

			const assembleData: AssembleResult = await assembleRes.json();

			// Store results
			lastScrapeResults = {
				...lastScrapeResults,
				[siteId]: { scrape: scrapeData, assemble: assembleData }
			};

			showToast(
				`${siteName}: ${scrapeData.stylesheets_found} stylesheets found, ${assembleData.total_classes} classes catalogued.`,
				'success'
			);

			// Refresh status
			await fetchStatus(siteId);
		} catch (err) {
			showToast(
				`${siteName}: ${err instanceof Error ? err.message : String(err)}`,
				'danger'
			);
		} finally {
			const cleaned = new Set(scrapingIds);
			cleaned.delete(siteId);
			scrapingIds = cleaned;
		}
	}

	// ── Scrape all sites sequentially ─────────────────────────────────────
	async function scrapeAll() {
		if (scrapeAllRunning) return;
		scrapeAllRunning = true;
		showToast('Starting scrape for all sites...', 'info');

		for (const site of sites) {
			if (!scrapeAllRunning) break; // allow cancellation
			await scrapeSite(site.id);
		}

		scrapeAllRunning = false;
		showToast('All sites processed.', 'success');
	}

	function stopScrapeAll() {
		scrapeAllRunning = false;
		showToast('Scrape all stopped.', 'warning');
	}

	// ── Toggle expansion ──────────────────────────────────────────────────
	function toggleExpand(siteId: string) {
		expandedId = expandedId === siteId ? null : siteId;
	}

	// ── Page Scraping ─────────────────────────────────────────────────────
	function getPageScrapeUrl(siteId: string): string {
		if (pageScrapeUrls[siteId] !== undefined) return pageScrapeUrls[siteId];
		const site = sites.find(s => s.id === siteId);
		return site?.url ?? '';
	}

	function setPageScrapeUrl(siteId: string, url: string) {
		pageScrapeUrls = { ...pageScrapeUrls, [siteId]: url };
	}

	function setPageShortcut(siteId: string, path: string) {
		const site = sites.find(s => s.id === siteId);
		if (!site) return;
		const baseUrl = site.url.endsWith('/') ? site.url : site.url + '/';
		const fullUrl = path === '/' ? baseUrl : baseUrl + path.replace(/^\//, '');
		pageScrapeUrls = { ...pageScrapeUrls, [siteId]: fullUrl };
	}

	async function scrapePageContent(siteId: string) {
		const url = getPageScrapeUrl(siteId);
		if (!url || pageScraping.has(siteId)) return;

		const next = new Set(pageScraping);
		next.add(siteId);
		pageScraping = next;

		const siteName = sites.find(s => s.id === siteId)?.name ?? siteId;

		try {
			const res = await fetch('/api/scrape-page', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ site_id: siteId, page_url: url })
			});

			if (!res.ok) {
				const errBody = await res.json().catch(() => null) as { message?: string } | null;
				throw new Error(errBody?.message || `Page scrape failed (${res.status})`);
			}

			const data: PageScrapeResult = await res.json();
			pageScrapeResults = { ...pageScrapeResults, [siteId]: data };
			showToast(`${siteName}: Page scraped successfully — "${data.title}"`, 'success');
		} catch (err) {
			showToast(
				`${siteName}: ${err instanceof Error ? err.message : String(err)}`,
				'danger'
			);
		} finally {
			const cleaned = new Set(pageScraping);
			cleaned.delete(siteId);
			pageScraping = cleaned;
		}
	}

	async function importToEditor(siteId: string) {
		const scrapeResult = pageScrapeResults[siteId];
		if (!scrapeResult || pageImporting.has(siteId)) return;

		const next = new Set(pageImporting);
		next.add(siteId);
		pageImporting = next;

		try {
			const res = await fetch('/api/pages/import', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					site_id: siteId,
					url: scrapeResult.url,
					title: scrapeResult.title,
					content_html: scrapeResult.content_html
				})
			});

			if (!res.ok) {
				const errBody = await res.json().catch(() => null) as { message?: string } | null;
				throw new Error(errBody?.message || `Import failed (${res.status})`);
			}

			const data: { page: { id: string } } = await res.json();
			showToast('Page imported! Redirecting to editor...', 'success');

			// Redirect to generate page with the page loaded
			setTimeout(() => {
				window.location.href = `/generate?page_id=${data.page.id}&site_id=${siteId}`;
			}, 500);
		} catch (err) {
			showToast(
				`Import failed: ${err instanceof Error ? err.message : String(err)}`,
				'danger'
			);
		} finally {
			const cleaned = new Set(pageImporting);
			cleaned.delete(siteId);
			pageImporting = cleaned;
		}
	}

	function clearPageScrape(siteId: string) {
		const { [siteId]: _, ...rest } = pageScrapeResults;
		pageScrapeResults = rest;
	}

	// ── Helpers ────────────────────────────────────────────────────────────
	function formatDate(iso: string | null): string {
		if (!iso) return 'Never';
		return new Date(iso).toLocaleString();
	}

	function statusBadge(status: string): { cls: string; label: string } {
		switch (status) {
			case 'complete': return { cls: 'bg-success', label: 'Complete' };
			case 'pending': return { cls: 'bg-warning text-dark', label: 'Pending' };
			case 'failed': return { cls: 'bg-danger', label: 'Failed' };
			case 'none': return { cls: 'bg-secondary', label: 'Not Scraped' };
			default: return { cls: 'bg-secondary', label: status };
		}
	}

	function getFilename(url: string): string {
		try {
			const pathname = new URL(url).pathname;
			return pathname.split('/').pop() || url;
		} catch {
			return url;
		}
	}
</script>

<!-- ═══ HEADER ═══════════════════════════════════════════════════════════ -->

<div class="mb-4 d-flex align-items-start justify-content-between flex-wrap gap-2">
	<div>
		<h1 class="fw-bold mb-1"><i class="fa-solid fa-globe me-2 text-primary"></i>Sites</h1>
		<p class="text-muted mb-0">Manage site configurations, trigger CSS scraping, and view catalogues.</p>
	</div>
	<div class="d-flex gap-2">
		<button class="btn btn-outline-secondary btn-sm" onclick={() => loadAll()} disabled={loading}>
			<i class="fa-solid fa-arrows-rotate me-1" class:fa-spin={loading}></i>Refresh
		</button>
		{#if !scrapeAllRunning}
			<button class="btn btn-primary btn-sm" onclick={scrapeAll} disabled={loading || sites.length === 0}>
				<i class="fa-solid fa-download me-1"></i>Scrape All Sites
			</button>
		{:else}
			<button class="btn btn-outline-danger btn-sm" onclick={stopScrapeAll}>
				<i class="fa-solid fa-stop me-1"></i>Stop Scrape All
			</button>
		{/if}
	</div>
</div>

<!-- ═══ LOADING STATE ══════════════════════════════════════════════════ -->

{#if loading && sites.length === 0}
	<div class="card border-0 shadow-sm">
		<div class="card-body text-center py-5">
			<i class="fa-solid fa-spinner fa-spin fa-2x text-primary mb-3"></i>
			<p class="text-muted mb-0">Loading sites...</p>
		</div>
	</div>
{:else if sites.length === 0}
	<div class="card border-0 shadow-sm">
		<div class="card-body text-center py-5">
			<i class="fa-solid fa-globe fa-3x text-muted mb-3"></i>
			<p class="text-muted mb-0">No sites found. Seed the database first.</p>
		</div>
	</div>
{:else}

<!-- ═══ SUMMARY STATS ═════════════════════════════════════════════════ -->

{@const scrapedCount = Object.values(statuses).filter(s => s.has_catalogue).length}
{@const totalClasses = Object.values(statuses).reduce((sum, s) => sum + s.total_classes, 0)}

<div class="row g-3 mb-4">
	<div class="col-6 col-md-3">
		<div class="card border-0 shadow-sm h-100">
			<div class="card-body text-center">
				<div class="fs-3 fw-bold text-primary">{sites.length}</div>
				<small class="text-muted">Total Sites</small>
			</div>
		</div>
	</div>
	<div class="col-6 col-md-3">
		<div class="card border-0 shadow-sm h-100">
			<div class="card-body text-center">
				<div class="fs-3 fw-bold text-success">{scrapedCount}</div>
				<small class="text-muted">Scraped</small>
			</div>
		</div>
	</div>
	<div class="col-6 col-md-3">
		<div class="card border-0 shadow-sm h-100">
			<div class="card-body text-center">
				<div class="fs-3 fw-bold text-warning">{sites.length - scrapedCount}</div>
				<small class="text-muted">Pending</small>
			</div>
		</div>
	</div>
	<div class="col-6 col-md-3">
		<div class="card border-0 shadow-sm h-100">
			<div class="card-body text-center">
				<div class="fs-3 fw-bold text-info">{totalClasses.toLocaleString()}</div>
				<small class="text-muted">Total Classes</small>
			</div>
		</div>
	</div>
</div>

<!-- ═══ SITE CARDS ════════════════════════════════════════════════════ -->

<div class="d-flex flex-column gap-3">
	{#each sites as site (site.id)}
		{@const status = statuses[site.id]}
		{@const isScraping = scrapingIds.has(site.id)}
		{@const isExpanded = expandedId === site.id}
		{@const badge = statusBadge(status?.status ?? 'none')}
		{@const lastResult = lastScrapeResults[site.id]}
		{@const isPageScraping = pageScraping.has(site.id)}
		{@const pageResult = pageScrapeResults[site.id]}
		{@const isImporting = pageImporting.has(site.id)}

		<div class="card border-0 shadow-sm">
			<!-- Card header / summary row -->
			<div class="card-body pb-2">
				<div class="d-flex align-items-center justify-content-between flex-wrap gap-2">
					<!-- Left: site info -->
					<div class="d-flex align-items-center gap-3 flex-grow-1" style="min-width: 0;">
						<button
							class="btn btn-sm btn-outline-secondary border-0"
							onclick={() => toggleExpand(site.id)}
							title={isExpanded ? 'Collapse' : 'Expand'}
						>
							<i class="fa-solid" class:fa-chevron-down={isExpanded} class:fa-chevron-right={!isExpanded}></i>
						</button>
						<div style="min-width: 0;">
							<h5 class="mb-0 fw-semibold text-truncate">{site.name}</h5>
							<a href={site.url} target="_blank" rel="noopener" class="text-muted small text-decoration-none">
								{site.url} <i class="fa-solid fa-up-right-from-square" style="font-size: 0.65rem;"></i>
							</a>
						</div>
					</div>

					<!-- Center: status info -->
					<div class="d-flex align-items-center gap-3 flex-shrink-0">
						<span class="badge {badge.cls}">{badge.label}</span>

						{#if status?.has_catalogue}
							<div class="d-flex gap-3 text-center">
								<div>
									<div class="fw-bold text-primary">{status.total_classes.toLocaleString()}</div>
									<small class="text-muted" style="font-size: 0.7rem;">Classes</small>
								</div>
								<div>
									<div class="fw-bold text-muted small">{formatDate(status.scraped_at)}</div>
									<small class="text-muted" style="font-size: 0.7rem;">Last Scraped</small>
								</div>
							</div>
						{/if}
					</div>

					<!-- Right: actions -->
					<div class="flex-shrink-0">
						<button
							class="btn btn-sm {isScraping ? 'btn-outline-secondary' : 'btn-primary'}"
							onclick={() => scrapeSite(site.id)}
							disabled={isScraping}
						>
							{#if isScraping}
								<i class="fa-solid fa-spinner fa-spin me-1"></i>Scraping...
							{:else}
								<i class="fa-solid fa-download me-1"></i>Scrape CSS
							{/if}
						</button>
					</div>
				</div>

				<!-- Scrape result summary (shows after scrape completes) -->
				{#if lastResult}
					<div class="alert alert-success mt-3 mb-0 py-2 px-3 small">
						<i class="fa-solid fa-check-circle me-1"></i>
						<strong>Last scrape:</strong>
						{lastResult.scrape.stylesheets_found} stylesheets found
						({lastResult.scrape.cdn_stylesheets.length} CDN, {lastResult.scrape.custom_stylesheets.length} custom),
						{lastResult.scrape.inline_styles} inline styles,
						{lastResult.scrape.pages_scraped} pages scraped
						{#if lastResult.scrape.pages_failed > 0}
							<span class="text-warning">({lastResult.scrape.pages_failed} failed)</span>
						{/if}
						&mdash;
						<strong>{lastResult.assemble.total_classes.toLocaleString()}</strong> classes catalogued
						({lastResult.assemble.bootstrap_classes} BS5,
						{lastResult.assemble.fontawesome_classes} FA6,
						{lastResult.assemble.custom_classes} custom)
					</div>
				{/if}
			</div>

			<!-- Page Scraper Section -->
			{#if isExpanded}
				<div class="card-body border-top pt-3 pb-2">
					<h6 class="fw-semibold mb-2">
						<i class="fa-solid fa-file-import me-1 text-info"></i>Scrape Page Content
					</h6>
					<div class="row g-2 align-items-end mb-2">
						<div class="col">
							<input
								type="text"
								class="form-control form-control-sm"
								placeholder="https://example.com/page"
								value={getPageScrapeUrl(site.id)}
								oninput={(e) => setPageScrapeUrl(site.id, (e.target as HTMLInputElement).value)}
							/>
						</div>
						<div class="col-auto">
							<button
								class="btn btn-sm btn-info text-white"
								onclick={() => scrapePageContent(site.id)}
								disabled={isPageScraping || !getPageScrapeUrl(site.id)}
							>
								{#if isPageScraping}
									<i class="fa-solid fa-spinner fa-spin me-1"></i>Scraping...
								{:else}
									<i class="fa-solid fa-file-import me-1"></i>Scrape Page
								{/if}
							</button>
						</div>
					</div>
					<div class="d-flex gap-1 flex-wrap mb-2">
						<span class="text-muted small me-1" style="line-height: 1.875rem;">Quick:</span>
						<button class="btn btn-outline-secondary btn-sm py-0" onclick={() => setPageShortcut(site.id, '/')}>Homepage</button>
						<button class="btn btn-outline-secondary btn-sm py-0" onclick={() => setPageShortcut(site.id, '/services')}>Services</button>
						<button class="btn btn-outline-secondary btn-sm py-0" onclick={() => setPageShortcut(site.id, '/about')}>About</button>
						<button class="btn btn-outline-secondary btn-sm py-0" onclick={() => setPageShortcut(site.id, '/contact')}>Contact</button>
					</div>

					{#if pageResult}
						<div class="border rounded p-3 mt-2 bg-white">
							<div class="d-flex justify-content-between align-items-start mb-2">
								<div>
									<h6 class="mb-1 fw-semibold">{pageResult.title}</h6>
									<small class="text-muted">{pageResult.url}</small>
									{#if pageResult.meta.description}
										<p class="small text-muted mt-1 mb-0">{pageResult.meta.description}</p>
									{/if}
									<div class="small text-muted mt-1">
										<i class="fa-solid fa-palette me-1"></i>{pageResult.meta.classes_found} CSS classes found
									</div>
								</div>
								<button class="btn btn-sm btn-outline-secondary" onclick={() => clearPageScrape(site.id)} title="Dismiss">
									<i class="fa-solid fa-times"></i>
								</button>
							</div>

							<!-- Content preview -->
							<div class="scraped-preview border rounded p-2 mb-3 bg-light" style="max-height: 250px; overflow-y: auto;">
								{@html pageResult.content_html.slice(0, 5000)}
								{#if pageResult.content_html.length > 5000}
									<p class="text-muted small mt-2"><em>...content truncated for preview ({Math.round(pageResult.content_html.length / 1024)}KB total)</em></p>
								{/if}
							</div>

							<button
								class="btn btn-success btn-sm"
								onclick={() => importToEditor(site.id)}
								disabled={isImporting}
							>
								{#if isImporting}
									<i class="fa-solid fa-spinner fa-spin me-1"></i>Importing...
								{:else}
									<i class="fa-solid fa-arrow-right me-1"></i>Import to Editor
								{/if}
							</button>
						</div>
					{/if}
				</div>
			{/if}

			<!-- Expanded detail panel -->
			{#if isExpanded && status}
				<div class="card-footer bg-light border-top">
					{#if !status.has_catalogue}
						<p class="text-muted mb-0 py-2">
							<i class="fa-solid fa-info-circle me-1"></i>
							No catalogue data yet. Click <strong>Scrape CSS</strong> to get started.
						</p>
					{:else}
						<!-- Class breakdown -->
						<div class="row g-3 mb-3">
							<div class="col-md-6">
								<h6 class="fw-semibold mb-2">
									<i class="fa-solid fa-chart-pie me-1 text-primary"></i>CSS Catalogue Summary
								</h6>
								<table class="table table-sm table-bordered mb-0">
									<tbody>
										<tr>
											<td><i class="fa-brands fa-bootstrap me-1 text-purple"></i>Bootstrap 5</td>
											<td class="text-end fw-bold">{status.bootstrap_classes.toLocaleString()}</td>
										</tr>
										<tr>
											<td><i class="fa-brands fa-font-awesome me-1 text-info"></i>Font Awesome 6</td>
											<td class="text-end fw-bold">{status.fontawesome_classes.toLocaleString()}</td>
										</tr>
										<tr>
											<td><i class="fa-solid fa-palette me-1 text-warning"></i>Custom</td>
											<td class="text-end fw-bold">{status.custom_classes.toLocaleString()}</td>
										</tr>
										<tr class="table-active">
											<td class="fw-semibold">Total Classes</td>
											<td class="text-end fw-bold">{status.total_classes.toLocaleString()}</td>
										</tr>
										<tr>
											<td><i class="fa-solid fa-circle-check me-1 text-success"></i>Verified in HTML</td>
											<td class="text-end fw-bold">{status.verified_classes.toLocaleString()}</td>
										</tr>
									</tbody>
								</table>
							</div>

							<div class="col-md-6">
								<h6 class="fw-semibold mb-2">
									<i class="fa-solid fa-link me-1 text-secondary"></i>Scraped Stylesheets
								</h6>
								{#if status.stylesheet_urls.length === 0}
									<p class="text-muted small mb-0">No stylesheet URLs recorded.</p>
								{:else}
									<div class="list-group list-group-flush" style="max-height: 200px; overflow-y: auto;">
										{#each status.stylesheet_urls as url}
											<div class="list-group-item px-2 py-1 small d-flex align-items-center gap-2">
												<i class="fa-solid fa-file-code text-muted flex-shrink-0"></i>
												<a href={url} target="_blank" rel="noopener" class="text-truncate text-decoration-none" title={url}>
													{getFilename(url)}
												</a>
											</div>
										{/each}
									</div>
								{/if}
							</div>
						</div>

						<!-- Content wrapper -->
						{#if status.content_wrapper}
							<div class="mb-2">
								<h6 class="fw-semibold mb-2">
									<i class="fa-solid fa-code me-1 text-success"></i>Content Wrapper
								</h6>
								<pre class="bg-dark text-light p-3 rounded small mb-0" style="max-height: 200px; overflow: auto;">{JSON.stringify(status.content_wrapper, null, 2)}</pre>
							</div>
						{/if}

						<div class="text-muted small mt-2">
							<i class="fa-solid fa-clock me-1"></i>Catalogue ID: <code>{status.catalogue_id}</code>
							&middot; Scraped at: {formatDate(status.scraped_at)}
						</div>
					{/if}
				</div>
			{/if}
		</div>
	{/each}
</div>

{/if}

<!-- ═══ TOAST NOTIFICATIONS ═════════════════════════════════════════════ -->

<div class="toast-container position-fixed bottom-0 end-0 p-3" style="z-index: 9999;">
	{#each toasts as toast (toast.id)}
		<div class="toast show align-items-center text-bg-{toast.type} border-0" role="alert">
			<div class="d-flex">
				<div class="toast-body">{toast.message}</div>
				<button type="button" class="btn-close btn-close-white me-2 m-auto" onclick={() => toasts = toasts.filter(t => t.id !== toast.id)}></button>
			</div>
		</div>
	{/each}
</div>

<style>
	.toast-container .toast {
		margin-bottom: 0.5rem;
		min-width: 300px;
	}

	.text-purple {
		color: #7952b3;
	}

	pre {
		white-space: pre-wrap;
		word-break: break-all;
	}

	.scraped-preview {
		font-size: 0.85rem;
		line-height: 1.5;
	}

	.scraped-preview img {
		max-width: 100%;
		height: auto;
	}
</style>
