<script lang="ts">
	import PreviewFrame from '$lib/components/PreviewFrame.svelte';
	import { sanitizeHtml } from '$lib/utils/html-sanitize';
	import { page } from '$app/stores';

	// ── Types ──────────────────────────────────────────────────────────────
	interface Site {
		id: string;
		name: string;
		url: string;
	}

	interface Session {
		id: string;
		site_id: string;
		status: string;
		created_at: string;
		updated_at: string;
	}

	interface ChatMessage {
		role: 'user' | 'assistant';
		content: string;
		html?: string;
		timestamp: Date;
	}

	interface ValidationItem {
		level: 'error' | 'warning' | 'info';
		message: string;
	}

	interface PageVersion {
		id: string;
		page_id: string;
		version_number: number;
		html_content: string;
		source: string;
		change_summary: string | null;
		created_at: string;
	}

	interface PageData {
		id: string;
		site_id: string;
		title: string;
		status: string;
	}

	// ── State ──────────────────────────────────────────────────────────────
	let sites = $state<Site[]>([]);
	let sessions = $state<Session[]>([]);
	let siteId = $state('');
	let sessionId = $state('');
	let messages = $state<ChatMessage[]>([]);
	let streaming = $state(false);
	let streamBuffer = $state('');
	let currentHtml = $state('');
	let prompt = $state('');
	let action = $state<'generate' | 'refine' | 'regenerate'>('generate');
	let suburb = $state('');
	let showSuburb = $state(false);
	let showValidation = $state(false);
	let validationItems = $state<ValidationItem[]>([]);
	let expandedCodeBlocks = $state<Set<number>>(new Set());
	let chatContainer: HTMLElement | undefined = $state(undefined);

	// Page import state
	let loadedPage = $state<PageData | null>(null);
	let loadedPageHtml = $state('');
	let pageLoading = $state(false);

	// ── Lifecycle ──────────────────────────────────────────────────────────
	$effect(() => {
		loadSites();
		loadPageFromUrl();
	});

	$effect(() => {
		if (siteId) {
			loadSessions();
		} else {
			sessions = [];
			sessionId = '';
		}
	});

	// Auto-scroll chat on new messages or streaming updates
	$effect(() => {
		// Track dependencies
		void messages.length;
		void streamBuffer;
		if (chatContainer) {
			requestAnimationFrame(() => {
				chatContainer!.scrollTop = chatContainer!.scrollHeight;
			});
		}
	});

	// ── Data Loading ───────────────────────────────────────────────────────
	async function loadSites() {
		try {
			const resp = await fetch('/api/sites');
			if (resp.ok) {
				const data: { sites?: Site[] } = await resp.json();
				sites = data.sites ?? [];
			}
		} catch {
			// Silently fail - user can retry
		}
	}

	async function loadSessions() {
		if (!siteId) return;
		try {
			const resp = await fetch(`/api/ai/sessions?site_id=${encodeURIComponent(siteId)}`);
			if (resp.ok) {
				const data: { sessions?: Session[] } = await resp.json();
				sessions = data.sessions ?? [];
			}
		} catch {
			sessions = [];
		}
	}

	// ── Load Page from URL params ─────────────────────────────────────────
	async function loadPageFromUrl() {
		let pageId: string | null = null;
		let querySiteId: string | null = null;

		// Read from URL search params
		const params = new URLSearchParams(window.location.search);
		pageId = params.get('page_id');
		querySiteId = params.get('site_id');

		if (querySiteId && !siteId) {
			siteId = querySiteId;
		}

		if (!pageId) return;

		pageLoading = true;
		try {
			const resp = await fetch(`/api/pages/${encodeURIComponent(pageId)}`);
			if (!resp.ok) {
				console.error('Failed to load page:', resp.status);
				return;
			}

			const data: { page: PageData; latest_version: PageVersion | null } = await resp.json();
			loadedPage = data.page;

			if (data.page.site_id && !siteId) {
				siteId = data.page.site_id;
			}

			if (data.latest_version?.html_content) {
				loadedPageHtml = data.latest_version.html_content;
				currentHtml = loadedPageHtml;

				// Set action to refine since we're working with existing content
				action = 'refine';

				// Add a system message indicating the loaded page
				messages = [{
					role: 'assistant',
					content: `Loaded page: "${data.page.title}" (version ${data.latest_version.version_number}). The existing content is shown in the preview. You can ask me to modify, improve, or regenerate any section.`,
					html: loadedPageHtml,
					timestamp: new Date()
				}];
			}
		} catch (err) {
			console.error('Error loading page:', err);
		} finally {
			pageLoading = false;
		}
	}

	// ── Code Block Toggle ──────────────────────────────────────────────────
	function toggleCodeBlock(index: number) {
		const next = new Set(expandedCodeBlocks);
		if (next.has(index)) {
			next.delete(index);
		} else {
			next.add(index);
		}
		expandedCodeBlocks = next;
	}

	// ── Validation ─────────────────────────────────────────────────────────
	function validateHtml(html: string): ValidationItem[] {
		const items: ValidationItem[] = [];

		if (!html.trim()) {
			items.push({ level: 'error', message: 'Response is empty - no HTML generated' });
			return items;
		}

		// Check for common issues
		const scriptTag = '<' + 'script';
		const styleTag = '<' + 'style';
		if (new RegExp(scriptTag, 'i').test(html)) {
			items.push({ level: 'warning', message: 'Contains script tags - may be stripped in production' });
		}
		if (new RegExp(styleTag, 'i').test(html)) {
			items.push({ level: 'warning', message: 'Contains inline style tags - consider using Bootstrap classes' });
		}
		if (/style="/i.test(html)) {
			items.push({ level: 'info', message: 'Contains inline styles - Bootstrap classes preferred' });
		}
		if (/<img[^>]*(?!alt=)/i.test(html) && !/<img[^>]*alt=/i.test(html)) {
			items.push({ level: 'warning', message: 'Images may be missing alt attributes' });
		}
		if (!/<(div|section|article|header|footer|main|nav)/i.test(html)) {
			items.push({ level: 'warning', message: 'No semantic container elements found' });
		}

		if (items.length === 0) {
			items.push({ level: 'info', message: 'HTML looks clean - no issues detected' });
		}

		return items;
	}

	// ── Send Message ───────────────────────────────────────────────────────
	async function sendMessage() {
		if (!prompt.trim() || !siteId || streaming) return;

		const userMessage: ChatMessage = {
			role: 'user',
			content: prompt.trim(),
			timestamp: new Date()
		};

		messages = [...messages, userMessage];
		const currentPrompt = prompt.trim();
		prompt = '';
		streaming = true;
		streamBuffer = '';

		try {
			// If we have existing page HTML and this is the first real user prompt,
			// include it as context so the AI knows what it's working with
			let enrichedPrompt = currentPrompt;
			const existingHtml = loadedPageHtml || currentHtml;
			if (existingHtml && (action === 'refine' || action === 'regenerate')) {
				enrichedPrompt = `Here is the existing page HTML content I want you to work with:\n\n\`\`\`html\n${existingHtml.slice(0, 15000)}\n\`\`\`\n\nUser request: ${currentPrompt}`;
			}

			const resp = await fetch('/api/ai/generate', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					session_id: sessionId || undefined,
					site_id: siteId,
					action,
					prompt: enrichedPrompt,
					suburb: suburb || undefined
				})
			});

			if (!resp.ok) {
				const errText = await resp.text();
				messages = [...messages, {
					role: 'assistant',
					content: `Error: ${resp.status} - ${errText}`,
					timestamp: new Date()
				}];
				streaming = false;
				return;
			}

			const reader = resp.body?.getReader();
			if (!reader) {
				messages = [...messages, {
					role: 'assistant',
					content: 'Error: No response stream received',
					timestamp: new Date()
				}];
				streaming = false;
				return;
			}

			const decoder = new TextDecoder();
			let buffer = '';
			let fullHtml = '';

			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				buffer += decoder.decode(value, { stream: true });
				const lines = buffer.split('\n');
				buffer = lines.pop() ?? '';

				for (const line of lines) {
					if (!line.startsWith('data: ')) continue;
					const data = line.slice(6).trim();
					if (!data) continue;

					try {
						const event = JSON.parse(data);

						if (event.type === 'content') {
							fullHtml += event.text;
							streamBuffer = fullHtml;
						} else if (event.type === 'done') {
							// Update session ID for continuity
							if (event.session_id) {
								sessionId = event.session_id;
							}
						} else if (event.type === 'error') {
							messages = [...messages, {
								role: 'assistant',
								content: `Error: ${event.message}`,
								timestamp: new Date()
							}];
							streaming = false;
							return;
						}
					} catch {
						// Skip malformed JSON
					}
				}
			}

			// Streaming complete - add the full message
			const assistantMsg: ChatMessage = {
				role: 'assistant',
				content: fullHtml,
				html: fullHtml,
				timestamp: new Date()
			};
			messages = [...messages, assistantMsg];
			currentHtml = fullHtml;
			streamBuffer = '';

			// Run validation
			validationItems = validateHtml(fullHtml);
			showValidation = validationItems.some(v => v.level !== 'info');

			// Reload sessions in case a new one was created
			loadSessions();
		} catch (err) {
			messages = [...messages, {
				role: 'assistant',
				content: `Network error: ${err instanceof Error ? err.message : String(err)}`,
				timestamp: new Date()
			}];
		} finally {
			streaming = false;
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			sendMessage();
		}
	}

	function formatTime(date: Date): string {
		return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	}

	function escapeHtml(str: string): string {
		return str
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;');
	}
