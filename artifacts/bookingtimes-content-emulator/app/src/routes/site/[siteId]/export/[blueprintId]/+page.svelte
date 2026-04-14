<script lang="ts">
  import { page } from '$app/state';
  import { onMount } from 'svelte';
  import PreviewFrame from '$lib/components/PreviewFrame.svelte';

  // ---------------------------------------------------------------------------
  // Types
  // ---------------------------------------------------------------------------

  interface ExportArtifact {
    pageHtml: string;
    jsonLd: string;
    headJs: string | null;
  }

  interface ExportValidation {
    passed: boolean;
    critical: string[];
    warnings: string[];
  }

  interface ExportResult {
    blueprintId: number;
    artifacts: ExportArtifact;
    validation: ExportValidation;
    exportBlocked: boolean;
    error?: string;
  }

  interface PageVersion {
    id: number;
    pageId: number;
    versionNumber: number;
    htmlContent: string;
    changeReason: string;
    createdAt: string;
    editDistance: number | null;
  }

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  let siteId: number = $derived(parseInt(page.params.siteId ?? '0', 10));
  let blueprintId: number = $derived(parseInt(page.params.blueprintId ?? '0', 10));

  let exportData: ExportResult | null = $state(null);
  let loading = $state(true);
  let errorMsg = $state('');

  // Active view tab: preview is default
  let activeTab = $state<'preview' | 'source' | 'jsonld' | 'headjs'>('preview');

  // Site slug for CSS tier loading
  let siteSlug = $state('');

  // Copy feedback per panel
  let copiedHtml = $state(false);
  let copiedJsonLd = $state(false);
  let copiedHeadJs = $state(false);

  // Deploy state
  let deploying = $state(false);
  let deploySuccess = $state(false);
  let deployError = $state('');

  // Version info
  let versions: PageVersion[] = $state([]);
  let currentVersion: number = $derived(versions.length > 0 ? versions[0].versionNumber : 0);
  let editDistance: number | null = $derived(
    versions.length > 0 ? versions[0].editDistance : null
  );

  // Additional action states
  let generatingExport = $state(false);
  let rollingBack = $state(false);
  let checkingCssChanges = $state(false);
  let cssChangesResult: string | null = $state(null);

  // ---------------------------------------------------------------------------
  // Derived display values
  // ---------------------------------------------------------------------------

  let pageTitle: string = $derived(
    exportData ? `Blueprint #${exportData.blueprintId}` : 'Export'
  );

  let validationSummary: string = $derived(buildValidationSummary());

  function buildValidationSummary(): string {
    if (!exportData) return '';
    const v = exportData.validation;
    if (v.passed && v.warnings.length === 0) return 'Passed';
    if (v.passed) return `Passed (${v.warnings.length} warning${v.warnings.length !== 1 ? 's' : ''})`;
    return `Failed (${v.critical.length} error${v.critical.length !== 1 ? 's' : ''}, ${v.warnings.length} warning${v.warnings.length !== 1 ? 's' : ''})`;
  }

  // Edit distance is now computed server-side via true Levenshtein and stored
  // in page_versions.edit_distance. The $derived above reads it directly.

  // ---------------------------------------------------------------------------
  // Data loading
  // ---------------------------------------------------------------------------

  onMount(() => {
    loadExport();
  });

  async function loadExport() {
    loading = true;
    errorMsg = '';
    try {
      const [res, summaryRes] = await Promise.all([
        fetch(`/api/export/${blueprintId}`),
        fetch(`/api/site/${siteId}/summary`),
      ]);
      const data: ExportResult = await res.json();
      if (res.ok) {
        exportData = data;
        await loadVersions();
      } else {
        errorMsg = data.error ?? 'Failed to load export data';
      }
      // Extract slug for CSS preview
      if (summaryRes.ok) {
        const summaryData = await summaryRes.json();
        siteSlug = summaryData.slug ?? '';
      }
    } catch {
      errorMsg = 'Network error loading export';
    } finally {
      loading = false;
    }
  }

  async function loadVersions() {
    try {
      // We need to find the pageId for this blueprint.
      // The versions API uses pageId; we look up via site pages.
      const res = await fetch(`/api/site/${siteId}/pages`);
      if (!res.ok) return;
      const data = await res.json();
      // Find matching page — pageId is associated via the export pipeline
      // For now, try loading versions if we can derive the pageId
      if (data.pages && Array.isArray(data.pages)) {
        for (const p of data.pages) {
          const vRes = await fetch(`/api/versions/${p.id}`);
          if (vRes.ok) {
            const vData = await vRes.json();
            if (vData.versions && vData.versions.length > 0) {
              // Check if the latest version content matches our export
              versions = vData.versions;
              break;
            }
          }
        }
      }
    } catch {
      // Version info is best-effort; don't block export UI
    }
  }

  // ---------------------------------------------------------------------------
  // Copy to clipboard
  // ---------------------------------------------------------------------------

  async function copyToClipboard(text: string, panel: 'html' | 'jsonld' | 'headjs') {
    try {
      await navigator.clipboard.writeText(text);
      if (panel === 'html') {
        copiedHtml = true;
        setTimeout(() => copiedHtml = false, 2000);
      } else if (panel === 'jsonld') {
        copiedJsonLd = true;
        setTimeout(() => copiedJsonLd = false, 2000);
      } else {
        copiedHeadJs = true;
        setTimeout(() => copiedHeadJs = false, 2000);
      }
    } catch {
      errorMsg = 'Failed to copy to clipboard';
    }
  }

  // ---------------------------------------------------------------------------
  // Mark as Deployed
  // ---------------------------------------------------------------------------

  async function markAsDeployed() {
    if (!exportData || exportData.exportBlocked) return;
    deploying = true;
    deployError = '';
    deploySuccess = false;
    try {
      const res = await fetch('/api/freshness/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteId,
          pageUrl: window.location.pathname,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        deploySuccess = true;
      } else {
        deployError = data.error ?? 'Failed to mark as deployed';
      }
    } catch {
      deployError = 'Network error during deploy';
    } finally {
      deploying = false;
    }
  }

  // ---------------------------------------------------------------------------
  // Generate Export
  // ---------------------------------------------------------------------------

  async function generateExport() {
    generatingExport = true;
    errorMsg = '';
    try {
      const res = await fetch(`/api/export/${blueprintId}`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        // Reload export data to show the fresh export
        await loadExport();
      } else {
        errorMsg = data.error ?? 'Failed to generate export';
      }
    } catch {
      errorMsg = 'Network error generating export';
    } finally {
      generatingExport = false;
    }
  }

  // ---------------------------------------------------------------------------
  // Rollback Version
  // ---------------------------------------------------------------------------

  async function rollbackVersion() {
    if (versions.length === 0) return;
    const pageId = versions[0].pageId;
    rollingBack = true;
    errorMsg = '';
    try {
      const res = await fetch(`/api/versions/${pageId}/rollback`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        await loadExport();
      } else {
        errorMsg = data.error ?? 'Failed to rollback version';
      }
    } catch {
      errorMsg = 'Network error during rollback';
    } finally {
      rollingBack = false;
    }
  }

  // ---------------------------------------------------------------------------
  // Check for CSS Changes
  // ---------------------------------------------------------------------------

  async function checkCssChanges() {
    checkingCssChanges = true;
    errorMsg = '';
    cssChangesResult = null;
    try {
      const res = await fetch(`/api/css-decisions/${siteId}/changes`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        cssChangesResult = data.message ?? (data.hasChanges ? 'CSS changes detected' : 'No CSS changes detected');
      } else {
        errorMsg = data.error ?? 'Failed to check CSS changes';
      }
    } catch {
      errorMsg = 'Network error checking CSS changes';
    } finally {
      checkingCssChanges = false;
    }
  }
