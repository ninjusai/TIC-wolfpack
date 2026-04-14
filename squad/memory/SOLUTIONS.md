# Wolf Pack Solutions

Solutions to problems encountered across projects. When you hit a problem, check here first.

---

## Solution Template

```markdown
## {Problem Title}

**ID:** SOL-{NNN}
**Added:** {YYYY-MM-DD}
**Added By:** {agent_name}
**Category:** {error|integration|performance|configuration|other}
**Frequency:** {one-time|occasional|recurring|common}

### Problem

{Clear description of the problem}

### Symptoms

- {How to recognize this problem}
- {Error message or behavior}

### Root Cause

{Why does this problem occur?}

### Solution

{Step-by-step solution}

1. {Step 1}
2. {Step 2}
3. {Step 3}

### Verification

{How to confirm the solution worked}

### Prevention

{How to avoid this problem in the future}

### Related

- SOL-{XXX}: {Related solution}
- PAT-{XXX}: {Related pattern}

---
```

---

## Categories

| Category | Description |
|----------|-------------|
| error | Runtime errors, exceptions, crashes |
| integration | Issues with external services, APIs, tools |
| performance | Slow operations, resource issues |
| configuration | Setup, environment, config problems |
| other | Miscellaneous |

---

## Frequency Levels

| Level | Description |
|-------|-------------|
| one-time | Happened once, unlikely to recur |
| occasional | Happens rarely, worth documenting |
| recurring | Happens regularly under certain conditions |
| common | Frequent problem, high value solution |

---

## Search Tips

When you hit a problem:
1. Search this file for keywords from error messages
2. Check the category section
3. If not found, solve it and add a new entry

---

## Archive Policy

Solutions marked "one-time" and unused for 6+ months may be archived.
Archived solutions go to: `archive/SOLUTIONS_ARCHIVE_v{N}.md`

---

## Solutions

<!-- Add solutions below this line, grouped by category -->

### Error

## SolidJS App Won't Render / White Screen (No Console Errors)

**ID:** SOL-003
**Added:** 2026-04-02
**Added By:** scribe
**Category:** error
**Frequency:** recurring

### Problem

SolidJS application renders a blank white screen with zero console errors. The `<div id="root">` appears empty or contains only the static placeholder from index.html.

### Symptoms

- Blank white page when running `npm run dev`
- No JavaScript errors in browser console
- Vite dev server serves all modules correctly (200 status)
- Network tab shows all resources loading
- `document.getElementById('root').innerHTML` is empty or contains placeholder

### Root Cause

Multiple possible causes (check in this order):

1. **@solidjs/router non-Route children** — Non-Route components (Nav, Sidebar) placed as direct children of `<Router>` silently corrupt the route table in v0.14+. Nothing renders, no error.
2. **render() append behavior** — SolidJS `render()` appends to the container; static placeholder content from HTML is never removed, making it look like the app didn't mount.
3. **vite-plugin-pwa devOptions** — `devOptions: { enabled: true }` with InjectManifest strategy causes SW compilation failure, which can prevent the module graph from loading.
4. **ES module silent failure** — Any broken static import in the transitive dependency graph silently prevents the entire module from executing.
5. **Network-dependent component crash** — Auth or data-fetching components without ErrorBoundary crash the render tree when backend is unreachable.

### Solution

Apply fixes in order of likelihood:

1. **Check Router structure:**
   ```tsx
   // Move non-Route children into root layout
   <Router root={AppLayout}>
     <Route path="/" component={Home} />
   </Router>
   ```

2. **Clear container before render:**
   ```tsx
   root.innerHTML = "";
   render(() => <App />, root);
   ```

3. **Disable PWA devOptions:**
   ```typescript
   devOptions: { enabled: false }
   ```

4. **Add defensive error listeners in index.html:**
   ```html
   <script>
   window.addEventListener('error', (e) => {
     document.getElementById('root').innerHTML = '<pre>' + e.message + '</pre>';
   });
   window.addEventListener('unhandledrejection', (e) => {
     document.getElementById('root').innerHTML = '<pre>' + e.reason + '</pre>';
   });
   </script>
   ```

5. **Wrap network-dependent components in ErrorBoundary:**
   ```tsx
   <ErrorBoundary fallback={(err) => <ServerUnavailable error={err} />}>
     <AuthProvider>{props.children}</AuthProvider>
   </ErrorBoundary>
   ```

### Verification

- App renders content in the browser
- No blank screen on initial load
- App shows "Server Unavailable" UI (not blank screen) when backend is down
- `document.getElementById('root').children.length > 0` in console