</script>

<svelte:head>
	<title>AI Generate - Bookingtimes Emulator</title>
</svelte:head>

<div class="generate-page">
	<!-- Header -->
	<div class="d-flex align-items-center justify-content-between mb-3">
		<div>
			<h1 class="fw-bold mb-0 fs-4">
				<i class="fa-solid fa-wand-magic-sparkles text-primary me-2"></i>AI Content Generator
			</h1>
			<p class="text-muted mb-0 small">Generate and preview HTML content with AI</p>
		</div>
	</div>

	<!-- Page Loading Indicator -->
	{#if pageLoading}
		<div class="alert alert-info py-2 small mb-3">
			<i class="fa-solid fa-spinner fa-spin me-1"></i> Loading page content...
		</div>
	{/if}

	<!-- Loaded Page Banner -->
	{#if loadedPage}
		<div class="alert alert-success py-2 small mb-3 d-flex align-items-center justify-content-between">
			<div>
				<i class="fa-solid fa-file-import me-1"></i>
				Editing imported page: <strong>{loadedPage.title}</strong>
				<span class="text-muted ms-2">({loadedPage.status})</span>
			</div>
			<button class="btn btn-sm btn-outline-success" onclick={() => { loadedPage = null; loadedPageHtml = ''; }}>
				<i class="fa-solid fa-times me-1"></i>Clear
			</button>
		</div>
	{/if}

	<!-- Controls Bar -->
	<div class="controls-bar card border-0 shadow-sm mb-3">
		<div class="card-body py-2">
			<div class="row g-2 align-items-end">
				<div class="col-md-3">
					<label for="site-select" class="form-label small text-muted mb-1">Site</label>
					<select id="site-select" class="form-select form-select-sm" bind:value={siteId}>
						<option value="">Select a site...</option>
						{#each sites as site}
							<option value={site.id}>{site.name}</option>
						{/each}
					</select>
				</div>
				<div class="col-md-3">
					<label for="session-select" class="form-label small text-muted mb-1">Session</label>
					<select id="session-select" class="form-select form-select-sm" bind:value={sessionId} disabled={!siteId}>
						<option value="">New Session</option>
						{#each sessions as sess}
							<option value={sess.id}>
								{new Date(sess.created_at).toLocaleDateString()} {new Date(sess.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
							</option>
						{/each}
					</select>
				</div>
				<div class="col-md-2">
					<label for="action-select" class="form-label small text-muted mb-1">Action</label>
					<select id="action-select" class="form-select form-select-sm" bind:value={action}>
						<option value="generate">Generate</option>
						<option value="refine">Refine</option>
						<option value="regenerate">Regenerate</option>
					</select>
				</div>
				<div class="col-md-2">
					<button class="btn btn-sm btn-outline-secondary w-100" onclick={() => showSuburb = !showSuburb}>
						<i class="fa-solid fa-map-pin me-1"></i>
						{showSuburb ? 'Hide' : 'Suburb'}
					</button>
				</div>
				<div class="col-md-2">
					<button class="btn btn-sm btn-outline-secondary w-100" disabled>
						<i class="fa-solid fa-puzzle-piece me-1"></i>Template
					</button>
				</div>
			</div>
			{#if showSuburb}
				<div class="row g-2 mt-1">
					<div class="col-md-4">
						<input type="text" class="form-control form-control-sm" placeholder="Suburb name (e.g., Bondi Beach)" bind:value={suburb} />
					</div>
				</div>
			{/if}
		</div>
	</div>

	<!-- Split View -->
	<div class="split-view">
		<!-- Chat Panel -->
		<div class="chat-panel">
			<!-- Messages Area -->
			<div class="chat-messages" bind:this={chatContainer}>
				{#if messages.length === 0 && !streaming}
					<div class="empty-state">
						<i class="fa-solid fa-comments text-muted mb-3" style="font-size: 2.5rem;"></i>
						<p class="text-muted mb-1">No messages yet</p>
						<p class="text-muted small">Select a site and describe what content you want to generate.</p>
					</div>
				{/if}

				{#each messages as msg, idx}
					<div class="chat-msg" class:chat-msg-user={msg.role === 'user'} class:chat-msg-assistant={msg.role === 'assistant'}>
						<div class="msg-header">
							{#if msg.role === 'user'}
								<i class="fa-solid fa-user me-1"></i> You
							{:else}
								<i class="fa-solid fa-robot me-1"></i> AI
							{/if}
							<span class="msg-time">{formatTime(msg.timestamp)}</span>
						</div>
						<div class="msg-body">
							{#if msg.role === 'user'}
								{msg.content}
							{:else if msg.html}
								<!-- Rendered HTML preview -->
								<div class="rendered-html-preview">{@html sanitizeHtml(msg.html)}</div>
								<!-- Collapsible raw code -->
								<button class="btn btn-sm btn-outline-light mt-2 code-toggle" onclick={() => toggleCodeBlock(idx)}>
									<i class="fa-solid" class:fa-chevron-down={!expandedCodeBlocks.has(idx)} class:fa-chevron-up={expandedCodeBlocks.has(idx)}></i>
									{expandedCodeBlocks.has(idx) ? 'Hide' : 'Show'} HTML Source
								</button>
								{#if expandedCodeBlocks.has(idx)}
									<pre class="code-block"><code>{escapeHtml(msg.content)}</code></pre>
								{/if}
							{:else}
								{msg.content}
							{/if}
						</div>
					</div>
				{/each}

				<!-- Streaming indicator -->
				{#if streaming}
					<div class="chat-msg chat-msg-assistant">
						<div class="msg-header">
							<i class="fa-solid fa-robot me-1"></i> AI
							<span class="msg-time">generating...</span>
						</div>
						<div class="msg-body">
							{#if streamBuffer}
								<div class="rendered-html-preview">{@html sanitizeHtml(streamBuffer)}</div>
							{:else}
								<div class="typing-indicator">
									<span></span><span></span><span></span>
								</div>
							{/if}
						</div>
					</div>
				{/if}
			</div>

			<!-- Input Area -->
			<div class="chat-input-area">
				{#if !siteId}
					<div class="text-center text-muted py-2 small">
						<i class="fa-solid fa-arrow-up me-1"></i> Select a site above to start generating
					</div>
				{:else}
					<div class="d-flex gap-2">
						<textarea
							class="form-control chat-textarea"
							placeholder="Describe the content you want to generate..."
							bind:value={prompt}
							onkeydown={handleKeydown}
							disabled={streaming || !siteId}
							rows="2"
						></textarea>
						<button
							class="btn btn-primary send-btn"
							onclick={sendMessage}
							disabled={streaming || !prompt.trim() || !siteId}
						>
							{#if streaming}
								<span class="spinner-border spinner-border-sm"></span>
							{:else}
								<i class="fa-solid fa-paper-plane"></i>
							{/if}
						</button>
					</div>
				{/if}
			</div>
		</div>

		<!-- Preview Panel -->
		<div class="preview-panel">
			<div class="preview-header">
				<i class="fa-solid fa-eye me-2"></i>Live Preview
				{#if currentHtml}
					<span class="badge bg-success ms-2">Updated</span>
				{/if}
			</div>
			<div class="preview-body">
				{#if currentHtml}
					<PreviewFrame html={currentHtml} siteId={siteId} />
				{:else}
					<div class="preview-placeholder">
						<i class="fa-solid fa-desktop text-muted mb-2" style="font-size: 2rem;"></i>
						<p class="text-muted small mb-0">Preview will appear here after generation</p>
					</div>
				{/if}
			</div>
		</div>
	</div>

	<!-- Validation Panel -->
	{#if showValidation && validationItems.length > 0}
		<div class="validation-panel mt-3">
			<div class="card border-0 shadow-sm">
				<div class="card-header d-flex justify-content-between align-items-center py-2">
					<span class="small fw-semibold">
						<i class="fa-solid fa-clipboard-check me-1"></i> Validation Results
					</span>
					<button class="btn btn-sm btn-close" onclick={() => showValidation = false} aria-label="Close"></button>
				</div>
				<div class="card-body py-2">
					{#each validationItems as item}
						<div class="d-flex align-items-start gap-2 mb-1">
							{#if item.level === 'error'}
								<i class="fa-solid fa-circle-xmark text-danger mt-1"></i>
							{:else if item.level === 'warning'}
								<i class="fa-solid fa-triangle-exclamation text-warning mt-1"></i>
							{:else}
								<i class="fa-solid fa-circle-check text-success mt-1"></i>
							{/if}
							<span class="small">{item.message}</span>
						</div>
					{/each}
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	.generate-page {
		display: flex;
		flex-direction: column;
		height: calc(100vh - 2rem);
		max-height: calc(100vh - 2rem);
	}

	/* Split view layout */
	.split-view {
		display: flex;
		flex: 1;
		gap: 0;
		min-height: 0;
		border-radius: 8px;
		overflow: hidden;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
	}

	/* Chat Panel */
	.chat-panel {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-width: 0;
		background: #1a1d23;
		color: #e0e0e0;
	}

	.chat-messages {
		flex: 1;
		overflow-y: auto;
		padding: 16px;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		flex: 1;
		opacity: 0.7;
	}

	/* Chat messages */
	.chat-msg {
		max-width: 85%;
		animation: msgIn 0.2s ease-out;
	}

	@keyframes msgIn {
		from { opacity: 0; transform: translateY(8px); }
		to { opacity: 1; transform: translateY(0); }
	}

	.chat-msg-user {
		align-self: flex-end;
	}

	.chat-msg-assistant {
		align-self: flex-start;
	}

	.msg-header {
		font-size: 0.7rem;
		color: #888;
		margin-bottom: 4px;
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.msg-time {
		margin-left: auto;
		font-size: 0.65rem;
	}

	.msg-body {
		padding: 10px 14px;
		border-radius: 10px;
		font-size: 0.875rem;
		line-height: 1.5;
		word-break: break-word;
	}

	.chat-msg-user .msg-body {
		background: #2563eb;
		color: #fff;
		border-bottom-right-radius: 4px;
	}

	.chat-msg-assistant .msg-body {
		background: #2a2d35;
		color: #e0e0e0;
		border-bottom-left-radius: 4px;
	}

	/* Rendered HTML preview inside chat */
	.rendered-html-preview {
		background: #fff;
		color: #333;
		border-radius: 6px;
		padding: 12px;
		margin-bottom: 4px;
		max-height: 300px;
		overflow-y: auto;
	}

	/* Code block */
	.code-toggle {
		font-size: 0.7rem;
		padding: 2px 8px;
		border-color: #555;
		color: #aaa;
	}

	.code-toggle:hover {
		border-color: #888;
		color: #ddd;
		background: rgba(255, 255, 255, 0.05);
	}

	.code-block {
		background: #0d1117;
		color: #c9d1d9;
		border-radius: 6px;
		padding: 12px;
		margin-top: 8px;
		font-size: 0.75rem;
		max-height: 250px;
		overflow: auto;
		white-space: pre-wrap;
		word-break: break-all;
	}

	.code-block code {
		font-family: 'SFMono-Regular', 'Cascadia Code', 'Fira Code', monospace;
	}

	/* Typing indicator */
	.typing-indicator {
		display: flex;
		gap: 4px;
		padding: 4px 0;
	}

	.typing-indicator span {
		width: 8px;
		height: 8px;
		background: #666;
		border-radius: 50%;
		animation: typingDot 1.4s infinite ease-in-out;
	}

	.typing-indicator span:nth-child(2) { animation-delay: 0.2s; }
	.typing-indicator span:nth-child(3) { animation-delay: 0.4s; }

	@keyframes typingDot {
		0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
		30% { transform: translateY(-6px); opacity: 1; }
	}

	/* Chat input */
	.chat-input-area {
		padding: 12px 16px;
		border-top: 1px solid #2a2d35;
		background: #1e2128;
	}

	.chat-textarea {
		background: #2a2d35;
		border: 1px solid #3a3d45;
		color: #e0e0e0;
		resize: none;
		font-size: 0.875rem;
	}

	.chat-textarea:focus {
		background: #2a2d35;
		border-color: #2563eb;
		color: #e0e0e0;
		box-shadow: 0 0 0 0.2rem rgba(37, 99, 235, 0.25);
	}

	.chat-textarea::placeholder {
		color: #666;
	}

	.send-btn {
		width: 48px;
		height: 48px;
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	/* Preview Panel */
	.preview-panel {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-width: 0;
		background: #fff;
		border-left: 1px solid #dee2e6;
	}

	.preview-header {
		padding: 10px 16px;
		font-size: 0.8rem;
		font-weight: 600;
		color: #555;
		background: #f8f9fa;
		border-bottom: 1px solid #dee2e6;
		display: flex;
		align-items: center;
	}

	.preview-body {
		flex: 1;
		position: relative;
		min-height: 0;
	}

	.preview-body :global(.preview-frame-container) {
		min-height: 100% !important;
		height: 100% !important;
		border: none !important;
		border-radius: 0 !important;
	}

	.preview-body :global(.preview-iframe) {
		min-height: 100% !important;
		height: 100% !important;
	}

	.preview-placeholder {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100%;
		min-height: 400px;
	}

	/* Validation */
	.validation-panel {
		flex-shrink: 0;
	}

	/* Responsive */
	@media (max-width: 991.98px) {
		.split-view {
			flex-direction: column;
		}

		.chat-panel {
			min-height: 50vh;
		}

		.preview-panel {
			min-height: 40vh;
			border-left: none;
			border-top: 1px solid #dee2e6;
		}
	}

	/* Scrollbar styling for chat */
	.chat-messages::-webkit-scrollbar {
		width: 6px;
	}

	.chat-messages::-webkit-scrollbar-track {
		background: transparent;
	}

	.chat-messages::-webkit-scrollbar-thumb {
		background: #3a3d45;
		border-radius: 3px;
	}

	.chat-messages::-webkit-scrollbar-thumb:hover {
		background: #555;
	}
</style>
