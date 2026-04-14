<svelte:head>
	<title>Batch - Bookingtimes Emulator</title>
</svelte:head>

<script lang="ts">
	import PreviewFrame from '$lib/components/PreviewFrame.svelte';

	// ── Types ──────────────────────────────────────────────────────────────
	interface Site { id: string; name: string; url: string; }
	interface Template { id: string; name: string; description: string | null; site_ids: string[]; section_count: number; }
	interface Suburb { id: string; suburb_name: string; postcode: string | null; region: string | null; state: string; }
	interface BatchJob {
		id: string;
		template_id: string;
		site_id: string;
		suburb: string;
		status: 'pending' | 'processing' | 'complete' | 'failed' | 'needs_review';
		page_id: string | null;
		error_message: string | null;
		retry_count: number;
		created_at: string;
		updated_at: string;
	}

	// ── State ──────────────────────────────────────────────────────────────
	let sites = $state<Site[]>([]);
	let templates = $state<Template[]>([]);
	let suburbs = $state<Suburb[]>([]);
	let jobs = $state<BatchJob[]>([]);

	let selectedSiteId = $state('');
	let selectedTemplateId = $state('');
	let selectedSuburbIds = $state<Set<string>>(new Set());

	let statusFilter = $state('all');
	let loading = $state(false);
	let creating = $state(false);
	let processing = $state(false);
	let pollTimer = $state<ReturnType<typeof setInterval> | null>(null);

	// Toast
	let toasts = $state<Array<{ id: number; message: string; type: string }>>([]);
	let toastCounter = $state(0);

	// Modals
	let previewModal = $state<{ open: boolean; job: BatchJob | null; html: string }>({ open: false, job: null, html: '' });
	let editModal = $state<{ open: boolean; job: BatchJob | null; html: string }>({ open: false, job: null, html: '' });

	// Stats
	let stats = $derived({
		total: jobs.length,
		pending: jobs.filter(j => j.status === 'pending').length,
		processing: jobs.filter(j => j.status === 'processing').length,
		complete: jobs.filter(j => j.status === 'complete').length,
		failed: jobs.filter(j => j.status === 'failed').length,
		needs_review: jobs.filter(j => j.status === 'needs_review').length,
	});

	let progressPct = $derived(stats.total > 0 ? Math.round((stats.complete / stats.total) * 100) : 0);

	let filteredJobs = $derived(
		statusFilter === 'all' ? jobs : jobs.filter(j => j.status === statusFilter)
	);

	// Current processing job
	let currentJob = $derived(jobs.find(j => j.status === 'processing') ?? null);

	// Processing timing
	let processingStartTime = $state<number | null>(null);
	let completedDuringSession = $state(0);
	let estimatedTimeLeft = $derived(() => {
		if (!processingStartTime || completedDuringSession === 0) return null;
		const elapsed = (Date.now() - processingStartTime) / 1000;
		const avgPerJob = elapsed / completedDuringSession;
		const remaining = stats.pending + stats.processing;
		return Math.ceil(avgPerJob * remaining);
	});

	// ── Toast helpers ──────────────────────────────────────────────────────
	function showToast(message: string, type: string = 'success') {
		const id = ++toastCounter;
		toasts = [...toasts, { id, message, type }];
		setTimeout(() => {
			toasts = toasts.filter(t => t.id !== id);
		}, 4000);
	}

	// ── Data fetching ──────────────────────────────────────────────────────
	async function fetchSites() {
		try {
			const res = await fetch('/api/sites');
			const data: { sites?: Site[] } = await res.json();
			sites = data.sites ?? [];
		} catch { sites = []; }
	}

	async function fetchTemplates() {
		try {
			const res = await fetch('/api/templates');
			const data: { templates?: Template[] } = await res.json();
			templates = data.templates ?? [];
		} catch { templates = []; }
	}

	async function fetchSuburbs() {
		try {
			const res = await fetch('/api/suburbs');
			const data: { suburbs?: Suburb[] } = await res.json();
			suburbs = data.suburbs ?? [];
		} catch { suburbs = []; }
	}

	async function fetchJobs() {
		try {
			const res = await fetch('/api/batch');
			const data: { jobs?: BatchJob[] } = await res.json();
			jobs = data.jobs ?? [];
		} catch { jobs = []; }
	}

	async function fetchPageHtml(pageId: string): Promise<string> {
		try {
			const res = await fetch(`/api/pages?page_id=${encodeURIComponent(pageId)}`);
			const data: { versions?: Array<{ html_content?: string; html?: string }> } = await res.json();
			if (data.versions && data.versions.length > 0) {
				return data.versions[0].html_content || data.versions[0].html || '';
			}
			return '';
		} catch {
			return '';
		}
	}

	// ── Init ───────────────────────────────────────────────────────────────
	$effect(() => {
		fetchSites();
		fetchTemplates();
		fetchSuburbs();
		fetchJobs();
	});

	// ── Suburb selection ───────────────────────────────────────────────────
	function toggleSuburb(id: string) {
		const next = new Set(selectedSuburbIds);
		if (next.has(id)) next.delete(id); else next.add(id);
		selectedSuburbIds = next;
	}

	function selectAllSuburbs() {
		selectedSuburbIds = new Set(suburbs.map(s => s.id));
	}

	function deselectAllSuburbs() {
		selectedSuburbIds = new Set();
	}

	// ── Create batch ───────────────────────────────────────────────────────
	async function createBatch() {
		if (!selectedSiteId || !selectedTemplateId || selectedSuburbIds.size === 0) {
			showToast('Please select a site, template, and at least one suburb.', 'warning');
			return;
		}
		creating = true;
		try {
			const res = await fetch('/api/batch', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					site_id: selectedSiteId,
					template_id: selectedTemplateId,
					suburb_ids: Array.from(selectedSuburbIds)
				})
			});
			if (!res.ok) {
				const errBody = await res.json().catch(() => null) as { message?: string } | null;
				throw new Error(errBody?.message || res.statusText || 'Failed to create batch');
			}
			const data: { batch: { total_jobs: number } } = await res.json();
			showToast(`Batch created: ${data.batch.total_jobs} jobs queued.`, 'success');
			selectedSuburbIds = new Set();
			await fetchJobs();
		} catch (err) {
			showToast(`Error: ${err instanceof Error ? err.message : String(err)}`, 'danger');
		} finally {
			creating = false;
		}
	}

	// ── Processing ─────────────────────────────────────────────────────────
	async function processNextJob(): Promise<boolean> {
		try {
			const res = await fetch('/api/batch/process', { method: 'POST' });
			const data: { result: unknown } = await res.json();
			if (!data.result) return false; // no more pending
			completedDuringSession++;
			await fetchJobs();
			return true;
		} catch {
			return false;
		}
	}

	async function startProcessing() {
		if (processing) return;
		processing = true;
		processingStartTime = Date.now();
		completedDuringSession = 0;

		// Process sequentially with polling
		const run = async () => {
			if (!processing) return;
			const hasMore = await processNextJob();
			if (hasMore && processing) {
				pollTimer = setTimeout(run, 500) as unknown as ReturnType<typeof setInterval>;
			} else {
				stopProcessing();
				if (!hasMore) showToast('All jobs processed.', 'info');
			}
		};
		run();
	}

	function stopProcessing() {
		processing = false;
		if (pollTimer) {
			clearTimeout(pollTimer as unknown as ReturnType<typeof setTimeout>);
			pollTimer = null;
		}
		processingStartTime = null;
		fetchJobs();
	}

	// ── Job actions ────────────────────────────────────────────────────────
	async function approveJob(job: BatchJob) {
		try {
			const res = await fetch(`/api/batch/${encodeURIComponent(job.id)}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ status: 'complete' })
			});
			if (!res.ok) {
				const errBody = await res.json().catch(() => null) as { message?: string } | null;
				throw new Error(errBody?.message || res.statusText || 'Failed to approve');
			}
			showToast(`Approved: ${job.suburb}`, 'success');
			await fetchJobs();
		} catch (err) {
			showToast(`Failed to approve job: ${err instanceof Error ? err.message : String(err)}`, 'danger');
		}
	}

	async function regenerateJob(job: BatchJob) {
		try {
			// Reset the job to 'pending' so it gets picked up by the batch processor
			const res = await fetch(`/api/batch/${encodeURIComponent(job.id)}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ status: 'pending' })
			});
			if (!res.ok) {
				const errBody = await res.json().catch(() => null) as { message?: string } | null;
				throw new Error(errBody?.message || res.statusText || 'Failed to regenerate');
			}
			showToast(`Queued for regeneration: ${job.suburb}`, 'info');
			await fetchJobs();
		} catch (err) {
			showToast(`Failed to regenerate job: ${err instanceof Error ? err.message : String(err)}`, 'danger');
		}
	}

	async function openPreview(job: BatchJob) {
		if (!job.page_id) {
			showToast('No generated page available for preview.', 'warning');
			return;
		}
		const html = await fetchPageHtml(job.page_id);
		previewModal = { open: true, job, html: html || '<p class="text-muted p-4">No HTML content available.</p>' };
	}

	function openEdit(job: BatchJob) {
		if (!job.page_id) {
			showToast('No generated page available for editing.', 'warning');
			return;
		}
		fetchPageHtml(job.page_id).then(html => {
			editModal = { open: true, job, html: html || '' };
		});
	}

	async function saveEdit() {
		if (!editModal.job?.page_id) return;
		try {
			const res = await fetch('/api/export', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					html: editModal.html,
					site_id: editModal.job.site_id,
					page_id: editModal.job.page_id,
					force: true
				})
			});
			if (!res.ok) throw new Error('Export failed');
			showToast(`Saved edits for ${editModal.job.suburb}`, 'success');
			editModal = { open: false, job: null, html: '' };
		} catch {
			showToast('Failed to save edits.', 'danger');
		}
	}

	// ── Export ──────────────────────────────────────────────────────────────
	async function exportApproved() {
		const approvedJobs = jobs.filter(j => j.status === 'complete' && j.page_id);
		if (approvedJobs.length === 0) {
			showToast('No completed jobs to export.', 'warning');
			return;
		}

		loading = true;
		try {
			const htmlPages: Array<{ suburb: string; html: string }> = [];
			for (const job of approvedJobs) {
				const html = await fetchPageHtml(job.page_id!);
				if (html) htmlPages.push({ suburb: job.suburb, html });
			}

			if (htmlPages.length === 0) {
				showToast('No HTML content found for completed jobs.', 'warning');
				return;
			}

			// Create a combined download
			const combined = htmlPages.map(p =>
				`<!-- ═══ ${p.suburb} ═══ -->\n${p.html}\n`
			).join('\n\n');

			const blob = new Blob([combined], { type: 'text/html' });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `batch-export-${new Date().toISOString().slice(0, 10)}.html`;
			a.click();
			URL.revokeObjectURL(url);

			showToast(`Exported ${htmlPages.length} pages.`, 'success');
		} catch {
			showToast('Export failed.', 'danger');
		} finally {
			loading = false;
		}
	}

	// ── Helpers ─────────────────────────────────────────────────────────────
	function statusBadgeClass(status: string): string {
		switch (status) {
			case 'pending': return 'bg-secondary';
			case 'processing': return 'bg-primary';
			case 'complete': return 'bg-success';
			case 'failed': return 'bg-danger';
			case 'needs_review': return 'bg-warning text-dark';
			default: return 'bg-secondary';
		}
	}

	function statusIcon(status: string): string {
		switch (status) {
			case 'pending': return 'fa-clock';
			case 'processing': return 'fa-spinner fa-spin';
			case 'complete': return 'fa-check';
			case 'failed': return 'fa-xmark';
			case 'needs_review': return 'fa-eye';
			default: return 'fa-question';
		}
	}

	function formatTime(seconds: number | null): string {
		if (seconds === null) return '--';
		if (seconds < 60) return `${seconds}s`;
		const m = Math.floor(seconds / 60);
		const s = seconds % 60;
		return `${m}m ${s}s`;
	}

	function formatDate(iso: string): string {
		return new Date(iso).toLocaleString();
	}
