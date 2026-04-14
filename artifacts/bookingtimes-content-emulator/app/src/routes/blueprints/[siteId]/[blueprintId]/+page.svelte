<script lang="ts">
  import { page } from '$app/state';
  import { onMount } from 'svelte';
  import PreviewFrame from '$lib/components/PreviewFrame.svelte';

  // ---------------------------------------------------------------------------
  // Types
  // ---------------------------------------------------------------------------

  interface LinkAssignment {
    url: string;
    type: string;
    section: string | null;
  }

  interface SectionSpec {
    id: number;
    blueprint_id: number;
    section_type: string;
    section_order: number;
    heading_text: string | null;
    target_word_count_min: number | null;
    target_word_count_max: number | null;
    cta_required: number;
    cta_text: string | null;
    content_requirements: unknown;
    links_required: Array<{ target_url?: string; url?: string; anchor_text?: string }> | null;
    direct_answer_block_required: number;
    statistics_required: number;
    faq_questions: string[] | null;
    css_classes: string[] | null;
    design_pattern: string | null;
    status: string;
    generated_html: string | null;
  }

  interface CssDecision {
    id: number;
    decision_type: string;
    class_name: string | null;
    replacement_class: string | null;
    rationale: string | null;
  }

  interface BlueprintDetail {
    id: number;
    backlog_id: number;
    site_id: number;
    page_type: string;
    action: string;
    priority: number;
    working_title: string | null;
    h1_text: string | null;
    meta_title: string | null;
    meta_description: string | null;
    canonical_url: string | null;
    target_keywords: string[] | null;
    page_level_seo_rules: Record<string, unknown> | null;
    page_level_geo_rules: Record<string, unknown> | null;
    page_level_voice_rules: Record<string, unknown> | null;
    page_level_css_rules: Record<string, unknown> | null;
    section_count: number | null;
    section_count_rationale: string | null;
    internal_links_required: LinkAssignment[] | null;
    internal_links_optional: LinkAssignment[] | null;
    breadcrumb_path: Array<{ label: string; url: string }> | null;
    silo_membership: string | null;
    schema_spec: Record<string, unknown> | null;
    section_order: string[] | null;
    coherence_requirements: Record<string, unknown> | null;
    user_approved: number;
    created_at: string;
  }

  interface DetailResponse {
    blueprint: BlueprintDetail;
    sectionSpecs: SectionSpec[];
    cssDecisions: CssDecision[];
    error?: string;
  }

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  let siteId: number = $derived(parseInt(page.params.siteId ?? '0', 10));
  let blueprintId: number = $derived(parseInt(page.params.blueprintId ?? '0', 10));

  let blueprint: BlueprintDetail | null = $state(null);
  let sectionSpecs: SectionSpec[] = $state([]);
  let cssDecisions: CssDecision[] = $state([]);
  let loading = $state(true);
  let errorMsg = $state('');
  let successMsg = $state('');
  let approving = $state(false);

  // Track which sections are expanded in accordion
  let expandedSections: Set<number> = $state(new Set());

  // Stage 4 action states
  let editingBlueprintField: string | null = $state(null);
  let generatingSectionSpecs = $state(false);
  let generatingJsonLd = $state(false);
  let generatingInteractivity = $state(false);
  let validatingPage = $state(false);
  let validatingCss = $state(false);

  // Per-section action states (keyed by spec.id)
  let generatingSection: Set<number> = $state(new Set());
  let validatingSection: Set<number> = $state(new Set());

  // Feedback states (keyed by spec.id)
  let approvingSection: Set<number> = $state(new Set());
  let rejectingSection: Set<number> = $state(new Set());
  let refiningSection: Set<number> = $state(new Set());
  let refineExpandedId: number | null = $state(null);
  let refineNotes: string = $state('');

  // Page-level build step tracking
  let buildStepDone: Record<string, boolean> = $state({});

  // Content preview: track which sections show 'preview' vs 'source'
  let contentViewMode: Record<number, 'preview' | 'source'> = $state({});

  // Site slug for CSS-aware previews
  let siteSlug = $state('');

  // ---------------------------------------------------------------------------
  // Build workflow steps
  // ---------------------------------------------------------------------------

  interface BuildStep {
    key: string;
    number: number;
    label: string;
    description: string;
  }

  const BUILD_STEPS: BuildStep[] = [
    { key: 'gen-specs', number: 1, label: 'Generate Section Specs', description: 'Create specifications for each section' },
    { key: 'gen-sections', number: 2, label: 'Generate Sections', description: 'Generate content for each section (per-section below)' },
    { key: 'validate', number: 3, label: 'Validate Page', description: 'Run page-level validation checks' },
    { key: 'gen-jsonld', number: 4, label: 'Generate JSON-LD', description: 'Create structured data markup' },
    { key: 'gen-interactive', number: 5, label: 'Generate Interactivity', description: 'Add interactive elements to sections' },
    { key: 'validate-css', number: 6, label: 'Validate CSS', description: 'Check CSS class usage and compliance' },
  ];

  let buildNextStep = $derived.by(() => {
    for (let i = 0; i < BUILD_STEPS.length; i++) {
      if (!buildStepDone[BUILD_STEPS[i].key]) return i;
    }
    return BUILD_STEPS.length;
  });

  // ---------------------------------------------------------------------------
  // Section status helpers
  // ---------------------------------------------------------------------------

  function sectionStatusLabel(status: string): { text: string; cls: string } {
    switch (status) {
      case 'approved': return { text: 'Approved', cls: 'bg-success' };
      case 'generated': return { text: 'Generated', cls: 'bg-info text-dark' };
      case 'rejected': return { text: 'Rejected', cls: 'bg-danger' };
      case 'refined': return { text: 'Refined', cls: 'bg-warning text-dark' };
      default: return { text: 'Pending', cls: 'bg-secondary' };
    }
  }

  let approvedSections = $derived(sectionSpecs.filter(s => s.status === 'approved').length);
  let generatedSections = $derived(sectionSpecs.filter(s => s.status === 'generated' || s.status === 'approved').length);
  let allSectionsApproved = $derived(sectionSpecs.length > 0 && approvedSections === sectionSpecs.length);
  let hasApprovedSections = $derived(approvedSections > 0);

  // ---------------------------------------------------------------------------
  // Data loading
  // ---------------------------------------------------------------------------

  onMount(() => {
    loadBlueprint();
  });

  async function loadBlueprint() {
    loading = true;
    errorMsg = '';
    try {
      const [res, summaryRes] = await Promise.all([
        fetch(`/api/blueprints/${siteId}/${blueprintId}`),
        fetch(`/api/site/${siteId}/summary`),
      ]);
      // Extract slug for CSS-aware section previews
      if (summaryRes.ok) {
        const summaryData = await summaryRes.json();
        siteSlug = summaryData.slug ?? '';
      }
      const data: DetailResponse = await res.json();
      if (res.ok) {
        blueprint = data.blueprint;
        sectionSpecs = data.sectionSpecs ?? [];
        cssDecisions = data.cssDecisions ?? [];

        // Derive build step completion from loaded data
        const derived: Record<string, boolean> = {};
        if (sectionSpecs.length > 0) {
          derived['gen-specs'] = true;
        }
        const allGenerated = sectionSpecs.length > 0 && sectionSpecs.every(
          s => s.status === 'generated' || s.status === 'approved' || s.status === 'rejected'
        );
        if (allGenerated) {
          derived['gen-sections'] = true;
        }
        if (blueprint?.schema_spec) {
          derived['gen-jsonld'] = true;
        }
        if (cssDecisions.length > 0) {
          derived['validate-css'] = true;
        }
        // Merge: keep any in-session states, overlay derived
        buildStepDone = { ...derived, ...buildStepDone };
      } else {
        errorMsg = data.error ?? 'Failed to load blueprint';
      }
    } catch {
      errorMsg = 'Network error loading blueprint';
    } finally {
      loading = false;
    }
  }

  // ---------------------------------------------------------------------------
  // Approve Blueprint
  // ---------------------------------------------------------------------------

  async function approveBlueprint() {
    if (!blueprint || blueprint.user_approved === 1) return;
    approving = true;
    errorMsg = '';
    successMsg = '';
    try {
      const res = await fetch(`/api/blueprints/${siteId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blueprintIds: [blueprintId] }),
      });
      const data = await res.json();
      if (res.ok) {
        successMsg = data.message;
        await loadBlueprint();
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
  // Generate Section Specs for this blueprint
  // ---------------------------------------------------------------------------

  async function generateSectionSpecs() {
    generatingSectionSpecs = true;
    errorMsg = '';
    successMsg = '';
    try {
      const res = await fetch(`/api/section-specs/${blueprintId}`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        successMsg = data.message ?? 'Section specs generated';
        buildStepDone = { ...buildStepDone, 'gen-specs': true };
        await loadBlueprint();
      } else {
        errorMsg = data.error ?? 'Failed to generate section specs';
      }
    } catch {
      errorMsg = 'Network error generating section specs';
    } finally {
      generatingSectionSpecs = false;
    }
  }

  // ---------------------------------------------------------------------------
  // Per-section: Generate Section Content
  // ---------------------------------------------------------------------------

  async function generateSection(specId: number) {
    const next = new Set(generatingSection);
    next.add(specId);
    generatingSection = next;
    errorMsg = '';
    successMsg = '';
    try {
      const res = await fetch(`/api/generate/section/${specId}`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        successMsg = data.message ?? `Section ${specId} generated`;
        await loadBlueprint();
      } else {
        errorMsg = data.error ?? `Failed to generate section ${specId}`;
      }
    } catch {
      errorMsg = `Network error generating section ${specId}`;
    } finally {
      const updated = new Set(generatingSection);
      updated.delete(specId);
      generatingSection = updated;
    }
  }

  // ---------------------------------------------------------------------------
  // Per-section: Validate Section
  // ---------------------------------------------------------------------------

  async function validateSection(specId: number) {
    const next = new Set(validatingSection);
    next.add(specId);
    validatingSection = next;
    errorMsg = '';
    successMsg = '';
    try {
      const res = await fetch(`/api/validate/section/${specId}`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        successMsg = data.message ?? `Section ${specId} validated`;
        await loadBlueprint();
      } else {
        errorMsg = data.error ?? `Validation failed for section ${specId}`;
      }
    } catch {
      errorMsg = `Network error validating section ${specId}`;
    } finally {
      const updated = new Set(validatingSection);
      updated.delete(specId);
      validatingSection = updated;
    }
  }

  // ---------------------------------------------------------------------------
  // Feedback: Approve / Reject / Refine
  // ---------------------------------------------------------------------------

  async function approveSection(specId: number) {
    const next = new Set(approvingSection);
    next.add(specId);
    approvingSection = next;
    errorMsg = '';
    successMsg = '';
    try {
      const res = await fetch(`/api/feedback/approve/${specId}`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        successMsg = data.message ?? `Section ${specId} approved`;
        await loadBlueprint();
      } else {
        errorMsg = data.error ?? `Failed to approve section ${specId}`;
      }
    } catch {
      errorMsg = `Network error approving section ${specId}`;
    } finally {
      const updated = new Set(approvingSection);
      updated.delete(specId);
      approvingSection = updated;
    }
  }

  async function rejectSection(specId: number) {
    const next = new Set(rejectingSection);
    next.add(specId);
    rejectingSection = next;
    errorMsg = '';
    successMsg = '';
    try {
      const res = await fetch(`/api/feedback/reject/${specId}`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        successMsg = data.message ?? `Section ${specId} rejected`;
        await loadBlueprint();
      } else {
        errorMsg = data.error ?? `Failed to reject section ${specId}`;
      }
    } catch {
      errorMsg = `Network error rejecting section ${specId}`;
    } finally {
      const updated = new Set(rejectingSection);
      updated.delete(specId);
      rejectingSection = updated;
    }
  }

  async function refineSection(specId: number) {
    if (!refineNotes.trim()) {
      errorMsg = 'Please enter refinement notes before submitting.';
      return;
    }
    const next = new Set(refiningSection);
    next.add(specId);
    refiningSection = next;
    errorMsg = '';
    successMsg = '';
    try {
      const res = await fetch(`/api/feedback/refine/${specId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: refineNotes.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        successMsg = data.message ?? `Section ${specId} refinement submitted`;
        refineExpandedId = null;
        refineNotes = '';
        await loadBlueprint();
      } else {
        errorMsg = data.error ?? `Failed to refine section ${specId}`;
      }
    } catch {
      errorMsg = `Network error refining section ${specId}`;
    } finally {
      const updated = new Set(refiningSection);
      updated.delete(specId);
      refiningSection = updated;
    }
  }

  function toggleRefine(specId: number) {
    if (refineExpandedId === specId) {
      refineExpandedId = null;
      refineNotes = '';
    } else {
      refineExpandedId = specId;
      refineNotes = '';
    }
  }

  // ---------------------------------------------------------------------------
  // Page-level Build Actions
  // ---------------------------------------------------------------------------

  async function validatePage() {
    validatingPage = true;
    errorMsg = '';
    successMsg = '';
    try {
      const res = await fetch(`/api/validate/page/${blueprintId}`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        successMsg = data.message ?? 'Page validation complete';
        buildStepDone = { ...buildStepDone, 'validate': true };
      } else {
        errorMsg = data.error ?? 'Page validation failed';
      }
    } catch {
      errorMsg = 'Network error during page validation';
    } finally {
      validatingPage = false;
    }
  }

  async function generateJsonLdContent() {
    generatingJsonLd = true;
    errorMsg = '';
    successMsg = '';
    try {
      const res = await fetch(`/api/jsonld-generate/${blueprintId}`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        successMsg = data.message ?? 'JSON-LD generated';
        buildStepDone = { ...buildStepDone, 'gen-jsonld': true };
        await loadBlueprint();
      } else {
        errorMsg = data.error ?? 'Failed to generate JSON-LD';
      }
    } catch {
      errorMsg = 'Network error generating JSON-LD';
    } finally {
      generatingJsonLd = false;
    }
  }

  async function generateInteractivity() {
    generatingInteractivity = true;
    errorMsg = '';
    successMsg = '';
    try {
      const res = await fetch('/api/interactivity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blueprintId }),
      });
      const data = await res.json();
      if (res.ok) {
        successMsg = data.message ?? 'Interactivity generated';
        buildStepDone = { ...buildStepDone, 'gen-interactive': true };
      } else {
        errorMsg = data.error ?? 'Failed to generate interactivity';
      }
    } catch {
      errorMsg = 'Network error generating interactivity';
    } finally {
      generatingInteractivity = false;
    }
  }

  async function validateCss() {
    validatingCss = true;
    errorMsg = '';
    successMsg = '';
    try {
      const res = await fetch('/api/css-validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId, blueprintId }),
      });
      const data = await res.json();
      if (res.ok) {
        successMsg = data.message ?? 'CSS validation complete';
        buildStepDone = { ...buildStepDone, 'validate-css': true };
      } else {
        errorMsg = data.error ?? 'CSS validation failed';
      }
    } catch {
      errorMsg = 'Network error during CSS validation';
    } finally {
      validatingCss = false;
    }
  }

  let anyBuildActionRunning: boolean = $derived(
    generatingSectionSpecs || validatingPage || generatingJsonLd || generatingInteractivity || validatingCss
  );

  /** Run a build step by key */
  function runBuildStep(step: BuildStep) {
    switch (step.key) {
      case 'gen-specs': generateSectionSpecs(); break;
      case 'validate': validatePage(); break;
      case 'gen-jsonld': generateJsonLdContent(); break;
      case 'gen-interactive': generateInteractivity(); break;
      case 'validate-css': validateCss(); break;
      // 'gen-sections' is handled per-section
    }
  }

  function isBuildStepLoading(key: string): boolean {
    switch (key) {
      case 'gen-specs': return generatingSectionSpecs;
      case 'validate': return validatingPage;
      case 'gen-jsonld': return generatingJsonLd;
      case 'gen-interactive': return generatingInteractivity;
      case 'validate-css': return validatingCss;
      default: return false;
    }
  }

  // ---------------------------------------------------------------------------
  // Accordion helpers
  // ---------------------------------------------------------------------------

  function toggleSection(specId: number) {
    const next = new Set(expandedSections);
    if (next.has(specId)) {
      next.delete(specId);
    } else {
      next.add(specId);
    }
    expandedSections = next;
  }

  function expandAll() {
    expandedSections = new Set(sectionSpecs.map((s) => s.id));
  }

  function collapseAll() {
    expandedSections = new Set();
  }

  // ---------------------------------------------------------------------------
  // Display helpers
  // ---------------------------------------------------------------------------

  function formatJson(obj: unknown): string {
    if (!obj) return 'null';
    try {
      return JSON.stringify(obj, null, 2);
    } catch {
      return String(obj);
    }
  }

  function renderRulesAsList(rules: Record<string, unknown> | null): Array<{ key: string; value: string }> {
    if (!rules) return [];
    return Object.entries(rules).map(([key, value]) => ({
      key: key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase()),
      value: typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value),
    }));
  }

  function decisionBadgeClass(type: string): string {
    switch (type) {
      case 'use': return 'bg-success';
      case 'avoid': return 'bg-danger';
      case 'replace': return 'bg-warning text-dark';
      case 'custom': return 'bg-info text-dark';
      default: return 'bg-secondary';
    }
  }
