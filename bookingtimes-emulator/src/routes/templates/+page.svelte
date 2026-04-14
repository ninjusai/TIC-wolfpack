<script lang="ts">
	import type { Template, TemplateSection, ContentRules, Variant } from '$lib/types/template';

	// ── Types ──────────────────────────────────────────────────────────────────

	interface TemplateListItem {
		id: string;
		name: string;
		description: string | null;
		site_ids: string[];
		section_count: number;
		created_at: string;
		updated_at: string;
	}

	interface Site {
		id: string;
		name: string;
		url: string;
	}

	interface EditSection {
		_key: string; // local key for Svelte keying
		name: string;
		sort_order: number;
		required: boolean;
		html_skeleton: string;
		required_classes_str: string; // comma-separated for input
		min_words: number | '';
		max_words: number | '';
		tone: string;
		variants: { id: string; brief: string }[];
	}

	// ── State ──────────────────────────────────────────────────────────────────

	let templates = $state<TemplateListItem[]>([]);
	let sites = $state<Site[]>([]);
	let loading = $state(true);
	let error_msg = $state('');
	let toast = $state<{ type: 'success' | 'error'; message: string } | null>(null);

	// Editor state
	let editing = $state(false);
	let editId = $state<string | null>(null); // null = new template
	let editName = $state('');
	let editDescription = $state('');
	let editSiteIds = $state<string[]>([]);
	let editSections = $state<EditSection[]>([]);
	let saving = $state(false);
	let deleting = $state(false);
	let confirmDelete = $state(false);
	let loadingTemplate = $state(false);

	// ── Helpers ────────────────────────────────────────────────────────────────

	function showToast(type: 'success' | 'error', message: string) {
		toast = { type, message };
		setTimeout(() => { toast = null; }, 3500);
	}

	function makeKey() {
		return crypto.randomUUID();
	}

	function blankSection(): EditSection {
		return {
			_key: makeKey(),
			name: '',
			sort_order: 0,
			required: true,
			html_skeleton: '',
			required_classes_str: '',
			min_words: '',
			max_words: '',
			tone: '',
			variants: []
		};
	}

	function sectionToPayload(s: EditSection, index: number) {
		const content_rules: ContentRules = {};
		if (s.min_words !== '' && s.min_words !== 0) content_rules.min_words = Number(s.min_words);
		if (s.max_words !== '' && s.max_words !== 0) content_rules.max_words = Number(s.max_words);
		if (s.tone) content_rules.tone = s.tone;

		return {
			name: s.name,
			sort_order: index,
			required: s.required,
			html_skeleton: s.html_skeleton || null,
			required_classes: s.required_classes_str
				? s.required_classes_str.split(',').map((c: string) => c.trim()).filter(Boolean)
				: [],
			content_rules: Object.keys(content_rules).length > 0 ? content_rules : null,
			variant_pool: s.variants
		};
	}

	function templateSectionToEdit(s: TemplateSection): EditSection {
		return {
			_key: makeKey(),
			name: s.name,
			sort_order: s.sort_order,
			required: s.required,
			html_skeleton: s.html_skeleton ?? '',
			required_classes_str: (s.required_classes ?? []).join(', '),
			min_words: s.content_rules?.min_words ?? '',
			max_words: s.content_rules?.max_words ?? '',
			tone: s.content_rules?.tone ?? '',
			variants: [...(s.variant_pool ?? [])]
		};
	}

	function formatDate(iso: string) {
		return new Date(iso).toLocaleDateString('en-US', {
			month: 'short', day: 'numeric', year: 'numeric',
			hour: '2-digit', minute: '2-digit'
		});
	}

	// ── Data Fetching ──────────────────────────────────────────────────────────

	async function fetchTemplates() {
		loading = true;
		error_msg = '';
		try {
			const resp = await fetch('/api/templates');
			if (!resp.ok) throw new Error(`${resp.status} ${resp.statusText}`);
			const data = await resp.json() as { templates: TemplateListItem[] };
			templates = data.templates ?? [];
		} catch (err) {
			error_msg = err instanceof Error ? err.message : String(err);
		} finally {
			loading = false;
		}
	}

	async function fetchSites() {
		try {
			const resp = await fetch('/api/sites');
			if (!resp.ok) return;
			const data = await resp.json() as { sites: Site[] };
			sites = data.sites ?? [];
		} catch { /* non-critical */ }
	}

	// Load on mount
	$effect(() => {
		fetchTemplates();
		fetchSites();
	});

	// ── Editor Actions ─────────────────────────────────────────────────────────

	function openNew() {
		editId = null;
		editName = '';
		editDescription = '';
		editSiteIds = [];
		editSections = [blankSection()];
		confirmDelete = false;
		editing = true;
	}

	async function openEdit(id: string) {
		loadingTemplate = true;
		editing = true;
		editId = id;
		confirmDelete = false;
		try {
			const resp = await fetch(`/api/templates/${id}`);
			if (!resp.ok) throw new Error(`${resp.status} ${resp.statusText}`);
			const data = await resp.json() as { template: Template };
			const t: Template = data.template;
			editName = t.name;
			editDescription = t.description ?? '';
			editSiteIds = [...t.site_ids];
			editSections = t.sections.map(templateSectionToEdit);
			if (editSections.length === 0) editSections = [blankSection()];
		} catch (err) {
			showToast('error', 'Failed to load template');
			editing = false;
		} finally {
			loadingTemplate = false;
		}
	}

	function closeEditor() {
		editing = false;
		editId = null;
		confirmDelete = false;
	}

	async function saveTemplate() {
		if (!editName.trim()) {
			showToast('error', 'Template name is required');
			return;
		}
		if (editSections.length === 0 || !editSections.some(s => s.name.trim())) {
			showToast('error', 'At least one named section is required');
			return;
		}

		saving = true;
		try {
			const payload = {
				name: editName.trim(),
				description: editDescription.trim() || null,
				site_ids: editSiteIds,
				sections: editSections.filter(s => s.name.trim()).map(sectionToPayload)
			};

			const url = editId ? `/api/templates/${editId}` : '/api/templates';
			const method = editId ? 'PUT' : 'POST';

			const resp = await fetch(url, {
				method,
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			});

			if (!resp.ok) {
				const errData = await resp.json().catch(() => ({ message: '' })) as { message?: string };
				throw new Error(errData.message || `${resp.status} ${resp.statusText}`);
			}

			showToast('success', editId ? 'Template updated' : 'Template created');
			closeEditor();
			await fetchTemplates();
		} catch (err) {
			showToast('error', err instanceof Error ? err.message : 'Save failed');
		} finally {
			saving = false;
		}
	}

	async function deleteTemplate() {
		if (!editId) return;
		deleting = true;
		try {
			const resp = await fetch(`/api/templates/${editId}`, { method: 'DELETE' });
			if (!resp.ok) throw new Error(`${resp.status}`);
			showToast('success', 'Template deleted');
			closeEditor();
			await fetchTemplates();
		} catch (err) {
			showToast('error', 'Delete failed');
		} finally {
			deleting = false;
		}
	}

	// ── Section Helpers ────────────────────────────────────────────────────────

	function addSection() {
		editSections = [...editSections, blankSection()];
	}

	function removeSection(index: number) {
		editSections = editSections.filter((_, i) => i !== index);
	}

	function moveSection(index: number, direction: -1 | 1) {
		const target = index + direction;
		if (target < 0 || target >= editSections.length) return;
		const arr = [...editSections];
		[arr[index], arr[target]] = [arr[target], arr[index]];
		editSections = arr;
	}

	function addVariant(sectionIndex: number) {
		const sections = [...editSections];
		sections[sectionIndex] = {
			...sections[sectionIndex],
			variants: [...sections[sectionIndex].variants, { id: crypto.randomUUID().slice(0, 8), brief: '' }]
		};
		editSections = sections;
	}

	function removeVariant(sectionIndex: number, variantIndex: number) {
		const sections = [...editSections];
		sections[sectionIndex] = {
			...sections[sectionIndex],
			variants: sections[sectionIndex].variants.filter((_, i) => i !== variantIndex)
		};
		editSections = sections;
	}

	function toggleSiteId(siteId: string) {
		if (editSiteIds.includes(siteId)) {
			editSiteIds = editSiteIds.filter(id => id !== siteId);
		} else {
			editSiteIds = [...editSiteIds, siteId];
		}
	}
