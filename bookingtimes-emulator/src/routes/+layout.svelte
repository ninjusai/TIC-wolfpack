<script lang="ts">
	import type { Snippet } from 'svelte';
	import { onMount } from 'svelte';

	let { children }: { children: Snippet } = $props();

	let sidebarCollapsed = $state(false);
	let mobileOpen = $state(false);
	let authConnected = $state(false);

	onMount(async () => {
		try {
			const res = await fetch('/auth/status');
			const data = await res.json();
			authConnected = data.authenticated && !data.expired;
		} catch {
			authConnected = false;
		}
	});

	function toggleSidebar() {
		sidebarCollapsed = !sidebarCollapsed;
	}

	function toggleMobile() {
		mobileOpen = !mobileOpen;
	}

	function closeMobileOnNavigate() {
		mobileOpen = false;
	}

	const navItems = [
		{ href: '/generate', label: 'Generate', icon: 'fa-wand-magic-sparkles' },
		{ href: '/sites', label: 'Sites', icon: 'fa-globe' },
		{ href: '/templates', label: 'Templates', icon: 'fa-layer-group' },
		{ href: '/pages', label: 'Pages', icon: 'fa-file-lines' },
		{ href: '/preview', label: 'Preview', icon: 'fa-eye' },
		{ href: '/export', label: 'Export', icon: 'fa-file-export' },
		{ href: '/batch', label: 'Batch', icon: 'fa-bars-staggered' },
		{ href: '/settings', label: 'Settings', icon: 'fa-gear' },
		{ href: '/tools/paste-test', label: 'Paste Test', icon: 'fa-clipboard-check' }
	];
</script>

<div class="app-layout">
	<!-- Mobile top bar -->
	<nav class="mobile-topbar d-md-none d-flex align-items-center px-3 py-2">
		<button class="btn btn-sm btn-outline-light me-3" onclick={toggleMobile} aria-label="Toggle menu">
			<i class="fa-solid fa-bars"></i>
		</button>
		<span class="text-white fw-bold">Bookingtimes Emulator</span>
	</nav>

	<!-- Sidebar backdrop for mobile -->
	{#if mobileOpen}
		<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
		<div class="sidebar-backdrop d-md-none" onclick={closeMobileOnNavigate}></div>
	{/if}

	<!-- Sidebar -->
	<aside class="sidebar d-flex flex-column"
		class:collapsed={sidebarCollapsed}
		class:mobile-open={mobileOpen}>

		<!-- Sidebar header -->
		<div class="sidebar-header d-flex align-items-center px-3 py-3">
			{#if !sidebarCollapsed}
				<a href="/" class="text-white text-decoration-none fw-bold flex-grow-1" onclick={closeMobileOnNavigate}>
					<i class="fa-solid fa-calendar-check me-2"></i>BT Emulator
				</a>
			{/if}
			<button class="btn btn-sm btn-outline-light d-none d-md-inline-block" onclick={toggleSidebar} aria-label="Collapse sidebar">
				<i class="fa-solid" class:fa-angles-left={!sidebarCollapsed} class:fa-angles-right={sidebarCollapsed}></i>
			</button>
		</div>

		<!-- Nav items -->
		<ul class="nav flex-column flex-grow-1 mt-2">
			{#each navItems as item}
				<li class="nav-item">
					<a href={item.href} class="nav-link sidebar-link d-flex align-items-center px-3 py-2" onclick={closeMobileOnNavigate} title={item.label}>
						<i class="fa-solid {item.icon}" style="width: 20px; text-align: center;"></i>
						{#if !sidebarCollapsed}
							<span class="ms-3">{item.label}</span>
						{/if}
					</a>
				</li>
			{/each}
		</ul>

		<!-- Auth status -->
		<div class="px-3 py-2">
			{#if authConnected}
				<a href="/auth" class="sidebar-link d-flex align-items-center text-decoration-none" title="Claude Connected">
					<span class="auth-dot auth-dot-green"></span>
					{#if !sidebarCollapsed}
						<span class="ms-2 small text-success">Connected</span>
					{/if}
				</a>
			{:else}
				<a href="/auth" class="sidebar-link d-flex align-items-center text-decoration-none" title="Sign In to Claude">
					<span class="auth-dot auth-dot-red"></span>
					{#if !sidebarCollapsed}
						<span class="ms-2 small text-danger">Sign In</span>
					{/if}
				</a>
			{/if}
		</div>

		<!-- Sidebar footer -->
		<div class="sidebar-footer px-3 py-2 mt-auto">
			{#if !sidebarCollapsed}
				<small class="text-secondary">Bookingtimes.com</small>
			{/if}
		</div>
	</aside>

	<!-- Main content -->
	<main class="main-content" class:main-expanded={sidebarCollapsed}>
		<div class="p-4">
			{@render children()}
		</div>
	</main>
</div>

<style>
	:global(body) {
		margin: 0;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
		background-color: #f5f6fa;
	}

	.app-layout {
		display: flex;
		min-height: 100vh;
	}

	/* Mobile top bar */
	.mobile-topbar {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		z-index: 1040;
		background-color: #1e2530;
		height: 48px;
	}

	/* Sidebar backdrop */
	.sidebar-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.5);
		z-index: 1045;
	}

	/* Sidebar */
	.sidebar {
		position: fixed;
		top: 0;
		left: 0;
		bottom: 0;
		width: 250px;
		background-color: #1e2530;
		color: #c2c7d0;
		z-index: 1050;
		transition: width 0.2s ease, transform 0.2s ease;
		overflow-x: hidden;
	}

	.sidebar.collapsed {
		width: 60px;
	}

	.sidebar-header {
		border-bottom: 1px solid rgba(255, 255, 255, 0.08);
		min-height: 56px;
	}

	.sidebar-link {
		color: #c2c7d0 !important;
		border-radius: 6px;
		margin: 2px 8px;
		transition: background-color 0.15s ease, color 0.15s ease;
		white-space: nowrap;
	}

	.sidebar-link:hover {
		background-color: rgba(255, 255, 255, 0.08);
		color: #fff !important;
	}

	.sidebar-link:global(.active),
	.sidebar-link:focus {
		background-color: rgba(66, 133, 244, 0.2);
		color: #7abaff !important;
	}

	.auth-dot {
		display: inline-block;
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.auth-dot-green {
		background-color: #22c55e;
		box-shadow: 0 0 4px rgba(34, 197, 94, 0.5);
	}

	.auth-dot-red {
		background-color: #ef4444;
		box-shadow: 0 0 4px rgba(239, 68, 68, 0.5);
	}

	.sidebar-footer {
		border-top: 1px solid rgba(255, 255, 255, 0.08);
	}

	/* Main content */
	.main-content {
		flex: 1;
		margin-left: 250px;
		transition: margin-left 0.2s ease;
		min-height: 100vh;
	}

	.main-content.main-expanded {
		margin-left: 60px;
	}

	/* Mobile responsive */
	@media (max-width: 767.98px) {
		.sidebar {
			transform: translateX(-100%);
		}

		.sidebar.mobile-open {
			transform: translateX(0);
		}

		.main-content,
		.main-content.main-expanded {
			margin-left: 0;
			padding-top: 48px;
		}
	}
</style>
