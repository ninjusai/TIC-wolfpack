<script lang="ts">
  import { page } from '$app/state';
  import { onMount } from 'svelte';

  // ---------------------------------------------------------------------------
  // Types
  // ---------------------------------------------------------------------------

  interface PipelineSite {
    siteId: number;
    siteName: string;
    currentStage: string;
    canAdvance: boolean;
    nextStage: string | null;
  }

  interface Checkpoint {
    id: number;
    siteId: number | null;
    stage: string;
    checkpointType: string;
    deliverables: Record<string, unknown> | null;
    decisions: Record<string, unknown> | null;
    stateForNextSession: Record<string, unknown> | null;
    issues: Record<string, unknown> | null;
    createdAt: string;
  }

  interface StageInfo {
    key: string;
    number: number;
    label: string;
    description: string;
  }

  interface StageStep {
    key: string;
    number: number;
    label: string;
    description: string;
    endpoint: string;
    method: 'POST';
    isComplete?: boolean;
  }

  // ---------------------------------------------------------------------------
  // Constants
  // ---------------------------------------------------------------------------

  const STAGES: StageInfo[] = [
    { key: 'stage_1', number: 1, label: 'Site Audit & Inventory', description: 'Crawl, scrape, classify CSS, infer brand, audit schema & SEO' },
    { key: 'stage_2', number: 2, label: 'Benchmark Research', description: 'Seed SEO, GEO, and schema benchmarks, then build taxonomy' },
    { key: 'stage_3', number: 3, label: 'Gap Analysis', description: 'Run gap analysis, generate work backlog, build link graph and anchor bank' },
    { key: 'stage_4', number: 4, label: 'Design & Architecture', description: 'Generate blueprints, section specs, CSS decisions, and JSON-LD specs' },
    { key: 'stage_5', number: 5, label: 'Build & Learn', description: 'Generate content per-section, validate, approve, export and deploy' },
  ];

  const STAGE_ORDER = ['not_started', 'stage_1', 'stage_2', 'stage_3', 'stage_4', 'stage_5', 'maintaining'];

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  let siteId: number = $derived(parseInt(page.params.siteId ?? '0', 10));

  let loading = $state(true);
  let errorMsg = $state('');
  let successMsg = $state('');
  let advancing = $state(false);

  let siteInfo: PipelineSite | null = $state(null);
  let checkpoints: Checkpoint[] = $state([]);

  /** Tracks which action buttons are currently executing, keyed by label */
  let actionLoading: Record<string, boolean> = $state({});
  /** Per-action feedback messages, keyed by label */
  let actionFeedback: Record<string, { type: 'success' | 'danger'; message: string }> = $state({});
  /** Whether the pipeline can advance (fetched from can-advance endpoint) */
  let canAdvanceChecked = $state(false);

  /** Per-stage step completion tracking (resets on reload) */
  let stepCompleted: Record<string, boolean> = $state({});

  // ---------------------------------------------------------------------------
  // Run All Stage orchestration
  // ---------------------------------------------------------------------------

  interface RunAllStepResult {
    name: string;
    status: 'done' | 'failed' | 'skipped';
    duration?: number;
    error?: string;
  }

  let runAllStage: Record<string, boolean> = $state({});
  let runAllResults: Record<string, RunAllStepResult[]> = $state({});
  let runAllOverall: Record<string, 'complete' | 'partial' | null> = $state({});

  function getRunAllEndpoint(stageKey: string): string | null {
    switch (stageKey) {
      case 'stage_2': return `/api/stage/run-all-2/${siteId}`;
      case 'stage_3': return `/api/stage/run-all-3/${siteId}`;
      default: return null;
    }
  }

  async function runAllForStage(stageKey: string) {
    const endpoint = getRunAllEndpoint(stageKey);
    if (!endpoint) return;

    const steps = getStageSteps(stageKey);
    runAllStage = { ...runAllStage, [stageKey]: true };
    runAllResults = { ...runAllResults, [stageKey]: steps.map(s => ({ name: s.label, status: 'pending' as any })) };
    runAllOverall = { ...runAllOverall, [stageKey]: null };

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (res.ok) {
        runAllResults = { ...runAllResults, [stageKey]: data.steps ?? [] };
        runAllOverall = { ...runAllOverall, [stageKey]: data.overall ?? 'complete' };
        // Mark individual steps as completed
        for (const result of (data.steps ?? [])) {
          const matchStep = steps.find(s => s.label === result.name || s.key === result.name);
          if (matchStep && result.status === 'done') {
            stepCompleted = { ...stepCompleted, [matchStep.key]: true };
          }
        }
        await loadData();
      } else {
        runAllOverall = { ...runAllOverall, [stageKey]: 'partial' };
      }
    } catch {
      runAllOverall = { ...runAllOverall, [stageKey]: 'partial' };
    } finally {
      runAllStage = { ...runAllStage, [stageKey]: false };
    }
  }

  let currentStageIndex: number = $derived.by(() => {
    const info = siteInfo;
    return info ? STAGE_ORDER.indexOf(info.currentStage) : 0;
  });

  // ---------------------------------------------------------------------------
  // Stage step definitions (numbered workflow steps)
  // ---------------------------------------------------------------------------

  function getStageSteps(stageKey: string): StageStep[] {
    switch (stageKey) {
      case 'stage_2':
        return [
          { key: 's2-seo', number: 1, label: 'Seed SEO Benchmarks', description: 'Populate SEO benchmark data for comparison', endpoint: '/api/benchmarks/seed-seo', method: 'POST' },
          { key: 's2-geo', number: 2, label: 'Seed GEO Benchmarks', description: 'Populate geographic/local benchmark data', endpoint: '/api/benchmarks/seed-geo', method: 'POST' },
          { key: 's2-schema', number: 3, label: 'Seed Schema Benchmarks', description: 'Populate schema markup benchmark data', endpoint: '/api/benchmarks/seed-schema', method: 'POST' },
          { key: 's2-taxonomy', number: 4, label: 'Build Taxonomy', description: 'Create site taxonomy and silo structure', endpoint: '/api/taxonomy', method: 'POST' },
          { key: 's2-complete', number: 5, label: 'Complete Stage 2', description: 'Mark Stage 2 as complete and advance', endpoint: '/api/stage/complete-2', method: 'POST', isComplete: true },
        ];
      case 'stage_3':
        return [
          { key: 's3-gap', number: 1, label: 'Run Gap Analysis', description: 'Compare site against benchmarks to find gaps', endpoint: `/api/gap-analysis/${siteId}`, method: 'POST' },
          { key: 's3-backlog', number: 2, label: 'Generate Work Backlog', description: 'Create prioritized list of content tasks', endpoint: `/api/work-backlog/${siteId}`, method: 'POST' },
          { key: 's3-linkgraph', number: 3, label: 'Build Link Graph', description: 'Map internal linking structure', endpoint: `/api/link-graph/${siteId}`, method: 'POST' },
          { key: 's3-anchor', number: 4, label: 'Generate Anchor Bank', description: 'Create anchor text variations for links', endpoint: `/api/anchor-bank/${siteId}`, method: 'POST' },
          { key: 's3-complete', number: 5, label: 'Complete Stage 3', description: 'Mark Stage 3 as complete and advance', endpoint: `/api/stage/complete-3/${siteId}`, method: 'POST', isComplete: true },
        ];
      case 'stage_1':
        return [
          { key: 's1-complete', number: 1, label: 'Complete Stage 1', description: 'Mark Stage 1 as complete (run audit steps on the Site Detail page first)', endpoint: `/api/stage/complete-1/${siteId}`, method: 'POST', isComplete: true },
        ];
      case 'stage_4':
        return [
          { key: 's4-complete', number: 1, label: 'Complete Stage 4', description: 'Mark Stage 4 as complete (run design steps on the Blueprints page first)', endpoint: `/api/stage/complete-4/${siteId}`, method: 'POST', isComplete: true },
        ];
      default:
        return [];
    }
  }

  /** Which step is the next incomplete one within a stage */
  function getNextStepInStage(stageKey: string): number {
    const steps = getStageSteps(stageKey);
    for (let i = 0; i < steps.length; i++) {
      if (!stepCompleted[steps[i].key]) return i;
    }
    return steps.length;
  }

  function allStepsCompleteInStage(stageKey: string): boolean {
    const steps = getStageSteps(stageKey);
    return steps.length > 0 && steps.every(s => stepCompleted[s.key]);
  }

  // ---------------------------------------------------------------------------
  // Data loading
  // ---------------------------------------------------------------------------

  onMount(() => {
    loadData();
  });

  async function loadData() {
    loading = true;
    errorMsg = '';
    try {
      const [statusRes, checkpointRes, canAdvanceRes, stepStatusRes] = await Promise.all([
        fetch('/api/pipeline/status'),
        fetch(`/api/site/${siteId}/checkpoints`),
        fetch(`/api/pipeline/can-advance/${siteId}`),
        fetch(`/api/site/${siteId}/step-status`),
      ]);

      if (statusRes.ok) {
        const statusData = await statusRes.json();
        const sites: PipelineSite[] = statusData.sites ?? [];
        siteInfo = sites.find((s: PipelineSite) => s.siteId === siteId) ?? null;
        if (!siteInfo) {
          errorMsg = `Site with ID ${siteId} not found in pipeline status.`;
        }
      } else {
        errorMsg = 'Failed to load pipeline status.';
      }

      if (checkpointRes.ok) {
        const cpData = await checkpointRes.json();
        checkpoints = cpData.checkpoints ?? [];
      }

      if (canAdvanceRes.ok) {
        const caData = await canAdvanceRes.json();
        canAdvanceChecked = caData.canAdvance ?? false;
        if (siteInfo) {
          siteInfo = { ...siteInfo, canAdvance: canAdvanceChecked };
        }
      }

      // Restore sub-step completion from database
      if (stepStatusRes.ok) {
        const ssData = await stepStatusRes.json();
        const dbSteps: Record<string, boolean> = ssData.steps ?? {};
        const restored: Record<string, boolean> = {};
        // Map DB step keys to pipeline step keys
        for (const [key, done] of Object.entries(dbSteps)) {
          if (done) {
            restored[key] = true;
          }
        }
        // Merge: keep any in-session completions, overlay DB-known completions
        stepCompleted = { ...restored, ...stepCompleted };
      }
    } catch {
      errorMsg = 'Network error loading pipeline data.';
    } finally {
      loading = false;
    }
  }

  // ---------------------------------------------------------------------------
  // Action execution
  // ---------------------------------------------------------------------------

  async function executeStep(step: StageStep) {
    actionLoading = { ...actionLoading, [step.key]: true };
    const { [step.key]: _, ...restFeedback } = actionFeedback;
    actionFeedback = restFeedback;
    errorMsg = '';
    successMsg = '';

    try {
      const res = await fetch(step.endpoint, {
        method: step.method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId }),
      });
      const data = await res.json();

      if (res.ok && (data.success !== false)) {
        const msg = data.message ?? data.summary ?? `${step.label} completed successfully.`;
        actionFeedback = { ...actionFeedback, [step.key]: { type: 'success', message: msg } };
        stepCompleted = { ...stepCompleted, [step.key]: true };

        if (step.isComplete) {
          successMsg = msg;
          await loadData();
        }
      } else {
        const msg = data.error ?? data.message ?? `${step.label} failed.`;
        actionFeedback = { ...actionFeedback, [step.key]: { type: 'danger', message: msg } };
      }
    } catch {
      actionFeedback = { ...actionFeedback, [step.key]: { type: 'danger', message: `Network error running ${step.label}.` } };
    } finally {
      actionLoading = { ...actionLoading, [step.key]: false };
    }
  }

  // ---------------------------------------------------------------------------
  // Stage advance
  // ---------------------------------------------------------------------------

  async function advanceStage() {
    if (!siteInfo || !siteInfo.canAdvance) return;
    advancing = true;
    errorMsg = '';
    successMsg = '';
    try {
      const res = await fetch('/api/pipeline/advance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        successMsg = `Advanced from ${data.fromStage} to ${data.toStage}.`;
        await loadData();
      } else {
        errorMsg = data.error ?? 'Failed to advance stage.';
      }
    } catch {
      errorMsg = 'Network error advancing stage.';
    } finally {
      advancing = false;
    }
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  function getStageStatus(stage: StageInfo): 'completed' | 'current' | 'future' {
    const stageIdx = STAGE_ORDER.indexOf(stage.key);
    if (currentStageIndex > stageIdx) return 'completed';
    if (currentStageIndex === stageIdx) return 'current';
    if (siteInfo?.currentStage === 'maintaining') return 'completed';
    return 'future';
  }

  function getCheckpointsForStage(stageKey: string): Checkpoint[] {
    return checkpoints.filter((c) => c.stage === stageKey && c.checkpointType === 'stage_complete');
  }

  function getLatestCheckpoint(): Checkpoint | null {
    if (checkpoints.length === 0) return null;
    return checkpoints[0];
  }

  function formatDate(iso: string): string {
    try {
      const d = new Date(iso + 'Z');
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
      return iso;
    }
  }

  function countDeliverables(deliverables: Record<string, unknown> | null): number {
    if (!deliverables) return 0;
    return Object.keys(deliverables).length;
  }

  function formatDeliverableKey(key: string): string {
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/_/g, ' ')
      .replace(/^\w/, (c) => c.toUpperCase())
      .trim();
  }

  function getNextActionGuidance(): string {
    const latest = getLatestCheckpoint();
    if (latest?.stateForNextSession) {
      const state = latest.stateForNextSession;
      if (state.readyFor) {
        const targetStage = STAGES.find((s) => s.key === state.readyFor);
        if (targetStage) {
          return `Ready to begin: ${targetStage.label}`;
        }
      }
    }
    if (!siteInfo) return 'Load site data to see guidance.';
    if (siteInfo.currentStage === 'not_started') return 'Begin by running site audit and inventory.';
    if (siteInfo.currentStage === 'maintaining') return 'All stages complete. Monitor content freshness.';
    const current = STAGES.find((s) => s.key === siteInfo!.currentStage);
    return current ? `Continue working on: ${current.label}` : 'Continue pipeline work.';
  }

  /** Where to link for stage-specific tasks */
  function getStageLink(stage: StageInfo): { label: string; href: string } | null {
    if (stage.key === 'stage_1') return { label: 'Go to Site Detail for audit steps', href: `/site/${siteId}` };
    if (stage.key === 'stage_4') return { label: 'Go to Blueprints for design steps', href: `/blueprints/${siteId}` };
    if (stage.key === 'stage_5') return { label: 'Go to Blueprints to build sections', href: `/blueprints/${siteId}` };
    return null;
  }