### Prevention

- Always use `<Router root={Layout}>` pattern in @solidjs/router v0.14+
- Always clear innerHTML before render() when HTML has placeholder content
- Always wrap auth/fetch components in ErrorBoundary
- Keep `devOptions: { enabled: false }` in vite-plugin-pwa config
- Add global error listeners in index.html as safety net

### Related

- PAT-011: SolidJS Router Root Prop Pattern
- PAT-012: SolidJS render() Append Behavior
- PAT-013: ErrorBoundary on Network-Dependent Components
- PAT-014: ES Module Silent Failure Defense
- PAT-015: vite-plugin-pwa devOptions

---

### Integration

## PeakProtocol Deployment Checklist (Cloudflare Stack)

**ID:** SOL-004
**Added:** 2026-04-02
**Added By:** scribe
**Category:** integration
**Frequency:** recurring

### Problem

Deploying a full-stack application to Cloudflare's edge platform (Workers + Pages + D1 + KV + R2) requires coordinating multiple services, secrets, and bindings that are easy to misconfigure.

### Symptoms

- Worker deploys but returns 500 errors (missing bindings)
- Pages build succeeds but API calls fail (wrong API URL)
- D1 database exists but migrations haven't run
- KV/R2 namespaces not bound to the worker
- Secrets not set, causing auth failures

### Root Cause

Cloudflare's edge stack has many moving parts that must be configured in the correct order with consistent naming.

### Solution

Follow this checklist in order:

1. **Create D1 database:**
   ```bash
   wrangler d1 create [db-name]
   ```
   Note the database ID for wrangler.toml.

2. **Run D1 migrations:**
   ```bash
   wrangler d1 execute [db-name] --remote --file=migrations/001_init.sql
   ```

3. **Create KV namespace:**
   ```bash
   wrangler kv namespace create [namespace-name]
   ```
   Note the namespace ID for wrangler.toml.

4. **Create R2 bucket:**
   ```bash
   wrangler r2 bucket create [bucket-name]
   ```

5. **Configure wrangler.toml bindings:**
   ```toml
   [[d1_databases]]
   binding = "DB"
   database_name = "[db-name]"
   database_id = "[id-from-step-1]"

   [[kv_namespaces]]
   binding = "KV"
   id = "[id-from-step-3]"

   [[r2_buckets]]
   binding = "R2"
   bucket_name = "[bucket-name]"
   ```

6. **Set secrets:**
   ```bash
   wrangler secret put JWT_SECRET
   wrangler secret put [OTHER_SECRETS]
   ```

7. **Deploy worker:**
   ```bash
   wrangler deploy
   ```

8. **Deploy Pages (frontend):**
   ```bash
   # Build frontend
   npm run build
   # Deploy to Pages
   wrangler pages deploy dist --project-name=[project]
   ```

9. **Configure Pages environment variables:**
   - Set `VITE_API_URL` to the Worker URL
   - Set any other build-time variables

10. **Verify:**
    - Worker health check endpoint responds
    - Frontend loads and can reach the API
    - Auth flow works end-to-end
    - Data operations (CRUD) work

### Verification

- `curl https://[worker].workers.dev/health` returns 200
- Frontend at `https://[project].pages.dev` loads
- Login/signup flow completes
- Core workflows function

### Prevention

- Keep a deployment checklist in the project's docs/
- Use wrangler.toml for all bindings (not dashboard)
- Define deployment in Phase 1 architecture decisions
- Include deployment verification in eval spec

### Related

- PAT-017: Local Verification Before Complete
- SOL-005: SolidJS Project Starter Checklist

---

## SolidJS Project Starter Checklist

**ID:** SOL-005
**Added:** 2026-04-02
**Added By:** scribe
**Category:** configuration
**Frequency:** recurring

### Problem

New SolidJS projects hit the same set of gotchas repeatedly: blank screens from router misconfiguration, render() append behavior, PWA dev mode issues, and silent module failures.

### Symptoms

- Blank screen on first run
- Placeholder content persists after app mounts
- Vite dev server fails with SW compilation errors
- App crashes silently with no console output

### Root Cause

SolidJS has several non-obvious behaviors that differ from React and other frameworks. These are well-documented once known, but consistently trip up first-time setups.

### Solution

Apply this checklist to every new SolidJS project:

1. **Router root prop** — Use `<Router root={Layout}>` for persistent layout elements. Never put non-Route children directly in `<Router>`.
   ```tsx
   <Router root={AppLayout}>
     <Route path="/" component={Home} />
   </Router>
   ```