</script>

<div class="container mt-4 mb-5">
  <!-- Header -->
  <div class="d-flex justify-content-between align-items-center mb-3">
    <div>
      <a href="/blueprints/{siteId}" class="text-decoration-none text-muted">&larr; All Blueprints</a>
    </div>
    <div class="d-flex gap-2">
      {#if hasApprovedSections}
        <a href="/site/{siteId}/export/{blueprintId}" class="btn btn-success wf-action-btn">View Export &rarr;</a>
      {/if}
      <a href="/site/{siteId}/pipeline" class="btn btn-outline-primary wf-action-btn">Pipeline</a>
      <a href="/" class="btn btn-outline-secondary wf-action-btn">Dashboard</a>
    </div>
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
  {:else if !blueprint}
    <div class="card">
      <div class="card-body text-center py-5">
        <h5 class="card-title mb-3">Blueprint Not Found</h5>
        <p class="text-muted">The requested blueprint does not exist.</p>
      </div>
    </div>
  {:else}
    <!-- ================================================================== -->
    <!-- Blueprint Header Card                                               -->
    <!-- ================================================================== -->
    <div class="card mb-4">
      <div class="card-header d-flex justify-content-between align-items-center">
        <h2 class="mb-0 h5">{blueprint.working_title || 'Untitled Blueprint'}</h2>
        <div class="d-flex gap-2 align-items-center">
          {#if blueprint.user_approved === 1}
            <span class="badge bg-success fs-6 px-3 py-2">Approved</span>
          {:else}
            <span class="badge bg-warning text-dark fs-6 px-3 py-2">Pending Review</span>
            <button
              class="btn btn-success wf-action-btn"
              disabled={approving}
              onclick={approveBlueprint}
            >
              {#if approving}
                <span class="spinner-border spinner-border-sm me-1" role="status"></span>
              {/if}
              Approve Blueprint
            </button>
          {/if}
        </div>
      </div>
      <div class="card-body">
        <div class="row">
          <div class="col-md-6">
            <table class="table table-sm table-borderless mb-0">
              <tbody>
                <tr>
                  <th class="text-muted" style="width: 160px;">Page Type</th>
                  <td><code>{blueprint.page_type}</code></td>
                </tr>
                <tr>
                  <th class="text-muted">Action</th>
                  <td><span class="badge {blueprint.action === 'create' ? 'bg-primary' : blueprint.action === 'improve' ? 'bg-warning text-dark' : 'bg-danger'}">{blueprint.action}</span></td>
                </tr>
                <tr>
                  <th class="text-muted">H1 Text</th>
                  <td>{blueprint.h1_text || '--'}</td>
                </tr>
                <tr>
                  <th class="text-muted">Meta Title</th>
                  <td>{blueprint.meta_title || '--'}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="col-md-6">
            <table class="table table-sm table-borderless mb-0">
              <tbody>
                <tr>
                  <th class="text-muted" style="width: 160px;">Meta Description</th>
                  <td><small>{blueprint.meta_description || '--'}</small></td>
                </tr>
                <tr>
                  <th class="text-muted">Canonical URL</th>
                  <td><code class="text-break">{blueprint.canonical_url || '--'}</code></td>
                </tr>
                <tr>
                  <th class="text-muted">Sections</th>
                  <td>{blueprint.section_count ?? 0}</td>
                </tr>
                <tr>
                  <th class="text-muted">Keywords</th>
                  <td>
                    {#if blueprint.target_keywords && Array.isArray(blueprint.target_keywords)}
                      {#each blueprint.target_keywords as kw}
                        <span class="badge bg-light text-dark border me-1">{kw}</span>
                      {/each}
                    {:else}
                      <span class="text-muted">--</span>
                    {/if}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <!-- ================================================================== -->
    <!-- Build Workflow Steps (numbered)                                      -->
    <!-- ================================================================== -->
    <div class="card mb-4 border-primary">
      <div class="card-header bg-primary text-white d-flex justify-content-between align-items-center">
        <div>
          <h5 class="mb-0">Stage 5: Build Workflow</h5>
          <small class="opacity-75">Page-level build actions in order</small>
        </div>
        <span class="badge bg-light text-primary fs-6">
          {#if sectionSpecs.length > 0}
            {approvedSections}/{sectionSpecs.length} sections approved
          {:else}
            No sections yet
          {/if}
        </span>
      </div>
      <div class="card-body p-0">
        <div class="list-group list-group-flush">
          {#each BUILD_STEPS as step, idx}
            {@const isDone = buildStepDone[step.key] ?? false}
            {@const isLoading = isBuildStepLoading(step.key)}
            {@const isNext = idx === buildNextStep}
            {@const isPerSection = step.key === 'gen-sections'}

            <div class="list-group-item py-3 {isNext && !isDone ? 'wf-next-step' : ''} {isDone ? 'wf-step-done' : ''}">
              <div class="d-flex align-items-center gap-3">
                <div class="wf-step-circle-sm {isDone ? 'wf-circle-done' : isLoading ? 'wf-circle-running' : isNext ? 'wf-circle-next' : 'wf-circle-idle'}">
                  {#if isDone}
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
                      <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/>
                    </svg>
                  {:else if isLoading}
                    <span class="spinner-border spinner-border-sm" style="width: 14px; height: 14px;" role="status"></span>
                  {:else}
                    {step.number}
                  {/if}
                </div>

                <div class="flex-grow-1">
                  <div class="d-flex align-items-center gap-2">
                    <strong class="{isDone ? 'text-muted text-decoration-line-through' : ''}">{step.label}</strong>
                    {#if isNext && !isDone && !isLoading}
                      <span class="badge bg-primary wf-pulse">Next Step</span>
                    {/if}
                  </div>
                  <small class="text-muted">{step.description}</small>
                  {#if isPerSection && sectionSpecs.length > 0}
                    <div class="mt-1">
                      <small class="text-info fw-semibold">{generatedSections}/{sectionSpecs.length} sections generated &mdash; see individual sections below</small>
                    </div>
                  {/if}
                </div>

                {#if !isPerSection}
                  <button
                    class="btn {isDone ? 'btn-outline-success' : isNext ? 'btn-primary' : 'btn-outline-secondary'} wf-action-btn"
                    disabled={isLoading || anyBuildActionRunning}
                    onclick={() => runBuildStep(step)}
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
                {:else}
                  <span class="badge bg-info text-dark px-3 py-2">Per-Section</span>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      </div>
    </div>

    <!-- Export CTA (shown when sections are approved) -->
    {#if allSectionsApproved}
      <div class="card mb-4 border-success wf-export-cta">
        <div class="card-body d-flex justify-content-between align-items-center py-4">
          <div>
            <h5 class="mb-1 text-success">All sections approved!</h5>
            <p class="text-muted mb-0">Your content is ready. View the assembled page, copy HTML, and deploy.</p>
          </div>
          <a href="/site/{siteId}/export/{blueprintId}" class="btn btn-success btn-lg wf-action-btn wf-pulse wf-export-btn">
            View Export &rarr;
          </a>
        </div>
      </div>
    {:else if hasApprovedSections}
      <div class="card mb-4 border-info">
        <div class="card-body d-flex justify-content-between align-items-center">
          <span class="text-muted">{approvedSections}/{sectionSpecs.length} sections approved. You can preview the partial export.</span>
          <a href="/site/{siteId}/export/{blueprintId}" class="btn btn-outline-success wf-action-btn">
            Preview Export &rarr;
          </a>
        </div>
      </div>
    {/if}

    <!-- ================================================================== -->
    <!-- Rules Panels (SEO / GEO / Voice)                                    -->
    <!-- ================================================================== -->
    <div class="row mb-4">
      <div class="col-md-4">
        <div class="card h-100">
          <div class="card-header"><h6 class="mb-0">SEO Rules</h6></div>
          <div class="card-body">
            {#if blueprint.page_level_seo_rules}
              <ul class="list-unstyled mb-0">
                {#each renderRulesAsList(blueprint.page_level_seo_rules) as rule}
                  <li class="mb-2">
                    <strong class="d-block text-muted small">{rule.key}</strong>
                    {#if rule.value.startsWith('{')}
                      <pre class="bg-light p-2 rounded small mb-0" style="white-space: pre-wrap;">{rule.value}</pre>
                    {:else}
                      <span>{rule.value}</span>
                    {/if}
                  </li>
                {/each}
              </ul>
            {:else}
              <p class="text-muted mb-0">No SEO rules defined.</p>
            {/if}
          </div>
        </div>
      </div>

      <div class="col-md-4">
        <div class="card h-100">
          <div class="card-header"><h6 class="mb-0">GEO Rules</h6></div>
          <div class="card-body">
            {#if blueprint.page_level_geo_rules}
              <ul class="list-unstyled mb-0">
                {#each renderRulesAsList(blueprint.page_level_geo_rules) as rule}
                  <li class="mb-2">
                    <strong class="d-block text-muted small">{rule.key}</strong>
                    {#if rule.value.startsWith('{')}
                      <pre class="bg-light p-2 rounded small mb-0" style="white-space: pre-wrap;">{rule.value}</pre>
                    {:else}
                      <span>{rule.value}</span>
                    {/if}
                  </li>
                {/each}
              </ul>
            {:else}
              <p class="text-muted mb-0">No GEO rules defined.</p>
            {/if}
          </div>
        </div>
      </div>

      <div class="col-md-4">
        <div class="card h-100">
          <div class="card-header"><h6 class="mb-0">Voice Rules</h6></div>
          <div class="card-body">
            {#if blueprint.page_level_voice_rules}
              <ul class="list-unstyled mb-0">
                {#each renderRulesAsList(blueprint.page_level_voice_rules) as rule}
                  <li class="mb-2">
                    <strong class="d-block text-muted small">{rule.key}</strong>
                    {#if rule.value.startsWith('{') || rule.value.startsWith('[')}
                      <pre class="bg-light p-2 rounded small mb-0" style="white-space: pre-wrap;">{rule.value}</pre>
                    {:else}
                      <span>{rule.value}</span>
                    {/if}
                  </li>
                {/each}
              </ul>
            {:else}
              <p class="text-muted mb-0">No voice rules defined.</p>
            {/if}
          </div>
        </div>
      </div>
    </div>

    <!-- ================================================================== -->
    <!-- Section Specs with Status-Based Actions                             -->
    <!-- ================================================================== -->
    <div class="card mb-4">
      <div class="card-header d-flex justify-content-between align-items-center">
        <div>
          <h5 class="mb-0">Section Specs ({sectionSpecs.length})</h5>
          {#if sectionSpecs.length > 0}
            <small class="text-muted">
              {approvedSections} approved, {generatedSections - approvedSections} generated, {sectionSpecs.length - generatedSections} pending
            </small>
          {/if}
        </div>
        <div class="btn-group btn-group-sm">
          <button class="btn btn-outline-secondary" onclick={expandAll}>Expand All</button>
          <button class="btn btn-outline-secondary" onclick={collapseAll}>Collapse All</button>
        </div>
      </div>
      <div class="card-body p-0">
        {#if sectionSpecs.length === 0}
          <div class="p-4 text-center text-muted">
            No section specs generated yet. Run "Generate Section Specs" in the build workflow above.
          </div>
        {:else}
          <div class="accordion accordion-flush" id="sectionAccordion">
            {#each sectionSpecs as spec (spec.id)}
              {@const isExpanded = expandedSections.has(spec.id)}
              {@const statusInfo = sectionStatusLabel(spec.status)}
              {@const isApproved = spec.status === 'approved'}
              {@const isGenerated = spec.status === 'generated'}
              {@const isPending = !isApproved && !isGenerated && spec.status !== 'rejected'}
              <div class="accordion-item {isApproved ? 'wf-section-approved' : ''}">
                <h2 class="accordion-header">
                  <button
                    class="accordion-button {isExpanded ? '' : 'collapsed'}"
                    type="button"
                    onclick={() => toggleSection(spec.id)}
                  >
                    <div class="d-flex align-items-center gap-2 flex-grow-1 me-3">
                      <!-- Section order number -->
                      <div class="wf-step-circle-xs {isApproved ? 'wf-circle-done' : isGenerated ? 'wf-circle-next' : 'wf-circle-idle'}">
                        {#if isApproved}
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" viewBox="0 0 16 16">
                            <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/>
                          </svg>
                        {:else}
                          {spec.section_order}
                        {/if}
                      </div>
                      <strong>{spec.section_type}</strong>
                      {#if spec.heading_text}
                        <span class="text-muted">- {spec.heading_text}</span>
                      {/if}
                      <span class="badge {statusInfo.cls} ms-auto">{statusInfo.text}</span>
                      {#if spec.cta_required}
                        <span class="badge bg-info text-dark">CTA</span>
                      {/if}
                      {#if spec.direct_answer_block_required}
                        <span class="badge bg-info text-dark">DAB</span>
                      {/if}
                      {#if spec.faq_questions && spec.faq_questions.length > 0}
                        <span class="badge bg-info text-dark">FAQ</span>
                      {/if}
                    </div>
                  </button>
                </h2>
                {#if isExpanded}
                  <div class="accordion-body">
                    <div class="row">
                      <div class="col-md-6">
                        <table class="table table-sm table-borderless">
                          <tbody>
                            <tr>
                              <th class="text-muted" style="width: 180px;">Section Type</th>
                              <td><code>{spec.section_type}</code></td>
                            </tr>
                            <tr>
                              <th class="text-muted">Order</th>
                              <td>{spec.section_order}</td>
                            </tr>
                            <tr>
                              <th class="text-muted">Heading</th>
                              <td>{spec.heading_text || '--'}</td>
                            </tr>
                            <tr>
                              <th class="text-muted">Word Count Range</th>
                              <td>
                                {#if spec.target_word_count_min != null && spec.target_word_count_max != null}
                                  {spec.target_word_count_min} - {spec.target_word_count_max}
                                {:else}
                                  <span class="text-muted">--</span>
                                {/if}
                              </td>
                            </tr>
                            <tr>
                              <th class="text-muted">CTA Required</th>
                              <td>
                                {#if spec.cta_required}
                                  <span class="badge bg-success">Yes</span>
                                  {#if spec.cta_text}
                                    <span class="ms-1 text-muted small">({spec.cta_text})</span>
                                  {/if}
                                {:else}
                                  <span class="badge bg-secondary">No</span>
                                {/if}
                              </td>
                            </tr>
                            <tr>
                              <th class="text-muted">Direct Answer Block</th>
                              <td>
                                <span class="badge {spec.direct_answer_block_required ? 'bg-success' : 'bg-secondary'}">
                                  {spec.direct_answer_block_required ? 'Yes' : 'No'}
                                </span>
                              </td>
                            </tr>
                            <tr>
                              <th class="text-muted">Statistics Required</th>
                              <td>
                                <span class="badge {spec.statistics_required ? 'bg-success' : 'bg-secondary'}">
                                  {spec.statistics_required ? 'Yes' : 'No'}
                                </span>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                      <div class="col-md-6">
                        <table class="table table-sm table-borderless">
                          <tbody>
                            <tr>
                              <th class="text-muted" style="width: 180px;">Design Pattern</th>
                              <td>
                                {#if spec.design_pattern}
                                  <span class="badge bg-light text-dark border">{spec.design_pattern}</span>
                                {:else}
                                  <span class="text-muted">--</span>
                                {/if}
                              </td>
                            </tr>
                            <tr>
                              <th class="text-muted">CSS Classes</th>
                              <td>
                                {#if spec.css_classes && Array.isArray(spec.css_classes) && spec.css_classes.length > 0}
                                  {#each spec.css_classes as cls}
                                    <span class="badge bg-dark me-1 mb-1">{cls}</span>
                                  {/each}
                                {:else}
                                  <span class="text-muted">--</span>
                                {/if}
                              </td>
                            </tr>
                            <tr>
                              <th class="text-muted">Status</th>
                              <td>
                                <span class="badge {statusInfo.cls}">{statusInfo.text}</span>
                              </td>
                            </tr>
                          </tbody>
                        </table>

                        {#if spec.links_required && Array.isArray(spec.links_required) && spec.links_required.length > 0}
                          <h6 class="mt-3 text-muted">Links Required</h6>
                          <ul class="list-group list-group-flush">
                            {#each spec.links_required as link}
                              <li class="list-group-item px-0 py-1">
                                <code class="small">{link.target_url || link.url || '--'}</code>
                                {#if link.anchor_text}
                                  <br><small class="text-muted">Anchor: {link.anchor_text}</small>
                                {/if}
                              </li>
                            {/each}
                          </ul>
                        {/if}

                        {#if spec.faq_questions && Array.isArray(spec.faq_questions) && spec.faq_questions.length > 0}
                          <h6 class="mt-3 text-muted">FAQ Questions</h6>
                          <ol class="small">
                            {#each spec.faq_questions as q}
                              <li>{q}</li>
                            {/each}
                          </ol>
                        {/if}
                      </div>
                    </div>

                    <!-- ================================================ -->
                    <!-- Generated HTML Content Preview                     -->
                    <!-- ================================================ -->
                    {#if spec.generated_html}
                      <hr class="my-3">
                      <div class="mb-3">
                        <div class="d-flex align-items-center gap-2 mb-2">
                          <h6 class="mb-0 text-muted">Generated Content</h6>
                          <div class="btn-group btn-group-sm ms-auto">
                            <button
                              class="btn {(contentViewMode[spec.id] ?? 'preview') === 'preview' ? 'btn-primary' : 'btn-outline-primary'}"
                              onclick={() => contentViewMode = { ...contentViewMode, [spec.id]: 'preview' }}
                            >
                              Preview
                            </button>
                            <button
                              class="btn {(contentViewMode[spec.id] ?? 'preview') === 'source' ? 'btn-primary' : 'btn-outline-primary'}"
                              onclick={() => contentViewMode = { ...contentViewMode, [spec.id]: 'source' }}
                            >
                              Source
                            </button>
                          </div>
                        </div>
                        {#if (contentViewMode[spec.id] ?? 'preview') === 'preview'}
                          <PreviewFrame
                            htmlContent={spec.generated_html ?? ''}
                            {siteSlug}
                            {siteId}
                            showControls={false}
                          />
                        {:else}
                          <pre class="bg-light p-3 rounded border mb-0" style="max-height: 400px; overflow: auto; white-space: pre-wrap; word-break: break-word;"><code>{spec.generated_html}</code></pre>
                        {/if}
                      </div>
                    {:else if spec.status !== 'pending'}
                      <hr class="my-3">
                      <div class="mb-3">
                        <p class="text-muted small mb-0">No content generated yet.</p>
                      </div>
                    {/if}

                    <!-- ================================================ -->
                    <!-- Status-Based Section Actions                       -->
                    <!-- ================================================ -->
                    <hr class="my-3">
                    <div class="wf-section-actions p-3 rounded border {isApproved ? 'bg-success bg-opacity-10 border-success' : isPending ? 'bg-light border-primary' : isGenerated ? 'bg-info bg-opacity-10 border-info' : 'bg-danger bg-opacity-10 border-danger'}">
                      {#if isPending || spec.status === 'rejected'}
                        <!-- Pending: Show Generate prominently -->
                        <div class="d-flex align-items-center gap-2 mb-2">
                          <span class="fw-semibold text-muted">
                            {#if spec.status === 'rejected'}
                              Section was rejected. Regenerate or refine:
                            {:else}
                              Section needs content. Generate it:
                            {/if}
                          </span>
                        </div>
                        <div class="d-flex flex-wrap gap-2">
                          <button
                            class="btn btn-primary wf-action-btn wf-pulse"
                            disabled={generatingSection.has(spec.id)}
                            onclick={() => generateSection(spec.id)}
                          >
                            {#if generatingSection.has(spec.id)}
                              <span class="spinner-border spinner-border-sm me-1" role="status"></span>
                              Generating...
                            {:else}
                              Generate Section
                            {/if}
                          </button>
                        </div>

                      {:else if isGenerated}
                        <!-- Generated: Show Validate + Approve/Reject/Refine -->
                        <div class="d-flex align-items-center gap-2 mb-2">
                          <span class="fw-semibold text-muted">Section generated. Review and decide:</span>
                        </div>
                        <div class="d-flex flex-wrap gap-2">
                          <button
                            class="btn btn-outline-secondary wf-action-btn"
                            disabled={validatingSection.has(spec.id)}
                            onclick={() => validateSection(spec.id)}
                          >
                            {#if validatingSection.has(spec.id)}
                              <span class="spinner-border spinner-border-sm me-1" role="status"></span>
                            {/if}
                            Validate
                          </button>

                          <span class="border-start mx-1"></span>

                          <button
                            class="btn btn-success wf-action-btn"
                            disabled={approvingSection.has(spec.id)}
                            onclick={() => approveSection(spec.id)}
                          >
                            {#if approvingSection.has(spec.id)}
                              <span class="spinner-border spinner-border-sm me-1" role="status"></span>
                            {/if}
                            Approve
                          </button>

                          <button
                            class="btn btn-danger wf-action-btn"
                            disabled={rejectingSection.has(spec.id)}
                            onclick={() => rejectSection(spec.id)}
                          >
                            {#if rejectingSection.has(spec.id)}
                              <span class="spinner-border spinner-border-sm me-1" role="status"></span>
                            {/if}
                            Reject
                          </button>

                          <button
                            class="btn btn-warning wf-action-btn"
                            onclick={() => toggleRefine(spec.id)}
                          >
                            {#if refineExpandedId === spec.id}
                              Cancel Refine
                            {:else}
                              Refine
                            {/if}
                          </button>

                          <span class="border-start mx-1"></span>

                          <button
                            class="btn btn-outline-primary wf-action-btn"
                            disabled={generatingSection.has(spec.id)}
                            onclick={() => generateSection(spec.id)}
                          >
                            {#if generatingSection.has(spec.id)}
                              <span class="spinner-border spinner-border-sm me-1" role="status"></span>
                            {/if}
                            Regenerate
                          </button>
                        </div>

                      {:else if isApproved}
                        <!-- Approved: Dimmed with checkmark -->
                        <div class="d-flex align-items-center gap-2">
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" class="text-success" viewBox="0 0 16 16">
                            <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/>
                          </svg>
                          <span class="text-success fw-semibold">Section approved.</span>
                          <button
                            class="btn btn-outline-secondary btn-sm ms-auto"
                            disabled={generatingSection.has(spec.id)}
                            onclick={() => generateSection(spec.id)}
                          >
                            Regenerate
                          </button>
                        </div>
                      {/if}

                      <!-- Refine text area (expandable) -->
                      {#if refineExpandedId === spec.id}
                        <div class="mt-3 p-3 bg-light rounded border">
                          <label for="refine-notes-{spec.id}" class="form-label fw-semibold small">Refinement Notes</label>
                          <textarea
                            id="refine-notes-{spec.id}"
                            class="form-control form-control-sm mb-2"
                            rows={3}
                            placeholder="Describe what needs to change..."
                            bind:value={refineNotes}
                          ></textarea>
                          <button
                            class="btn btn-warning wf-action-btn"
                            disabled={refiningSection.has(spec.id) || !refineNotes.trim()}
                            onclick={() => refineSection(spec.id)}
                          >
                            {#if refiningSection.has(spec.id)}
                              <span class="spinner-border spinner-border-sm me-1" role="status"></span>
                            {/if}
                            Submit Refinement
                          </button>
                        </div>
                      {/if}
                    </div>
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>

    <!-- ================================================================== -->
    <!-- Link Assignments Panel                                              -->
    <!-- ================================================================== -->
    <div class="card mb-4">
      <div class="card-header"><h5 class="mb-0">Link Assignments</h5></div>
      <div class="card-body">
        <div class="row">
          <div class="col-md-6">
            <h6 class="text-muted">Required Links</h6>
            {#if blueprint.internal_links_required && Array.isArray(blueprint.internal_links_required) && blueprint.internal_links_required.length > 0}
              <table class="table table-sm">
                <thead>
                  <tr><th>URL</th><th>Type</th><th>Section</th></tr>
                </thead>
                <tbody>
                  {#each blueprint.internal_links_required as link}
                    <tr>
                      <td><code class="small">{link.url}</code></td>
                      <td><span class="badge bg-secondary">{link.type}</span></td>
                      <td>{link.section || '--'}</td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            {:else}
              <p class="text-muted small">No required links.</p>
            {/if}
          </div>
          <div class="col-md-6">
            <h6 class="text-muted">Optional Links</h6>
            {#if blueprint.internal_links_optional && Array.isArray(blueprint.internal_links_optional) && blueprint.internal_links_optional.length > 0}
              <table class="table table-sm">
                <thead>
                  <tr><th>URL</th><th>Type</th><th>Section</th></tr>
                </thead>
                <tbody>
                  {#each blueprint.internal_links_optional as link}
                    <tr>
                      <td><code class="small">{link.url}</code></td>
                      <td><span class="badge bg-secondary">{link.type}</span></td>
                      <td>{link.section || '--'}</td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            {:else}
              <p class="text-muted small">No optional links.</p>
            {/if}
          </div>
        </div>
      </div>
    </div>

    <!-- ================================================================== -->
    <!-- Schema Spec Panel                                                   -->
    <!-- ================================================================== -->
    <div class="card mb-4">
      <div class="card-header"><h5 class="mb-0">Schema Spec (JSON-LD)</h5></div>
      <div class="card-body">
        {#if blueprint.schema_spec}
          <pre class="bg-light p-3 rounded mb-0"><code>{formatJson(blueprint.schema_spec)}</code></pre>
        {:else}
          <p class="text-muted mb-0">No schema spec generated yet. Run "Generate JSON-LD" in the build workflow.</p>
        {/if}
      </div>
    </div>

    <!-- ================================================================== -->
    <!-- CSS Decisions Panel                                                 -->
    <!-- ================================================================== -->
    <div class="card mb-4">
      <div class="card-header"><h5 class="mb-0">CSS Decisions ({cssDecisions.length})</h5></div>
      <div class="card-body">
        {#if cssDecisions.length > 0}
          <table class="table table-sm table-hover">
            <thead class="table-light">
              <tr>
                <th>Decision</th>
                <th>Class</th>
                <th>Replacement</th>
                <th>Rationale</th>
              </tr>
            </thead>
            <tbody>
              {#each cssDecisions as dec}
                <tr>
                  <td><span class="badge {decisionBadgeClass(dec.decision_type)}">{dec.decision_type}</span></td>
                  <td><code>{dec.class_name || '--'}</code></td>
                  <td>
                    {#if dec.replacement_class}
                      <code>{dec.replacement_class}</code>
                    {:else}
                      <span class="text-muted">--</span>
                    {/if}
                  </td>
                  <td><small>{dec.rationale || '--'}</small></td>
                </tr>
              {/each}
            </tbody>
          </table>
        {:else}
          <p class="text-muted mb-0">No CSS decisions recorded for this site.</p>
        {/if}
      </div>
    </div>

    <!-- ================================================================== -->
    <!-- Bottom Approve Bar                                                  -->
    <!-- ================================================================== -->
    {#if blueprint.user_approved === 0}
      <div class="card border-success">
        <div class="card-body d-flex justify-content-between align-items-center">
          <span class="fw-semibold">Ready to approve this blueprint?</span>
          <button
            class="btn btn-success btn-lg wf-action-btn"
            disabled={approving}
            onclick={approveBlueprint}
          >
            {#if approving}
              <span class="spinner-border spinner-border-sm me-1" role="status"></span>
            {/if}
            Approve Blueprint
          </button>
        </div>
      </div>
    {/if}
  {/if}
</div>

<style>
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

  .wf-step-circle-xs {
    width: 26px;
    height: 26px;
    min-width: 26px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 0.7rem;
    border: 2px solid;
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

  .wf-next-step {
    background: rgba(var(--bs-primary-rgb), 0.06);
    border-left: 4px solid var(--bs-primary) !important;
  }

  .wf-step-done {
    opacity: 0.7;
  }

  .wf-section-approved {
    opacity: 0.7;
  }

  .wf-section-actions {
    transition: all 0.2s ease;
  }

  .wf-pulse {
    animation: wf-pulse-anim 2s ease-in-out infinite;
  }

  @keyframes wf-pulse-anim {
    0%, 100% { box-shadow: 0 0 0 0 rgba(var(--bs-primary-rgb), 0.4); }
    50% { box-shadow: 0 0 0 8px rgba(var(--bs-primary-rgb), 0); }
  }

  .wf-export-cta {
    background: rgba(var(--bs-success-rgb), 0.05);
  }

  .wf-export-btn {
    min-width: 180px;
    font-size: 1.1rem;
    padding: 0.75rem 2rem;
  }

  .preview-container {
    max-height: 500px;
    overflow: auto;
  }
</style>
