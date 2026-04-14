<script lang="ts">
	let copied = $state(false);
	let checklist = $state({
		classesPreserved: false,
		htmlStructure: false,
		inlineStyles: false,
		bootstrapGrid: false,
		customClasses: false
	});

	const sampleHtml = `<div class="container py-4">
  <div class="row g-4">
    <!-- Column 1: Card -->
    <div class="col-md-6 col-lg-4">
      <div class="card shadow-sm rounded bg-light">
        <div class="card-body p-3">
          <h3 class="text-primary fw-bold">Feature Card</h3>
          <p class="lead text-muted">This is a sample card with Bootstrap 5 styling applied.</p>
          <button class="btn btn-primary me-2">Primary Action</button>
          <button class="btn btn-outline-secondary">Secondary</button>
        </div>
      </div>
    </div>

    <!-- Column 2: List Group -->
    <div class="col-md-6 col-lg-4">
      <h4 class="fw-bold text-primary mb-3">Services</h4>
      <ul class="list-group">
        <li class="list-group-item d-flex justify-content-between align-items-center">
          Haircut
          <span class="badge bg-primary rounded-pill">$30</span>
        </li>
        <li class="list-group-item d-flex justify-content-between align-items-center">
          Colour
          <span class="badge bg-primary rounded-pill">$80</span>
        </li>
        <li class="list-group-item d-flex justify-content-between align-items-center">
          Styling
          <span class="badge bg-primary rounded-pill">$50</span>
        </li>
      </ul>
    </div>

    <!-- Column 3: Alert + Info -->
    <div class="col-md-6 col-lg-4">
      <div class="alert alert-info" role="alert">
        <i class="fa-solid fa-circle-info me-2"></i>
        <strong>Note:</strong> This is a Bootstrap alert component.
      </div>
      <p class="text-muted fs-6">Additional info paragraph with <span class="fw-bold text-dark">bold inline text</span> and <a href="#" class="text-decoration-none">a styled link</a>.</p>
    </div>
  </div>

  <!-- Table Section -->
  <div class="row mt-4">
    <div class="col-12">
      <h4 class="fw-bold text-primary mb-3">Schedule Overview</h4>
      <table class="table table-striped table-hover">
        <thead class="table-dark">
          <tr>
            <th scope="col">Day</th>
            <th scope="col">Opening</th>
            <th scope="col">Closing</th>
            <th scope="col">Status</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Monday</td>
            <td>9:00 AM</td>
            <td>5:00 PM</td>
            <td><span class="badge bg-success">Open</span></td>
          </tr>
          <tr>
            <td>Tuesday</td>
            <td>9:00 AM</td>
            <td>5:00 PM</td>
            <td><span class="badge bg-success">Open</span></td>
          </tr>
          <tr>
            <td>Wednesday</td>
            <td>10:00 AM</td>
            <td>6:00 PM</td>
            <td><span class="badge bg-warning text-dark">Late Open</span></td>
          </tr>
          <tr>
            <td>Sunday</td>
            <td>-</td>
            <td>-</td>
            <td><span class="badge bg-danger">Closed</span></td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <!-- Buttons Row -->
  <div class="row mt-3">
    <div class="col-12 d-flex gap-2 flex-wrap">
      <button class="btn btn-primary">btn-primary</button>
      <button class="btn btn-secondary">btn-secondary</button>
      <button class="btn btn-success">btn-success</button>
      <button class="btn btn-danger">btn-danger</button>
      <button class="btn btn-warning">btn-warning</button>
      <button class="btn btn-info">btn-info</button>
      <button class="btn btn-outline-primary">btn-outline-primary</button>
      <button class="btn btn-outline-secondary">btn-outline-secondary</button>
      <button class="btn btn-lg btn-primary">Large Button</button>
      <button class="btn btn-sm btn-secondary">Small Button</button>
    </div>
  </div>
</div>`;

	async function copyToClipboard() {
		try {
			await navigator.clipboard.writeText(sampleHtml);
			copied = true;
			setTimeout(() => { copied = false; }, 2000);
		} catch {
			// Fallback
			const textarea = document.querySelector('#html-source') as HTMLTextAreaElement;
			if (textarea) {
				textarea.select();
				document.execCommand('copy');
				copied = true;
				setTimeout(() => { copied = false; }, 2000);
			}
		}
	}

	let allPassed = $derived(
		checklist.classesPreserved &&
		checklist.htmlStructure &&
		checklist.inlineStyles &&
		checklist.bootstrapGrid &&
		checklist.customClasses
	);
</script>

<svelte:head>
	<title>Paste Test - Bookingtimes Emulator</title>
</svelte:head>

<div class="mb-4">
	<h1 class="fw-bold mb-1">WYSIWYG Paste Acceptance Test</h1>
	<p class="text-muted">Generate sample Bootstrap 5 HTML, copy it, and paste into bookingtimes.com to verify class preservation.</p>
