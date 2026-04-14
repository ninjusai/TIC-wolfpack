<script lang="ts">
  import { page } from '$app/state';
  import { onMount } from 'svelte';

  // ---------------------------------------------------------------------------
  // Types
  // ---------------------------------------------------------------------------

  interface QueueItem {
    blueprintId: number;
    pageType: string;
    title: string;
    priority: number;
    status: 'pending' | 'generating' | 'generated' | 'approved';
    locked: boolean;
    lockReason: string | null;
    sectionTotal: number;
    sectionsDone: number;
  }

  interface QueueResponse {
    siteId: number;
    homepageStatus: 'pending' | 'generating' | 'generated' | 'approved' | 'missing';
    approvedSuburbCount: number;
    batchUnlockThreshold: number;
    batchUnlocked: boolean;
    queue: QueueItem[];
  }

  interface GeneratingState {
    blueprintId: number;
    progress: string;
  }

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  let siteId: number = $derived(parseInt(page.params.siteId ?? '0', 10));

  let queue: QueueItem[] = $state([]);
  let homepageStatus: QueueResponse['homepageStatus'] = $state('missing');
  let approvedSuburbCount: number = $state(0);
  let batchUnlockThreshold: number = $state(3);
  let batchUnlocked: boolean = $state(false);

  let loading = $state(true);
  let errorMsg = $state('');
  let successMsg = $state('');
  let generating: GeneratingState | null = $state(null);
  let batchGenerating = $state(false);

  // Derived groups
  let homepage: QueueItem | undefined = $derived(queue.find((q) => q.pageType === 'homepage'));
  let servicePages: QueueItem[] = $derived(queue.filter((q) => q.pageType === 'service'));
  let locationPages: QueueItem[] = $derived(queue.filter((q) => q.pageType === 'location'));
  let otherPages: QueueItem[] = $derived(
    queue.filter((q) => q.pageType !== 'homepage' && q.pageType !== 'service' && q.pageType !== 'location')
  );

  let unapprovedLocations: QueueItem[] = $derived(
    locationPages.filter((q) => q.status !== 'approved')
  );
  let generatableLocations: QueueItem[] = $derived(
    unapprovedLocations.filter((q) => q.status === 'pending' && !q.locked)
  );

  // ---------------------------------------------------------------------------
  // Data loading
  // ---------------------------------------------------------------------------

  onMount(() => {
    loadQueue();
  });

  async function loadQueue() {
    loading = true;
    errorMsg = '';
    try {
      const res = await fetch(`/api/generate/queue/${siteId}`);
      const data: QueueResponse & { error?: string } = await res.json();
      if (res.ok) {
        queue = data.queue ?? [];
        homepageStatus = data.homepageStatus;
        approvedSuburbCount = data.approvedSuburbCount;
        batchUnlockThreshold = data.batchUnlockThreshold;
        batchUnlocked = data.batchUnlocked;
      } else {
        errorMsg = data.error ?? 'Failed to load generation queue';
      }
    } catch {
      errorMsg = 'Network error loading generation queue';
    } finally {
      loading = false;
    }
  }

  // ---------------------------------------------------------------------------
  // Generate single page
  // ---------------------------------------------------------------------------

  async function generatePage(item: QueueItem) {
    if (item.locked || item.status === 'generating' || generating) return;

    generating = { blueprintId: item.blueprintId, progress: 'Starting generation...' };
    errorMsg = '';
    successMsg = '';

    try {
      generating = { blueprintId: item.blueprintId, progress: 'Generating sections...' };

      const res = await fetch(`/api/generate/page/${item.blueprintId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skipCompleted: true }),
      });
      const data = await res.json();

      if (res.ok) {
        successMsg = `Generated ${data.sectionsGenerated} section(s) for "${item.title}"`;
        await loadQueue();
      } else {
        errorMsg = data.message ?? 'Generation failed';
      }
    } catch {
      errorMsg = `Network error generating "${item.title}"`;
    } finally {
      generating = null;
    }
  }

  // ---------------------------------------------------------------------------
  // Batch generate locations
  // ---------------------------------------------------------------------------

  async function batchGenerateLocations() {
    if (!batchUnlocked || batchGenerating) return;

    batchGenerating = true;
    errorMsg = '';
    successMsg = '';
    let generated = 0;
    let failed = 0;

    for (const item of generatableLocations) {
      generating = { blueprintId: item.blueprintId, progress: `Generating "${item.title}"...` };
      try {
        const res = await fetch(`/api/generate/page/${item.blueprintId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ skipCompleted: true }),
        });
        if (res.ok) {
          generated++;
        } else {
          failed++;
        }
      } catch {
        failed++;
      }
    }

    generating = null;
    batchGenerating = false;

    if (generated > 0) {
      successMsg = `Batch generated ${generated} location page(s)${failed > 0 ? `, ${failed} failed` : ''}`;
    } else if (failed > 0) {
      errorMsg = `Batch generation failed for all ${failed} page(s)`;
    }

    await loadQueue();
  }

  // ---------------------------------------------------------------------------
  // Display helpers
  // ---------------------------------------------------------------------------

  function statusBadge(status: QueueItem['status']): { text: string; cls: string } {
    switch (status) {
      case 'approved':
        return { text: 'Approved', cls: 'bg-success' };
      case 'generated':
        return { text: 'Generated', cls: 'bg-info text-dark' };
      case 'generating':
        return { text: 'Generating...', cls: 'bg-warning text-dark' };
      default:
        return { text: 'Pending', cls: 'bg-secondary' };
    }
  }

  function pageTypeLabel(pageType: string): string {
    switch (pageType) {
      case 'homepage': return 'Homepage';
      case 'service': return 'Service Page';
      case 'location': return 'Location Page';
      default: return pageType.charAt(0).toUpperCase() + pageType.slice(1);
    }
  }

  function isGeneratingThis(item: QueueItem): boolean {
    return generating?.blueprintId === item.blueprintId;
  }

  function canGenerate(item: QueueItem): boolean {
    return !item.locked && item.status === 'pending' && !generating && !batchGenerating;
  }
