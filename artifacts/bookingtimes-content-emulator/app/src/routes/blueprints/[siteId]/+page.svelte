<script lang="ts">
  import { page } from '$app/state';
  import { onMount } from 'svelte';

  // ---------------------------------------------------------------------------
  // Types
  // ---------------------------------------------------------------------------

  interface Blueprint {
    id: number;
    backlog_id: number;
    site_id: number;
    working_title: string | null;
    page_type: string;
    action: string;
    priority: number;
    section_count: number | null;
    user_approved: number;
    meta_title: string | null;
    canonical_url: string | null;
    created_at: string;
  }

  interface BlueprintListResponse {
    siteId: number;
    totalBlueprints: number;
    byPageType: Record<string, number>;
    blueprints: Blueprint[];
    message?: string;
    error?: string;
  }

  // ---------------------------------------------------------------------------
  // Stage 4 Workflow Steps
  // ---------------------------------------------------------------------------

  interface DesignStep {
    key: string;
    number: number;
    label: string;
    description: string;
  }

  const DESIGN_STEPS: DesignStep[] = [
    { key: 'blueprints', number: 1, label: 'Generate Blueprints', description: 'Create page blueprints from the work backlog' },
    { key: 'section-specs', number: 2, label: 'Generate Section Specs', description: 'Define section-level specifications for all blueprints' },
    { key: 'css-decisions', number: 3, label: 'Generate CSS Decisions', description: 'Determine CSS class usage, replacements, and custom rules' },
    { key: 'jsonld-specs', number: 4, label: 'Generate JSON-LD Specs', description: 'Create structured data specifications for each page' },
  ];

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  let siteId: number = $derived(parseInt(page.params.siteId ?? '0', 10));

  let blueprints: Blueprint[] = $state([]);
  let loading = $state(true);
  let errorMsg = $state('');
  let successMsg = $state('');
  let approving = $state(false);
  let selectedIds: Set<number> = $state(new Set());

  // Step tracking
  let stepCompleted: Record<string, boolean> = $state({});
  let stepLoading: Record<string, boolean> = $state({});
  let stepMessage: Record<string, { type: 'success' | 'danger'; text: string }> = $state({});

  // Summary stats
  let totalBlueprints: number = $derived(blueprints.length);
  let approvedCount: number = $derived(blueprints.filter((b) => b.user_approved === 1).length);
  let unapprovedCount: number = $derived(totalBlueprints - approvedCount);
  let totalSections: number = $derived(
    blueprints.reduce((sum, b) => sum + (b.section_count ?? 0), 0)
  );

  let allSelected: boolean = $derived(
    blueprints.length > 0 && blueprints.every((b) => selectedIds.has(b.id))
  );

  let nextStepIndex = $derived.by(() => {
    for (let i = 0; i < DESIGN_STEPS.length; i++) {
      if (!stepCompleted[DESIGN_STEPS[i].key]) return i;
    }
    return DESIGN_STEPS.length;
  });

  let allDesignStepsDone = $derived(nextStepIndex >= DESIGN_STEPS.length);

  function isAnyStepLoading(): boolean {
    return Object.values(stepLoading).some(Boolean);
  }

  // ---------------------------------------------------------------------------
  // Run All Stage 4
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

  async function runAllStage4() {
    runAllLoading = true;
    runAllResults = DESIGN_STEPS.map(s => ({ name: s.label, status: 'pending' as any }));
    runAllOverall = null;

    try {
      const res = await fetch(`/api/stage/run-all-4/${siteId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (res.ok) {
        runAllResults = data.steps ?? [];
        runAllOverall = data.overall ?? 'complete';
        for (const result of runAllResults) {
          const matchStep = DESIGN_STEPS.find(s => s.label === result.name || s.key === result.name);
          if (matchStep && result.status === 'done') {
            stepCompleted = { ...stepCompleted, [matchStep.key]: true };
          }
        }
        await loadBlueprints();
      } else {
        runAllOverall = 'partial';
      }
    } catch {
      runAllOverall = 'partial';
    } finally {
      runAllLoading = false;
    }
  }

  // ---------------------------------------------------------------------------
  // Data loading
  // ---------------------------------------------------------------------------

  onMount(() => {
    loadBlueprints();
  });

  async function loadBlueprints() {
    loading = true;
    errorMsg = '';
    try {
      const [res, stepStatusRes] = await Promise.all([
        fetch(`/api/blueprints/${siteId}`),
        fetch(`/api/site/${siteId}/step-status`),
      ]);
      const data: BlueprintListResponse = await res.json();
      if (res.ok) {
        blueprints = data.blueprints ?? [];
      } else if (res.status === 404) {
        blueprints = [];
      } else {
        errorMsg = data.error ?? 'Failed to load blueprints';
      }

      // Restore design step completion from database
      if (stepStatusRes.ok) {
        const ssData = await stepStatusRes.json();
        const dbSteps: Record<string, boolean> = ssData.steps ?? {};
        const restored: Record<string, boolean> = {};
        for (const step of DESIGN_STEPS) {
          if (dbSteps[step.key]) {
            restored[step.key] = true;
          }
        }
        // Merge: keep any in-session completions, overlay DB-known completions
        stepCompleted = { ...restored, ...stepCompleted };
      }
    } catch {
      errorMsg = 'Network error loading blueprints';
    } finally {
      loading = false;
    }
  }

  // ---------------------------------------------------------------------------
  // Design Step Execution
  // ---------------------------------------------------------------------------

  async function runDesignStep(step: DesignStep) {
    stepLoading = { ...stepLoading, [step.key]: true };
    const old = stepMessage;
    delete old[step.key];
    stepMessage = { ...old };
    errorMsg = '';
    successMsg = '';

    let endpoint = '';
    switch (step.key) {
      case 'blueprints': endpoint = `/api/blueprints/${siteId}`; break;
      case 'section-specs': endpoint = `/api/section-specs/site/${siteId}`; break;
      case 'css-decisions': endpoint = `/api/css-decisions/${siteId}`; break;
      case 'jsonld-specs': endpoint = `/api/jsonld-specs/${siteId}`; break;
    }

    try {
      const res = await fetch(endpoint, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        const msg = data.message ?? `${step.label} completed successfully`;
        stepMessage = { ...stepMessage, [step.key]: { type: 'success', text: msg } };
        stepCompleted = { ...stepCompleted, [step.key]: true };
        successMsg = msg;
        await loadBlueprints();
      } else {
        stepMessage = { ...stepMessage, [step.key]: { type: 'danger', text: data.error ?? `${step.label} failed` } };
      }
    } catch {
      stepMessage = { ...stepMessage, [step.key]: { type: 'danger', text: `Network error running ${step.label}` } };
    } finally {
      stepLoading = { ...stepLoading, [step.key]: false };
    }
  }

  // ---------------------------------------------------------------------------
  // Selection helpers
  // ---------------------------------------------------------------------------

  function toggleSelect(id: number) {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    selectedIds = next;
  }

  function toggleSelectAll() {
    if (allSelected) {
      selectedIds = new Set();
    } else {
      selectedIds = new Set(blueprints.map((b) => b.id));
    }
  }

  // ---------------------------------------------------------------------------
  // Approve
  // ---------------------------------------------------------------------------

  async function approveSelected() {
    const ids = [...selectedIds].filter((id) => {
      const bp = blueprints.find((b) => b.id === id);
      return bp && bp.user_approved === 0;
    });
    if (ids.length === 0) {
      errorMsg = 'No unapproved blueprints selected.';
      return;
    }
    await doApprove(ids);
  }

  async function approveAll() {
    const ids = blueprints.filter((b) => b.user_approved === 0).map((b) => b.id);
    if (ids.length === 0) {
      errorMsg = 'All blueprints are already approved.';
      return;
    }
    await doApprove(ids);
  }

  async function doApprove(ids: number[]) {
    approving = true;
    errorMsg = '';
    successMsg = '';
    try {
      const res = await fetch(`/api/blueprints/${siteId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blueprintIds: ids }),
      });
      const data = await res.json();
      if (res.ok) {
        successMsg = data.message;
        selectedIds = new Set();
        await loadBlueprints();
      } else {
        errorMsg = data.error ?? 'Approval failed';
      }
    } catch {
      errorMsg = 'Network error during approval';
    } finally {
      approving = false;
    }
  }

  // ---------------------------------------------------------------------------
  // Display helpers
  // ---------------------------------------------------------------------------

  function statusBadge(approved: number): { text: string; cls: string } {
    return approved === 1
      ? { text: 'Approved', cls: 'bg-success' }
      : { text: 'Pending', cls: 'bg-warning text-dark' };
  }

  function actionBadgeClass(action: string): string {
    switch (action) {
      case 'create': return 'bg-primary';
      case 'improve': return 'bg-warning text-dark';
      case 'rewrite': return 'bg-danger';
      default: return 'bg-secondary';
    }
  }