</div>

<!-- Instructions -->
<div class="alert alert-info mb-4" role="alert">
	<h6 class="alert-heading fw-bold mb-2"><i class="fa-solid fa-circle-info me-2"></i>How to use this test</h6>
	<ol class="mb-0 ps-3">
		<li>Review the rendered preview below</li>
		<li>Click "Copy to Clipboard" to copy the raw HTML</li>
		<li>Paste into the bookingtimes.com WYSIWYG editor</li>
		<li>Check each item in the verification checklist</li>
	</ol>
</div>

<div class="row g-4">
	<!-- Left: Preview + Source -->
	<div class="col-lg-8">
		<!-- Rendered Preview -->
		<div class="card border-0 shadow-sm mb-4">
			<div class="card-header bg-white border-bottom">
				<h5 class="mb-0 fw-bold"><i class="fa-solid fa-eye me-2 text-primary"></i>Rendered Preview</h5>
			</div>
			<div class="card-body">
				{@html sampleHtml}
			</div>
		</div>

		<!-- Raw HTML Source -->
		<div class="card border-0 shadow-sm">
			<div class="card-header bg-white border-bottom d-flex justify-content-between align-items-center">
				<h5 class="mb-0 fw-bold"><i class="fa-solid fa-code me-2 text-primary"></i>Raw HTML Source</h5>
				<button
					class="btn btn-sm {copied ? 'btn-success' : 'btn-primary'}"
					onclick={copyToClipboard}
				>
					<i class="fa-solid {copied ? 'fa-check' : 'fa-clipboard'} me-1"></i>
					{copied ? 'Copied!' : 'Copy to Clipboard'}
				</button>
			</div>
			<div class="card-body p-0">
				<textarea
					id="html-source"
					class="form-control font-monospace border-0 rounded-0"
					rows="20"
					readonly
					style="font-size: 0.8rem; background: #f8f9fa; resize: vertical;"
				>{sampleHtml}</textarea>
			</div>
		</div>
	</div>

	<!-- Right: Checklist -->
	<div class="col-lg-4">
		<div class="card border-0 shadow-sm sticky-top" style="top: 1rem;">
			<div class="card-header bg-white border-bottom">
				<h5 class="mb-0 fw-bold"><i class="fa-solid fa-clipboard-check me-2 text-primary"></i>Verification Checklist</h5>
			</div>
			<div class="card-body">
				<p class="text-muted small mb-3">After pasting into bookingtimes.com, verify each item:</p>

				<div class="form-check mb-3">
					<input class="form-check-input" type="checkbox" id="chk-classes" bind:checked={checklist.classesPreserved}>
					<label class="form-check-label" for="chk-classes">
						<strong>Classes preserved on paste?</strong>
						<br><small class="text-muted">Bootstrap classes like <code>shadow-sm</code>, <code>rounded</code>, <code>fw-bold</code> remain in the HTML</small>
					</label>
				</div>

				<div class="form-check mb-3">
					<input class="form-check-input" type="checkbox" id="chk-structure" bind:checked={checklist.htmlStructure}>
					<label class="form-check-label" for="chk-structure">
						<strong>HTML structure preserved?</strong>
						<br><small class="text-muted">Nested divs, tables, lists maintain their hierarchy</small>
					</label>
				</div>

				<div class="form-check mb-3">
					<input class="form-check-input" type="checkbox" id="chk-styles" bind:checked={checklist.inlineStyles}>
					<label class="form-check-label" for="chk-styles">
						<strong>Inline styles preserved?</strong>
						<br><small class="text-muted">Any inline <code>style=""</code> attributes survive paste</small>
					</label>
				</div>

				<div class="form-check mb-3">
					<input class="form-check-input" type="checkbox" id="chk-grid" bind:checked={checklist.bootstrapGrid}>
					<label class="form-check-label" for="chk-grid">
						<strong>Bootstrap grid renders correctly?</strong>
						<br><small class="text-muted"><code>container</code>, <code>row</code>, <code>col-*</code> layout as expected</small>
					</label>
				</div>

				<div class="form-check mb-3">
					<input class="form-check-input" type="checkbox" id="chk-custom" bind:checked={checklist.customClasses}>
					<label class="form-check-label" for="chk-custom">
						<strong>Custom classes preserved?</strong>
						<br><small class="text-muted">Non-Bootstrap custom classes survive the paste operation</small>
					</label>
				</div>

				<hr>

				{#if allPassed}
					<div class="alert alert-success mb-0">
						<i class="fa-solid fa-circle-check me-2"></i>
						<strong>All checks passed!</strong> Paste fidelity is confirmed.
					</div>
				{:else}
					<div class="alert alert-warning mb-0">
						<i class="fa-solid fa-triangle-exclamation me-2"></i>
						<strong>{Object.values(checklist).filter(Boolean).length}/5 checks passed.</strong> Complete all checks after testing.
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>
