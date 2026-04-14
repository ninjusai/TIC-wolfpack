<script lang="ts">
	interface SiteStatus {
		siteId: number;
		siteName: string;
		currentStage: string;
		canAdvance: boolean;
		nextStage: string | null;
	}

	interface FreshnessSummary {
		fresh: number;
		aging: number;
		stale: number;
		unknown: number;
	}

	interface SiteDashboard extends SiteStatus {
		freshness: FreshnessSummary | null;
		totalPages: number;
	}

	const STAGE_LABELS: Record<string, string> = {
		not_started: 'Not Started',
		stage_1: 'Audit',
		stage_2: 'Benchmark',
		stage_3: 'Gap Analysis',
		stage_4: 'Blueprint',
		stage_5: 'Generate',
		maintaining: 'Maintaining'
	};

	const STAGE_COLORS: Record<string, string> = {
		not_started: 'secondary',
		stage_1: 'info',
		stage_2: 'primary',
		stage_3: 'warning',
		stage_4: 'danger',
		stage_5: 'success',
		maintaining: 'dark'
	};

	const STAGE_DESCRIPTIONS: Record<string, string> = {
		not_started: 'Add the site and start scraping',
		stage_1: 'Scrape, classify, and audit the site',
		stage_2: 'Seed benchmarks and build taxonomy',
		stage_3: 'Run gap analysis and generate backlog',
		stage_4: 'Generate blueprints and design specs',
		stage_5: 'Generate content, validate, and deploy',
		maintaining: 'Monitor freshness and updates'
	};

	/** Get the right page to continue work based on current stage */
	function getWorkflowLink(site: SiteDashboard): { href: string; label: string } {
		switch (site.currentStage) {
			case 'not_started':
			case 'stage_1':
				return { href: `/site/${site.siteId}`, label: 'Start Audit' };
			case 'stage_2':
			case 'stage_3':
				return { href: `/site/${site.siteId}/pipeline`, label: 'Continue Pipeline' };
			case 'stage_4':
				return { href: `/blueprints/${site.siteId}`, label: 'Design Blueprints' };
			case 'stage_5':
				return { href: `/blueprints/${site.siteId}`, label: 'Build Content' };
			case 'maintaining':
				return { href: `/site/${site.siteId}`, label: 'View Site' };
			default:
				return { href: `/site/${site.siteId}`, label: 'View Details' };
		}
	}

	let sites = $state<SiteDashboard[]>([]);
	let loading = $state(true);
	let error = $state('');

	// Add New Site form state
	let newSiteUrl = $state('');
	let scraping = $state(false);
	let scrapeResult = $state('');
	let scrapeError = $state('');

	async function startScrape() {
		if (!newSiteUrl.trim() || scraping) return;
		scraping = true;
		scrapeResult = '';
		scrapeError = '';
		try {
			const res = await fetch('/api/scrape', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ siteUrl: newSiteUrl.trim() })
			});
			const data = await res.json();
			if (res.ok) {
				scrapeResult = `CSS scrape complete: ${data.pagesFound ?? 0} pages found, ${data.cssFilesScraped ?? 0} CSS files scraped. Use "Scrape Content" on a site card for full content scraping.`;
				newSiteUrl = '';
				await loadDashboard();
			} else {
				scrapeError = data.message ?? data.error ?? 'Scrape failed';
			}
		} catch (e) {
			scrapeError = e instanceof Error ? e.message : String(e);
		} finally {
			scraping = false;
		}
	}

	let totalSites = $derived(sites.length);
	let totalPages = $derived(sites.reduce((sum, s) => sum + s.totalPages, 0));
	let stageBreakdown = $derived(() => {
		const counts: Record<string, number> = {};
		for (const s of sites) {
			const label = STAGE_LABELS[s.currentStage] ?? s.currentStage;
			counts[label] = (counts[label] ?? 0) + 1;
		}
		return counts;
	});

	async function loadDashboard() {
		loading = true;
		error = '';
		try {
			const res = await fetch('/api/pipeline/status');
			if (!res.ok) throw new Error('Failed to fetch pipeline status');
			const data = await res.json();
			const statuses: SiteStatus[] = data.sites;

			const enriched: SiteDashboard[] = await Promise.all(
				statuses.map(async (s) => {
					let freshness: FreshnessSummary | null = null;
					let totalPages = 0;
					try {
						const fRes = await fetch(`/api/freshness/${s.siteId}`);
						if (fRes.ok) {
							const fData = await fRes.json();
							freshness = fData.summary ?? null;
							totalPages = fData.totalPages ?? 0;
						}
					} catch {
						// freshness unavailable
					}
					return { ...s, freshness, totalPages };
				})
			);

			sites = enriched;
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		loadDashboard();
	});
</script>

