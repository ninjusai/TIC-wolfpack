<script lang="ts">
	// ── Types ──────────────────────────────────────────────────────────────────

	interface BackupItem {
		key: string;
		size: number;
		created: string;
	}

	// ── State ──────────────────────────────────────────────────────────────────

	let backups = $state<BackupItem[]>([]);
	let loading = $state(false);
	let creating = $state(false);
	let restoring = $state<string | null>(null);
	let confirmRestore = $state<string | null>(null);
	let toast = $state<{ type: 'success' | 'error'; message: string } | null>(null);

	// ── Helpers ────────────────────────────────────────────────────────────────

	function showToast(type: 'success' | 'error', message: string) {
		toast = { type, message };
		setTimeout(() => { toast = null; }, 4000);
	}

	function formatBytes(bytes: number): string {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	}

	function formatDate(iso: string): string {
		return new Date(iso).toLocaleString();
	}

	// ── API Calls ─────────────────────────────────────────────────────────────

	async function loadBackups() {
		loading = true;
		try {
			const res = await fetch('/api/backup');
			if (!res.ok) throw new Error(await res.text());
			const data: { backups: BackupItem[] } = await res.json();
			backups = data.backups ?? [];
		} catch (err) {
			showToast('error', `Failed to load backups: ${err instanceof Error ? err.message : err}`);
		} finally {
			loading = false;
		}
	}

	async function createBackup() {
		creating = true;
		try {
			const res = await fetch('/api/backup', { method: 'POST' });
			if (!res.ok) throw new Error(await res.text());
			const data: { backup: { tables: string[]; key: string; timestamp: string } } = await res.json();
			showToast('success', `Backup created — ${data.backup.tables.length} tables exported`);
			await loadBackups();
		} catch (err) {
			showToast('error', `Failed to create backup: ${err instanceof Error ? err.message : err}`);
		} finally {
			creating = false;
		}
	}

	async function restoreBackup(key: string) {
		restoring = key;
		confirmRestore = null;
		try {
			const res = await fetch('/api/backup/restore', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ backup_key: key })
			});
			if (!res.ok) throw new Error(await res.text());
			const data: { restored: { restored_tables: string[]; row_counts: Record<string, number> } } = await res.json();
			const tables = data.restored.restored_tables.join(', ');
			showToast('success', `Restored ${tables}`);
		} catch (err) {
			showToast('error', `Restore failed: ${err instanceof Error ? err.message : err}`);
		} finally {
			restoring = null;
		}
	}

	// ── Init ──────────────────────────────────────────────────────────────────

	$effect(() => { loadBackups(); });
</script>

<svelte:head>
	<title>Settings - Bookingtimes Emulator</title>
</svelte:head>

