<script lang="ts">
	import PreviewFrame from '$lib/components/PreviewFrame.svelte';

	// ── Types ──────────────────────────────────────────────────────────────────

	interface Site {
		id: string;
		name: string;
		url: string;
	}

	interface Page {
		id: string;
		site_id: string;
		title: string;
		slug: string;
		html: string | null;
		status: string;
	}

	interface ValidationError {
		type: string;
		severity: string;
		message: string;
		context?: string;
	}

	interface ValidationResult {
		valid: boolean;
		html: string;
		errors: ValidationError[];
		warnings: ValidationError[];
		stats: {
			total_classes: number;
			valid_classes: number;
			unknown_classes: number;
			disallowed_elements: number;
			[key: string]: unknown;
		};
		validation?: {
			errors: ValidationError[];
			warnings: ValidationError[];
			stats: Record<string, unknown>;
		};
		forced?: boolean;
		isolation?: Record<string, unknown>;
	}

	// ── State ──────────────────────────────────────────────────────────────────

	let sites = $state<Site[]>([]);
	let pages = $state<Page[]>([]);
	let selectedSiteId = $state('');
	let selectedPageId = $state('');
	let htmlInput = $state('');
	let htmlSource = $state<'page' | 'manual'>('page');
	let forceExport = $state(false);

	let loadingSites = $state(true);
	let loadingPages = $state(false);
	let validating = $state(false);
	let validationResult = $state<ValidationResult | null>(null);

	let toast = $state<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
	let copied = $state(false);

	// ── Derived ────────────────────────────────────────────────────────────────

	let exportHtml = $derived(
		htmlSource === 'page'
			? (pages.find(p => p.id === selectedPageId)?.html ?? '')
			: htmlInput
	);

	let errors = $derived(
		validationResult
			? (validationResult.validation?.errors ?? validationResult.errors ?? [])
			: []
	);

	let warnings = $derived(
		validationResult
			? (validationResult.validation?.warnings ?? validationResult.warnings ?? [])
			: []
	);

	let stats = $derived(
		validationResult
			? (validationResult.validation?.stats ?? validationResult.stats ?? null)
			: null
	);

	let isValid = $derived(validationResult?.valid ?? false);

	// ── Helpers ────────────────────────────────────────────────────────────────

	function showToast(type: 'success' | 'error' | 'info', message: string) {
		toast = { type, message };
		setTimeout(() => { toast = null; }, 3000);
	}

	// ── Data Fetching ──────────────────────────────────────────────────────────

	async function fetchSites() {
		loadingSites = true;
		try {
			const resp = await fetch('/api/sites');
			if (!resp.ok) throw new Error(`${resp.status}`);
			const data = await resp.json() as { sites: Site[] };
			sites = data.sites ?? [];
			if (sites.length > 0 && !selectedSiteId) {
				selectedSiteId = sites[0].id;
			}
		} catch {
			showToast('error', 'Failed to load sites');
		} finally {
			loadingSites = false;
		}
	}

	async function fetchPages(siteId: string) {
		if (!siteId) { pages = []; return; }
		loadingPages = true;
		try {
			const resp = await fetch(`/api/pages?site_id=${encodeURIComponent(siteId)}`);
			if (!resp.ok) throw new Error(`${resp.status}`);
			const data = await resp.json() as { pages: Page[] };
			pages = data.pages ?? [];
			selectedPageId = '';
		} catch {
			showToast('error', 'Failed to load pages');
			pages = [];
		} finally {
			loadingPages = false;
		}
	}

	// Load sites on mount
	$effect(() => {
		fetchSites();
	});

	// Fetch pages when site changes
	$effect(() => {
		if (selectedSiteId) {
			fetchPages(selectedSiteId);
			validationResult = null;
		}
	});

	// ── Actions ────────────────────────────────────────────────────────────────

	async function runValidation() {
		if (!selectedSiteId) {
			showToast('error', 'Please select a site');
			return;
		}
		if (!exportHtml.trim()) {
			showToast('error', 'No HTML to validate');
			return;
		}

		validating = true;
		validationResult = null;
		try {
			const resp = await fetch('/api/export', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					html: exportHtml,
					site_id: selectedSiteId,
					page_id: selectedPageId || undefined,
					force: forceExport
				})
			});

			const data = await resp.json() as ValidationResult;
			validationResult = data;
		} catch (err) {
			showToast('error', 'Validation failed');
		} finally {
			validating = false;
		}
	}

	async function copyToClipboard() {
		const html = validationResult?.html ?? exportHtml;
		try {
			await navigator.clipboard.writeText(html);
			copied = true;
			showToast('success', 'Copied to clipboard!');
			setTimeout(() => { copied = false; }, 2000);
		} catch {
			showToast('error', 'Failed to copy. Try selecting and copying manually.');
		}
	}

	function downloadHtml() {
		const html = validationResult?.html ?? exportHtml;
		const blob = new Blob([html], { type: 'text/html' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		const pageName = pages.find(p => p.id === selectedPageId)?.slug ?? 'export';
		a.download = `${pageName}.html`;
		a.click();
		URL.revokeObjectURL(url);
		showToast('success', 'Download started');
	}
</script>

<svelte:head>
	<title>Export - Bookingtimes Emulator</title>
</svelte:head>

<!-- Toast -->
{#if toast}
	<div class="position-fixed top-0 end-0 p-3" style="z-index: 1100;">
		<div class="alert alert-{toast.type === 'success' ? 'success' : toast.type === 'info' ? 'info' : 'danger'} alert-dismissible shadow-sm mb-0" role="alert">
			<i class="fa-solid {toast.type === 'success' ? 'fa-check-circle' : toast.type === 'info' ? 'fa-info-circle' : 'fa-exclamation-circle'} me-2"></i>
			{toast.message}
			<button type="button" class="btn-close" onclick={() => toast = null} aria-label="Close"></button>
		</div>
	</div>
{/if}

<div class="mb-4">
	<h1 class="fw-bold mb-1"><i class="fa-solid fa-file-export me-2 text-warning"></i>Export</h1>
	<p class="text-muted mb-0">Validate and export HTML content for your sites.</p>
</div>

<div class="row g-4">
	<!-- Left column: Source + Validation -->
	<div class="col-lg-6">
		<!-- Page selector -->
		<div class="card border-0 shadow-sm mb-4">
			<div class="card-header bg-white">
				<h6 class="mb-0"><i class="fa-solid fa-file-lines me-2 text-info"></i>Content Source</h6>
			</div>
			<div class="card-body">
				<!-- Source toggle -->
				<div class="btn-group w-100 mb-3" role="group">
					<button class="btn btn-sm {htmlSource === 'page' ? 'btn-primary' : 'btn-outline-primary'}"
						onclick={() => htmlSource = 'page'}>
						<i class="fa-solid fa-file me-1"></i> From Page
					</button>
					<button class="btn btn-sm {htmlSource === 'manual' ? 'btn-primary' : 'btn-outline-primary'}"
						onclick={() => htmlSource = 'manual'}>
						<i class="fa-solid fa-code me-1"></i> Paste HTML
					</button>
				</div>

				<!-- Site dropdown -->
				<div class="mb-3">
					<label for="exp-site" class="form-label fw-semibold">Site</label>
					{#if loadingSites}
						<div class="d-flex align-items-center text-muted">
							<div class="spinner-border spinner-border-sm me-2"></div> Loading sites...
						</div>
					{:else}
						<select id="exp-site" class="form-select" bind:value={selectedSiteId}>
							<option value="">-- Select a site --</option>
							{#each sites as site}
								<option value={site.id}>{site.name}</option>
							{/each}
						</select>
					{/if}
				</div>

				{#if htmlSource === 'page'}
					<!-- Page dropdown -->
					<div class="mb-3">
						<label for="exp-page" class="form-label fw-semibold">Page</label>
						{#if loadingPages}
							<div class="d-flex align-items-center text-muted">
								<div class="spinner-border spinner-border-sm me-2"></div> Loading pages...
							</div>
						{:else if pages.length === 0}
							<p class="text-muted small">No pages found for this site.</p>
						{:else}
							<select id="exp-page" class="form-select" bind:value={selectedPageId}>
								<option value="">-- Select a page --</option>
								{#each pages as page}
									<option value={page.id}>{page.title} ({page.slug})</option>
								{/each}
							</select>
						{/if}
					</div>
				{:else}
					<!-- Manual HTML textarea -->
					<div class="mb-3">
						<label for="exp-html" class="form-label fw-semibold">HTML Content</label>
						<textarea id="exp-html" class="form-control font-monospace" rows="8"
							placeholder="Paste your HTML content here..."
							bind:value={htmlInput}></textarea>
					</div>
				{/if}

				<!-- Actions row -->
				<div class="d-flex align-items-center gap-2 flex-wrap">
					<button class="btn btn-primary" onclick={runValidation}
						disabled={validating || !selectedSiteId || !exportHtml.trim()}>
						{#if validating}
							<span class="spinner-border spinner-border-sm me-1"></span>
						{/if}
						<i class="fa-solid fa-check-double me-1"></i> Validate
					</button>

					<div class="form-check form-switch ms-auto">
						<input class="form-check-input" type="checkbox" id="force-export"
							bind:checked={forceExport} />
						<label class="form-check-label small text-muted" for="force-export">Force Export</label>
					</div>
				</div>
			</div>
		</div>

		<!-- Validation Report -->
		{#if validationResult}
			<div class="card border-0 shadow-sm mb-4">
				<div class="card-header bg-white d-flex justify-content-between align-items-center">
					<h6 class="mb-0"><i class="fa-solid fa-clipboard-check me-2"></i>Validation Report</h6>
					{#if isValid}
						<span class="badge bg-success"><i class="fa-solid fa-check me-1"></i>Valid</span>
					{:else}
						<span class="badge bg-danger"><i class="fa-solid fa-exclamation-triangle me-1"></i>Issues Found</span>
					{/if}
				</div>
				<div class="card-body">
					<!-- Stats -->
					{#if stats}
						<div class="row g-2 mb-3">
							<div class="col-6 col-md-3">
								<div class="text-center p-2 bg-light rounded">
									<div class="fw-bold">{stats.total_classes ?? 0}</div>
									<small class="text-muted">Total Classes</small>
								</div>
							</div>
							<div class="col-6 col-md-3">
								<div class="text-center p-2 bg-light rounded">
									<div class="fw-bold text-success">{stats.valid_classes ?? 0}</div>
									<small class="text-muted">Valid</small>
								</div>
							</div>
							<div class="col-6 col-md-3">
								<div class="text-center p-2 bg-light rounded">
									<div class="fw-bold text-warning">{stats.unknown_classes ?? 0}</div>
									<small class="text-muted">Unknown</small>
								</div>
							</div>
							<div class="col-6 col-md-3">
								<div class="text-center p-2 bg-light rounded">
									<div class="fw-bold text-danger">{stats.disallowed_elements ?? 0}</div>
									<small class="text-muted">Disallowed</small>
								</div>
							</div>
						</div>
					{/if}

					<!-- Errors -->
					{#if errors.length > 0}
						<div class="mb-3">
							<h6 class="text-danger small fw-semibold mb-2">
								<i class="fa-solid fa-circle-xmark me-1"></i>Errors ({errors.length})
							</h6>
							<div class="list-group list-group-flush">
								{#each errors as err}
									<div class="list-group-item list-group-item-danger py-2 px-3">
										<div class="small">{err.message}</div>
										{#if err.context}
											<code class="small text-danger">{err.context}</code>
										{/if}
									</div>
								{/each}
							</div>
						</div>
					{/if}

					<!-- Warnings -->
					{#if warnings.length > 0}
						<div class="mb-3">
							<h6 class="text-warning small fw-semibold mb-2">
								<i class="fa-solid fa-triangle-exclamation me-1"></i>Warnings ({warnings.length})
							</h6>
							<div class="list-group list-group-flush">
								{#each warnings as warn}
									<div class="list-group-item list-group-item-warning py-2 px-3">
										<div class="small">{warn.message}</div>
										{#if warn.context}
											<code class="small text-warning">{warn.context}</code>
										{/if}
									</div>
								{/each}
							</div>
						</div>
					{/if}

					{#if errors.length === 0 && warnings.length === 0}
						<p class="text-success mb-0"><i class="fa-solid fa-check-circle me-2"></i>No issues found. HTML is clean.</p>
					{/if}

					{#if validationResult.forced}
						<div class="alert alert-warning small mt-3 mb-0">
							<i class="fa-solid fa-bolt me-1"></i> This export was forced despite validation errors.
						</div>
					{/if}
				</div>
			</div>
		{/if}

		<!-- Export Actions -->
		<div class="card border-0 shadow-sm">
			<div class="card-header bg-white">
				<h6 class="mb-0"><i class="fa-solid fa-download me-2 text-primary"></i>Export Actions</h6>
			</div>
			<div class="card-body">
				<div class="d-flex gap-2 flex-wrap">
					<button class="btn btn-outline-primary" onclick={copyToClipboard}
						disabled={!exportHtml.trim()}>
						{#if copied}
							<i class="fa-solid fa-check me-1 text-success"></i> Copied!
						{:else}
							<i class="fa-solid fa-copy me-1"></i> Copy to Clipboard
						{/if}
					</button>
					<button class="btn btn-outline-secondary" onclick={downloadHtml}
						disabled={!exportHtml.trim()}>
						<i class="fa-solid fa-download me-1"></i> Download .html
					</button>
				</div>
			</div>
		</div>
	</div>

	<!-- Right column: Preview -->
	<div class="col-lg-6">
		<div class="card border-0 shadow-sm">
			<div class="card-header bg-white">
				<h6 class="mb-0"><i class="fa-solid fa-eye me-2 text-info"></i>Preview</h6>
			</div>
			<div class="card-body p-0" style="min-height: 500px;">
				{#if exportHtml.trim() && selectedSiteId}
					<PreviewFrame html={exportHtml} siteId={selectedSiteId} />
				{:else}
					<div class="d-flex align-items-center justify-content-center text-muted" style="min-height: 400px;">
						<div class="text-center">
							<i class="fa-solid fa-eye-slash fa-2x mb-2"></i>
							<p class="mb-0">Select content to preview</p>
						</div>
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>