<div class="py-4">
	<h1 class="mb-4">Dashboard</h1>

	{#if loading}
		<div class="d-flex justify-content-center py-5">
			<div class="spinner-border text-primary" role="status">
				<span class="visually-hidden">Loading...</span>
			</div>
		</div>
	{:else if error}
		<div class="alert alert-danger" role="alert">{error}</div>
	{:else}
		<!-- Add New Site -->
		<div class="card mb-4 border-primary">
			<div class="card-header bg-primary text-white d-flex align-items-center">
				<strong>Add New Site &amp; Scrape CSS</strong>
			</div>
			<div class="card-body">
				<div class="row g-2 align-items-end">
					<div class="col-md-8">
						<label class="form-label form-label-sm mb-1" for="newSiteUrl">Site URL</label>
						<input
							id="newSiteUrl"
							type="url"
							class="form-control"
							placeholder="https://example.com"
							bind:value={newSiteUrl}
							disabled={scraping}
						/>
					</div>
					<div class="col-md-4">
						<button
							class="btn btn-primary w-100 wf-action-btn"
							disabled={scraping || !newSiteUrl.trim()}
							onclick={startScrape}
						>
							{#if scraping}
								<span class="spinner-border spinner-border-sm me-1" role="status"></span>
								Scraping CSS...
							{:else}
								Scrape CSS
							{/if}
						</button>
					</div>
				</div>
				{#if scrapeResult}
					<div class="alert alert-success mt-2 mb-0 py-1 small">{scrapeResult}</div>
				{/if}
				{#if scrapeError}
					<div class="alert alert-danger mt-2 mb-0 py-1 small">{scrapeError}</div>
				{/if}
			</div>
		</div>

		<!-- Summary Stats -->
		<div class="row g-3 mb-4">
			<div class="col-md-4">
				<div class="card text-center border-primary">
					<div class="card-body">
						<h5 class="card-title text-muted">Total Sites</h5>
						<p class="display-6 fw-bold mb-0">{totalSites}</p>
					</div>
				</div>
			</div>
			<div class="col-md-4">
				<div class="card text-center border-success">
					<div class="card-body">
						<h5 class="card-title text-muted">Total Pages</h5>
						<p class="display-6 fw-bold mb-0">{totalPages}</p>
					</div>
				</div>
			</div>
			<div class="col-md-4">
				<div class="card text-center border-info">
					<div class="card-body">
						<h5 class="card-title text-muted">Sites by Stage</h5>
						<div class="mt-2">
							{#each Object.entries(stageBreakdown()) as [label, count]}
								<span class="badge bg-secondary me-1">{label}: {count}</span>
							{/each}
						</div>
					</div>
				</div>
			</div>
		</div>

		<!-- Site Cards -->
		<div class="row g-3">
			{#each sites as site}
				{@const wfLink = getWorkflowLink(site)}
				<div class="col-md-6 col-xl-4">
					<div class="card h-100">
						<div class="card-body">
							<div class="d-flex justify-content-between align-items-start mb-2">
								<h5 class="card-title mb-0">
									<a href="/site/{site.siteId}" class="text-decoration-none">{site.siteName}</a>
								</h5>
								<span class="badge bg-{STAGE_COLORS[site.currentStage] ?? 'secondary'} fs-6">
									{STAGE_LABELS[site.currentStage] ?? site.currentStage}
								</span>
							</div>

							<!-- Stage description -->
							<p class="text-muted small mb-2">
								{STAGE_DESCRIPTIONS[site.currentStage] ?? ''}
							</p>

							<div class="mb-3">
								<small class="text-muted">Pages tracked: <strong>{site.totalPages}</strong></small>
							</div>

							{#if site.freshness}
								<div class="mb-3">
									<small class="text-muted d-block mb-1">Freshness</small>
									<div class="d-flex gap-2">
										{#if site.freshness.fresh > 0}
											<span class="badge bg-success">Fresh: {site.freshness.fresh}</span>
										{/if}
										{#if site.freshness.aging > 0}
											<span class="badge bg-warning text-dark">Aging: {site.freshness.aging}</span>
										{/if}
										{#if site.freshness.stale > 0}
											<span class="badge bg-danger">Stale: {site.freshness.stale}</span>
										{/if}
										{#if site.freshness.unknown > 0}
											<span class="badge bg-light text-dark">Unknown: {site.freshness.unknown}</span>
										{/if}
									</div>
								</div>
							{:else}
								<div class="mb-3">
									<small class="text-muted">No freshness data</small>
								</div>
							{/if}

							<!-- Workflow Action -->
							<div class="d-flex gap-2 mt-auto">
								<a href={wfLink.href} class="btn btn-primary wf-action-btn flex-grow-1">
									{wfLink.label} &rarr;
								</a>
								{#if site.currentStage === 'maintaining'}
									<a href="/blueprints/{site.siteId}" class="btn btn-outline-success wf-action-btn-sm">
										Exports
									</a>
								{/if}
								<a href="/site/{site.siteId}" class="btn btn-outline-secondary wf-action-btn-sm">
									Details
								</a>
							</div>
						</div>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.wf-action-btn {
		min-height: 42px;
		padding: 0.5rem 1.25rem;
		font-weight: 600;
		font-size: 0.95rem;
		border-radius: 6px;
	}

	.wf-action-btn-sm {
		min-height: 42px;
		padding: 0.5rem 1rem;
		font-weight: 600;
		font-size: 0.85rem;
		border-radius: 6px;
	}
</style>