</script>

<!-- ═══ HEADER ═══════════════════════════════════════════════════════════ -->

<div class="mb-4 d-flex align-items-start justify-content-between flex-wrap gap-2">
	<div>
		<h1 class="fw-bold mb-1"><i class="fa-solid fa-bars-staggered me-2 text-warning"></i>Batch Dashboard</h1>
		<p class="text-muted mb-0">Create, monitor, review, and export batch-generated pages.</p>
	</div>
	<div class="d-flex gap-2">
		<button class="btn btn-outline-secondary btn-sm" onclick={() => fetchJobs()}>
			<i class="fa-solid fa-arrows-rotate me-1"></i>Refresh
		</button>
		<button class="btn btn-success btn-sm" onclick={exportApproved} disabled={loading || stats.complete === 0}>
			<i class="fa-solid fa-file-export me-1"></i>Export All Approved
		</button>
	</div>
</div>

<!-- ═══ PROGRESS MONITOR (WRK-038) ══════════════════════════════════════ -->

{#if stats.total > 0}
<div class="card border-0 shadow-sm mb-4">
	<div class="card-body">
		<div class="d-flex align-items-center justify-content-between mb-3">
			<h5 class="card-title mb-0"><i class="fa-solid fa-chart-bar me-2 text-primary"></i>Progress</h5>
			<div class="d-flex align-items-center gap-2">
				{#if currentJob}
					<span class="badge bg-primary-subtle text-primary-emphasis">
						<i class="fa-solid fa-spinner fa-spin me-1"></i>Processing: {currentJob.suburb}
					</span>
				{/if}
				{#if !processing}
					<button class="btn btn-primary btn-sm" onclick={startProcessing} disabled={stats.pending === 0}>
						<i class="fa-solid fa-play me-1"></i>Start Processing
					</button>
				{:else}
					<button class="btn btn-outline-danger btn-sm" onclick={stopProcessing}>
						<i class="fa-solid fa-stop me-1"></i>Stop
					</button>
				{/if}
			</div>
		</div>

		<!-- Progress bar -->
		<div class="progress mb-3" style="height: 24px;">
			<div class="progress-bar bg-success" role="progressbar"
				style="width: {progressPct}%"
				aria-valuenow={progressPct} aria-valuemin={0} aria-valuemax={100}>
				{progressPct}% ({stats.complete}/{stats.total})
			</div>
		</div>

		<!-- Stats grid -->
		<div class="row g-2">
			<div class="col">
				<div class="text-center p-2 rounded bg-light">
					<div class="fs-4 fw-bold text-secondary">{stats.pending}</div>
					<small class="text-muted">Pending</small>
				</div>
			</div>
			<div class="col">
				<div class="text-center p-2 rounded bg-light">
					<div class="fs-4 fw-bold text-primary">{stats.processing}</div>
					<small class="text-muted">Processing</small>
				</div>
			</div>
			<div class="col">
				<div class="text-center p-2 rounded bg-light">
					<div class="fs-4 fw-bold text-success">{stats.complete}</div>
					<small class="text-muted">Complete</small>
				</div>
			</div>
			<div class="col">
				<div class="text-center p-2 rounded bg-light">
					<div class="fs-4 fw-bold text-danger">{stats.failed}</div>
					<small class="text-muted">Failed</small>
				</div>
			</div>
			<div class="col">
				<div class="text-center p-2 rounded bg-light">
					<div class="fs-4 fw-bold text-warning">{stats.needs_review}</div>
					<small class="text-muted">Review</small>
				</div>
			</div>
			<div class="col">
				<div class="text-center p-2 rounded bg-light">
					<div class="fs-4 fw-bold text-dark">{formatTime(estimatedTimeLeft())}</div>
					<small class="text-muted">Est. Left</small>
				</div>
			</div>
		</div>
	</div>
</div>
{/if}

<!-- ═══ BATCH CREATION FORM ═════════════════════════════════════════════ -->

<div class="card border-0 shadow-sm mb-4">
	<div class="card-header bg-white border-bottom">
		<h5 class="mb-0"><i class="fa-solid fa-plus-circle me-2 text-success"></i>Create Batch</h5>
	</div>
	<div class="card-body">
		<div class="row g-3 mb-3">
			<!-- Site selector -->
			<div class="col-md-6">
				<label for="site-select" class="form-label fw-semibold">Site</label>
				<select id="site-select" class="form-select" bind:value={selectedSiteId}>
					<option value="">-- Select Site --</option>
					{#each sites as site}
						<option value={site.id}>{site.name}</option>
					{/each}
				</select>
			</div>
			<!-- Template selector -->
			<div class="col-md-6">
				<label for="template-select" class="form-label fw-semibold">Template</label>
				<select id="template-select" class="form-select" bind:value={selectedTemplateId}>
					<option value="">-- Select Template --</option>
					{#each templates as tmpl}
						<option value={tmpl.id}>{tmpl.name} ({tmpl.section_count} sections)</option>
					{/each}
				</select>
			</div>
		</div>

		<!-- Suburb multi-select -->
		<div class="mb-3">
			<div class="d-flex align-items-center justify-content-between mb-2">
				<label class="form-label fw-semibold mb-0">Suburbs ({selectedSuburbIds.size} selected)</label>
				<div class="btn-group btn-group-sm">
					<button class="btn btn-outline-secondary" onclick={selectAllSuburbs}>Select All</button>
					<button class="btn btn-outline-secondary" onclick={deselectAllSuburbs}>Deselect All</button>
				</div>
			</div>
			<div class="suburb-list border rounded p-2" style="max-height: 200px; overflow-y: auto;">
				{#if suburbs.length === 0}
					<p class="text-muted small mb-0 text-center py-2">No suburbs found. Add suburbs first.</p>
				{:else}
					{#each suburbs as suburb}
						<div class="form-check">
							<input
								class="form-check-input"
								type="checkbox"
								id="suburb-{suburb.id}"
								checked={selectedSuburbIds.has(suburb.id)}
								onchange={() => toggleSuburb(suburb.id)}
							/>
							<label class="form-check-label" for="suburb-{suburb.id}">
								{suburb.suburb_name}
								{#if suburb.postcode}
									<span class="text-muted">({suburb.postcode})</span>
								{/if}
								{#if suburb.region}
									<span class="badge bg-light text-dark ms-1">{suburb.region}</span>
								{/if}
							</label>
						</div>
					{/each}
				{/if}
			</div>
		</div>

		<button class="btn btn-warning fw-semibold" onclick={createBatch} disabled={creating}>
			{#if creating}
				<i class="fa-solid fa-spinner fa-spin me-1"></i>Creating...
			{:else}
				<i class="fa-solid fa-bolt me-1"></i>Generate Batch
			{/if}
		</button>
	</div>
</div>

<!-- ═══ JOB LIST (WRK-037) ══════════════════════════════════════════════ -->

<div class="card border-0 shadow-sm mb-4">
	<div class="card-header bg-white border-bottom d-flex align-items-center justify-content-between">
		<h5 class="mb-0"><i class="fa-solid fa-list-check me-2 text-info"></i>Batch Jobs</h5>
		<!-- Status filter tabs -->
		<ul class="nav nav-pills nav-pills-sm gap-1 mb-0">
			{#each ['all', 'pending', 'processing', 'complete', 'failed', 'needs_review'] as st}
				<li class="nav-item">
					<button
						class="nav-link py-1 px-2 {statusFilter === st ? 'active' : ''}"
						onclick={() => statusFilter = st}
					>
						{st === 'all' ? 'All' : st === 'needs_review' ? 'Review' : st.charAt(0).toUpperCase() + st.slice(1)}
						{#if st === 'all'}
							<span class="badge bg-dark ms-1">{stats.total}</span>
						{:else if st === 'pending'}
							<span class="badge bg-secondary ms-1">{stats.pending}</span>
						{:else if st === 'processing'}
							<span class="badge bg-primary ms-1">{stats.processing}</span>
						{:else if st === 'complete'}
							<span class="badge bg-success ms-1">{stats.complete}</span>
						{:else if st === 'failed'}
							<span class="badge bg-danger ms-1">{stats.failed}</span>
						{:else if st === 'needs_review'}
							<span class="badge bg-warning text-dark ms-1">{stats.needs_review}</span>
						{/if}
					</button>
				</li>
			{/each}
		</ul>
	</div>
	<div class="card-body p-0">
		{#if filteredJobs.length === 0}
			<div class="text-center py-5">
				<i class="fa-solid fa-inbox fa-2x text-muted mb-2"></i>
				<p class="text-muted mb-0">
					{stats.total === 0 ? 'No batch jobs yet. Create a batch above.' : 'No jobs match this filter.'}
				</p>
			</div>
		{:else}
			<div class="table-responsive">
				<table class="table table-hover align-middle mb-0">
					<thead class="table-light">
						<tr>
							<th>Suburb</th>
							<th>Status</th>
							<th>Retries</th>
							<th>Error</th>
							<th>Created</th>
							<th class="text-end">Actions</th>
						</tr>
					</thead>
					<tbody>
						{#each filteredJobs as job (job.id)}
							<tr>
								<td class="fw-semibold">{job.suburb}</td>
								<td>
									<span class="badge {statusBadgeClass(job.status)}">
										<i class="fa-solid {statusIcon(job.status)} me-1"></i>
										{job.status === 'needs_review' ? 'Needs Review' : job.status.charAt(0).toUpperCase() + job.status.slice(1)}
									</span>
								</td>
								<td>
									{#if job.retry_count > 0}
										<span class="text-warning"><i class="fa-solid fa-rotate-right me-1"></i>{job.retry_count}</span>
									{:else}
										<span class="text-muted">0</span>
									{/if}
								</td>
								<td>
									{#if job.error_message}
										<span class="text-danger small" title={job.error_message}>
											{job.error_message.length > 60 ? job.error_message.slice(0, 60) + '...' : job.error_message}
										</span>
									{:else}
										<span class="text-muted">--</span>
									{/if}
								</td>
								<td><small class="text-muted">{formatDate(job.created_at)}</small></td>
								<td class="text-end">
									<div class="btn-group btn-group-sm">
										{#if job.status === 'complete' || job.status === 'needs_review'}
											<button class="btn btn-outline-primary" onclick={() => openPreview(job)} title="Preview">
												<i class="fa-solid fa-eye"></i>
											</button>
										{/if}
										{#if job.status === 'complete' || job.status === 'needs_review'}
											<button class="btn btn-outline-secondary" onclick={() => openEdit(job)} title="Edit HTML">
												<i class="fa-solid fa-pen-to-square"></i>
											</button>
										{/if}
										{#if job.status === 'needs_review'}
											<button class="btn btn-outline-success" onclick={() => approveJob(job)} title="Approve">
												<i class="fa-solid fa-check"></i>
											</button>
										{/if}
										{#if job.status === 'failed' || job.status === 'needs_review'}
											<button class="btn btn-outline-warning" onclick={() => regenerateJob(job)} title="Regenerate">
												<i class="fa-solid fa-rotate-right"></i>
											</button>
										{/if}
									</div>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</div>
</div>

<!-- ═══ PREVIEW MODAL ═══════════════════════════════════════════════════ -->

{#if previewModal.open}
<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div class="modal-backdrop-custom" onclick={() => previewModal = { open: false, job: null, html: '' }}></div>
<div class="modal d-block" tabindex="-1">
	<div class="modal-dialog modal-xl modal-dialog-centered">
		<div class="modal-content">
			<div class="modal-header">
				<h5 class="modal-title">
					<i class="fa-solid fa-eye me-2 text-primary"></i>Preview: {previewModal.job?.suburb}
				</h5>
				<button type="button" class="btn-close" onclick={() => previewModal = { open: false, job: null, html: '' }}></button>
			</div>
			<div class="modal-body p-0" style="height: 70vh;">
				<PreviewFrame html={previewModal.html} siteId={previewModal.job?.site_id ?? ''} />
			</div>
			<div class="modal-footer">
				<button class="btn btn-outline-secondary" onclick={() => previewModal = { open: false, job: null, html: '' }}>Close</button>
				{#if previewModal.job?.status === 'needs_review'}
					<button class="btn btn-success" onclick={() => { approveJob(previewModal.job!); previewModal = { open: false, job: null, html: '' }; }}>
						<i class="fa-solid fa-check me-1"></i>Approve
					</button>
				{/if}
			</div>
		</div>
	</div>
</div>
{/if}

<!-- ═══ EDIT MODAL ══════════════════════════════════════════════════════ -->

{#if editModal.open}
<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div class="modal-backdrop-custom" onclick={() => editModal = { open: false, job: null, html: '' }}></div>
<div class="modal d-block" tabindex="-1">
	<div class="modal-dialog modal-xl modal-dialog-centered">
		<div class="modal-content">
			<div class="modal-header">
				<h5 class="modal-title">
					<i class="fa-solid fa-pen-to-square me-2 text-info"></i>Edit HTML: {editModal.job?.suburb}
				</h5>
				<button type="button" class="btn-close" onclick={() => editModal = { open: false, job: null, html: '' }}></button>
			</div>
			<div class="modal-body">
				<textarea
					class="form-control font-monospace"
					style="height: 60vh; font-size: 0.85rem;"
					bind:value={editModal.html}
				></textarea>
			</div>
			<div class="modal-footer">
				<button class="btn btn-outline-secondary" onclick={() => editModal = { open: false, job: null, html: '' }}>Cancel</button>
				<button class="btn btn-primary" onclick={saveEdit}>
					<i class="fa-solid fa-floppy-disk me-1"></i>Save & Export
				</button>
			</div>
		</div>
	</div>
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
	.modal-backdrop-custom {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.5);
		z-index: 1050;
	}

	.modal.d-block {
		z-index: 1055;
	}

	.nav-pills-sm .nav-link {
		font-size: 0.8rem;
	}

	.suburb-list .form-check {
		padding-top: 2px;
		padding-bottom: 2px;
	}

	.toast-container .toast {
		margin-bottom: 0.5rem;
		min-width: 280px;
	}
</style>
