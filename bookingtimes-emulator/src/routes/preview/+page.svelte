<script lang="ts">
	import PreviewFrame from '$lib/components/PreviewFrame.svelte';
	import PreviewToolbar from '$lib/components/PreviewToolbar.svelte';

	interface Site {
		id: string;
		name: string;
		url: string;
	}

	let sites = $state<Site[]>([]);
	let selectedSiteId = $state('');
	let iframeWidth = $state('100%');
	let htmlContent = $state('<div class="container py-4">\n  <h1>Preview Test</h1>\n  <p>Enter HTML in the textarea below to preview it with the site\'s styles.</p>\n</div>');
	let wrapperHtml = $state('');
	let loadingSites = $state(true);
	let sitesError = $state('');

	/** Fetch sites list on mount */
	$effect(() => {
		fetchSites();
	});

	async function fetchSites() {
		loadingSites = true;
		sitesError = '';
		try {
			const resp = await fetch('/api/sites');
			if (!resp.ok) throw new Error(`${resp.status} ${resp.statusText}`);
			const data = await resp.json() as { sites: Site[] };
			sites = data.sites ?? [];
			if (sites.length > 0 && !selectedSiteId) {
				selectedSiteId = sites[0].id;
			}
		} catch (err) {
			sitesError = err instanceof Error ? err.message : String(err);
		} finally {
			loadingSites = false;
		}
	}

	function handleWidthChange(width: string) {
		iframeWidth = width;
	}

	function handleSave() {
		try {
			const key = `preview_html_${selectedSiteId || 'default'}`;
			localStorage.setItem(key, htmlContent);
			saveStatus = 'Saved!';
			setTimeout(() => (saveStatus = ''), 2000);
		} catch {
			saveStatus = 'Save failed';
		}
	}

	function handleLoad() {
		try {
			const key = `preview_html_${selectedSiteId || 'default'}`;
			const saved = localStorage.getItem(key);
			if (saved) {
				htmlContent = saved;
				saveStatus = 'Loaded!';
			} else {
				saveStatus = 'Nothing saved';
			}
			setTimeout(() => (saveStatus = ''), 2000);
		} catch {
			saveStatus = 'Load failed';
		}
	}

	let saveStatus = $state('');
</script>

<svelte:head>
	<title>Preview - Bookingtimes Emulator</title>
</svelte:head>

<div class="mb-3">
	<h1 class="fw-bold mb-1">
		<i class="fa-solid fa-eye me-2 text-primary"></i>Preview
	</h1>
	<p class="text-muted mb-0">Preview generated HTML content with site-specific styles.</p>
</div>

<!-- Controls row -->
<div class="row g-3 mb-3">
	<div class="col-md-4">
		<label for="site-select" class="form-label fw-semibold">
			<i class="fa-solid fa-globe me-1"></i>Site
		</label>
		{#if loadingSites}
			<div class="d-flex align-items-center text-muted">
				<div class="spinner-border spinner-border-sm me-2" role="status"></div>
				Loading sites...
			</div>
		{:else if sitesError}
			<div class="alert alert-danger py-1 px-2 small mb-0">
				<i class="fa-solid fa-circle-xmark me-1"></i>{sitesError}
			</div>
		{:else}
			<select
				id="site-select"
				class="form-select"
				bind:value={selectedSiteId}
			>
				<option value="">-- Select a site --</option>
				{#each sites as site}
					<option value={site.id}>{site.name} ({site.url})</option>
				{/each}
			</select>
		{/if}
	</div>

	<div class="col-md-4">
		<label for="wrapper-input" class="form-label fw-semibold">
			<i class="fa-solid fa-code me-1"></i>Wrapper (optional)
		</label>
		<input
			id="wrapper-input"
			type="text"
			class="form-control font-monospace small"
			placeholder='e.g. <div class="container">|||</div>'
			bind:value={wrapperHtml}
		/>
		<div class="form-text">Use ||| to separate opening and closing tags.</div>
	</div>

	<div class="col-md-4 d-flex align-items-end gap-2">
		<button class="btn btn-sm btn-outline-primary" onclick={handleSave} title="Save HTML to localStorage">
			<i class="fa-solid fa-floppy-disk me-1"></i>Save
		</button>
		<button class="btn btn-sm btn-outline-secondary" onclick={handleLoad} title="Load HTML from localStorage">
			<i class="fa-solid fa-folder-open me-1"></i>Load
		</button>
		{#if saveStatus}
			<span class="badge bg-info">{saveStatus}</span>
		{/if}
	</div>
</div>

<!-- Toolbar + Preview -->
<div class="card border-0 shadow-sm mb-3">
	<PreviewToolbar activeWidth={iframeWidth} onwidthchange={handleWidthChange} />

	<div class="preview-area">
		<PreviewFrame
			html={htmlContent}
			siteId={selectedSiteId}
			wrapper={wrapperHtml}
			width={iframeWidth}
		/>
	</div>
</div>

<!-- HTML textarea -->
<div class="card border-0 shadow-sm">
	<div class="card-header bg-white border-bottom d-flex align-items-center">
		<i class="fa-solid fa-code me-2 text-muted"></i>
		<span class="fw-semibold">HTML Content</span>
	</div>
	<div class="card-body p-0">
		<textarea
			class="form-control font-monospace border-0 rounded-0"
			rows="12"
			bind:value={htmlContent}
			placeholder="Enter HTML to preview..."
			spellcheck="false"
		></textarea>
	</div>
</div>

<style>
	.preview-area {
		background: #e9ecef;
		padding: 16px;
		min-height: 450px;
		display: flex;
		justify-content: center;
	}

	.preview-area :global(.preview-frame-container) {
		height: 100%;
		min-height: 420px;
	}

	textarea {
		resize: vertical;
		min-height: 150px;
		font-size: 0.85rem;
	}
</style>
