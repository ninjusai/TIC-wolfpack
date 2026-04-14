<script lang="ts">
	import { page } from '$app/state';

	interface AuditScores {
		seo: number | null;
		geo: number | null;
		schema: number | null;
	}

	interface BacklogStats {
		total: number;
		byStatus: Record<string, number>;
	}

	interface BlueprintStats {
		total: number;
		approved: number;
	}

	interface RecentItem {
		section_type: string;
		status: string;
		heading_text: string | null;
		created_at: string;
		working_title: string | null;
	}

	interface FreshnessSummary {
		fresh: number;
		aging: number;
		stale: number;
		unknown: number;
	}

	interface SiteSummary {
		siteId: number;
		siteName: string;
		siteUrl: string;
		slug: string;
		pipelineStage: string;
		pageCount: number;
		auditScores: AuditScores;
		backlog: BacklogStats;
		blueprints: BlueprintStats;
		recentActivity: RecentItem[];
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

	const PIPELINE_STEPS = [
		'not_started',
		'stage_1',
		'stage_2',
		'stage_3',
		'stage_4',
		'stage_5',
		'maintaining'
	];

	// ---------------------------------------------------------------------------
	// Stage 1 Checklist Steps
	// ---------------------------------------------------------------------------

	interface WorkflowStep {
		key: string;
		number: number;
		label: string;
		description: string;
		endpoint: (id: string) => string;
		needsBody?: boolean;
	}

	const STAGE_1_STEPS: WorkflowStep[] = [
		{ key: 'scrape-css', number: 1, label: 'Scrape CSS', description: 'Crawl site and scrape all CSS files', endpoint: () => `/api/scrape`, needsBody: true },
		{ key: 'classify-css', number: 2, label: 'Classify CSS', description: 'Categorize and classify scraped CSS rules', endpoint: (id) => `/api/css-classify/${id}` },
		{ key: 'scrape-content', number: 3, label: 'Scrape Content', description: 'Extract page content from all crawled URLs', endpoint: (id) => `/api/content-scrape/${id}` },
		{ key: 'inventory', number: 4, label: 'Build Inventory', description: 'Build a complete page inventory from scraped data', endpoint: (id) => `/api/inventory/${id}` },
		{ key: 'brand-infer', number: 5, label: 'Infer Brand Voice', description: 'Analyze content to determine brand voice and tone', endpoint: (id) => `/api/brand/infer/${id}` },
		{ key: 'seo-audit', number: 6, label: 'Run SEO Audit', description: 'Audit all pages for SEO best practices', endpoint: (id) => `/api/seo-audit/${id}` },
		{ key: 'geo-audit', number: 7, label: 'Run GEO Audit', description: 'Audit geographic/local SEO signals', endpoint: (id) => `/api/geo-audit/${id}` },
		{ key: 'schema-audit', number: 8, label: 'Run Schema Audit', description: 'Audit structured data and schema markup', endpoint: (id) => `/api/schema-audit/${id}` },
	];

	let summary = $state<SiteSummary | null>(null);
	let freshness = $state<FreshnessSummary | null>(null);
	let loading = $state(true);
	let error = $state('');

	let siteId = $derived(page.params.siteId);

	let stageIndex = $derived(
		summary ? PIPELINE_STEPS.indexOf(summary.pipelineStage) : -1
	);

	let progressPercent = $derived(
		stageIndex >= 0 ? Math.round((stageIndex / (PIPELINE_STEPS.length - 1)) * 100) : 0
	);

	async function loadSite(id: string) {
		loading = true;
		error = '';
		try {
			const [summaryRes, freshnessRes, stepStatusRes] = await Promise.all([
				fetch(`/api/site/${id}/summary`),
				fetch(`/api/freshness/${id}`),
				fetch(`/api/site/${id}/step-status`)
			]);

			if (!summaryRes.ok) {
				const errData = await summaryRes.json();
				throw new Error(errData.error ?? 'Failed to load site summary');
			}
			summary = await summaryRes.json();

			if (freshnessRes.ok) {
				const fData = await freshnessRes.json();
				freshness = fData.summary ?? null;
			}

			// Restore step completion from database
			if (stepStatusRes.ok) {
				const ssData = await stepStatusRes.json();
				const dbSteps: Record<string, boolean> = ssData.steps ?? {};
				const restored: Record<string, 'idle' | 'running' | 'done' | 'error'> = {};
				for (const step of STAGE_1_STEPS) {
					if (dbSteps[step.key]) {
						restored[step.key] = 'done';
					}
				}
				// Merge: keep any in-session running/error states, but fill in DB-known completions
				stepStatus = { ...restored, ...Object.fromEntries(
					Object.entries(stepStatus).filter(([, v]) => v === 'running' || v === 'error')
				)};
				stepStatusLoaded = true;
			}
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		if (siteId) {
			loadSite(siteId);
		}
	});

	function formatScore(score: number | null): string {
		if (score === null) return '--';
		return score.toFixed(1);
	}

	function scoreColor(score: number | null): string {
		if (score === null) return 'secondary';
		if (score >= 80) return 'success';
		if (score >= 60) return 'warning';
		return 'danger';
	}

	// ---------------------------------------------------------------------------
	// Workflow step tracking
	// ---------------------------------------------------------------------------

	let stepStatus = $state<Record<string, 'idle' | 'running' | 'done' | 'error'>>({});
	let stepMessage = $state<Record<string, string>>({});
	let lastCompletedStep = $state(-1);
	let stepStatusLoaded = $state(false);

	// ---------------------------------------------------------------------------
	// Run All Stage 1
	// ---------------------------------------------------------------------------

	interface RunAllStepResult {
		name: string;
		status: 'done' | 'failed' | 'skipped';
		duration?: number;
		error?: string;
	}

	let runAllLoading = $state(false);
	let runAllResults = $state<RunAllStepResult[]>([]);
	let runAllOverall = $state<'complete' | 'partial' | null>(null);

	async function runAllStage1() {
		runAllLoading = true;
		runAllResults = STAGE_1_STEPS.map(s => ({ name: s.label, status: 'pending' as any }));
		runAllOverall = null;

		try {
			const res = await fetch(`/api/stage/run-all-1/${siteId}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
			});
			const data = await res.json();
			if (res.ok) {
				runAllResults = data.steps ?? [];
				runAllOverall = data.overall ?? 'complete';
				// Mark individual step statuses based on results
				for (const result of runAllResults) {
					const matchStep = STAGE_1_STEPS.find(s => s.label === result.name || s.key === result.name);
					if (matchStep) {
						stepStatus = {
							...stepStatus,
							[matchStep.key]: result.status === 'done' ? 'done' : result.status === 'failed' ? 'error' : 'done'
						};
						if (result.error) {
							stepMessage = { ...stepMessage, [matchStep.key]: result.error };
						}
					}
				}
				// Reload site data
				loadSite(siteId);
			} else {
				runAllOverall = 'partial';
			}
		} catch (e) {
			runAllOverall = 'partial';
		} finally {
			runAllLoading = false;
		}
	}

	function getStepStatus(key: string): 'idle' | 'running' | 'done' | 'error' {
		return stepStatus[key] ?? 'idle';
	}

	function isAnyStepRunning(): boolean {
		return Object.values(stepStatus).some(s => s === 'running');
	}

	/** The next step the user should run (0-indexed into STAGE_1_STEPS) */
	let nextStepIndex = $derived.by(() => {
		for (let i = 0; i < STAGE_1_STEPS.length; i++) {
			const s = getStepStatus(STAGE_1_STEPS[i].key);
			if (s !== 'done') return i;
		}
		return STAGE_1_STEPS.length; // all done
	});

	let allStepsDone = $derived(nextStepIndex >= STAGE_1_STEPS.length);

	async function runStep(step: WorkflowStep) {
		stepStatus = { ...stepStatus, [step.key]: 'running' };
		stepMessage = { ...stepMessage, [step.key]: '' };
		try {
			const endpoint = step.endpoint(siteId);
			const fetchOpts: RequestInit = {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
			};
			if (step.needsBody && summary?.siteUrl) {
				fetchOpts.body = JSON.stringify({ siteUrl: summary.siteUrl });
			}
			const res = await fetch(endpoint, fetchOpts);
			const data = await res.json();
			if (res.ok) {
				stepStatus = { ...stepStatus, [step.key]: 'done' };
				stepMessage = { ...stepMessage, [step.key]: `${step.label} completed successfully.` };
				lastCompletedStep = step.number - 1;
				loadSite(siteId);
			} else {
				stepStatus = { ...stepStatus, [step.key]: 'error' };
				stepMessage = { ...stepMessage, [step.key]: data.error ?? data.message ?? `${step.label} failed.` };
			}
		} catch (e) {
			stepStatus = { ...stepStatus, [step.key]: 'error' };
			stepMessage = { ...stepMessage, [step.key]: e instanceof Error ? e.message : String(e) };
		}
	}
</script>

<div class="py-4">
	<nav aria-label="breadcrumb" class="mb-3">
		<ol class="breadcrumb">
			<li class="breadcrumb-item"><a href="/">Dashboard</a></li>
			<li class="breadcrumb-item active" aria-current="page">
				{summary?.siteName ?? 'Site'}
			</li>
		</ol>
	</nav>

	{#if loading}
		<div class="d-flex justify-content-center py-5">
			<div class="spinner-border text-primary" role="status">
				<span class="visually-hidden">Loading...</span>
			</div>
		</div>
	{:else if error}
		<div class="alert alert-danger" role="alert">{error}</div>
	{:else if summary}
		<!-- Header -->
		<div class="d-flex justify-content-between align-items-start mb-4">
			<div>
				<h1 class="mb-1">{summary.siteName}</h1>
				<a href={summary.siteUrl} target="_blank" rel="noopener noreferrer" class="text-muted">
					{summary.siteUrl}
				</a>
			</div>
			<span class="badge bg-{STAGE_COLORS[summary.pipelineStage] ?? 'secondary'} fs-6">
				{STAGE_LABELS[summary.pipelineStage] ?? summary.pipelineStage}
			</span>
		</div>

		<!-- Pipeline Progress -->
		<div class="card mb-4">
			<div class="card-body">
				<h6 class="card-title text-muted mb-3">Pipeline Progress</h6>
				<div class="progress mb-2" style="height: 24px;">
					<div
						class="progress-bar bg-{STAGE_COLORS[summary.pipelineStage] ?? 'secondary'}"
						role="progressbar"
						style="width: {progressPercent}%"
						aria-valuenow={progressPercent}
						aria-valuemin={0}
						aria-valuemax={100}
					>
						{progressPercent}%
					</div>
				</div>
				<div class="d-flex justify-content-between">
					{#each PIPELINE_STEPS as step, i}
						<small
							class:fw-bold={i <= stageIndex}
							class:text-muted={i > stageIndex}
						>
							{STAGE_LABELS[step]}
						</small>
					{/each}
				</div>
			</div>
		</div>

		<!-- Navigation Cards -->
		<div class="row g-3 mb-4">
			<div class="col-md-3">
				<a href="/backlog/{siteId}" class="card text-decoration-none h-100">
					<div class="card-body text-center">
						<h5 class="card-title">Work Backlog</h5>
						<p class="text-muted mb-0">{summary.backlog.total} items</p>
					</div>
				</a>
			</div>
			<div class="col-md-3">
				<a href="/blueprints/{siteId}" class="card text-decoration-none h-100">
					<div class="card-body text-center">
						<h5 class="card-title">Blueprints</h5>
						<p class="text-muted mb-0">
							{summary.blueprints.total} total, {summary.blueprints.approved} approved
						</p>
					</div>
				</a>
			</div>
			<div class="col-md-3">
				<a href="/brand/{siteId}" class="card text-decoration-none h-100">
					<div class="card-body text-center">
						<h5 class="card-title">Brand Profile</h5>
						<p class="text-muted mb-0">Voice &amp; style</p>
					</div>
				</a>
			</div>
			<div class="col-md-3">
				<a href="/preview" class="card text-decoration-none h-100">
					<div class="card-body text-center">
						<h5 class="card-title">Preview</h5>
						<p class="text-muted mb-0">Live preview</p>
					</div>
				</a>
			</div>
		</div>

		<!-- ================================================================== -->
		<!-- Stage 1: Guided Workflow Checklist                                  -->
		<!-- ================================================================== -->
		<div class="card mb-4 border-primary">
			<div class="card-header bg-primary text-white d-flex justify-content-between align-items-center">
				<div>
					<h5 class="mb-0">Stage 1: Site Audit &amp; Inventory</h5>
					<small class="opacity-75">Complete these steps in order to audit the site</small>
				</div>
				<div class="d-flex align-items-center gap-2">
					{#if !allStepsDone}
						<button
							class="btn btn-warning btn-lg fw-bold wf-action-btn"
							disabled={runAllLoading || isAnyStepRunning()}
							onclick={runAllStage1}
						>
							{#if runAllLoading}
								<span class="spinner-border spinner-border-sm me-1" role="status"></span>
								Running All...
							{:else}
								Run All Stage 1
							{/if}
						</button>
					{/if}
					{#if allStepsDone}
						<span class="badge bg-success fs-6">All Steps Complete</span>
					{:else}
						<span class="badge bg-light text-primary fs-6">{nextStepIndex} / {STAGE_1_STEPS.length} done</span>
					{/if}
				</div>
			</div>

			<!-- Run All Progress Display -->
			{#if runAllResults.length > 0 && (runAllLoading || runAllOverall)}
				<div class="card-body border-bottom py-2">
					<div class="d-flex align-items-center gap-2 mb-2">
						<strong class="small text-muted">Run All Progress:</strong>
						{#if runAllOverall === 'complete'}
							<span class="badge bg-success">Complete</span>
						{:else if runAllOverall === 'partial'}
							<span class="badge bg-warning text-dark">Partial</span>
						{:else}
							<span class="badge bg-info">Running...</span>
						{/if}
					</div>
					<div class="d-flex flex-wrap gap-2">
						{#each runAllResults as result}
							<div class="d-flex align-items-center gap-1 px-2 py-1 rounded border {result.status === 'done' ? 'border-success bg-success bg-opacity-10' : result.status === 'failed' ? 'border-danger bg-danger bg-opacity-10' : result.status === 'skipped' ? 'border-secondary bg-light' : 'border-primary bg-primary bg-opacity-10'}">
								{#if result.status === 'done'}
									<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" class="text-success" viewBox="0 0 16 16"><path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/></svg>
								{:else if result.status === 'failed'}
									<span class="text-danger fw-bold">X</span>
								{:else if result.status === 'skipped'}
									<span class="text-muted">-</span>
								{:else}
									<span class="spinner-border spinner-border-sm text-primary" style="width: 14px; height: 14px;" role="status"></span>
								{/if}
								<small class="{result.status === 'done' ? 'text-success' : result.status === 'failed' ? 'text-danger' : 'text-muted'} fw-semibold">{result.name}</small>
								{#if result.duration}
									<small class="text-muted">({(result.duration / 1000).toFixed(1)}s)</small>
								{/if}
							</div>
						{/each}
					</div>
					{#if runAllResults.some(r => r.error)}
						<div class="mt-2">
							{#each runAllResults.filter(r => r.error) as r}
								<small class="text-danger d-block">{r.name}: {r.error}</small>
							{/each}
						</div>
					{/if}
				</div>
			{/if}

			<div class="card-body p-0">
				<div class="list-group list-group-flush">
					{#each STAGE_1_STEPS as step, idx}
						{@const status = getStepStatus(step.key)}
						{@const isNext = idx === nextStepIndex}
						{@const isDone = status === 'done'}
						{@const isRunning = status === 'running'}
						{@const isError = status === 'error'}
						<div
							class="list-group-item py-3 {isNext ? 'wf-next-step' : ''} {isDone ? 'wf-step-done' : ''}"
						>
							<div class="d-flex align-items-center gap-3">
								<!-- Step Number / Status Icon -->
								<div class="wf-step-circle {isDone ? 'wf-circle-done' : isRunning ? 'wf-circle-running' : isError ? 'wf-circle-error' : isNext ? 'wf-circle-next' : 'wf-circle-idle'}">
									{#if isDone}
										<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 16 16">
											<path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/>
										</svg>
									{:else if isRunning}
										<span class="spinner-border spinner-border-sm" role="status"></span>
									{:else}
										{step.number}
									{/if}
								</div>

								<!-- Step Info -->
								<div class="flex-grow-1">
									<div class="d-flex align-items-center gap-2">
										<strong class="{isDone ? 'text-muted text-decoration-line-through' : ''}">{step.label}</strong>
										{#if isNext && !isRunning}
											<span class="badge bg-primary wf-pulse">Next Step</span>
										{/if}
									</div>
									<small class="text-muted">{step.description}</small>
									{#if stepMessage[step.key]}
										<div class="mt-1">
											<small class="{isError ? 'text-danger' : 'text-success'} fw-semibold">
												{stepMessage[step.key]}
											</small>
										</div>
									{/if}
								</div>

								<!-- Action Button -->
								<div>
									<button
										class="btn {isDone ? 'btn-outline-success' : isNext ? 'btn-primary' : 'btn-outline-secondary'} wf-action-btn"
										disabled={isRunning || (isAnyStepRunning() && !isRunning)}
										onclick={() => runStep(step)}
									>
										{#if isRunning}
											<span class="spinner-border spinner-border-sm me-1" role="status"></span>
											Running...
										{:else if isDone}
											Re-run
										{:else}
											Run
										{/if}
									</button>
								</div>
							</div>
						</div>
					{/each}
				</div>
			</div>
			<div class="card-footer">
				{#if allStepsDone}
					<div class="d-flex align-items-center justify-content-between">
						<span class="text-success fw-semibold">All Stage 1 tasks complete!</span>
						<a href="/site/{siteId}/pipeline" class="btn btn-success btn-lg wf-action-btn wf-pulse">
							Go to Pipeline to Advance Stage
						</a>
					</div>
				{:else}
					<div class="text-muted">
						Complete all {STAGE_1_STEPS.length} steps, then advance to the Pipeline page to complete Stage 1.
					</div>
				{/if}
			</div>
		</div>

		<!-- Audit + Freshness Row -->
		<div class="row g-3 mb-4">
			<!-- Audit Scores -->
			<div class="col-md-6">
				<div class="card h-100">
					<div class="card-body">
						<h6 class="card-title text-muted mb-3">Audit Summary</h6>
						<div class="row text-center">
							<div class="col-4">
								<div class="fs-3 fw-bold text-{scoreColor(summary.auditScores.seo)}">
									{formatScore(summary.auditScores.seo)}
								</div>
								<small class="text-muted">SEO</small>
							</div>
							<div class="col-4">
								<div class="fs-3 fw-bold text-{scoreColor(summary.auditScores.geo)}">
									{formatScore(summary.auditScores.geo)}
								</div>
								<small class="text-muted">GEO</small>
							</div>
							<div class="col-4">
								<div class="fs-3 fw-bold text-{scoreColor(summary.auditScores.schema)}">
									{formatScore(summary.auditScores.schema)}
								</div>
								<small class="text-muted">Schema</small>
							</div>
						</div>
						<div class="text-center mt-2">
							<small class="text-muted">{summary.pageCount} pages tracked</small>
						</div>
					</div>
				</div>
			</div>

			<!-- Freshness -->
			<div class="col-md-6">
				<div class="card h-100">
					<div class="card-body">
						<h6 class="card-title text-muted mb-3">Freshness Summary</h6>
						{#if freshness}
							<div class="row text-center">
								<div class="col-3">
									<div class="fs-3 fw-bold text-success">{freshness.fresh}</div>
									<small class="text-muted">Fresh</small>
								</div>
								<div class="col-3">
									<div class="fs-3 fw-bold text-warning">{freshness.aging}</div>
									<small class="text-muted">Aging</small>
								</div>
								<div class="col-3">
									<div class="fs-3 fw-bold text-danger">{freshness.stale}</div>
									<small class="text-muted">Stale</small>
								</div>
								<div class="col-3">
									<div class="fs-3 fw-bold text-secondary">{freshness.unknown}</div>
									<small class="text-muted">Unknown</small>
								</div>
							</div>
						{:else}
							<p class="text-muted text-center mb-0">No freshness data available</p>
						{/if}
					</div>
				</div>
			</div>
		</div>

		<!-- Recent Activity -->
		<div class="card">
			<div class="card-body">
				<h6 class="card-title text-muted mb-3">Recent Activity</h6>
				{#if summary.recentActivity.length > 0}
					<div class="table-responsive">
						<table class="table table-sm table-hover mb-0">
							<thead>
								<tr>
									<th>Section</th>
									<th>Page</th>
									<th>Status</th>
									<th>Date</th>
								</tr>
							</thead>
							<tbody>
								{#each summary.recentActivity as item}
									<tr>
										<td>{item.heading_text ?? item.section_type}</td>
										<td>{item.working_title ?? '--'}</td>
										<td>
											<span class="badge bg-{item.status === 'approved' ? 'success' : item.status === 'generated' ? 'info' : item.status === 'rejected' ? 'danger' : 'secondary'}">
												{item.status}
											</span>
										</td>
										<td><small class="text-muted">{item.created_at}</small></td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{:else}
					<p class="text-muted text-center mb-0">No recent activity</p>
				{/if}
			</div>
		</div>
	{/if}
</div>

<style>
	/* Workflow Step Circles */
	.wf-step-circle {
		width: 38px;
		height: 38px;
		min-width: 38px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: 700;
		font-size: 0.9rem;
		border: 3px solid;
		transition: all 0.2s ease;
	}

	.wf-circle-done {
		background: var(--bs-success);
		border-color: var(--bs-success);
		color: white;
	}

	.wf-circle-running {
		background: var(--bs-primary);
		border-color: var(--bs-primary);
		color: white;
	}

	.wf-circle-error {
		background: var(--bs-danger);
		border-color: var(--bs-danger);
		color: white;
	}

	.wf-circle-next {
		background: var(--bs-primary);
		border-color: var(--bs-primary);
		color: white;
	}

	.wf-circle-idle {
		background: var(--bs-gray-200);
		border-color: var(--bs-gray-400);
		color: var(--bs-gray-500);
	}

	/* Action buttons — prominent and clear */
	.wf-action-btn {
		min-height: 40px;
		min-width: 100px;
		padding: 0.5rem 1.25rem;
		font-weight: 600;
		font-size: 0.9rem;
		border-radius: 6px;
	}

	/* Next step highlight */
	.wf-next-step {
		background: rgba(var(--bs-primary-rgb), 0.06);
		border-left: 4px solid var(--bs-primary) !important;
	}

	/* Done step dimming */
	.wf-step-done {
		opacity: 0.7;
	}

	/* Pulse animation for "Next Step" badge */
	.wf-pulse {
		animation: wf-pulse-anim 2s ease-in-out infinite;
	}

	@keyframes wf-pulse-anim {
		0%, 100% { box-shadow: 0 0 0 0 rgba(var(--bs-primary-rgb), 0.4); }
		50% { box-shadow: 0 0 0 8px rgba(var(--bs-primary-rgb), 0); }
	}
</style>
