<!--
  Preview Page — WRK-BCE2-046

  Full-featured preview page with:
  - Site slug + site ID inputs for CSS tier loading
  - Blueprint selector dropdown (auto-fetches from /api/blueprints/[siteId])
  - Responsive breakpoint controls (delegated to PreviewFrame)
  - Sidebar simulation toggle
  - HTML content editor (for manual preview)
  - Validation status display (when blueprint is selected)
-->
<script lang="ts">
	import PreviewFrame from '$lib/components/PreviewFrame.svelte';

	// ── Site config ──────────────────────────────────────────────────────────
	let siteSlug = $state('');
	let siteId = $state(0);
	let siteIdInput = $state('');
	let showSidebar = $state(false);

	// Keep siteId in sync with text input
	$effect(() => {
		const parsed = parseInt(siteIdInput, 10);
		siteId = isNaN(parsed) ? 0 : parsed;
	});

	// ── Blueprint selector ───────────────────────────────────────────────────
	interface BlueprintSummary {
		id: number;
		working_title: string | null;
		page_type: string;
		canonical_url: string | null;
	}

	let blueprints = $state<BlueprintSummary[]>([]);
	let blueprintsLoading = $state(false);
	let blueprintsError = $state('');
	let selectedBlueprintId = $state(0);

	// Fetch blueprints when siteId changes
	$effect(() => {
		if (siteId <= 0) {
			blueprints = [];
			selectedBlueprintId = 0;
			blueprintsError = '';
			return;
		}

		blueprintsLoading = true;
		blueprintsError = '';

		fetch(`/api/blueprints/${siteId}`)
			.then(async (res) => {
				if (!res.ok) {
					if (res.status === 404) {
						blueprints = [];
						blueprintsError = 'No blueprints found for this site.';
						return;
					}
					const body = await res.json().catch(() => ({ error: res.statusText }));
					blueprintsError = body.error || `HTTP ${res.status}`;
					return;
				}
				const data = await res.json();
				blueprints = data.blueprints ?? [];
			})
			.catch((err) => {
				blueprintsError = err instanceof Error ? err.message : String(err);
			})
			.finally(() => {
				blueprintsLoading = false;
			});
	});

	// ── Mode: blueprint vs manual HTML ───────────────────────────────────────
	let mode = $state<'manual' | 'blueprint'>('manual');

	// Auto-switch to blueprint mode when a blueprint is selected
	$effect(() => {
		if (selectedBlueprintId > 0) {
			mode = 'blueprint';
		}
	});

	// ── Manual HTML content ──────────────────────────────────────────────────
	let htmlContent = $state(`<h1>Sample Heading</h1>
<p class="lead">This is a lead paragraph demonstrating how content will appear on the BookingTimes site with the target's actual CSS applied.</p>

<div class="card mb-3">
  <div class="card-body">
    <h5 class="card-title">Card Example</h5>
    <p class="card-text">Cards, buttons, and other Bootstrap components should render using the site's real stylesheet.</p>
    <a href="#" class="btn btn-primary">Primary Button</a>
    <a href="#" class="btn btn-outline-secondary ms-2">Secondary</a>
  </div>
</div>

<h2>Content Section</h2>
<p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</p>

<ul>
  <li>First item in an unordered list</li>
  <li>Second item with <strong>bold text</strong></li>
  <li>Third item with a <a href="#">link</a></li>
</ul>

<div class="alert alert-info">
  <strong>Info:</strong> This alert demonstrates Bootstrap styling from the target site.
</div>

<table class="table table-striped">
  <thead>
    <tr><th>#</th><th>Name</th><th>Status</th></tr>
  </thead>
  <tbody>
    <tr><td>1</td><td>Example Row</td><td><span class="badge bg-success">Active</span></td></tr>
    <tr><td>2</td><td>Another Row</td><td><span class="badge bg-warning text-dark">Pending</span></td></tr>
  </tbody>
</table>`);
</script>

<svelte:head>
	<title>Preview — BCE</title>
</svelte:head>

<h1 class="mt-4 mb-3">Content Preview</h1>

