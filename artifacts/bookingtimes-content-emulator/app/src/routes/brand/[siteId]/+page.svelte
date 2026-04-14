<script lang="ts">
  import { page } from '$app/state';
  import { onMount } from 'svelte';

  interface TerminologyPattern {
    use: string;
    avoid: string;
  }

  interface BrandProfile {
    siteId: number;
    voiceDescription: string;
    toneKeywords: string[];
    terminologyPatterns: TerminologyPattern[];
    sentenceStyle: string;
    recurringPhrases: string[];
    antiPatterns: string[];
    targetAudience?: string;
    keyDifferentiators?: string;
    brandPersonality?: string;
    inferenceConfidence: number;
    sourcePageCount: number;
    userConfirmed?: boolean;
  }

  let siteId: number = $derived(parseInt(page.params.siteId ?? '0', 10));
  let profile: BrandProfile | null = $state(null);
  let loading = $state(true);
  let inferring = $state(false);
  let saving = $state(false);
  let confirming = $state(false);
  let errorMsg = $state('');
  let successMsg = $state('');

  // Editable form fields
  let voiceDescription = $state('');
  let toneKeywordsText = $state('');
  let sentenceStyle = $state('');
  let recurringPhrasesText = $state('');
  let antiPatternsText = $state('');
  let targetAudience = $state('');
  let keyDifferentiators = $state('');
  let brandPersonality = $state('');
  let terminologyPatterns: TerminologyPattern[] = $state([]);

  onMount(() => {
    loadProfile();
  });

  async function loadProfile() {
    loading = true;
    errorMsg = '';
    try {
      const res = await fetch(`/api/brand/${siteId}`);
      if (res.ok) {
        const data = await res.json();
        profile = data.profile;
        populateForm();
      } else if (res.status === 404) {
        profile = null;
      } else {
        const data = await res.json();
        errorMsg = data.error || 'Failed to load profile';
      }
    } catch (err) {
      errorMsg = 'Network error loading profile';
    } finally {
      loading = false;
    }
  }

  function populateForm() {
    if (!profile) return;
    voiceDescription = profile.voiceDescription;
    toneKeywordsText = profile.toneKeywords.join(', ');
    sentenceStyle = profile.sentenceStyle;
    recurringPhrasesText = profile.recurringPhrases.join(', ');
    antiPatternsText = profile.antiPatterns.join(', ');
    targetAudience = profile.targetAudience || '';
    keyDifferentiators = profile.keyDifferentiators || '';
    brandPersonality = profile.brandPersonality || '';
    terminologyPatterns = profile.terminologyPatterns.length > 0
      ? [...profile.terminologyPatterns]
      : [{ use: '', avoid: '' }];
  }

  async function runInference() {
    inferring = true;
    errorMsg = '';
    successMsg = '';
    try {
      const res = await fetch(`/api/brand/infer/${siteId}`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        profile = data.profile;
        populateForm();
        successMsg = 'Brand voice inferred successfully.';
        if (data.warning) {
          successMsg += ' ' + data.warning;
        }
      } else {
        errorMsg = data.error || 'Inference failed';
      }
    } catch (err) {
      errorMsg = 'Network error during inference';
    } finally {
      inferring = false;
    }
  }

  async function saveProfile() {
    saving = true;
    errorMsg = '';
    successMsg = '';

    const updates = {
      voiceDescription,
      toneKeywords: toneKeywordsText.split(',').map((s: string) => s.trim()).filter(Boolean),
      sentenceStyle,
      recurringPhrases: recurringPhrasesText.split(',').map((s: string) => s.trim()).filter(Boolean),
      antiPatterns: antiPatternsText.split(',').map((s: string) => s.trim()).filter(Boolean),
      targetAudience: targetAudience || undefined,
      keyDifferentiators: keyDifferentiators || undefined,
      brandPersonality: brandPersonality || undefined,
      terminologyPatterns: terminologyPatterns.filter((tp: TerminologyPattern) => tp.use || tp.avoid),
    };

    try {
      const res = await fetch(`/api/brand/${siteId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      if (res.ok) {
        profile = data.profile;
        populateForm();
        successMsg = 'Profile saved.';
      } else {
        errorMsg = data.error || 'Save failed';
      }
    } catch (err) {
      errorMsg = 'Network error saving profile';
    } finally {
      saving = false;
    }
  }

  async function confirmProfile() {
    confirming = true;
    errorMsg = '';
    successMsg = '';
    try {
      const res = await fetch(`/api/brand/${siteId}/confirm`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        profile = data.profile;
        populateForm();
        successMsg = 'Profile confirmed!';
      } else {
        errorMsg = data.error || 'Confirm failed';
      }
    } catch (err) {
      errorMsg = 'Network error confirming profile';
    } finally {
      confirming = false;
    }
  }

  function addTerminologyRow() {
    terminologyPatterns = [...terminologyPatterns, { use: '', avoid: '' }];
  }

  function removeTerminologyRow(index: number) {
    terminologyPatterns = terminologyPatterns.filter((_: TerminologyPattern, i: number) => i !== index);
  }

  function confidenceColor(confidence: number): string {
    if (confidence >= 0.7) return 'success';
    if (confidence >= 0.5) return 'warning';
    return 'danger';
  }

  function confidenceLabel(confidence: number): string {
    if (confidence >= 0.7) return 'High';
    if (confidence >= 0.5) return 'Medium';
    return 'Low';
  }
</script>

<div class="container mt-4 mb-5">
  <div class="d-flex justify-content-between align-items-center mb-3">
    <h1>Brand Voice Profile</h1>
    <a href="/" class="btn btn-outline-secondary btn-sm">Back to Dashboard</a>
  </div>

  <p class="text-muted">Site ID: {siteId}</p>

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
  {:else if !profile}
    <div class="card">
      <div class="card-body text-center py-5">
        <h5 class="card-title mb-3">No Brand Profile Yet</h5>
        <p class="text-muted mb-4">
          Run brand voice inference to analyze scraped content and generate a brand profile.
        </p>
        <button
          class="btn btn-primary"
          onclick={runInference}
          disabled={inferring}
        >
          {#if inferring}
            <span class="spinner-border spinner-border-sm me-1" role="status"></span>
            Inferring...
          {:else}
            Infer Brand Voice
          {/if}
        </button>
      </div>
    </div>
  {:else}
    <!-- Confidence Indicator -->
    <div class="card mb-4">
      <div class="card-body">
        <div class="d-flex justify-content-between align-items-center mb-2">
          <strong>Inference Confidence</strong>
          <span class="badge bg-{confidenceColor(profile.inferenceConfidence)}">
            {confidenceLabel(profile.inferenceConfidence)} ({(profile.inferenceConfidence * 100).toFixed(0)}%)
          </span>
        </div>
        <div class="progress" style="height: 8px;">
          <div
            class="progress-bar bg-{confidenceColor(profile.inferenceConfidence)}"
            role="progressbar"
            style="width: {profile.inferenceConfidence * 100}%"
            aria-valuenow={profile.inferenceConfidence * 100}
            aria-valuemin={0}
            aria-valuemax={100}
          ></div>
        </div>
        <small class="text-muted mt-1 d-block">
          Based on {profile.sourcePageCount} page(s).
          {#if profile.inferenceConfidence < 0.5}
            Scrape more pages for better accuracy.
          {/if}
        </small>

        {#if profile.inferenceConfidence < 0.5}
          <div class="alert alert-warning mt-3 mb-0" role="alert">
            <strong>Low Confidence Warning:</strong>
            Only {profile.sourcePageCount} page(s) were analyzed.
            For a reliable brand voice profile, at least 5 pages are recommended (10 for full confidence).
          </div>
        {/if}

        {#if profile.userConfirmed}
          <div class="alert alert-info mt-3 mb-0" role="alert">
            This profile has been confirmed by an operator.
          </div>
        {/if}
      </div>
    </div>

    <!-- Editable Form -->
    <form onsubmit={(e: SubmitEvent) => { e.preventDefault(); saveProfile(); }}>
      <div class="card mb-3">
        <div class="card-header"><strong>Voice &amp; Tone</strong></div>
        <div class="card-body">
          <div class="mb-3">
            <label for="voiceDescription" class="form-label">Voice Description</label>
            <textarea
              id="voiceDescription"
              class="form-control"
              rows={3}
              bind:value={voiceDescription}
            ></textarea>
          </div>
          <div class="mb-3">
            <label for="toneKeywords" class="form-label">Tone Keywords</label>
            <input
              id="toneKeywords"
              type="text"
              class="form-control"
              placeholder="e.g. professional, warm, authoritative"
              bind:value={toneKeywordsText}
            />
            <div class="form-text">Comma-separated adjectives</div>
          </div>
          <div class="mb-3">
            <label for="brandPersonality" class="form-label">Brand Personality</label>
            <textarea
              id="brandPersonality"
              class="form-control"
              rows={2}
              bind:value={brandPersonality}
            ></textarea>
          </div>
        </div>
      </div>

      <div class="card mb-3">
        <div class="card-header"><strong>Writing Style</strong></div>
        <div class="card-body">
          <div class="mb-3">
            <label for="sentenceStyle" class="form-label">Sentence Style</label>
            <textarea
              id="sentenceStyle"
              class="form-control"
              rows={2}
              bind:value={sentenceStyle}
            ></textarea>
          </div>
          <div class="mb-3">
            <label for="recurringPhrases" class="form-label">Recurring Phrases</label>
            <input
              id="recurringPhrases"
              type="text"
              class="form-control"
              bind:value={recurringPhrasesText}
            />
            <div class="form-text">Comma-separated phrases</div>
          </div>
          <div class="mb-3">
            <label for="antiPatterns" class="form-label">Anti-Patterns (things the brand avoids)</label>
            <input
              id="antiPatterns"
              type="text"
              class="form-control"
              bind:value={antiPatternsText}
            />
            <div class="form-text">Comma-separated patterns</div>
          </div>
        </div>
      </div>

      <div class="card mb-3">
        <div class="card-header">
          <div class="d-flex justify-content-between align-items-center">
            <strong>Terminology Patterns</strong>
            <button type="button" class="btn btn-outline-primary btn-sm" onclick={addTerminologyRow}>
              + Add Row
            </button>
          </div>
        </div>
        <div class="card-body">
          {#if terminologyPatterns.length === 0}
            <p class="text-muted">No terminology patterns defined.</p>
          {:else}
            <div class="row mb-2">
              <div class="col-5"><strong>Use</strong></div>
              <div class="col-5"><strong>Avoid</strong></div>
              <div class="col-2"></div>
            </div>
            {#each terminologyPatterns as tp, i}
              <div class="row mb-2">
                <div class="col-5">
                  <input type="text" class="form-control form-control-sm" bind:value={tp.use} placeholder="Preferred term" />
                </div>
                <div class="col-5">
                  <input type="text" class="form-control form-control-sm" bind:value={tp.avoid} placeholder="Term to avoid" />
                </div>
                <div class="col-2">
                  <button type="button" class="btn btn-outline-danger btn-sm" onclick={() => removeTerminologyRow(i)}>
                    Remove
                  </button>
                </div>
              </div>
            {/each}
          {/if}
        </div>
      </div>

      <div class="card mb-3">
        <div class="card-header"><strong>Audience &amp; Differentiation</strong></div>
        <div class="card-body">
          <div class="mb-3">
            <label for="targetAudience" class="form-label">Target Audience</label>
            <input
              id="targetAudience"
              type="text"
              class="form-control"
              bind:value={targetAudience}
            />
          </div>
          <div class="mb-3">
            <label for="keyDifferentiators" class="form-label">Key Differentiators</label>
            <input
              id="keyDifferentiators"
              type="text"
              class="form-control"
              bind:value={keyDifferentiators}
            />
          </div>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="d-flex gap-2 mb-4">
        <button type="submit" class="btn btn-primary" disabled={saving}>
          {#if saving}
            <span class="spinner-border spinner-border-sm me-1" role="status"></span>
            Saving...
          {:else}
            Save Changes
          {/if}
        </button>

        <button
          type="button"
          class="btn btn-success"
          disabled={confirming || profile.userConfirmed}
          onclick={confirmProfile}
        >
          {#if confirming}
            <span class="spinner-border spinner-border-sm me-1" role="status"></span>
            Confirming...
          {:else if profile.userConfirmed}
            Confirmed
          {:else}
            Confirm Profile
          {/if}
        </button>

        <button
          type="button"
          class="btn btn-outline-secondary"
          disabled={inferring}
          onclick={runInference}
        >
          {#if inferring}
            <span class="spinner-border spinner-border-sm me-1" role="status"></span>
            Re-inferring...
          {:else}
            Re-infer from Content
          {/if}
        </button>
      </div>
    </form>
  {/if}
</div>
