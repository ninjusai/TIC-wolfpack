<script lang="ts">
	let {
		html = '',
		siteId = '',
		wrapper = '',
		width = '100%'
	}: {
		html: string;
		siteId: string;
		wrapper?: string;
		width?: string;
	} = $props();

	let loading = $state(true);
	let cssError = $state('');
	let srcdoc = $state('');
	let debounceTimer: ReturnType<typeof setTimeout> | null = null;

	/** Build the full iframe document string */
	function buildDocument(cssText: string, content: string, wrapperHtml: string): string {
		let body: string;
		if (wrapperHtml) {
			// wrapper should be in the form of opening tags; we close them after content
			// Expect wrapper as "opening|||closing" or just opening html with matching closing
			const parts = wrapperHtml.split('|||');
			if (parts.length === 2) {
				body = parts[0] + content + parts[1];
			} else {
				body = wrapperHtml + content;
			}
		} else {
			body = content;
		}

		return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
<style>
${cssText}
</style>
<style>
/* Reset iframe body defaults */
body { margin: 0; padding: 0; }
</style>
</head>
<body>
${body}
</body>
</html>`;
	}

	/** Fetch site CSS and rebuild the srcdoc */
	async function rebuildPreview() {
		if (!siteId) {
			srcdoc = buildDocument('/* no site selected */', html, wrapper);
			loading = false;
			return;
		}

		loading = true;
		cssError = '';

		try {
			const resp = await fetch(`/api/css/${encodeURIComponent(siteId)}`);
			if (!resp.ok) {
				throw new Error(`CSS fetch failed: ${resp.status} ${resp.statusText}`);
			}
			const cssText = await resp.text();
			srcdoc = buildDocument(cssText, html, wrapper);
		} catch (err) {
			cssError = err instanceof Error ? err.message : String(err);
			// Still build the doc without custom CSS so user sees something
			srcdoc = buildDocument('/* CSS load failed */', html, wrapper);
		} finally {
			loading = false;
		}
	}

	// Rebuild when siteId changes (immediate)
	$effect(() => {
		// Track siteId dependency
		const _siteId = siteId;
		void _siteId;
		rebuildPreview();
	});

	// Rebuild when html or wrapper change (debounced 300ms)
	$effect(() => {
		// Track html and wrapper dependencies
		const _html = html;
		const _wrapper = wrapper;
		void _html;
		void _wrapper;

		if (debounceTimer) clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => {
			rebuildPreview();
		}, 300);

		return () => {
			if (debounceTimer) clearTimeout(debounceTimer);
		};
	});
</script>

<div class="preview-frame-container" style="width: {width}; margin: 0 auto;">
	{#if loading}
		<div class="loading-overlay">
			<div class="spinner-border text-primary" role="status">
				<span class="visually-hidden">Loading...</span>
			</div>
			<span class="ms-2 text-muted">Loading preview...</span>
		</div>
	{/if}

	{#if cssError}
		<div class="alert alert-warning alert-dismissible m-2" role="alert">
			<i class="fa-solid fa-triangle-exclamation me-1"></i>
			CSS Error: {cssError}
			<button type="button" class="btn-close" onclick={() => cssError = ''} aria-label="Close"></button>
		</div>
	{/if}

	<iframe
		title="Preview"
		{srcdoc}
		sandbox="allow-same-origin allow-scripts"
		class="preview-iframe"
		onload={() => loading = false}
	></iframe>
</div>

<style>
	.preview-frame-container {
		position: relative;
		height: 100%;
		min-height: 400px;
		border: 1px solid #dee2e6;
		border-radius: 6px;
		overflow: hidden;
		background: #fff;
		transition: width 0.3s ease;
	}

	.loading-overlay {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(255, 255, 255, 0.85);
		z-index: 10;
	}

	.preview-iframe {
		width: 100%;
		height: 100%;
		min-height: 400px;
		border: none;
		display: block;
	}
</style>