</script>

<div class="container mt-4 mb-5">
  <!-- Header -->
  <div class="d-flex justify-content-between align-items-center mb-3">
    <h1>Page Blueprints</h1>
    <div class="d-flex gap-2">
      <a href="/site/{siteId}/pipeline" class="btn btn-outline-primary wf-action-btn">Pipeline</a>
      <a href="/" class="btn btn-outline-secondary wf-action-btn">Dashboard</a>
    </div>
  </div>

  <p class="text-muted">Site ID: {siteId}</p>

  <!-- ================================================================== -->
  <!-- Stage 4: Design Workflow Steps                                      -->
  <!-- ================================================================== -->
  <div class="card mb-4 border-primary">
    <div class="card-header bg-primary text-white d-flex justify-content-between align-items-center">
      <div>
        <h5 class="mb-0">Stage 4: Design &amp; Architecture</h5>
        <small class="opacity-75">Complete these steps to design all page blueprints</small>
      </div>
      <div class="d-flex align-items-center gap-2">
        {#if !allDesignStepsDone}
          <button
            class="btn btn-warning btn-lg fw-bold wf-action-btn"
            disabled={runAllLoading || isAnyStepLoading()}
            onclick={runAllStage4}
          >
            {#if runAllLoading}
              <span class="spinner-border spinner-border-sm me-1" role="status"></span>
              Running All...
            {:else}
              Run All Stage 4
            {/if}
          </button>
        {/if}
        {#if allDesignStepsDone}
          <span class="badge bg-success fs-6">All Steps Complete</span>
        {:else}
          <span class="badge bg-light text-primary fs-6">{nextStepIndex} / {DESIGN_STEPS.length} done</span>
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
        {#each DESIGN_STEPS as step, idx}
          {@const isDone = stepCompleted[step.key] ?? false}
          {@const isLoading = stepLoading[step.key] ?? false}
          {@const isNext = idx === nextStepIndex}
          {@const feedback = stepMessage[step.key]}

          <div class="list-group-item py-3 {isNext && !isDone ? 'wf-next-step' : ''} {isDone ? 'wf-step-done' : ''}">
            <div class="d-flex align-items-center gap-3">
              <!-- Step circle -->
              <div class="wf-step-circle {isDone ? 'wf-circle-done' : isLoading ? 'wf-circle-running' : isNext ? 'wf-circle-next' : 'wf-circle-idle'}">
                {#if isDone}
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/>
                  </svg>
                {:else if isLoading}
                  <span class="spinner-border spinner-border-sm" role="status"></span>
                {:else}
                  {step.number}
                {/if}
              </div>

              <!-- Step info -->
              <div class="flex-grow-1">
                <div class="d-flex align-items-center gap-2">
                  <strong class="{isDone ? 'text-muted text-decoration-line-through' : ''}">{step.label}</strong>
                  {#if isNext && !isDone && !isLoading}
                    <span class="badge bg-primary wf-pulse">Next Step</span>
                  {/if}
                </div>
                <small class="text-muted">{step.description}</small>
                {#if feedback}
                  <div class="mt-1">
                    <small class="text-{feedback.type} fw-semibold">{feedback.text}</small>
                  </div>
                {/if}
              </div>

              <!-- Action button -->
              <button
                class="btn {isDone ? 'btn-outline-success' : isNext ? 'btn-primary' : 'btn-outline-secondary'} wf-action-btn"
                disabled={isLoading || (isAnyStepLoading() && !isLoading) || (step.key !== 'blueprints' && blueprints.length === 0 && !isDone)}
                onclick={() => runDesignStep(step)}
              >
                {#if isLoading}
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
        {/each}
      </div>
    </div>
    {#if allDesignStepsDone}
      <div class="card-footer">
        <div class="d-flex align-items-center justify-content-between">
          <span class="text-success fw-semibold">All design steps done! Return to Pipeline to complete Stage 4.</span>
          <a href="/site/{siteId}/pipeline" class="btn btn-success btn-lg wf-action-btn wf-pulse">
            Complete Stage 4 on Pipeline
          </a>
        </div>
      </div>
    {/if}
  </div>

  <!-- Alerts -->
  {#if errorMsg}
    <div class="alert alert-danger alert-dismissible" role="alert">
      {errorMsg}
      <button type="button" class="btn-close" onclick={() => errorMsg = ''}></button>
    </div>
  {/if}

  {#if successMsg}
    <div class="alert alert-success alert-dismissible" role="alert">
      {successMsg}
      <button type="button" class="btn-close" onclick={() => successMsg = ''}></button>
    </div>
  {/if}

  {#if loading}
    <div class="text-center py-5">
      <div class="spinner-border" role="status">
        <span class="visually-hidden">Loading...</span>
      </div>
    </div>
  {:else if blueprints.length === 0}
    <div class="card">
      <div class="card-body text-center py-5">
        <h5 class="card-title mb-3">No Blueprints Found</h5>
        <p class="text-muted mb-4">
          Run "Generate Blueprints" above to create blueprints from the work backlog.
        </p>
      </div>
    </div>
  {:else}
    <!-- Summary Cards -->
    <div class="row mb-4">
      <div class="col-md-3">
        <div class="card">
          <div class="card-body">
            <h6 class="card-subtitle mb-2 text-muted">Total Blueprints</h6>
            <h3>{totalBlueprints}</h3>
          </div>
        </div>
      </div>
      <div class="col-md-3">
        <div class="card">
          <div class="card-body">
            <h6 class="card-subtitle mb-2 text-muted">Approved</h6>
            <h3 class="text-success">{approvedCount}</h3>
          </div>
        </div>
      </div>
      <div class="col-md-3">
        <div class="card">
          <div class="card-body">
            <h6 class="card-subtitle mb-2 text-muted">Pending Review</h6>
            <h3 class="text-warning">{unapprovedCount}</h3>
          </div>
        </div>
      </div>
      <div class="col-md-3">
        <div class="card">
          <div class="card-body">
            <h6 class="card-subtitle mb-2 text-muted">Total Sections</h6>
            <h3>{totalSections}</h3>
          </div>
        </div>
      </div>
    </div>

    <!-- Controls -->
    <div class="d-flex justify-content-end mb-3 gap-2">
      <button
        class="btn btn-success wf-action-btn"
        disabled={approving || unapprovedCount === 0}
        onclick={approveAll}
      >
        {#if approving}
          <span class="spinner-border spinner-border-sm me-1" role="status"></span>
        {/if}
        Approve All ({unapprovedCount})
      </button>
      <button
        class="btn btn-outline-success wf-action-btn"
        disabled={approving || selectedIds.size === 0}
        onclick={approveSelected}
      >
        Approve Selected ({selectedIds.size})
      </button>
    </div>

    <!-- Blueprint Table -->
    <div class="table-responsive">
      <table class="table table-hover table-bordered align-middle">
        <thead class="table-light">
          <tr>
            <th style="width: 40px;">
              <input
                type="checkbox"
                class="form-check-input"
                checked={allSelected}
                onchange={toggleSelectAll}
              />
            </th>
            <th style="width: 50px;">#</th>
            <th>Working Title</th>
            <th>Page Type</th>
            <th>Action</th>
            <th>Sections</th>
            <th>Status</th>
            <th style="width: 100px;">Detail</th>
            <th style="width: 100px;">Export</th>
          </tr>
        </thead>
        <tbody>
          {#each blueprints as bp, idx (bp.id)}
            {@const badge = statusBadge(bp.user_approved)}
            <tr>
              <td>
                <input
                  type="checkbox"
                  class="form-check-input"
                  checked={selectedIds.has(bp.id)}
                  onchange={() => toggleSelect(bp.id)}
                />
              </td>
              <td>{idx + 1}</td>
              <td>
                <a href="/blueprints/{siteId}/{bp.id}" class="text-decoration-none fw-semibold">
                  {bp.working_title || 'Untitled'}
                </a>
              </td>
              <td><code>{bp.page_type}</code></td>
              <td>
                <span class="badge {actionBadgeClass(bp.action)}">{bp.action}</span>
              </td>
              <td>{bp.section_count ?? 0}</td>
              <td>
                <span class="badge {badge.cls}">{badge.text}</span>
              </td>
              <td>
                <a href="/blueprints/{siteId}/{bp.id}" class="btn btn-primary wf-action-btn-sm">
                  View
                </a>
              </td>
              <td>
                {#if bp.user_approved === 1}
                  <a href="/site/{siteId}/export/{bp.id}" class="btn btn-success wf-action-btn-sm">
                    Export
                  </a>
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>

<style>
  .wf-step-circle {
    width: 36px;
    height: 36px;
    min-width: 36px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 0.85rem;
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

  .wf-action-btn {
    min-height: 40px;
    min-width: 100px;
    padding: 0.5rem 1.25rem;
    font-weight: 600;
    font-size: 0.9rem;
    border-radius: 6px;
  }

  .wf-action-btn-sm {
    min-height: 34px;
    padding: 0.35rem 1rem;
    font-weight: 600;
    font-size: 0.85rem;
    border-radius: 6px;
  }

  .wf-next-step {
    background: rgba(var(--bs-primary-rgb), 0.06);
    border-left: 4px solid var(--bs-primary) !important;
  }

  .wf-step-done {
    opacity: 0.7;
  }

  .wf-pulse {
    animation: wf-pulse-anim 2s ease-in-out infinite;
  }

  @keyframes wf-pulse-anim {
    0%, 100% { box-shadow: 0 0 0 0 rgba(var(--bs-primary-rgb), 0.4); }
    50% { box-shadow: 0 0 0 8px rgba(var(--bs-primary-rgb), 0); }
  }
</style>