</script>

<div class="container mt-4 mb-5">
  <!-- Header -->
  <div class="d-flex justify-content-between align-items-center mb-3">
    <h1>Generation Queue</h1>
    <div class="d-flex gap-2">
      <button class="btn btn-outline-primary btn-sm" onclick={loadQueue} disabled={loading}>
        Refresh
      </button>
      <a href="/" class="btn btn-outline-secondary btn-sm">Back to Dashboard</a>
    </div>
  </div>

  <p class="text-muted">Site ID: {siteId}</p>

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
  {:else if queue.length === 0}
    <div class="card">
      <div class="card-body text-center py-5">
        <h5 class="card-title mb-3">No Blueprints in Queue</h5>
        <p class="text-muted mb-4">
          Generate and approve blueprints first, then return here to generate page content.
        </p>
      </div>
    </div>
  {:else}

    <!-- ================================================================== -->
    <!-- HOMEPAGE — always first, pinned -->
    <!-- ================================================================== -->

    <div class="card mb-4 border-primary">
      <div class="card-header bg-primary text-white d-flex align-items-center">
        <span class="me-2" style="font-size: 1.25rem;">&#128204;</span>
        <strong>Homepage</strong>
        <span class="ms-2 text-white-50">(always generated first)</span>
      </div>
      <div class="card-body">
        {#if homepage}
          {@const badge = statusBadge(homepage.status)}
          <div class="d-flex justify-content-between align-items-center">
            <div>
              <h5 class="mb-1">{homepage.title}</h5>
              <span class="badge {badge.cls} me-2">{badge.text}</span>
              {#if homepage.sectionTotal > 0}
                <small class="text-muted">
                  Sections: {homepage.sectionsDone}/{homepage.sectionTotal}
                </small>
              {/if}
            </div>
            <div>
              {#if isGeneratingThis(homepage)}
                <button class="btn btn-warning btn-sm" disabled>
                  <span class="spinner-border spinner-border-sm me-1" role="status"></span>
                  {generating?.progress ?? 'Generating...'}
                </button>
              {:else if homepage.status === 'approved'}
                <span class="btn btn-success btn-sm" style="pointer-events: none;">
                  Approved &#10003;
                </span>
              {:else if homepage.status === 'generated'}
                <span class="btn btn-outline-info btn-sm" style="pointer-events: none;">
                  Generated &#10003;
                </span>
              {:else}
                <button
                  class="btn btn-primary btn-sm"
                  disabled={!!generating || batchGenerating}
                  onclick={() => generatePage(homepage!)}
                >
                  Generate
                </button>
              {/if}
            </div>
          </div>

          <!-- Progress bar when generating -->
          {#if homepage.status === 'generating' || isGeneratingThis(homepage)}
            <div class="progress mt-2" style="height: 6px;">
              <div
                class="progress-bar progress-bar-striped progress-bar-animated bg-warning"
                role="progressbar"
                style="width: {homepage.sectionTotal > 0 ? Math.round((homepage.sectionsDone / homepage.sectionTotal) * 100) : 50}%"
              ></div>
            </div>
          {/if}
        {:else}
          <p class="text-muted mb-0">
            No homepage blueprint found. Create a homepage blueprint first.
          </p>
        {/if}
      </div>
    </div>

    <!-- Homepage gate notice -->
    {#if homepageStatus !== 'approved'}
      <div class="alert alert-warning d-flex align-items-center" role="alert">
        <span class="me-2" style="font-size: 1.25rem;">&#128274;</span>
        <div>
          {#if homepageStatus === 'missing' || homepageStatus === 'pending'}
            <strong>Homepage must be generated first.</strong> All other pages are locked until the homepage is generated and approved.
          {:else if homepageStatus === 'generating'}
            <strong>Homepage generation in progress.</strong> Other pages will unlock once the homepage is approved.
          {:else if homepageStatus === 'generated'}
            <strong>Homepage needs approval.</strong> Approve the homepage to unlock generation for other pages.
          {/if}
        </div>
      </div>
    {/if}

    <!-- ================================================================== -->
    <!-- SERVICE PAGES -->
    <!-- ================================================================== -->

    {#if servicePages.length > 0}
      <div class="card mb-4">
        <div class="card-header d-flex align-items-center">
          {#if homepageStatus === 'approved'}
            <span class="me-2" style="font-size: 1.25rem;">&#128275;</span>
          {:else}
            <span class="me-2" style="font-size: 1.25rem;">&#128274;</span>
          {/if}
          <strong>Service Pages</strong>
          <span class="badge bg-secondary ms-2">{servicePages.length}</span>
        </div>
        <ul class="list-group list-group-flush">
          {#each servicePages as item (item.blueprintId)}
            {@const badge = statusBadge(item.status)}
            <li class="list-group-item d-flex justify-content-between align-items-center {item.locked ? 'bg-light' : ''}">
              <div class="d-flex align-items-center flex-grow-1">
                {#if item.locked}
                  <span class="me-2 text-muted" title={item.lockReason ?? ''}>&#128274;</span>
                {/if}
                <div>
                  <span class="fw-semibold">{item.title}</span>
                  <span class="badge {badge.cls} ms-2">{badge.text}</span>
                  {#if item.locked && item.lockReason}
                    <br><small class="text-muted">{item.lockReason}</small>
                  {/if}
                  {#if item.sectionTotal > 0 && !item.locked}
                    <br><small class="text-muted">Sections: {item.sectionsDone}/{item.sectionTotal}</small>
                  {/if}
                </div>
              </div>
              <div>
                {#if isGeneratingThis(item)}
                  <button class="btn btn-warning btn-sm" disabled>
                    <span class="spinner-border spinner-border-sm me-1" role="status"></span>
                    Generating...
                  </button>
                {:else if item.status === 'approved'}
                  <span class="btn btn-success btn-sm" style="pointer-events: none;">Approved &#10003;</span>
                {:else if item.status === 'generated'}
                  <span class="btn btn-outline-info btn-sm" style="pointer-events: none;">Generated &#10003;</span>
                {:else if canGenerate(item)}
                  <button class="btn btn-primary btn-sm" onclick={() => generatePage(item)}>
                    Generate
                  </button>
                {:else}
                  <button class="btn btn-outline-secondary btn-sm" disabled>Generate</button>
                {/if}
              </div>
            </li>
          {/each}
        </ul>
      </div>
    {/if}

    <!-- ================================================================== -->
    <!-- LOCATION / SUBURB PAGES -->
    <!-- ================================================================== -->

    {#if locationPages.length > 0}
      <div class="card mb-4">
        <div class="card-header d-flex justify-content-between align-items-center">
          <div class="d-flex align-items-center">
            {#if homepageStatus === 'approved'}
              <span class="me-2" style="font-size: 1.25rem;">&#128275;</span>
            {:else}
              <span class="me-2" style="font-size: 1.25rem;">&#128274;</span>
            {/if}
            <strong>Location Pages</strong>
            <span class="badge bg-secondary ms-2">{locationPages.length}</span>
          </div>
          <div class="d-flex align-items-center gap-3">
            <small class="text-muted">
              Individually approved: {approvedSuburbCount}/{batchUnlockThreshold} needed for batch
            </small>
            {#if batchUnlocked && generatableLocations.length > 0}
              <button
                class="btn btn-success btn-sm"
                disabled={!!generating || batchGenerating}
                onclick={batchGenerateLocations}
              >
                {#if batchGenerating}
                  <span class="spinner-border spinner-border-sm me-1" role="status"></span>
                {/if}
                Batch Generate All Remaining ({generatableLocations.length})
              </button>
            {:else if !batchUnlocked}
              <button class="btn btn-outline-secondary btn-sm" disabled title="Approve {batchUnlockThreshold} suburb pages individually first">
                &#128274; Batch Generate Locked
              </button>
            {/if}
          </div>
        </div>
        <ul class="list-group list-group-flush">
          {#each locationPages as item (item.blueprintId)}
            {@const badge = statusBadge(item.status)}
            <li class="list-group-item d-flex justify-content-between align-items-center {item.locked ? 'bg-light' : ''}">
              <div class="d-flex align-items-center flex-grow-1">
                {#if item.locked}
                  <span class="me-2 text-muted" title={item.lockReason ?? ''}>&#128274;</span>
                {/if}
                <div>
                  <span class="fw-semibold">{item.title}</span>
                  <span class="badge {badge.cls} ms-2">{badge.text}</span>
                  {#if item.locked && item.lockReason}
                    <br><small class="text-muted">{item.lockReason}</small>
                  {/if}
                  {#if item.sectionTotal > 0 && !item.locked}
                    <br><small class="text-muted">Sections: {item.sectionsDone}/{item.sectionTotal}</small>
                  {/if}
                </div>
              </div>
              <div>
                {#if isGeneratingThis(item)}
                  <button class="btn btn-warning btn-sm" disabled>
                    <span class="spinner-border spinner-border-sm me-1" role="status"></span>
                    Generating...
                  </button>
                {:else if item.status === 'approved'}
                  <span class="btn btn-success btn-sm" style="pointer-events: none;">Approved &#10003;</span>
                {:else if item.status === 'generated'}
                  <span class="btn btn-outline-info btn-sm" style="pointer-events: none;">Generated &#10003;</span>
                {:else if canGenerate(item)}
                  <button class="btn btn-primary btn-sm" onclick={() => generatePage(item)}>
                    Generate
                  </button>
                {:else}
                  <button class="btn btn-outline-secondary btn-sm" disabled>Generate</button>
                {/if}
              </div>
            </li>
          {/each}
        </ul>
      </div>
    {/if}

    <!-- ================================================================== -->
    <!-- OTHER PAGES (if any page_types beyond homepage/service/location) -->
    <!-- ================================================================== -->

    {#if otherPages.length > 0}
      <div class="card mb-4">
        <div class="card-header d-flex align-items-center">
          {#if homepageStatus === 'approved'}
            <span class="me-2" style="font-size: 1.25rem;">&#128275;</span>
          {:else}
            <span class="me-2" style="font-size: 1.25rem;">&#128274;</span>
          {/if}
          <strong>Other Pages</strong>
          <span class="badge bg-secondary ms-2">{otherPages.length}</span>
        </div>
        <ul class="list-group list-group-flush">
          {#each otherPages as item (item.blueprintId)}
            {@const badge = statusBadge(item.status)}
            <li class="list-group-item d-flex justify-content-between align-items-center {item.locked ? 'bg-light' : ''}">
              <div class="d-flex align-items-center flex-grow-1">
                {#if item.locked}
                  <span class="me-2 text-muted" title={item.lockReason ?? ''}>&#128274;</span>
                {/if}
                <div>
                  <span class="fw-semibold">{item.title}</span>
                  <code class="ms-1 text-muted">{pageTypeLabel(item.pageType)}</code>
                  <span class="badge {badge.cls} ms-2">{badge.text}</span>
                  {#if item.locked && item.lockReason}
                    <br><small class="text-muted">{item.lockReason}</small>
                  {/if}
                </div>
              </div>
              <div>
                {#if isGeneratingThis(item)}
                  <button class="btn btn-warning btn-sm" disabled>
                    <span class="spinner-border spinner-border-sm me-1" role="status"></span>
                    Generating...
                  </button>
                {:else if item.status === 'approved'}
                  <span class="btn btn-success btn-sm" style="pointer-events: none;">Approved &#10003;</span>
                {:else if item.status === 'generated'}
                  <span class="btn btn-outline-info btn-sm" style="pointer-events: none;">Generated &#10003;</span>
                {:else if canGenerate(item)}
                  <button class="btn btn-primary btn-sm" onclick={() => generatePage(item)}>
                    Generate
                  </button>
                {:else}
                  <button class="btn btn-outline-secondary btn-sm" disabled>Generate</button>
                {/if}
              </div>
            </li>
          {/each}
        </ul>
      </div>
    {/if}

  {/if}
</div>
