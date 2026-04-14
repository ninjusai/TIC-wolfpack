<script lang="ts">
  import { page } from '$app/state';
  import { onMount } from 'svelte';

  // ---------------------------------------------------------------------------
  // Types
  // ---------------------------------------------------------------------------

  interface BacklogItem {
    id: number;
    site_id: number;
    gap_analysis_id: number | null;
    page_type: string;
    target_url: string | null;
    action: string;
    priority: number;
    status: string;
    created_at: string;
  }

  interface BacklogResponse {
    siteId: number;
    totalItems: number;
    byAction: { create: number; improve: number; rewrite: number };
    byStatus: Record<string, number>;
    pageTypes: string[];
    backlog: BacklogItem[];
    message?: string;
    error?: string;
  }

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  let siteId: number = $derived(parseInt(page.params.siteId ?? '0', 10));

  let items: BacklogItem[] = $state([]);
  let loading = $state(true);
  let errorMsg = $state('');
  let successMsg = $state('');
  let approving = $state(false);
  let reordering = $state(false);
  let selectedIds: Set<number> = $state(new Set());
  let statusFilter = $state('all');

  // Summary stats
  let summary = $state<{ byAction: Record<string, number>; byStatus: Record<string, number> } | null>(null);

  // Filtered + sorted view
  let filteredItems: BacklogItem[] = $derived(
    statusFilter === 'all'
      ? [...items].sort((a, b) => a.priority - b.priority)
      : [...items].filter((i) => i.status === statusFilter).sort((a, b) => a.priority - b.priority)
  );

  let allSelected: boolean = $derived(
    filteredItems.length > 0 && filteredItems.every((i) => selectedIds.has(i.id))
  );

  let pendingCount: number = $derived(
    items.filter((i) => i.status === 'pending').length
  );

  // ---------------------------------------------------------------------------
  // Data loading
  // ---------------------------------------------------------------------------

  onMount(() => {
    loadBacklog();
  });

  async function loadBacklog() {
    loading = true;
    errorMsg = '';
    try {
      const res = await fetch(`/api/work-backlog/${siteId}`);
      const data: BacklogResponse = await res.json();
      if (res.ok) {
        items = data.backlog ?? [];
        summary = { byAction: data.byAction, byStatus: data.byStatus };
      } else if (res.status === 404) {
        items = [];
        summary = null;
      } else {
        errorMsg = data.error ?? 'Failed to load backlog';
      }
    } catch {
      errorMsg = 'Network error loading backlog';
    } finally {
      loading = false;
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
      selectedIds = new Set(filteredItems.map((i) => i.id));
    }
  }

  // ---------------------------------------------------------------------------
  // Approve
  // ---------------------------------------------------------------------------

  async function approveSelected() {
    const ids = [...selectedIds].filter((id) => {
      const item = items.find((i) => i.id === id);
      return item && item.status === 'pending';
    });
    if (ids.length === 0) {
      errorMsg = 'No pending items selected to approve.';
      return;
    }
    approving = true;
    errorMsg = '';
    successMsg = '';
    try {
      const res = await fetch(`/api/work-backlog/${siteId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemIds: ids }),
      });
      const data = await res.json();
      if (res.ok) {
        successMsg = data.message;
        selectedIds = new Set();
        await loadBacklog();
      } else {
        errorMsg = data.error ?? 'Approval failed';
      }
    } catch {
      errorMsg = 'Network error during approval';
    } finally {
      approving = false;
    }
  }

  async function approveAll() {
    const pendingIds = items.filter((i) => i.status === 'pending').map((i) => i.id);
    if (pendingIds.length === 0) {
      errorMsg = 'No pending items to approve.';
      return;
    }
    approving = true;
    errorMsg = '';
    successMsg = '';
    try {
      const res = await fetch(`/api/work-backlog/${siteId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemIds: pendingIds }),
      });
      const data = await res.json();
      if (res.ok) {
        successMsg = data.message;
        selectedIds = new Set();
        await loadBacklog();
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
  // Reorder (move up / move down)
  // ---------------------------------------------------------------------------

  async function moveItem(itemId: number, direction: 'up' | 'down') {
    const sorted = [...items].sort((a, b) => a.priority - b.priority);
    const idx = sorted.findIndex((i) => i.id === itemId);
    if (idx < 0) return;

    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;

    const current = sorted[idx];
    const swap = sorted[swapIdx];

    // DEC-031: homepage cannot move below position 1
    if (current.page_type === 'homepage' && direction === 'down') {
      errorMsg = 'DEC-031: Homepage must remain at position 1.';
      return;
    }
    // Cannot move a non-homepage item above homepage
    if (swap.page_type === 'homepage' && direction === 'up') {
      errorMsg = 'DEC-031: Cannot move items above homepage.';
      return;
    }

    reordering = true;
    errorMsg = '';
    successMsg = '';

    const reorderPayload = [
      { id: current.id, priority: swap.priority },
      { id: swap.id, priority: current.priority },
    ];

    try {
      const res = await fetch(`/api/work-backlog/${siteId}/reorder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: reorderPayload }),
      });
      const data = await res.json();
      if (res.ok) {
        await loadBacklog();
      } else {
        errorMsg = data.error ?? 'Reorder failed';
      }
    } catch {
      errorMsg = 'Network error during reorder';
    } finally {
      reordering = false;
    }
  }

  // ---------------------------------------------------------------------------
  // Display helpers
  // ---------------------------------------------------------------------------

  function actionBadgeClass(action: string): string {
    switch (action) {
      case 'create':
        return 'bg-primary';
      case 'improve':
        return 'bg-warning text-dark';
      case 'rewrite':
        return 'bg-danger';
      default:
        return 'bg-secondary';
    }
  }

  function statusBadgeClass(status: string): string {
    switch (status) {
      case 'pending':
        return 'bg-secondary';
      case 'blueprinted':
        return 'bg-info text-dark';
      case 'in_progress':
        return 'bg-primary';
      case 'generated':
        return 'bg-success';
      case 'approved':
        return 'bg-success';
      case 'skipped':
        return 'bg-dark';
      default:
        return 'bg-secondary';
    }
  }

  function isHomepage(item: BacklogItem): boolean {
    return item.page_type === 'homepage';
  }

  const STATUS_OPTIONS = ['all', 'pending', 'blueprinted', 'in_progress', 'generated', 'approved', 'skipped'];
</script>

<div class="container mt-4 mb-5">
  <!-- Header -->
  <div class="d-flex justify-content-between align-items-center mb-3">
    <h1>Work Backlog</h1>
    <a href="/" class="btn btn-outline-secondary btn-sm">Back to Dashboard</a>
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
  {:else if items.length === 0}
    <div class="card">
      <div class="card-body text-center py-5">
        <h5 class="card-title mb-3">No Backlog Items</h5>
        <p class="text-muted mb-4">
          Run missing page identification first to populate the backlog.
        </p>
      </div>
    </div>
  {:else}
    <!-- Summary Cards -->
    {#if summary}
      <div class="row mb-4">
        <div class="col-md-4">
          <div class="card">
            <div class="card-body">
              <h6 class="card-subtitle mb-2 text-muted">Total Items</h6>
              <h3>{items.length}</h3>
            </div>
          </div>
        </div>
        <div class="col-md-4">
          <div class="card">
            <div class="card-body">
              <h6 class="card-subtitle mb-2 text-muted">By Action</h6>
              <span class="badge bg-primary me-1">Create: {summary.byAction.create ?? 0}</span>
              <span class="badge bg-warning text-dark me-1">Improve: {summary.byAction.improve ?? 0}</span>
              <span class="badge bg-danger">Rewrite: {summary.byAction.rewrite ?? 0}</span>
            </div>
          </div>
        </div>
        <div class="col-md-4">
          <div class="card">
            <div class="card-body">
              <h6 class="card-subtitle mb-2 text-muted">Pending Approval</h6>
              <h3>{pendingCount}</h3>
            </div>
          </div>
        </div>
      </div>
    {/if}

    <!-- Controls -->
    <div class="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
      <div class="d-flex gap-2 align-items-center">
        <label for="statusFilter" class="form-label mb-0 fw-bold">Filter:</label>
        <select
          id="statusFilter"
          class="form-select form-select-sm"
          style="width: auto;"
          bind:value={statusFilter}
        >
          {#each STATUS_OPTIONS as opt}
            <option value={opt}>{opt === 'all' ? 'All Statuses' : opt.replace('_', ' ')}</option>
          {/each}
        </select>
      </div>

      <div class="d-flex gap-2">
        <button
          class="btn btn-success btn-sm"
          disabled={approving || pendingCount === 0}
          onclick={approveAll}
        >
          {#if approving}
            <span class="spinner-border spinner-border-sm me-1" role="status"></span>
          {/if}
          Approve All ({pendingCount})
        </button>
        <button
          class="btn btn-outline-success btn-sm"
          disabled={approving || selectedIds.size === 0}
          onclick={approveSelected}
        >
          Approve Selected ({selectedIds.size})
        </button>
      </div>
    </div>

    <!-- Backlog Table -->
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
            <th>Page Type</th>
            <th>Target URL</th>
            <th>Action</th>
            <th>Priority</th>
            <th>Status</th>
            <th>Gap ID</th>
            <th style="width: 100px;">Reorder</th>
          </tr>
        </thead>
        <tbody>
          {#each filteredItems as item, idx (item.id)}
            <tr class={isHomepage(item) ? 'table-info' : ''}>
              <td>
                <input
                  type="checkbox"
                  class="form-check-input"
                  checked={selectedIds.has(item.id)}
                  onchange={() => toggleSelect(item.id)}
                />
              </td>
              <td>
                {idx + 1}
                {#if isHomepage(item)}
                  <span class="badge bg-info text-dark ms-1" title="DEC-031: Homepage always first">HP</span>
                {/if}
              </td>
              <td>{item.page_type}</td>
              <td>
                {#if item.target_url}
                  <code>{item.target_url}</code>
                {:else}
                  <span class="text-muted">--</span>
                {/if}
              </td>
              <td>
                <span class="badge {actionBadgeClass(item.action)}">{item.action}</span>
              </td>
              <td>{item.priority}</td>
              <td>
                <span class="badge {statusBadgeClass(item.status)}">{item.status.replace('_', ' ')}</span>
              </td>
              <td>
                {#if item.gap_analysis_id}
                  {item.gap_analysis_id}
                {:else}
                  <span class="text-muted">--</span>
                {/if}
              </td>
              <td>
                <div class="btn-group btn-group-sm">
                  <button
                    class="btn btn-outline-secondary"
                    title="Move up"
                    disabled={reordering || idx === 0}
                    onclick={() => moveItem(item.id, 'up')}
                  >
                    &uarr;
                  </button>
                  <button
                    class="btn btn-outline-secondary"
                    title="Move down"
                    disabled={reordering || idx === filteredItems.length - 1}
                    onclick={() => moveItem(item.id, 'down')}
                  >
                    &darr;
                  </button>
                </div>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    <!-- Legend -->
    <div class="card mt-3">
      <div class="card-body py-2">
        <small class="text-muted">
          <strong>Legend:</strong>
          <span class="badge bg-primary me-1">create</span> New page needed
          <span class="badge bg-warning text-dark me-1 ms-2">improve</span> Existing page needs enhancement
          <span class="badge bg-danger me-1 ms-2">rewrite</span> Existing page needs full rewrite
          &bull;
          <span class="badge bg-info text-dark ms-2">HP</span> = Homepage (DEC-031: always first)
        </small>
      </div>
    </div>
  {/if}
</div>
