<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';

	let authenticated = $state(false);
	let expired = $state(false);
	let expiresAt = $state<number | null>(null);
	let scopes = $state<string[]>([]);
	let source = $state<string>('none');
	let sourceLabel = $state<string>('');
	let loading = $state(true);
	let successMessage = $state('');

	onMount(async () => {
		// Check for query params
		const success = $page.url.searchParams.get('success');
		const logout = $page.url.searchParams.get('logout');
		if (success) successMessage = 'Successfully connected to Claude!';
		if (logout) successMessage = 'Signed out successfully.';

		// Fetch auth status
		try {
			const res = await fetch('/auth/status');
			const data = await res.json();
			authenticated = data.authenticated;
			expired = data.expired ?? false;
			expiresAt = data.expiresAt;
			scopes = data.scopes;
			source = data.source ?? 'none';
			sourceLabel = data.sourceLabel ?? '';
		} catch {
			// Ignore fetch errors
		}
		loading = false;
	});

	function formatExpiry(ts: number): string {
		return new Date(ts * 1000).toLocaleString();
	}

	function timeUntilExpiry(ts: number): string {
		const diff = ts - Math.floor(Date.now() / 1000);
		if (diff <= 0) return 'Expired';
		const hours = Math.floor(diff / 3600);
		const mins = Math.floor((diff % 3600) / 60);
		if (hours > 0) return `${hours}h ${mins}m`;
		return `${mins}m`;
	}
</script>

<svelte:head>
	<title>Claude Authentication</title>
</svelte:head>

<div class="container" style="max-width: 600px;">
	<h2 class="mb-4">
		<i class="fa-solid fa-key me-2"></i>Claude Authentication
	</h2>

	{#if successMessage}
		<div class="alert alert-success alert-dismissible fade show" role="alert">
			<i class="fa-solid fa-check-circle me-2"></i>{successMessage}
			<button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"
				onclick={() => successMessage = ''}></button>
		</div>
	{/if}

	{#if loading}
		<div class="text-center py-5">
			<div class="spinner-border text-primary" role="status">
				<span class="visually-hidden">Loading...</span>
			</div>
		</div>
	{:else if authenticated}
		<div class="card">
			<div class="card-body">
				<div class="d-flex align-items-center mb-3">
					<span class="badge bg-success me-2">
						<i class="fa-solid fa-circle me-1" style="font-size: 0.5em;"></i>Connected
					</span>
					{#if source === 'api_key'}
						<span class="badge bg-primary me-2">via API Key</span>
					{:else if source === 'auth_token'}
						<span class="badge bg-info text-dark me-2">via Dedicated Token</span>
					{:else if source === 'claude_code'}
						<span class="badge bg-warning text-dark me-2">via Claude Code (shared)</span>
					{/if}
					{#if expired}
						<span class="badge bg-warning text-dark">Token Expired</span>
					{/if}
				</div>

				<table class="table table-sm mb-3">
					<tbody>
						<tr>
							<td class="text-muted fw-medium">Source</td>
							<td>
								{#if source === 'api_key'}
									API Key
									<small class="text-muted ms-1">(ANTHROPIC_API_KEY env var)</small>
								{:else if source === 'auth_token'}
									Dedicated OAuth Token
									<small class="text-muted ms-1">(ANTHROPIC_AUTH_TOKEN env var)</small>
								{:else if source === 'claude_code'}
									Claude Code CLI credentials
									<small class="text-muted ms-1">(~/.claude/.credentials.json)</small>
								{:else}
									OAuth sign-in
								{/if}
							</td>
						</tr>
						{#if expiresAt}
							<tr>
								<td class="text-muted fw-medium">Expires</td>
								<td>{formatExpiry(expiresAt)}
									<small class="text-muted ms-1">({timeUntilExpiry(expiresAt)})</small>
								</td>
							</tr>
						{/if}
						{#if scopes.length > 0}
							<tr>
								<td class="text-muted fw-medium">Scopes</td>
								<td>
									{#each scopes as scope}
										<span class="badge bg-light text-dark me-1">{scope}</span>
									{/each}
								</td>
							</tr>
						{/if}
					</tbody>
				</table>

				{#if source === 'api_key'}
					<p class="text-muted small mb-3">
						Using API key from ANTHROPIC_API_KEY environment variable. This provides the highest rate limits.
					</p>
				{:else if source === 'auth_token'}
					<p class="text-muted small mb-3">
						Using a dedicated OAuth token from ANTHROPIC_AUTH_TOKEN environment variable.
						This has its own rate limit bucket, separate from Claude Code CLI.
					</p>
				{:else if source === 'claude_code'}
					<div class="alert alert-warning small mb-3">
						<i class="fa-solid fa-triangle-exclamation me-1"></i>
						<strong>Shared rate limits:</strong> Using credentials from your local Claude Code installation.
						This shares rate limits with Claude Code CLI. To avoid contention, run
						<code>claude setup-token</code> and set the <code>ANTHROPIC_AUTH_TOKEN</code> env var.
					</div>
				{:else}
					<p class="text-muted small mb-3">
						Your Claude Max subscription is connected. The app will automatically refresh tokens when they expire.
					</p>

					<form method="POST" action="/auth/logout">
						<button type="submit" class="btn btn-outline-danger">
							<i class="fa-solid fa-right-from-bracket me-1"></i>Sign Out
						</button>
					</form>
				{/if}
			</div>
		</div>
	{:else}
		<div class="card">
			<div class="card-body text-center py-5">
				<i class="fa-solid fa-cloud fa-3x text-muted mb-3"></i>
				<h5>Connect to Claude</h5>
				<p class="text-muted mb-4">
					Sign in with your Claude Max subscription to use AI features.
					This uses OAuth with PKCE for secure authentication.
				</p>
				<a href="/auth/login" class="btn btn-primary btn-lg">
					<i class="fa-solid fa-right-to-bracket me-2"></i>Sign in with Claude
				</a>
			</div>
		</div>
	{/if}
</div>