<!-- Row 1: Site config -->
<div class="row mb-3">
	<div class="col-md-4 mb-3">
		<label for="site-slug" class="form-label fw-bold">Site Slug</label>
		<input
			id="site-slug"
			type="text"
			class="form-control"
			bind:value={siteSlug}
			placeholder="e.g. metro-driving.bookingtimes.com"
		/>
		<div class="form-text">Hostname slug for Tier 2 CSS (from <code>data/css-cache/</code>).</div>
	</div>

	<div class="col-md-3 mb-3">
		<label for="site-id" class="form-label fw-bold">Site ID</label>
		<input
			id="site-id"
			type="text"
			class="form-control"
			bind:value={siteIdInput}
			placeholder="e.g. 1"
		/>
		<div class="form-text">Numeric ID for Tier 3 CSS + blueprints.</div>
	</div>

	<div class="col-md-3 mb-3 d-flex align-items-end">
		<div class="form-check form-switch">
			<input
				id="sidebar-toggle"
				type="checkbox"
				class="form-check-input"
				bind:checked={showSidebar}
				role="switch"
			/>
			<label class="form-check-label" for="sidebar-toggle">Simulate Sidebar</label>
		</div>
	</div>
</div>

<!-- Row 2: Blueprint selector -->
{#if siteId > 0}
	<div class="row mb-3">
		<div class="col-md-6">
			<label for="blueprint-select" class="form-label fw-bold">Blueprint</label>
			{#if blueprintsLoading}
				<div class="d-flex align-items-center gap-2">
					<div class="spinner-border spinner-border-sm text-primary" role="status"></div>
					<span class="text-muted small">Loading blueprints...</span>
				</div>
			{:else if blueprintsError && blueprints.length === 0}
				<div class="form-text text-warning">{blueprintsError}</div>
			{:else}
				<select id="blueprint-select" class="form-select" bind:value={selectedBlueprintId}>
					<option value={0}>-- Manual HTML (no blueprint) --</option>
					{#each blueprints as bp}
						<option value={bp.id}>
							#{bp.id} — {bp.working_title || bp.canonical_url || 'Untitled'} ({bp.page_type})
						</option>
					{/each}
				</select>
			{/if}
		</div>

		<div class="col-md-3 d-flex align-items-end">
			{#if selectedBlueprintId > 0}
				<button
					type="button"
					class="btn btn-outline-secondary btn-sm"
					onclick={() => { selectedBlueprintId = 0; mode = 'manual'; }}
				>
					<i class="fa-solid fa-xmark me-1"></i>Clear Blueprint
				</button>
			{/if}
		</div>
	</div>
{/if}

<!-- Row 3: Mode tabs + content -->
<div class="mb-4">
	<ul class="nav nav-tabs mb-3">
		<li class="nav-item">
			<button
				class="nav-link {mode === 'manual' ? 'active' : ''}"
				onclick={() => { mode = 'manual'; selectedBlueprintId = 0; }}
			>
				<i class="fa-solid fa-code me-1"></i>Manual HTML
			</button>
		</li>
		{#if siteId > 0}
			<li class="nav-item">
				<button
					class="nav-link {mode === 'blueprint' ? 'active' : ''}"
					disabled={selectedBlueprintId <= 0}
					onclick={() => { mode = 'blueprint'; }}
				>
					<i class="fa-solid fa-file-lines me-1"></i>Blueprint Preview
					{#if selectedBlueprintId > 0}
						<span class="badge bg-primary ms-1">#{selectedBlueprintId}</span>
					{/if}
				</button>
			</li>
		{/if}
	</ul>

	{#if mode === 'manual'}
		<label for="html-editor" class="form-label fw-bold">HTML Content</label>
		<textarea
			id="html-editor"
			class="form-control font-monospace"
			rows="8"
			bind:value={htmlContent}
		></textarea>
	{:else}
		<div class="alert alert-info py-2 small mb-0">
			<i class="fa-solid fa-info-circle me-1"></i>
			Showing assembled HTML from blueprint <strong>#{selectedBlueprintId}</strong>.
			Validation status and head JS are applied automatically.
		</div>
	{/if}
</div>

<!-- Preview -->
{#if siteSlug || siteId > 0}
	<h2 class="h5 mb-3">
		Preview
		{#if mode === 'blueprint' && selectedBlueprintId > 0}
			<span class="text-muted fw-normal">(Blueprint #{selectedBlueprintId})</span>
		{/if}
	</h2>
	<PreviewFrame
		htmlContent={mode === 'manual' ? htmlContent : ''}
		{siteSlug}
		{siteId}
		{showSidebar}
		blueprintId={mode === 'blueprint' ? selectedBlueprintId : 0}
	/>
{:else}
	<div class="alert alert-secondary">
		Enter a site slug or site ID above to load the preview.
	</div>
{/if}
