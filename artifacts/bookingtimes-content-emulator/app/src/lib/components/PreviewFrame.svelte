<!--
  PreviewFrame.svelte — WRK-BCE2-046

  Sandboxed iframe preview component that renders generated HTML content
  styled with all three CSS tiers, responsive breakpoints, sidebar simulation,
  and Tier 2 interactive JS support.

  CSS Tiers loaded:
    Tier 1: Bootstrap 5.0.2 (CDN)
    Tier 2: Site-specific CSS from /api/preview-css/[slug]
    Tier 3: Generated CSS from /api/preview-css/tier3/[siteId]
    FA6 Pro: Font Awesome 6 Pro CSS (if available)

  Props:
    htmlContent  — raw HTML to render in the preview
    siteSlug     — hostname slug for Tier 2 CSS lookup
    siteId       — numeric site ID for Tier 3 CSS + blueprint loading
    showSidebar  — wrap content in col-lg-9 / col-lg-3 layout
    width        — CSS width value or px number
    blueprintId  — when set, auto-loads assembled HTML from /api/export/[blueprintId]
    breakpoint   — active breakpoint name (bound externally or via built-in controls)
    showControls — show built-in breakpoint controls (default true)
-->
<script lang="ts">
	let {
		htmlContent = '',
		siteSlug = '',
		siteId = 0,
		showSidebar = false,
		width = '100%' as number | string,
		blueprintId = 0,
		breakpoint = 'full' as string,
		showControls = true,
	} = $props();

	// ── CSS state ────────────────────────────────────────────────────────────
	let tier2Css = $state('');
	let tier3Css = $state('');
	let loading = $state(true);
	let cssError = $state('');

	// ── Blueprint state ──────────────────────────────────────────────────────
	let blueprintHtml = $state('');
	let blueprintHeadJs = $state('');
	let blueprintValidation = $state<{ passed: boolean; critical: string[]; warnings: string[] } | null>(null);
	let blueprintLoading = $state(false);
	let blueprintError = $state('');

	// ── Breakpoints ──────────────────────────────────────────────────────────
	const BREAKPOINTS = [
		{ name: 'xs', label: 'XS', width: '375px', icon: 'fa-mobile-screen' },
		{ name: 'sm', label: 'SM', width: '576px', icon: 'fa-mobile' },
		{ name: 'md', label: 'MD', width: '768px', icon: 'fa-tablet-screen-button' },
		{ name: 'lg', label: 'LG', width: '992px', icon: 'fa-laptop' },
		{ name: 'xl', label: 'XL', width: '1200px', icon: 'fa-desktop' },
		{ name: 'full', label: 'Full', width: '100%', icon: 'fa-arrows-left-right' },
	] as const;

	let activeBreakpoint = $state(breakpoint);

	// Sync external breakpoint prop changes
	$effect(() => {
		activeBreakpoint = breakpoint;
	});

	// ── Width computation ────────────────────────────────────────────────────
	function toCSSWidth(w: number | string): string {
		if (typeof w === 'number') return `${w}px`;
		return w;
	}

	let effectiveWidth = $derived.by(() => {
		// If breakpoint controls are active and user picked one, use that
		if (showControls && activeBreakpoint !== 'full') {
			const bp = BREAKPOINTS.find((b) => b.name === activeBreakpoint);
			return bp ? bp.width : toCSSWidth(width);
		}
		return toCSSWidth(width);
	});

	// ── Fetch Tier 2 CSS ─────────────────────────────────────────────────────
	async function fetchTier2Css(slug: string) {
		try {
			const res = await fetch(`/api/preview-css/${encodeURIComponent(slug)}`);
			if (!res.ok) {
				const body = await res.json().catch(() => ({ message: res.statusText }));
				cssError = body.message || `Tier 2 CSS: HTTP ${res.status}`;
				return;
			}
			tier2Css = await res.text();
		} catch (err: unknown) {
			cssError = err instanceof Error ? err.message : String(err);
		}
	}

	// ── Fetch Tier 3 CSS ─────────────────────────────────────────────────────
	async function fetchTier3Css(id: number) {
		try {
			const res = await fetch(`/api/preview-css/tier3/${id}`);
			if (res.ok) {
				tier3Css = await res.text();
			}
			// Non-200 is fine — site may have no Tier 3 decisions
		} catch {
			// Tier 3 is optional — swallow errors
		}
	}

	// ── Load CSS tiers ───────────────────────────────────────────────────────
	$effect(() => {
		if (!siteSlug && !siteId) return;

		loading = true;
		cssError = '';
		tier2Css = '';
		tier3Css = '';

		const promises: Promise<void>[] = [];

		if (siteSlug) {
			promises.push(fetchTier2Css(siteSlug));
		}

		if (siteId > 0) {
			promises.push(fetchTier3Css(siteId));
		}

		Promise.all(promises).finally(() => {
			loading = false;
		});
	});

	// ── Blueprint loading ────────────────────────────────────────────────────
	$effect(() => {
		if (!blueprintId || blueprintId <= 0) {
			blueprintHtml = '';
			blueprintHeadJs = '';
			blueprintValidation = null;
			blueprintError = '';
			return;
		}

		blueprintLoading = true;
		blueprintError = '';

		fetch(`/api/export/${blueprintId}`)
			.then(async (res) => {
				if (!res.ok) {
					const body = await res.json().catch(() => ({ error: res.statusText }));
					blueprintError = body.error || `HTTP ${res.status}`;
					return;
				}
				const data = await res.json();
				blueprintHtml = data.artifacts?.pageHtml ?? '';
				blueprintHeadJs = data.artifacts?.headJs ?? '';
				blueprintValidation = data.validation ?? null;
			})
			.catch((err) => {
				blueprintError = err instanceof Error ? err.message : String(err);
			})
			.finally(() => {
				blueprintLoading = false;
			});
	});

	// ── Determine effective HTML content ──────────────────────────────────────
	let resolvedHtml = $derived(blueprintId > 0 ? blueprintHtml : htmlContent);
	let resolvedHeadJs = $derived(blueprintId > 0 ? blueprintHeadJs : '');

	// ── Build srcdoc ─────────────────────────────────────────────────────────
	let srcdoc = $derived.by(() => {
		if (loading) return '';
		if (!tier2Css && !resolvedHtml && !tier3Css) return '';

		// Sidebar layout wrapping
		const body = showSidebar
			? `<div class="row">
				<div class="col-lg-9">${resolvedHtml}</div>
				<div class="col-lg-3">
					<div style="background:#f0f0f0;border:1px dashed #ccc;padding:1rem;min-height:200px;border-radius:4px;">
						<small style="color:#999;font-weight:600;">&#9776; Sidebar Area</small>
					</div>
				</div>
			</div>`
			: resolvedHtml;

		// Build head JS injection
		const headJsBlock = resolvedHeadJs
			? `<script>${resolvedHeadJs}<\/script>`
			: '';

		return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="utf-8">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<!-- Tier 1: Bootstrap 5.0.2 CSS -->
	<link rel="stylesheet"
		href="https://cdn.jsdelivr.net/npm/bootstrap@5.0.2/dist/css/bootstrap.min.css"
		integrity="sha384-EVSTQN3/azprG1Anm3QDgpJLIm9Nao0Yz1ztcQTwFspd3yD65VohhpuuCOmLASjC"
		crossorigin="anonymous">
	<!-- FA6 Pro (CDN fallback — loads free if Pro kit unavailable) -->
	<link rel="stylesheet"
		href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css"
		crossorigin="anonymous">
	<!-- Tier 2: Site-specific CSS -->
	${tier2Css ? `<style id="tier2-css">${tier2Css}</style>` : ''}
	<!-- Tier 3: Generated CSS -->
	${tier3Css ? `<style id="tier3-css">${tier3Css}</style>` : ''}
	<style>
		/* Prevent iframe body margin and ensure clean rendering */
		body { margin: 0; padding: 1rem; }
	</style>
	<!-- Tier 2 Head JS -->
	${headJsBlock}
</head>
<body>
	<div class="container">
		${body}
	</div>

	<!-- jQuery (for Tier 2 interactive elements) -->
	<script src="https://code.jquery.com/jquery-3.6.0.min.js"
		integrity="sha256-/xUj+3OJU5yExlq6GSYGSHk7tPXikynS7ogEvDej/m4="
		crossorigin="anonymous"><\/script>
	<!-- Bootstrap 5.0.2 JS Bundle (accordion, collapse, tabs, etc.) -->
	<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.0.2/dist/js/bootstrap.bundle.min.js"
		integrity="sha384-MrcW6ZMFYlzcLA8Nl+NtUVF0sA7MsXsP1UyJoMp4YLEuNSfAP+JcXn/tWtIaxVXM"
		crossorigin="anonymous"><\/script>
</body>
</html>`;
	});
</script>

<!-- Breakpoint controls -->
{#if showControls}
	<div class="preview-controls d-flex align-items-center gap-1 mb-2">
		<span class="text-muted small me-2">Breakpoint:</span>
		{#each BREAKPOINTS as bp}
			<button
				type="button"
				class="btn btn-sm {activeBreakpoint === bp.name ? 'btn-primary' : 'btn-outline-secondary'}"
				title="{bp.label} ({bp.width})"
				onclick={() => { activeBreakpoint = bp.name; }}
			>
				<i class="fa-solid {bp.icon} me-1"></i>{bp.label}
			</button>
		{/each}
	</div>
{/if}

<!-- Validation status (when blueprint is loaded) -->
{#if blueprintValidation}
	<div class="mb-2">
		{#if blueprintValidation.passed}
			<span class="badge bg-success"><i class="fa-solid fa-circle-check me-1"></i>Validation passed</span>
		{:else}
			<span class="badge bg-danger"><i class="fa-solid fa-circle-xmark me-1"></i>Validation failed</span>
		{/if}
		{#if blueprintValidation.critical.length > 0}
			<div class="alert alert-danger mt-2 py-1 px-2 small mb-0">
				<strong>Critical:</strong>
				<ul class="mb-0 ps-3">
					{#each blueprintValidation.critical as issue}
						<li>{issue}</li>
					{/each}
				</ul>
			</div>
		{/if}
		{#if blueprintValidation.warnings.length > 0}
			<div class="alert alert-warning mt-1 py-1 px-2 small mb-0">
				<strong>Warnings:</strong>
				<ul class="mb-0 ps-3">
					{#each blueprintValidation.warnings as warn}
						<li>{warn}</li>
					{/each}
				</ul>
			</div>
		{/if}
	</div>
{/if}

<!-- Preview frame -->
<div class="preview-frame-wrapper" style="width:{effectiveWidth};">
	{#if loading || blueprintLoading}
		<div class="preview-loading">
			<div class="spinner-border text-primary" role="status">
				<span class="visually-hidden">Loading...</span>
			</div>
			<p class="mt-2 text-muted">
				{blueprintLoading ? 'Loading blueprint\u2026' : 'Loading CSS\u2026'}
			</p>
		</div>
	{:else if cssError}
		<div class="alert alert-warning" role="alert">
			<strong>CSS not available:</strong> {cssError}
			<hr>
			<small>Run the CSS scraper first: <code>POST /api/scrape</code> with the target site URL.</small>
		</div>
	{:else if blueprintError}
		<div class="alert alert-danger" role="alert">
			<strong>Blueprint load failed:</strong> {blueprintError}
		</div>
	{:else}
		<iframe
			title="Content preview"
			{srcdoc}
			sandbox="allow-same-origin allow-scripts"
			style="width:100%;border:1px solid #dee2e6;border-radius:4px;min-height:400px;"
		></iframe>
	{/if}
</div>

<style>
	.preview-frame-wrapper {
		margin: 0 auto;
		transition: width 0.3s ease;
	}

	.preview-loading {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 3rem;
		border: 1px dashed #dee2e6;
		border-radius: 4px;
		background: #fafafa;
	}

	iframe {
		display: block;
	}

	.preview-controls {
		flex-wrap: wrap;
	}
</style>