</script>

<svelte:head>
	<title>Templates - Bookingtimes Emulator</title>
</svelte:head>

<!-- Toast notification -->
{#if toast}
	<div class="position-fixed top-0 end-0 p-3" style="z-index: 1100;">
		<div class="alert alert-{toast.type === 'success' ? 'success' : 'danger'} alert-dismissible shadow-sm mb-0" role="alert">
			<i class="fa-solid {toast.type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'} me-2"></i>
			{toast.message}
			<button type="button" class="btn-close" onclick={() => toast = null} aria-label="Close"></button>
		</div>
	</div>
{/if}

<div class="mb-4 d-flex justify-content-between align-items-start">
	<div>
		<h1 class="fw-bold mb-1"><i class="fa-solid fa-layer-group me-2 text-success"></i>Templates</h1>
		<p class="text-muted mb-0">Manage page templates and section definitions.</p>
	</div>
	{#if !editing}
		<button class="btn btn-success" onclick={openNew}>
			<i class="fa-solid fa-plus me-1"></i> New Template
		</button>
	{/if}
</div>

<!-- ── EDITOR ─────────────────────────────────────────────────────────────── -->
{#if editing}
	<div class="card border-0 shadow-sm mb-4">
		<div class="card-header bg-white d-flex justify-content-between align-items-center">
			<h5 class="mb-0">
				<i class="fa-solid fa-pen-to-square me-2 text-primary"></i>
				{editId ? 'Edit Template' : 'New Template'}
			</h5>
			<button class="btn btn-sm btn-outline-secondary" onclick={closeEditor}>
				<i class="fa-solid fa-xmark me-1"></i> Cancel
			</button>
		</div>
		<div class="card-body">
			{#if loadingTemplate}
				<div class="text-center py-5">
					<div class="spinner-border text-primary" role="status"></div>
					<p class="text-muted mt-2">Loading template...</p>
				</div>
			{:else}
				<!-- Name & description -->
				<div class="row g-3 mb-4">
					<div class="col-md-6">
						<label for="tpl-name" class="form-label fw-semibold">Name <span class="text-danger">*</span></label>
						<input id="tpl-name" type="text" class="form-control" placeholder="e.g. Service Page"
							bind:value={editName} />
					</div>
					<div class="col-md-6">
						<label for="tpl-desc" class="form-label fw-semibold">Description</label>
						<input id="tpl-desc" type="text" class="form-control" placeholder="Brief description"
							bind:value={editDescription} />
					</div>
				</div>

				<!-- Site assignment -->
				{#if sites.length > 0}
					<div class="mb-4">
						<label class="form-label fw-semibold">Assign to Sites</label>
						<div class="d-flex flex-wrap gap-2">
							{#each sites as site}
								<div class="form-check">
									<input class="form-check-input" type="checkbox" id="site-{site.id}"
										checked={editSiteIds.includes(site.id)}
										onchange={() => toggleSiteId(site.id)} />
									<label class="form-check-label" for="site-{site.id}">{site.name}</label>
								</div>
							{/each}
						</div>
					</div>
				{/if}

				<!-- Sections -->
				<div class="mb-3 d-flex justify-content-between align-items-center">
					<h6 class="fw-semibold mb-0"><i class="fa-solid fa-puzzle-piece me-2 text-info"></i>Sections</h6>
					<button class="btn btn-sm btn-outline-info" onclick={addSection}>
						<i class="fa-solid fa-plus me-1"></i> Add Section
					</button>
				</div>

				{#each editSections as section, i (section._key)}
					<div class="card border mb-3">
						<div class="card-header bg-light d-flex justify-content-between align-items-center py-2">
							<div class="d-flex align-items-center gap-2">
								<button class="btn btn-sm btn-outline-secondary" onclick={() => moveSection(i, -1)}
									disabled={i === 0} title="Move up">
									<i class="fa-solid fa-arrow-up"></i>
								</button>
								<button class="btn btn-sm btn-outline-secondary" onclick={() => moveSection(i, 1)}
									disabled={i === editSections.length - 1} title="Move down">
									<i class="fa-solid fa-arrow-down"></i>
								</button>
								<span class="fw-semibold text-muted">Section {i + 1}</span>
								{#if section.name}
									<span class="text-dark">— {section.name}</span>
								{/if}
							</div>
							<button class="btn btn-sm btn-outline-danger" onclick={() => removeSection(i)}
								disabled={editSections.length <= 1} title="Remove section">
								<i class="fa-solid fa-trash"></i>
							</button>
						</div>
						<div class="card-body">
							<div class="row g-3 mb-3">
								<div class="col-md-6">
									<label class="form-label">Section Name <span class="text-danger">*</span></label>
									<input type="text" class="form-control form-control-sm"
										placeholder="e.g. Hero Banner"
										bind:value={editSections[i].name} />
								</div>
								<div class="col-md-3">
									<label class="form-label">Required</label>
									<div class="form-check form-switch mt-1">
										<input class="form-check-input" type="checkbox"
											bind:checked={editSections[i].required} />
										<label class="form-check-label text-muted">
											{editSections[i].required ? 'Yes' : 'No'}
										</label>
									</div>
								</div>
								<div class="col-md-3">
									<label class="form-label">Required Classes</label>
									<input type="text" class="form-control form-control-sm"
										placeholder="class-a, class-b"
										bind:value={editSections[i].required_classes_str} />
									<small class="text-muted">Comma-separated</small>
								</div>
							</div>

							<!-- HTML Skeleton -->
							<div class="mb-3">
								<label class="form-label">HTML Skeleton</label>
								<textarea class="form-control form-control-sm font-monospace" rows="4"
									placeholder='<section class="hero">&#10;  <div class="container">&#10;    <!-- content here -->&#10;  </div>&#10;</section>'
									bind:value={editSections[i].html_skeleton}></textarea>
							</div>

							<!-- Content rules -->
							<div class="row g-3 mb-3">
								<div class="col-md-3">
									<label class="form-label">Min Words</label>
									<input type="number" class="form-control form-control-sm" min="0"
										bind:value={editSections[i].min_words} />
								</div>
								<div class="col-md-3">
									<label class="form-label">Max Words</label>
									<input type="number" class="form-control form-control-sm" min="0"
										bind:value={editSections[i].max_words} />
								</div>
								<div class="col-md-6">
									<label class="form-label">Tone</label>
									<input type="text" class="form-control form-control-sm"
										placeholder="e.g. professional, friendly"
										bind:value={editSections[i].tone} />
								</div>
							</div>

							<!-- Variant Pool -->
							<div>
								<div class="d-flex justify-content-between align-items-center mb-2">
									<label class="form-label mb-0">Variant Pool</label>
									<button class="btn btn-sm btn-outline-secondary" onclick={() => addVariant(i)}>
										<i class="fa-solid fa-plus me-1"></i> Add Variant
									</button>
								</div>
								{#each section.variants as variant, vi}
									<div class="input-group input-group-sm mb-2">
										<span class="input-group-text text-muted" style="width: 90px; font-size: 0.75rem;">{variant.id}</span>
										<input type="text" class="form-control" placeholder="Brief description"
											bind:value={editSections[i].variants[vi].brief} />
										<button class="btn btn-outline-danger" onclick={() => removeVariant(i, vi)}
											title="Remove variant">
											<i class="fa-solid fa-xmark"></i>
										</button>
									</div>
								{/each}
								{#if section.variants.length === 0}
									<p class="text-muted small mb-0">No variants. Click "Add Variant" to create one.</p>
								{/if}
							</div>
						</div>
					</div>
				{/each}

				<!-- Save / Delete actions -->
				<div class="d-flex justify-content-between align-items-center mt-4 pt-3 border-top">
					<div>
						{#if editId}
							{#if confirmDelete}
								<span class="text-danger me-2">Are you sure?</span>
								<button class="btn btn-danger btn-sm me-2" onclick={deleteTemplate} disabled={deleting}>
									{#if deleting}
										<span class="spinner-border spinner-border-sm me-1"></span>
									{/if}
									Yes, Delete
								</button>
								<button class="btn btn-outline-secondary btn-sm" onclick={() => confirmDelete = false}>
									Cancel
								</button>
							{:else}
								<button class="btn btn-outline-danger btn-sm" onclick={() => confirmDelete = true}>
									<i class="fa-solid fa-trash me-1"></i> Delete Template
								</button>
							{/if}
						{/if}
					</div>
					<button class="btn btn-primary" onclick={saveTemplate} disabled={saving}>
						{#if saving}
							<span class="spinner-border spinner-border-sm me-1"></span>
						{/if}
						<i class="fa-solid fa-floppy-disk me-1"></i>
						{editId ? 'Update Template' : 'Create Template'}
					</button>
				</div>
			{/if}
		</div>
	</div>
{/if}

<!-- ── TEMPLATE LIST ──────────────────────────────────────────────────────── -->
{#if !editing}
	{#if loading}
		<div class="text-center py-5">
			<div class="spinner-border text-primary" role="status"></div>
			<p class="text-muted mt-2">Loading templates...</p>
		</div>
	{:else if error_msg}
		<div class="alert alert-danger">
			<i class="fa-solid fa-circle-exclamation me-2"></i>{error_msg}
		</div>
	{:else if templates.length === 0}
		<div class="card border-0 shadow-sm">
			<div class="card-body text-center py-5">
				<i class="fa-solid fa-layer-group fa-3x text-muted mb-3"></i>
				<p class="text-muted mb-3">No templates yet. Create your first template to get started.</p>
				<button class="btn btn-success" onclick={openNew}>
					<i class="fa-solid fa-plus me-1"></i> Create Template
				</button>
			</div>
		</div>
	{:else}
		<div class="row g-3">
			{#each templates as tpl}
				<div class="col-md-6 col-lg-4">
					<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
					<div class="card border-0 shadow-sm h-100 template-card" onclick={() => openEdit(tpl.id)}>
						<div class="card-body">
							<h6 class="fw-semibold mb-1">
								<i class="fa-solid fa-layer-group me-2 text-success"></i>{tpl.name}
							</h6>
							{#if tpl.description}
								<p class="text-muted small mb-2">{tpl.description}</p>
							{/if}
							<div class="d-flex gap-3 text-muted small">
								<span><i class="fa-solid fa-puzzle-piece me-1"></i>{tpl.section_count} section{tpl.section_count !== 1 ? 's' : ''}</span>
								<span><i class="fa-solid fa-globe me-1"></i>{tpl.site_ids.length} site{tpl.site_ids.length !== 1 ? 's' : ''}</span>
							</div>
							<div class="text-muted small mt-2">
								<i class="fa-solid fa-clock me-1"></i>Updated {formatDate(tpl.updated_at)}
							</div>
						</div>
					</div>
				</div>
			{/each}
		</div>
	{/if}
{/if}

<style>
	.template-card {
		cursor: pointer;
		transition: transform 0.15s ease, box-shadow 0.15s ease;
	}
	.template-card:hover {
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1) !important;
	}
</style>
