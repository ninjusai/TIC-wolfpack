<script lang="ts">
	let {
		activeWidth = '100%',
		onwidthchange
	}: {
		activeWidth?: string;
		onwidthchange?: (width: string) => void;
	} = $props();

	interface Breakpoint {
		label: string;
		width: string;
		icon: string;
		px: number | null;
	}

	const breakpoints: Breakpoint[] = [
		{ label: 'Mobile', width: '375px', icon: 'fa-mobile-screen', px: 375 },
		{ label: 'Tablet', width: '767px', icon: 'fa-tablet-screen-button', px: 767 },
		{ label: 'Desktop', width: '991px', icon: 'fa-desktop', px: 991 },
		{ label: 'Full', width: '1200px', icon: 'fa-display', px: 1200 },
		{ label: 'Auto', width: '100%', icon: 'fa-arrows-left-right', px: null }
	];

	function setWidth(width: string) {
		onwidthchange?.(width);
	}

	let currentLabel = $derived(
		breakpoints.find((b) => b.width === activeWidth)?.label ?? 'Custom'
	);

	let currentDisplay = $derived(
		activeWidth === '100%' ? 'Auto (100%)' : activeWidth
	);
</script>

<div class="preview-toolbar d-flex align-items-center gap-2 px-3 py-2">
	<span class="text-muted small me-1">
		<i class="fa-solid fa-ruler-combined me-1"></i>Viewport:
	</span>

	<div class="btn-group btn-group-sm" role="group" aria-label="Breakpoint selector">
		{#each breakpoints as bp}
			<button
				type="button"
				class="btn"
				class:btn-primary={activeWidth === bp.width}
				class:btn-outline-secondary={activeWidth !== bp.width}
				onclick={() => setWidth(bp.width)}
				title="{bp.label} ({bp.width})"
			>
				<i class="fa-solid {bp.icon}"></i>
				<span class="d-none d-lg-inline ms-1">{bp.label}</span>
			</button>
		{/each}
	</div>

	<span class="badge bg-secondary ms-2">
		{currentLabel} &mdash; {currentDisplay}
	</span>
</div>

<style>
	.preview-toolbar {
		background: #f8f9fa;
		border-bottom: 1px solid #dee2e6;
		border-radius: 6px 6px 0 0;
	}
</style>