<!-- Toast -->
{#if toast}
	<div
		class="position-fixed top-0 end-0 p-3"
		style="z-index: 1080;"
	>
		<div class="alert alert-{toast.type === 'success' ? 'success' : 'danger'} alert-dismissible shadow-sm mb-0">
			{toast.message}
			<button type="button" class="btn-close" onclick={() => (toast = null)}></button>
		</div>
	</div>
{/if}

<div class="mb-4">
	<h1 class="fw-bold mb-1"><i class="fa-solid fa-gear me-2 text-secondary"></i>Settings</h1>
	<p class="text-muted">Configure application settings.</p>
</div>

<!-- Backups Card -->
<div class="card border-0 shadow-sm mb-4">
	<div class="card-header bg-white d-flex justify-content-between align-items-center">
		<h5 class="mb-0"><i class="fa-solid fa-box-archive me-2 text-primary"></i>Backups</h5>
		<button
			class="btn btn-primary btn-sm"
			disabled={creating}
			onclick={createBackup}
		>
			{#if creating}
				<span class="spinner-border spinner-border-sm me-1"></span>Creating...
			{:else}
				<i class="fa-solid fa-plus me-1"></i>Create Backup Now
			{/if}
		</button>
	</div>
	<div class="card-body">
		{#if loading}
			<div class="text-center py-4">
				<span class="spinner-border text-primary"></span>
			</div>
		{:else if backups.length === 0}
			<p class="text-muted text-center mb-0 py-3">No backups yet. Create one to get started.</p>
		{:else}
			<div class="table-responsive">
				<table class="table table-hover align-middle mb-0">
					<thead>
						<tr>
							<th>Date</th>
							<th>Size</th>
							<th class="text-end">Actions</th>
						</tr>
					</thead>
					<tbody>
						{#each backups as backup (backup.key)}
							<tr>
								<td>
									<i class="fa-regular fa-file-zipper me-1 text-muted"></i>
									{formatDate(backup.created)}
								</td>
								<td><span class="badge bg-light text-dark">{formatBytes(backup.size)}</span></td>
								<td class="text-end">
									{#if confirmRestore === backup.key}
										<span class="text-danger me-2 small">Are you sure?</span>
										<button
											class="btn btn-danger btn-sm me-1"
											disabled={restoring === backup.key}
											onclick={() => restoreBackup(backup.key)}
										>
											{#if restoring === backup.key}
												<span class="spinner-border spinner-border-sm me-1"></span>
											{/if}
											Yes, restore
										</button>
										<button
											class="btn btn-outline-secondary btn-sm"
											onclick={() => (confirmRestore = null)}
										>
											Cancel
										</button>
									{:else}
										<button
											class="btn btn-outline-warning btn-sm"
											disabled={restoring !== null}
											onclick={() => (confirmRestore = backup.key)}
										>
											<i class="fa-solid fa-rotate-left me-1"></i>Restore
										</button>
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</div>
</div>

<!-- AI Authentication Card -->
<div class="card border-0 shadow-sm mb-4">
	<div class="card-header bg-white">
		<h5 class="mb-0"><i class="fa-solid fa-robot me-2 text-info"></i>AI Authentication</h5>
	</div>
	<div class="card-body">
		<p class="text-muted mb-3">
			The app authenticates with the Claude API using the following priority order:
		</p>
		<table class="table table-sm mb-4">
			<thead>
				<tr>
					<th style="width: 100px;">Priority</th>
					<th>Method</th>
					<th>Rate Limits</th>
				</tr>
			</thead>
			<tbody>
				<tr>
					<td><span class="badge bg-success">1 (best)</span></td>
					<td>
						<code>ANTHROPIC_API_KEY</code> env var
						<small class="text-muted d-block">Standard API key with x-api-key header</small>
					</td>
					<td>API-level (highest)</td>
				</tr>
				<tr>
					<td><span class="badge bg-info text-dark">2</span></td>
					<td>
						<code>ANTHROPIC_AUTH_TOKEN</code> env var
						<small class="text-muted d-block">Dedicated OAuth token from <code>claude setup-token</code></small>
					</td>
					<td>Consumer-level (own bucket)</td>
				</tr>
				<tr>
					<td><span class="badge bg-warning text-dark">3</span></td>
					<td>
						Claude Code credentials
						<small class="text-muted d-block">Auto-detected from <code>~/.claude/.credentials.json</code></small>
					</td>
					<td class="text-danger">Consumer-level (shared with CLI)</td>
				</tr>
			</tbody>
		</table>

		<div class="alert alert-info mb-0">
			<h6 class="alert-heading"><i class="fa-solid fa-lightbulb me-1"></i>Avoiding Rate Limit Contention</h6>
			<p class="mb-2">
				If you are hitting 429 rate limits because this app shares tokens with Claude Code CLI,
				get a dedicated token by running:
			</p>
			<ol class="mb-2">
				<li>Run <code>claude setup-token</code> in your terminal</li>
				<li>Copy the token it outputs (starts with <code>sk-ant-oat01-...</code>)</li>
				<li>Restart the app with the token:
					<pre class="bg-dark text-light p-2 rounded mt-1 mb-0" style="font-size: 0.85em;">ANTHROPIC_AUTH_TOKEN=sk-ant-oat01-... npm run dev</pre>
				</li>
			</ol>
			<p class="mb-0 small text-muted">
				This gives the app its own rate limit bucket, separate from Claude Code CLI.
			</p>
		</div>
	</div>
</div>