2. **Clear innerHTML before render()** — SolidJS `render()` appends, doesn't replace.
   ```tsx
   const root = document.getElementById("root");
   if (root) {
     root.innerHTML = "";
     render(() => <App />, root);
   }
   ```

3. **ErrorBoundary on network-dependent components** — Wrap auth providers and data fetchers.
   ```tsx
   <ErrorBoundary fallback={(err) => <ErrorUI error={err} />}>
     <AuthProvider>{props.children}</AuthProvider>
   </ErrorBoundary>
   ```

4. **Defensive error listeners in index.html** — Non-module script to catch silent failures.
   ```html
   <script>
     window.addEventListener('error', (e) => {
       document.getElementById('root').innerHTML =
         '<pre style="color:red">Error: ' + e.message + '</pre>';
     });
     window.addEventListener('unhandledrejection', (e) => {
       document.getElementById('root').innerHTML =
         '<pre style="color:red">Unhandled: ' + e.reason + '</pre>';
     });
   </script>
   ```

5. **PWA devOptions** — Keep `devOptions: { enabled: false }` (or omit) in vite-plugin-pwa config. `enabled: true` with InjectManifest causes `__WB_MANIFEST` compilation failures.

### Verification

- App renders on first `npm run dev`
- No blank screen issues
- Error UI appears when backend is unreachable (not blank screen)
- Vite dev server starts cleanly

### Prevention

- Use this checklist as a Phase 1 verification gate for all SolidJS projects
- Add to project scaffolding templates

### Related

- PAT-011: SolidJS Router Root Prop Pattern
- PAT-012: SolidJS render() Append Behavior
- PAT-013: ErrorBoundary on Network-Dependent Components
- PAT-014: ES Module Silent Failure Defense
- PAT-015: vite-plugin-pwa devOptions
- SOL-003: SolidJS White Screen Debugging

---

### Performance

{Performance solutions go here}

### Configuration

## rusqlite WAL Mode Configuration

**ID:** SOL-001
**Added:** 2026-03-31
**Added By:** scribe
**Category:** configuration
**Frequency:** recurring

### Problem

SQLite database lock contention when multiple processes (e.g., desktop app and CLI agents) need to access the same database simultaneously.

### Symptoms

- "database is locked" errors
- Timeouts when querying the database
- Inconsistent reads

### Root Cause

SQLite's default journal mode is DELETE, which doesn't support concurrent readers and writers well.

### Solution

1. Open the database connection with WAL mode enabled:

```rust
let conn = Connection::open(path)?;
conn.execute_batch("PRAGMA journal_mode=WAL;")?;
```

2. For read-only access (like a GUI viewer), ensure you're not holding transactions open longer than necessary.

3. Use `busy_timeout` to handle temporary locks:

```rust
conn.busy_timeout(Duration::from_secs(5))?;
```

### Verification

- Query `PRAGMA journal_mode;` - should return `wal`
- Verify concurrent read/write works without lock errors

### Prevention

- Always configure WAL mode at connection open
- Keep transactions short
- Use read-only connections when possible

### Related

- PAT-001: Tauri + SolidJS Desktop App

---

## Python Eval Harness Setup with pytest

**ID:** SOL-002
**Added:** 2026-03-31
**Added By:** scribe
**Category:** configuration
**Frequency:** recurring

### Problem

Need to set up a Python eval harness that can test a Tauri desktop application with fixture data.

### Symptoms

- Unclear how to structure eval tests
- Difficulty automating GUI testing
- Fixture data management issues

### Root Cause

Desktop app testing requires coordination between fixture setup, application launch, UI interaction, and result validation.

### Solution

1. Structure the eval harness:

```
evals/
  conftest.py           # pytest fixtures
  test_eval_cases.py    # test functions
  fixtures/
    projects/           # manifest.json, artifacts
    db/                 # wolfpack.db fixtures
  scorers/
    __init__.py
    data_match.py
```

2. Use pytest fixtures for setup/teardown:

```python
@pytest.fixture
def fixture_projects(tmp_path):
    # Copy fixture data to temp directory
    # Return path
    pass
```

3. For GUI testing, consider:
   - Tauri's WebDriver support
   - Playwright with Chrome DevTools Protocol
   - Semi-automated with manual app launch

4. Run with: `pytest evals/ -v`

### Verification

- All 27 eval cases pass
- CI pipeline runs successfully

### Prevention

- Keep fixtures version-controlled
- Document fixture generation process
- Automate fixture refresh

### Related

- PAT-002: Eval-First Development
- PAT-003: Python Eval Harness with pytest

---
