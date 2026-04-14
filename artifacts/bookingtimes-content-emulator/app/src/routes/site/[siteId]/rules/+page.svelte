<script lang="ts">
  import { page } from '$app/state';
  import { onMount } from 'svelte';

  // ---------------------------------------------------------------------------
  // Types
  // ---------------------------------------------------------------------------

  interface BrandRule {
    id: number;
    site_id: number;
    category: string;
    rule_text: string;
    priority: number;
    source: string;
    scope: string;
    page_type: string | null;
    section_type: string | null;
    confidence: number;
    confirmed: number;
    source_session_id: string | null;
    active: number;
    created_at: string;
  }

  interface EvolutionEntry {
    id: number;
    snapshot_date: string;
    reason: string;
    trigger_type: string;
  }

  // ---------------------------------------------------------------------------
  // Constants
  // ---------------------------------------------------------------------------

  const CATEGORIES = [
    'voice', 'structure', 'terminology', 'seo', 'geo',
    'localization', 'visual', 'schema', 'linking', 'anti-pattern'
  ];

  const SCOPES = ['global', 'brand', 'page_type', 'section_type', 'page'];

  const SOURCES = ['manual', 'feedback', 'inferred', 'research'];

  const categoryColors: Record<string, string> = {
    'voice': '#6f42c1',
    'structure': '#0d6efd',
    'terminology': '#198754',
    'seo': '#fd7e14',
    'geo': '#20c997',
    'localization': '#0dcaf0',
    'visual': '#e91e8a',
    'schema': '#6610f2',
    'linking': '#ffc107',
    'anti-pattern': '#dc3545'
  };

  const sourceColors: Record<string, string> = {
    'manual': 'primary',
    'feedback': 'warning',
    'inferred': 'success',
    'research': 'purple'
  };

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  let siteId: number = $derived(parseInt(page.params.siteId ?? '0', 10));

  let rules: BrandRule[] = $state([]);
  let evolution: EvolutionEntry[] = $state([]);
  let loading = $state(true);
  let loadingEvolution = $state(true);
  let errorMsg = $state('');
  let successMsg = $state('');

  // Filters
  let scopeFilter = $state('all');
  let categoryFilter = $state('all');
  let sourceFilter = $state('all');
  let showInactive = $state(false);

  // Inline editing
  let editingRuleId: number | null = $state(null);
  let editText = $state('');
  let editPriority = $state(0);

  // New rule form
  let showNewForm = $state(false);
  let newCategory = $state('voice');
  let newRuleText = $state('');
  let newScope = $state('brand');
  let newSource = $state('manual');
  let newPriority = $state(0);

  // Active tab
  let activeTab = $state<'rules' | 'timeline'>('rules');

  // Saving states
  let saving = $state(false);

  // ---------------------------------------------------------------------------
  // Derived
  // ---------------------------------------------------------------------------

  let filteredRules: BrandRule[] = $derived(
    rules
      .filter((r) => {
        if (!showInactive && !r.active) return false;
        if (scopeFilter !== 'all' && r.scope !== scopeFilter) return false;
        if (categoryFilter !== 'all' && r.category !== categoryFilter) return false;
        if (sourceFilter !== 'all' && r.source !== sourceFilter) return false;
        return true;
      })
      .sort((a, b) => b.priority - a.priority || a.category.localeCompare(b.category))
  );

  let ruleStats = $derived({
    total: rules.length,
    active: rules.filter((r) => r.active).length,
    confirmed: rules.filter((r) => r.confirmed).length,
    byCategory: CATEGORIES.reduce((acc, cat) => {
      acc[cat] = rules.filter((r) => r.category === cat && r.active).length;
      return acc;
    }, {} as Record<string, number>)
  });

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  onMount(() => {
    loadRules();
    loadEvolution();
  });

  // ---------------------------------------------------------------------------
  // Data loading
  // ---------------------------------------------------------------------------

  async function loadRules() {
    loading = true;
    errorMsg = '';
    try {
      const res = await fetch(`/api/rules/${siteId}`);
      if (res.ok) {
        const data = await res.json();
        rules = data.rules;
      } else {
        const data = await res.json();
        errorMsg = data.error || 'Failed to load rules';
      }
    } catch {
      errorMsg = 'Network error loading rules';
    } finally {
      loading = false;
    }
  }

  async function loadEvolution() {
    loadingEvolution = true;
    try {
      const res = await fetch(`/api/feedback/evolution/${siteId}`);
      if (res.ok) {
        const data = await res.json();
        evolution = data.evolution || [];
      }
    } catch {
      // Non-critical, silently fail
    } finally {
      loadingEvolution = false;
    }
  }

  // ---------------------------------------------------------------------------
  // Rule CRUD
  // ---------------------------------------------------------------------------

  async function createRule() {
    if (!newRuleText.trim()) return;
    saving = true;
    errorMsg = '';
    try {
      const res = await fetch(`/api/rules/${siteId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: newCategory,
          rule_text: newRuleText.trim(),
          scope: newScope,
          source: newSource,
          priority: newPriority
        })
      });
      if (res.ok) {
        successMsg = 'Rule created successfully';
        showNewForm = false;
        newRuleText = '';
        newPriority = 0;
        await loadRules();
      } else {
        const data = await res.json();
        errorMsg = data.error || 'Failed to create rule';
      }
    } catch {
      errorMsg = 'Network error creating rule';
    } finally {
      saving = false;
    }
  }

  async function updateRule(ruleId: number, updates: Record<string, unknown>) {
    saving = true;
    errorMsg = '';
    try {
      const res = await fetch(`/api/rules/${siteId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ruleId, updates })
      });
      if (res.ok) {
        const data = await res.json();
        rules = rules.map((r) => (r.id === ruleId ? data.rule : r));
        successMsg = 'Rule updated';
      } else {
        const data = await res.json();
        errorMsg = data.error || 'Failed to update rule';
      }
    } catch {
      errorMsg = 'Network error updating rule';
    } finally {
      saving = false;
    }
  }

  async function deactivateRule(ruleId: number) {
    errorMsg = '';
    try {
      const res = await fetch(`/api/rules/${siteId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ruleId })
      });
      if (res.ok) {
        rules = rules.map((r) => (r.id === ruleId ? { ...r, active: 0 } : r));
        successMsg = 'Rule deactivated';
      } else {
        const data = await res.json();
        errorMsg = data.error || 'Failed to deactivate rule';
      }
    } catch {
      errorMsg = 'Network error deactivating rule';
    }
  }

  function toggleActive(rule: BrandRule) {
    updateRule(rule.id, { active: rule.active ? 0 : 1 });
  }

  function toggleConfirmed(rule: BrandRule) {
    updateRule(rule.id, { confirmed: rule.confirmed ? 0 : 1 });
  }

  function startEdit(rule: BrandRule) {
    editingRuleId = rule.id;
    editText = rule.rule_text;
    editPriority = rule.priority;
  }

  function cancelEdit() {
    editingRuleId = null;
    editText = '';
    editPriority = 0;
  }

  function saveEdit(ruleId: number) {
    updateRule(ruleId, { rule_text: editText, priority: editPriority });
    editingRuleId = null;
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  function formatDate(dateStr: string): string {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  }

  function sourceBadgeClass(source: string): string {
    const map: Record<string, string> = {
      'manual': 'bg-primary',
      'feedback': 'bg-warning text-dark',
      'inferred': 'bg-success',
      'research': 'bg-purple'
    };
    return map[source] || 'bg-secondary';
  }
</script>

<style>
  .bg-purple {
    background-color: #6f42c1 !important;
    color: #fff;
  }
  .rule-inactive {
    opacity: 0.5;
  }
  .category-badge {
    display: inline-block;
    padding: 0.2em 0.6em;
    border-radius: 0.25rem;
    font-size: 0.75rem;
    font-weight: 600;
    color: #fff;
  }
  .timeline-container {
    position: relative;
    padding-left: 2rem;
  }
  .timeline-container::before {
    content: '';
    position: absolute;
    left: 0.75rem;
    top: 0;
    bottom: 0;
    width: 2px;
    background: #dee2e6;
  }
  .timeline-item {
    position: relative;
    margin-bottom: 1.5rem;
    padding-left: 1rem;
  }
  .timeline-dot {
    position: absolute;
    left: -1.65rem;
    top: 0.35rem;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: #0d6efd;
    border: 2px solid #fff;
    box-shadow: 0 0 0 2px #dee2e6;
  }
  .timeline-dot.feedback { background: #ffc107; }
  .timeline-dot.manual { background: #0d6efd; }
  .timeline-dot.inferred { background: #198754; }
  .timeline-dot.research { background: #6f42c1; }
  .edit-inline {
    display: flex;
    gap: 0.5rem;
    align-items: flex-start;
  }
  .stat-card {
    text-align: center;
    padding: 0.75rem;
  }
  .stat-card .stat-number {
    font-size: 1.5rem;
    font-weight: 700;
  }
  .scope-badge {
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
</style>

<div class="container mt-4 mb-5">
  <!-- Header -->
  <div class="d-flex justify-content-between align-items-center mb-3">
    <h1 class="h3 mb-0">Brand Rules</h1>
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
  {:else}
    <!-- Stats Row -->
    <div class="row mb-4">
      <div class="col-md-3">
        <div class="card stat-card">
          <div class="stat-number text-primary">{ruleStats.total}</div>
          <small class="text-muted">Total Rules</small>
        </div>
      </div>
      <div class="col-md-3">
        <div class="card stat-card">
          <div class="stat-number text-success">{ruleStats.active}</div>
          <small class="text-muted">Active</small>
        </div>
      </div>
      <div class="col-md-3">
        <div class="card stat-card">
          <div class="stat-number text-info">{ruleStats.confirmed}</div>
          <small class="text-muted">Confirmed</small>
        </div>
      </div>
      <div class="col-md-3">
        <div class="card stat-card">
          <div class="stat-number text-warning">{ruleStats.total - ruleStats.active}</div>
          <small class="text-muted">Inactive</small>
        </div>
      </div>
    </div>

    <!-- Tabs -->
    <ul class="nav nav-tabs mb-3">
      <li class="nav-item">
        <button
          class="nav-link"
          class:active={activeTab === 'rules'}
          onclick={() => activeTab = 'rules'}
        >
          Rules ({ruleStats.active})
        </button>
      </li>
      <li class="nav-item">
        <button
          class="nav-link"
          class:active={activeTab === 'timeline'}
          onclick={() => activeTab = 'timeline'}
        >
          Profile Evolution
        </button>
      </li>
    </ul>

    <!-- Rules Tab -->
    {#if activeTab === 'rules'}
      <!-- Filters -->
      <div class="card mb-3">
        <div class="card-body">
          <div class="row g-2 align-items-end">
            <div class="col-md-3">
              <label class="form-label form-label-sm mb-1">Scope</label>
              <select class="form-select form-select-sm" bind:value={scopeFilter}>
                <option value="all">All Scopes</option>
                {#each SCOPES as s}
                  <option value={s}>{s}</option>
                {/each}
              </select>
            </div>
            <div class="col-md-3">
              <label class="form-label form-label-sm mb-1">Category</label>
              <select class="form-select form-select-sm" bind:value={categoryFilter}>
                <option value="all">All Categories</option>
                {#each CATEGORIES as c}
                  <option value={c}>{c}</option>
                {/each}
              </select>
            </div>
            <div class="col-md-3">
              <label class="form-label form-label-sm mb-1">Source</label>
              <select class="form-select form-select-sm" bind:value={sourceFilter}>
                <option value="all">All Sources</option>
                {#each SOURCES as s}
                  <option value={s}>{s}</option>
                {/each}
              </select>
            </div>
            <div class="col-md-3 d-flex align-items-center gap-3">
              <div class="form-check">
                <input
                  class="form-check-input"
                  type="checkbox"
                  id="showInactive"
                  bind:checked={showInactive}
                />
                <label class="form-check-label small" for="showInactive">Show inactive</label>
              </div>
              <button
                class="btn btn-primary btn-sm"
                onclick={() => showNewForm = !showNewForm}
              >
                {showNewForm ? 'Cancel' : '+ Add Rule'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- New Rule Form -->
      {#if showNewForm}
        <div class="card mb-3 border-primary">
          <div class="card-header bg-primary text-white">New Rule</div>
          <div class="card-body">
            <div class="row g-3">
              <div class="col-md-3">
                <label class="form-label">Category</label>
                <select class="form-select form-select-sm" bind:value={newCategory}>
                  {#each CATEGORIES as c}
                    <option value={c}>{c}</option>
                  {/each}
                </select>
              </div>
              <div class="col-md-3">
                <label class="form-label">Scope</label>
                <select class="form-select form-select-sm" bind:value={newScope}>
                  {#each SCOPES as s}
                    <option value={s}>{s}</option>
                  {/each}
                </select>
              </div>
              <div class="col-md-3">
                <label class="form-label">Source</label>
                <select class="form-select form-select-sm" bind:value={newSource}>
                  {#each SOURCES as s}
                    <option value={s}>{s}</option>
                  {/each}
                </select>
              </div>
              <div class="col-md-3">
                <label class="form-label">Priority</label>
                <input type="number" class="form-control form-control-sm" bind:value={newPriority} min={0} />
              </div>
              <div class="col-12">
                <label class="form-label">Rule Text</label>
                <textarea class="form-control" rows={2} bind:value={newRuleText} placeholder="Describe the brand rule..."></textarea>
              </div>
              <div class="col-12">
                <button class="btn btn-primary btn-sm" onclick={createRule} disabled={saving || !newRuleText.trim()}>
                  {#if saving}
                    <span class="spinner-border spinner-border-sm me-1" role="status"></span>
                    Creating...
                  {:else}
                    Create Rule
                  {/if}
                </button>
              </div>
            </div>
          </div>
        </div>
      {/if}

      <!-- Rules Table -->
      {#if filteredRules.length === 0}
        <div class="card">
          <div class="card-body text-center py-4 text-muted">
            No rules found matching the current filters.
          </div>
        </div>
      {:else}
        <div class="table-responsive">
          <table class="table table-hover align-middle">
            <thead class="table-light">
              <tr>
                <th style="width: 120px">Category</th>
                <th>Rule Text</th>
                <th style="width: 100px">Scope</th>
                <th style="width: 70px">Priority</th>
                <th style="width: 90px">Source</th>
                <th style="width: 80px">Confirmed</th>
                <th style="width: 70px">Active</th>
                <th style="width: 140px">Actions</th>
              </tr>
            </thead>
            <tbody>
              {#each filteredRules as rule (rule.id)}
                <tr class:rule-inactive={!rule.active}>
                  <!-- Category -->
                  <td>
                    <span
                      class="category-badge"
                      style="background-color: {categoryColors[rule.category] || '#6c757d'}"
                    >
                      {rule.category}
                    </span>
                  </td>

                  <!-- Rule Text -->
                  <td>
                    {#if editingRuleId === rule.id}
                      <div class="edit-inline">
                        <textarea class="form-control form-control-sm" rows={2} bind:value={editText}></textarea>
                      </div>
                    {:else}
                      <span class="small">{rule.rule_text}</span>
                      {#if rule.page_type}
                        <br /><span class="badge bg-light text-dark scope-badge">page_type: {rule.page_type}</span>
                      {/if}
                      {#if rule.section_type}
                        <br /><span class="badge bg-light text-dark scope-badge">section_type: {rule.section_type}</span>
                      {/if}
                    {/if}
                  </td>

                  <!-- Scope -->
                  <td>
                    <span class="badge bg-secondary scope-badge">{rule.scope}</span>
                  </td>

                  <!-- Priority -->
                  <td>
                    {#if editingRuleId === rule.id}
                      <input type="number" class="form-control form-control-sm" style="width: 60px" bind:value={editPriority} min={0} />
                    {:else}
                      <span class="fw-bold">{rule.priority}</span>
                    {/if}
                  </td>

                  <!-- Source -->
                  <td>
                    <span class="badge {sourceBadgeClass(rule.source)}">{rule.source}</span>
                  </td>

                  <!-- Confirmed -->
                  <td class="text-center">
                    <button
                      class="btn btn-sm p-0 border-0"
                      title={rule.confirmed ? 'Unconfirm' : 'Confirm'}
                      onclick={() => toggleConfirmed(rule)}
                    >
                      {#if rule.confirmed}
                        <span class="text-success fs-5">&#10003;</span>
                      {:else}
                        <span class="text-muted fs-5">&#9675;</span>
                      {/if}
                    </button>
                  </td>

                  <!-- Active -->
                  <td class="text-center">
                    <div class="form-check form-switch d-flex justify-content-center">
                      <input
                        class="form-check-input"
                        type="checkbox"
                        role="switch"
                        checked={!!rule.active}
                        onchange={() => toggleActive(rule)}
                      />
                    </div>
                  </td>

                  <!-- Actions -->
                  <td>
                    {#if editingRuleId === rule.id}
                      <button class="btn btn-success btn-sm me-1" onclick={() => saveEdit(rule.id)} disabled={saving}>Save</button>
                      <button class="btn btn-outline-secondary btn-sm" onclick={cancelEdit}>Cancel</button>
                    {:else}
                      <button class="btn btn-outline-primary btn-sm me-1" onclick={() => startEdit(rule)} title="Edit">
                        Edit
                      </button>
                      {#if rule.active}
                        <button class="btn btn-outline-danger btn-sm" onclick={() => deactivateRule(rule.id)} title="Deactivate">
                          Del
                        </button>
                      {/if}
                    {/if}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
        <p class="text-muted small">Showing {filteredRules.length} of {rules.length} rules</p>
      {/if}

    <!-- Timeline Tab -->
    {:else if activeTab === 'timeline'}
      <div class="card">
        <div class="card-header"><strong>Brand Profile Evolution</strong></div>
        <div class="card-body">
          {#if loadingEvolution}
            <div class="text-center py-4">
              <div class="spinner-border spinner-border-sm" role="status">
                <span class="visually-hidden">Loading...</span>
              </div>
            </div>
          {:else if evolution.length === 0}
            <p class="text-muted text-center py-3">No profile evolution history yet.</p>
          {:else}
            <div class="timeline-container">
              {#each evolution as entry}
                <div class="timeline-item">
                  <div class="timeline-dot {entry.trigger_type || ''}"></div>
                  <div>
                    <div class="d-flex justify-content-between align-items-start">
                      <strong class="small">{formatDate(entry.snapshot_date)}</strong>
                      {#if entry.trigger_type}
                        <span class="badge {sourceBadgeClass(entry.trigger_type)} ms-2">{entry.trigger_type}</span>
                      {/if}
                    </div>
                    <p class="mb-0 small text-muted mt-1">{entry.reason}</p>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      </div>
    {/if}
  {/if}
</div>