</script>

<div class="container mt-4 mb-5">
  <!-- Header -->
  <div class="d-flex justify-content-between align-items-center mb-3">
    <div>
      <a href="/blueprints/{siteId}" class="text-decoration-none text-muted">&larr; All Blueprints</a>
    </div>
    <a href="/" class="btn btn-outline-secondary btn-sm">Dashboard</a>
  </div>

  <!-- Alerts -->
  {#if errorMsg}
    <div class="alert alert-danger alert-dismissible" role="alert">
      {errorMsg}
      <button type="button" class="btn-close" onclick={() => errorMsg = ''}></button>
    </div>
  {/if}

  {#if loading}
    <div class="text-center py-5">
      <div class="spinner-border" role="status">
        <span class="visually-hidden">Loading...</span>
      </div>
    </div>
  {:else if !exportData}
    <div class="card">
      <div class="card-body text-center py-5">
        <h5 class="card-title mb-3">Export Data Not Available</h5>
        <p class="text-muted">Could not load export artifacts for this blueprint.</p>
      </div>
    </div>
  {:else}
    <!-- ================================================================== -->
    <!-- Export Header + Validation Summary                                   -->
    <!-- ================================================================== -->
    <div class="card mb-4">
      <div class="card-header d-flex justify-content-between align-items-center">
        <h2 class="mb-0 h5">Export: {pageTitle}</h2>
        <div class="d-flex align-items-center gap-2">
          <span class="fw-semibold">Validation:</span>
          {#if exportData.validation.passed}
            <span class="badge bg-success">
              {validationSummary}
            </span>
          {:else}
            <span class="badge bg-danger">
              {validationSummary}
            </span>
          {/if}
        </div>
      </div>

      <!-- Validation Details -->
      {#if exportData.validation.critical.length > 0 || exportData.validation.warnings.length > 0}
        <div class="card-body border-bottom">
          {#if exportData.validation.critical.length > 0}
            <h6 class="text-danger mb-2">Critical Errors (blocks export)</h6>
            <ul class="list-unstyled mb-3">
              {#each exportData.validation.critical as err}
                <li class="mb-1">
                  <span class="badge bg-danger me-2">CRITICAL</span>
                  <small>{err}</small>
                </li>
              {/each}
            </ul>
          {/if}
          {#if exportData.validation.warnings.length > 0}
            <h6 class="text-warning mb-2">Warnings</h6>
            <ul class="list-unstyled mb-0">
              {#each exportData.validation.warnings as warn}
                <li class="mb-1">
                  <span class="badge bg-warning text-dark me-2">WARNING</span>
                  <small>{warn}</small>
                </li>
              {/each}
            </ul>
          {/if}
        </div>
      {/if}
    </div>

    <!-- ================================================================== -->
    <!-- Content Tabs: Preview / Source / JSON-LD / Head JS                  -->
    <!-- ================================================================== -->
    <div class="card mb-4">
      <div class="card-header">
        <div class="d-flex justify-content-between align-items-center">
          <ul class="nav nav-tabs card-header-tabs">
            <li class="nav-item">
              <button
                class="nav-link {activeTab === 'preview' ? 'active' : ''}"
                onclick={() => activeTab = 'preview'}
              >
                Preview
              </button>
            </li>
            <li class="nav-item">
              <button
                class="nav-link {activeTab === 'source' ? 'active' : ''}"
                onclick={() => activeTab = 'source'}
              >
                Source HTML
              </button>
            </li>
            <li class="nav-item">
              <button
                class="nav-link {activeTab === 'jsonld' ? 'active' : ''}"
                onclick={() => activeTab = 'jsonld'}
              >
                JSON-LD
              </button>
            </li>
            {#if exportData.artifacts.headJs}
              <li class="nav-item">
                <button
                  class="nav-link {activeTab === 'headjs' ? 'active' : ''}"
                  onclick={() => activeTab = 'headjs'}
                >
                  Head JS
                </button>
              </li>
            {/if}
          </ul>

          <!-- Copy button for active tab -->
          <div class="d-flex align-items-center gap-2">
            {#if copiedHtml && activeTab === 'source'}
              <span class="badge bg-success">Copied!</span>
            {/if}
            {#if copiedJsonLd && activeTab === 'jsonld'}
              <span class="badge bg-success">Copied!</span>
            {/if}
            {#if copiedHeadJs && activeTab === 'headjs'}
              <span class="badge bg-success">Copied!</span>
            {/if}
            {#if activeTab === 'source'}
              <button
                class="btn btn-outline-primary btn-sm"
                onclick={() => copyToClipboard(exportData!.artifacts.pageHtml, 'html')}
                disabled={!exportData.artifacts.pageHtml}
              >
                Copy HTML
              </button>
            {:else if activeTab === 'jsonld'}
              <button
                class="btn btn-outline-primary btn-sm"
                onclick={() => copyToClipboard(exportData!.artifacts.jsonLd, 'jsonld')}
                disabled={!exportData.artifacts.jsonLd}
              >
                Copy JSON-LD
              </button>
            {:else if activeTab === 'headjs' && exportData.artifacts.headJs}
              <button
                class="btn btn-outline-primary btn-sm"
                onclick={() => copyToClipboard(exportData!.artifacts.headJs!, 'headjs')}
              >
                Copy Head JS
              </button>
            {/if}
          </div>
        </div>
      </div>

      <div class="card-body p-0">
        <!-- Preview Tab: Rendered iframe with CSS tiers -->
        {#if activeTab === 'preview'}
          <div class="p-3">
            {#if exportData.artifacts.pageHtml}
              <PreviewFrame
                htmlContent={exportData.artifacts.pageHtml}
                {siteSlug}
                {siteId}
                showControls={true}
              />
            {:else}
              <div class="p-4 text-center text-muted">No HTML content available to preview.</div>
            {/if}
          </div>

        <!-- Source HTML Tab -->
        {:else if activeTab === 'source'}
          {#if exportData.artifacts.pageHtml}
            <pre class="bg-light p-3 mb-0 rounded-0" style="max-height: 600px; overflow: auto; white-space: pre-wrap; word-break: break-word;"><code>{exportData.artifacts.pageHtml}</code></pre>
          {:else}
            <div class="p-4 text-center text-muted">No HTML content available.</div>
          {/if}

        <!-- JSON-LD Tab -->
        {:else if activeTab === 'jsonld'}
          {#if exportData.artifacts.jsonLd}
            <pre class="bg-light p-3 mb-0 rounded-0" style="max-height: 600px; overflow: auto; white-space: pre-wrap; word-break: break-word;"><code>{exportData.artifacts.jsonLd}</code></pre>
          {:else}
            <div class="p-4 text-center text-muted">No JSON-LD content available.</div>
          {/if}

        <!-- Head JS Tab -->
        {:else if activeTab === 'headjs'}
          {#if exportData.artifacts.headJs}
            <pre class="bg-light p-3 mb-0 rounded-0" style="max-height: 600px; overflow: auto; white-space: pre-wrap; word-break: break-word;"><code>{exportData.artifacts.headJs}</code></pre>
          {:else}
            <div class="p-4 text-center text-muted">No Head JS content available.</div>
          {/if}
        {/if}
      </div>
    </div>

    <!-- ================================================================== -->
    <!-- Export Actions Card                                                 -->
    <!-- ================================================================== -->
    <div class="card mb-4 border-primary">
      <div class="card-header bg-primary bg-opacity-10">
        <h5 class="mb-0">Export &amp; Version Actions</h5>
      </div>
      <div class="card-body">
        <div class="d-flex flex-wrap gap-2 align-items-center">
          <!-- Generate Export -->
          <button
            class="btn btn-primary btn-sm"
            disabled={generatingExport}
            onclick={generateExport}
          >
            {#if generatingExport}
              <span class="spinner-border spinner-border-sm me-1" role="status"></span>
            {/if}
            Generate Export
          </button>

          <!-- Rollback Version -->
          <button
            class="btn btn-outline-warning btn-sm"
            disabled={rollingBack || versions.length === 0 || currentVersion <= 1}
            onclick={rollbackVersion}
          >
            {#if rollingBack}
              <span class="spinner-border spinner-border-sm me-1" role="status"></span>
            {/if}
            Rollback Version
          </button>

          <!-- Check for CSS Changes -->
          <button
            class="btn btn-outline-secondary btn-sm"
            disabled={checkingCssChanges}
            onclick={checkCssChanges}
          >
            {#if checkingCssChanges}
              <span class="spinner-border spinner-border-sm me-1" role="status"></span>
            {/if}
            Check for CSS Changes
          </button>

          {#if cssChangesResult}
            <span class="badge bg-info text-dark">{cssChangesResult}</span>
          {/if}
        </div>
      </div>
    </div>

    <!-- ================================================================== -->
    <!-- Deploy + Version Info Bar                                           -->
    <!-- ================================================================== -->
    <div class="card">
      <div class="card-body">
        <div class="d-flex justify-content-between align-items-center flex-wrap gap-3">
          <!-- Mark as Deployed -->
          <div class="d-flex align-items-center gap-2">
            {#if deploySuccess}
              <span class="badge bg-success">Deployed</span>
            {/if}
            {#if deployError}
              <span class="text-danger small">{deployError}</span>
            {/if}
            <button
              class="btn btn-primary"
              onclick={markAsDeployed}
              disabled={deploying || exportData.exportBlocked || deploySuccess}
            >
              {#if deploying}
                <span class="spinner-border spinner-border-sm me-1" role="status"></span>
              {/if}
              {#if deploySuccess}
                Deployed
              {:else if exportData.exportBlocked}
                Export Blocked
              {:else}
                Mark as Deployed
              {/if}
            </button>
            {#if exportData.exportBlocked}
              <small class="text-danger">Fix critical errors before deploying.</small>
            {/if}
          </div>

          <!-- Version info -->
          <div class="d-flex align-items-center gap-3">
            {#if editDistance !== null}
              <span class="text-muted small">Edit distance from prior version: {editDistance}</span>
            {/if}
            {#if currentVersion > 0}
              <span class="badge bg-secondary">Version: {currentVersion}</span>
            {:else}
              <span class="badge bg-secondary">No versions yet</span>
            {/if}
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>