</script>

<div class="container mt-4 mb-5">
  <!-- Header -->
  <div class="d-flex justify-content-between align-items-center mb-3">
    <h1>Pipeline Progress</h1>
    <div class="d-flex gap-2">
      {#if siteInfo}
        <a href="/site/{siteId}" class="btn btn-outline-primary wf-action-btn">Site Detail</a>
      {/if}
      <a href="/" class="btn btn-outline-secondary wf-action-btn">Dashboard</a>
    </div>
  </div>

  {#if siteInfo}
    <p class="text-muted mb-1">
      Site: <strong>{siteInfo.siteName}</strong> (ID: {siteId})
    </p>
    <p class="text-muted">
      Current stage: <span class="badge bg-primary fs-6">{siteInfo.currentStage.replace('_', ' ')}</span>
    </p>
  {:else if !loading}
    <p class="text-muted">Site ID: {siteId}</p>
  {/if}

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
  {:else}

    <!-- Resume / Next Action Card -->
    <div class="card mb-4 border-info">
      <div class="card-body d-flex justify-content-between align-items-center flex-wrap gap-2">
        <div>
          <h6 class="card-subtitle mb-1 text-muted">What to do next</h6>
          <p class="card-text mb-0 fw-semibold fs-5">{getNextActionGuidance()}</p>
        </div>
        {#if siteInfo?.canAdvance}
          <button
            class="btn btn-primary btn-lg wf-action-btn wf-pulse"
            disabled={advancing}
            onclick={advanceStage}
          >
            {#if advancing}
              <span class="spinner-border spinner-border-sm me-1" role="status"></span>
            {/if}
            Advance to {siteInfo.nextStage?.replace('_', ' ') ?? 'next stage'}
          </button>
        {:else if siteInfo?.currentStage === 'maintaining'}
          <span class="badge bg-success fs-5 px-3 py-2">All stages complete</span>
        {:else}
          <span class="text-muted small">Complete current stage requirements to advance.</span>
        {/if}
      </div>
    </div>

    <!-- Stepper: Desktop (horizontal) -->
    <div class="d-none d-md-block mb-4">
      <div class="d-flex align-items-start position-relative">
        {#each STAGES as stage, idx (stage.key)}
          {@const status = getStageStatus(stage)}
          {@const stageCps = getCheckpointsForStage(stage.key)}
          <div class="text-center flex-fill" style="position: relative; min-width: 0;">
            {#if idx > 0}
              <div
                style="position: absolute; top: 18px; left: 0; right: 50%; height: 3px; z-index: 0;"
                class={status === 'future' ? 'bg-secondary opacity-25' : 'bg-success'}
              ></div>
            {/if}
            {#if idx < STAGES.length - 1}
              <div
                style="position: absolute; top: 18px; left: 50%; right: 0; height: 3px; z-index: 0;"
                class={status === 'completed' ? 'bg-success' : 'bg-secondary opacity-25'}
              ></div>
            {/if}

            <div
              class="rounded-circle d-inline-flex align-items-center justify-content-center position-relative"
              style="width: 38px; height: 38px; z-index: 1; border: 3px solid; {
                status === 'completed'
                  ? 'border-color: var(--bs-success); background: var(--bs-success); color: white;'
                  : status === 'current'
                    ? 'border-color: var(--bs-primary); background: var(--bs-primary); color: white;'
                    : 'border-color: var(--bs-gray-400); background: var(--bs-gray-200); color: var(--bs-gray-500);'
              }"
            >
              {#if status === 'completed'}
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/>
                </svg>
              {:else}
                <span class="fw-bold" style="font-size: 0.85rem;">{stage.number}</span>
              {/if}
            </div>

            <div class="mt-2 px-1">
              <div class="fw-semibold small" class:text-success={status === 'completed'} class:text-primary={status === 'current'} class:text-muted={status === 'future'}>
                {stage.label}
              </div>
              <div class="text-muted" style="font-size: 0.7rem;">{stage.description}</div>
              {#if stageCps.length > 0}
                <div class="mt-1">
                  <span class="badge bg-light text-dark border" style="font-size: 0.65rem;">
                    {countDeliverables(stageCps[0].deliverables)} deliverables
                  </span>
                </div>
              {/if}
            </div>
          </div>
        {/each}
      </div>
    </div>

    <!-- ================================================================== -->
    <!-- Stage Workflow Panels                                               -->
    <!-- ================================================================== -->
    <h5 class="mb-3">Stage Details</h5>

    {#each STAGES as stage (stage.key)}
      {@const status = getStageStatus(stage)}
      {@const stageCps = getCheckpointsForStage(stage.key)}
      {@const steps = getStageSteps(stage.key)}
      {@const nextIdx = getNextStepInStage(stage.key)}
      {@const stageLink = getStageLink(stage)}
      {@const isCurrent = status === 'current'}
      {@const isCompleted = status === 'completed'}
      {@const isFuture = status === 'future'}

      <div class="card mb-3 {isCurrent ? 'border-primary wf-stage-current' : isCompleted ? 'border-success' : 'wf-stage-locked'}">
        <!-- Stage Header (always visible) -->
        <div
          class="card-header d-flex justify-content-between align-items-center {isCurrent ? 'bg-primary bg-opacity-10' : isCompleted ? 'bg-success bg-opacity-10' : ''}"
        >
          <div class="d-flex align-items-center gap-2">
            <div class="wf-step-circle-sm {isCompleted ? 'wf-circle-done' : isCurrent ? 'wf-circle-next' : 'wf-circle-idle'}">
              {#if isCompleted}
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/>
                </svg>
              {:else}
                {stage.number}
              {/if}
            </div>
            <div>
              <h5 class="mb-0 {isCompleted ? 'text-success' : isCurrent ? 'text-primary' : 'text-muted'}">
                Stage {stage.number}: {stage.label}
              </h5>
              <small class="text-muted">{stage.description}</small>
            </div>
          </div>
          <div>
            {#if isCompleted}
              <span class="badge bg-success fs-6 px-3 py-2">Complete</span>
            {:else if isCurrent}
              <span class="badge bg-primary fs-6 px-3 py-2">In Progress</span>
            {:else}
              <span class="badge bg-secondary px-3 py-2">Locked</span>
            {/if}
          </div>
        </div>

        <!-- Stage Body — expanded for current, collapsed for others -->
        {#if isCurrent}
          <div class="card-body">
            <!-- Cross-page navigation link if applicable -->
            {#if stageLink}
              <div class="alert alert-info d-flex align-items-center gap-2 mb-3">
                <span>This stage's primary tasks are on another page.</span>
                <a href={stageLink.href} class="btn btn-primary wf-action-btn">{stageLink.label}</a>
              </div>
            {/if}

            <!-- Run All button for Stage 2 and Stage 3 -->
            {#if (stage.key === 'stage_2' || stage.key === 'stage_3') && steps.length > 0 && !allStepsCompleteInStage(stage.key)}
              <div class="mb-3">
                <button
                  class="btn btn-warning btn-lg fw-bold wf-action-btn"
                  disabled={runAllStage[stage.key] || Object.values(actionLoading).some(Boolean)}
                  onclick={() => runAllForStage(stage.key)}
                >
                  {#if runAllStage[stage.key]}
                    <span class="spinner-border spinner-border-sm me-1" role="status"></span>
                    Running All Stage {stage.number}...
                  {:else}
                    Run All Stage {stage.number}
                  {/if}
                </button>
              </div>

              <!-- Run All Progress Display -->
              {#if runAllResults[stage.key] && (runAllStage[stage.key] || runAllOverall[stage.key])}
                <div class="mb-3 p-3 border rounded bg-light">
                  <div class="d-flex align-items-center gap-2 mb-2">
                    <strong class="small text-muted">Run All Progress:</strong>
                    {#if runAllOverall[stage.key] === 'complete'}
                      <span class="badge bg-success">Complete</span>
                    {:else if runAllOverall[stage.key] === 'partial'}
                      <span class="badge bg-warning text-dark">Partial</span>
                    {:else}
                      <span class="badge bg-info">Running...</span>
                    {/if}
                  </div>
                  <div class="d-flex flex-wrap gap-2">
                    {#each runAllResults[stage.key] as result}
                      <div class="d-flex align-items-center gap-1 px-2 py-1 rounded border {result.status === 'done' ? 'border-success bg-success bg-opacity-10' : result.status === 'failed' ? 'border-danger bg-danger bg-opacity-10' : result.status === 'skipped' ? 'border-secondary' : 'border-primary bg-primary bg-opacity-10'}">
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
                  {#if runAllResults[stage.key].some(r => r.error)}
                    <div class="mt-2">
                      {#each runAllResults[stage.key].filter(r => r.error) as r}
                        <small class="text-danger d-block">{r.name}: {r.error}</small>
                      {/each}
                    </div>
                  {/if}
                </div>
              {/if}
            {/if}

            <!-- Numbered steps -->
            {#if steps.length > 0}
              <div class="list-group mb-3">
                {#each steps as step, idx}
                  {@const isStepDone = stepCompleted[step.key] ?? false}
                  {@const isLoading = actionLoading[step.key] ?? false}
                  {@const feedback = actionFeedback[step.key]}
                  {@const isNextStep = idx === nextIdx}

                  <div class="list-group-item py-3 {isNextStep && !isStepDone ? 'wf-next-step' : ''} {isStepDone ? 'wf-step-done' : ''}">
                    <div class="d-flex align-items-center gap-3">
                      <!-- Step number circle -->
                      <div class="wf-step-circle-sm {isStepDone ? 'wf-circle-done' : isLoading ? 'wf-circle-running' : isNextStep ? 'wf-circle-next' : 'wf-circle-idle'}">
                        {#if isStepDone}
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
                            <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/>
                          </svg>
                        {:else if isLoading}
                          <span class="spinner-border spinner-border-sm" style="width: 14px; height: 14px;" role="status"></span>
                        {:else}
                          {step.number}
                        {/if}
                      </div>

                      <!-- Step info -->
                      <div class="flex-grow-1">
                        <div class="d-flex align-items-center gap-2">
                          <strong class="{isStepDone ? 'text-muted text-decoration-line-through' : ''}">{step.label}</strong>
                          {#if isNextStep && !isStepDone && !isLoading}
                            <span class="badge bg-primary wf-pulse">Next Step</span>
                          {/if}
                        </div>
                        <small class="text-muted">{step.description}</small>
                        {#if feedback}
                          <div class="mt-1">
                            <small class="text-{feedback.type} fw-semibold">{feedback.message}</small>
                          </div>
                        {/if}
                      </div>

                      <!-- Action button -->
                      <button
                        class="btn {step.isComplete ? (isStepDone ? 'btn-outline-success' : 'btn-success') : (isStepDone ? 'btn-outline-success' : isNextStep ? 'btn-primary' : 'btn-outline-secondary')} wf-action-btn"
                        disabled={isLoading || (Object.values(actionLoading).some(Boolean) && !isLoading)}
                        onclick={() => executeStep(step)}
                      >
                        {#if isLoading}
                          <span class="spinner-border spinner-border-sm me-1" role="status"></span>
                          Running...
                        {:else if isStepDone}
                          Re-run
                        {:else if step.isComplete}
                          Complete Stage
                        {:else}
                          Run
                        {/if}
                      </button>
                    </div>
                  </div>
                {/each}
              </div>
            {/if}

            <!-- Checkpoint data -->
            {#if stageCps.length > 0}
              {#each stageCps as cp (cp.id)}
                <div class="card mb-2 border-light">
                  <div class="card-body py-2">
                    <div class="d-flex justify-content-between align-items-center mb-2">
                      <small class="text-muted">Checkpoint #{cp.id}</small>
                      <small class="text-muted">{formatDate(cp.createdAt)}</small>
                    </div>

                    {#if cp.deliverables && Object.keys(cp.deliverables).length > 0}
                      <h6 class="mb-1" style="font-size: 0.8rem;">Deliverables</h6>
                      <div class="row row-cols-2 row-cols-md-3 g-1 mb-2">
                        {#each Object.entries(cp.deliverables) as [key, value]}
                          <div class="col">
                            <div class="bg-light rounded p-1 text-center" style="font-size: 0.75rem;">
                              <div class="fw-bold">{value}</div>
                              <div class="text-muted">{formatDeliverableKey(key)}</div>
                            </div>
                          </div>
                        {/each}
                      </div>
                    {/if}

                    {#if cp.decisions}
                      <h6 class="mb-1" style="font-size: 0.8rem;">Decisions</h6>
                      <pre class="bg-light rounded p-2 mb-2" style="font-size: 0.7rem; white-space: pre-wrap; max-height: 120px; overflow-y: auto;">{JSON.stringify(cp.decisions, null, 2)}</pre>
                    {/if}

                    {#if cp.stateForNextSession}
                      <h6 class="mb-1" style="font-size: 0.8rem;">Resume State</h6>
                      <pre class="bg-light rounded p-2 mb-0" style="font-size: 0.7rem; white-space: pre-wrap; max-height: 120px; overflow-y: auto;">{JSON.stringify(cp.stateForNextSession, null, 2)}</pre>
                    {/if}
                  </div>
                </div>
              {/each}
            {:else}
              <p class="text-muted small mb-0">Stage in progress. Run the steps above, then complete the stage.</p>
            {/if}
          </div>

        {:else if isCompleted}
          <!-- Collapsed completed stage — just show checkpoint summary -->
          <div class="card-body py-2">
            {#if stageCps.length > 0}
              <small class="text-muted">
                Completed on {formatDate(stageCps[0].createdAt)} with {countDeliverables(stageCps[0].deliverables)} deliverables.
              </small>
            {:else}
              <small class="text-muted">Stage completed.</small>
            {/if}
          </div>

        {:else}
          <!-- Locked future stage -->
          <div class="card-body py-2">
            <small class="text-muted">
              Locked &mdash; complete Stage {stage.number - 1} first to unlock this stage.
            </small>
          </div>
        {/if}
      </div>
    {/each}
  {/if}
</div>

<style>
  /* Workflow Step Circles (small variant) */
  .wf-step-circle-sm {
    width: 30px;
    height: 30px;
    min-width: 30px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 0.8rem;
    border: 2px solid;
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

  /* Action buttons */
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

  /* Current stage card emphasis */
  .wf-stage-current {
    border-width: 2px;
    box-shadow: 0 0 0 2px rgba(var(--bs-primary-rgb), 0.15);
  }

  /* Locked stage styling */
  .wf-stage-locked {
    opacity: 0.6;
  }

  /* Pulse animation */
  .wf-pulse {
    animation: wf-pulse-anim 2s ease-in-out infinite;
  }

  @keyframes wf-pulse-anim {
    0%, 100% { box-shadow: 0 0 0 0 rgba(var(--bs-primary-rgb), 0.4); }
    50% { box-shadow: 0 0 0 8px rgba(var(--bs-primary-rgb), 0); }
  }
</style>
