# Wolf Pack Patterns

Reusable patterns discovered across projects. These are solutions that work and can be applied to future work.

---

## Pattern Template

```markdown
## {Pattern Name}

**ID:** PAT-{NNN}
**Added:** {YYYY-MM-DD}
**Added By:** {agent_name}
**Category:** {architecture|workflow|code|testing|deployment|other}
**Projects Used:** {comma-separated list}

### Problem

{What recurring problem does this pattern solve?}

### Context

{When does this problem arise? What conditions must exist?}

### Pattern

{Describe the pattern clearly. How do you apply it?}

### Structure

```
{Diagram, file structure, or code skeleton}
```

### Example

```{language}
{Concrete example of the pattern in use}
```

### Benefits

- {Benefit 1}
- {Benefit 2}

### Trade-offs

- {Cost or downside to consider}

### When to Use

- {Condition that suggests this pattern}
- {Another condition}

### When NOT to Use

- {Condition that suggests avoiding this pattern}
- {Another condition}

### Related

- PAT-{XXX}: {Related pattern name}
- SOL-{XXX}: {Related solution}

---
```

---

## Categories

| Category | Description |
|----------|-------------|
| architecture | System structure, component organization |
| workflow | Process patterns, handoffs, pipelines |
| code | Implementation patterns, idioms |
| testing | Testing strategies, eval patterns |
| deployment | CI/CD, release patterns |
| other | Miscellaneous |

---

## Archive Policy

Patterns not used in 6+ months may be reviewed for archival.
Archived patterns go to: `archive/PATTERNS_ARCHIVE_v{N}.md`

---

## Patterns

<!-- Add patterns below this line, grouped by category -->

### Architecture

## Tauri v2 + SolidJS Desktop App

**ID:** PAT-001
**Added:** 2026-03-31
**Added By:** scribe
**Category:** architecture
**Projects Used:** mission-control

### Problem

Building a cross-platform desktop app that needs native file system access, SQLite database access, and a modern reactive UI without the overhead of Electron.

### Context

When building desktop applications that need:
- Native file system watching and access
- Direct SQLite database access with WAL mode
- Fast, reactive UI with minimal bundle size
- Windows 11 standard user compatibility (no admin required)

### Pattern

Use Tauri v2 for the native backend (Rust) and SolidJS for the frontend. Tauri provides native capabilities via Rust commands exposed to JavaScript via IPC. SolidJS provides reactive UI with signals and fine-grained reactivity.

### Structure

```
project/
  src-tauri/
    src/
      main.rs           # Tauri entry point
      commands.rs       # IPC commands
      db.rs             # rusqlite database access
    Cargo.toml          # Rust dependencies
  src/
    App.tsx             # SolidJS entry
    components/         # UI components
    contexts/           # SolidJS contexts for state
  package.json
  tauri.conf.json
```

### Benefits

- Native performance (Rust backend)
- Small binary size (~10MB vs ~150MB for Electron)
- Fine-grained reactivity (SolidJS)
- Direct SQLite access with WAL mode for concurrent reads
- No admin privileges required on Windows

### Trade-offs

- Smaller ecosystem than React/Electron
- Rust learning curve for backend logic
- WebView2 dependency on Windows (pre-installed on Win11)

### When to Use

- Desktop apps needing native file/DB access
- Performance-critical applications
- Single-developer or small team projects

### When NOT to Use

- Web-only applications
- When team has no Rust experience and cannot learn
- When Electron-specific plugins are required

### Related

- PAT-002: Eval-First Development
- SOL-001: rusqlite WAL Mode Configuration

---

### Workflow

## Interview-Style Project Intake

**ID:** PAT-006
**Added:** 2026-04-01
**Added By:** scribe
**Category:** workflow
**Projects Used:** interview-intake, project_development

### Problem

Manual project intake is brittle (requires remembering the protocol), interruptible (context lost on session end), and untracked (partial progress not persisted). This leads to incomplete requirements and inconsistent downstream artifacts.

### Context

When starting new projects in a multi-agent development pipeline where:
- Requirements must be extracted from stakeholders through conversation
- Quality checks must catch solution language, vague users, untestable criteria
- Sessions may be interrupted and must resume
- Output must be structured for programmatic consumption

### Pattern

Use a specialized Interview agent that:
1. Guides users through 5 sequential stages with max questions per stage
2. Detects and redirects solution language ("What problem would that solve?")
3. Probes for specificity on vague inputs
4. Persists responses after every turn (not just at end)
5. Validates completeness before generating output
6. Produces structured JSON (not prose) for downstream consumption

### Structure

```
STAGE 1: Problem Discovery
    | (detect solution language, probe for pain points)
    v
STAGE 2: User & Stakeholder Identification
    | (probe for specific roles + goals)
    v
STAGE 3: Scope Definition
    | (in-scope, out-of-scope explicit)
    v
STAGE 4: Constraints & Dependencies
    | (technical, timeline, resource)
    v
STAGE 5: Success Criteria & Validation
    | (testable criteria with measurements)
    v
OUTPUT: Intake Brief JSON -> Framer -> problem.md
```

### Benefits

- Consistent, high-quality requirements extraction
- Session persistence and resume capability
- Solution language detection prevents premature solutioning
- Testable success criteria feed eval system
- JSON output enables validation gates

### Trade-offs

- Requires specialized agent (more complexity)
- Users must answer questions (not just dump ideas)
- Multi-turn conversation adds latency

### When to Use

- Any multi-agent pipeline needing structured requirements
- Projects where eval-first development is used
- When intake quality directly impacts downstream work

### When NOT to Use

- Quick prototypes with informal requirements
- Single-developer projects with known scope
- When stakeholder is unavailable for conversation

### Related

- PAT-002: Eval-First Development
- SOL-003: Intake Brief JSON Schema

---

## Eval-First Development

**ID:** PAT-002
**Added:** 2026-03-31
**Added By:** scribe
**Category:** workflow
**Projects Used:** mission-control

### Problem

Features get built without clear acceptance criteria, leading to ambiguity about what "done" means and rework when stakeholders discover the implementation doesn't match expectations.

### Context

When building any non-trivial feature that has observable behavior, especially in agent-driven development where multiple agents may implement different parts.

### Pattern

Before implementing any feature:
1. Define the eval spec with concrete test cases
2. Define scorers (algorithmic or human-aligned)
3. Define pass/fail thresholds
4. Build fixtures/datasets for testing
5. Then implement the feature
6. Run evals to verify

### Structure

```
artifacts/{project}/
  problem.md        # Problem definition
  eval-spec.md      # Eval cases, scorers, thresholds
  prd.md            # Requirements derived from eval spec
  build-plan.md     # Work items traced to requirements
```

### Benefits

- Clear "definition of done"
- Automated regression testing
- Reduces ambiguity in agent handoffs
- Creates traceable requirements chain

### Trade-offs

- Upfront investment in eval authoring
- May slow initial development
- Requires discipline to maintain eval-first approach

### When to Use

- Any feature with observable behavior
- Multi-agent development
- Features requiring compliance/audit trail

### When NOT to Use

- Exploratory prototyping
- One-off scripts with no reuse

### Related

- PAT-001: Tauri + SolidJS Desktop App
- SOL-002: Python Eval Harness with pytest

---

### Code

## SolidJS Router v0.14+ Root Prop Pattern

**ID:** PAT-011
**Added:** 2026-04-02
**Added By:** scribe
**Category:** code
**Projects Used:** peakprotocol

### Problem

SolidJS app renders blank page with no errors when non-Route children (e.g., `<Nav />`) are placed directly inside `<Router>`.

### Context

When building SolidJS applications using @solidjs/router v0.14+ where:
- Persistent layout elements (nav bars, sidebars, footers) need to exist alongside routes
- The app renders a blank page with zero console errors
- Route definitions appear correct but nothing renders

### Pattern

In @solidjs/router v0.14+, non-Route children of `<Router>` silently corrupt the route table. Use the `root` prop to wrap routes in a layout component:

```tsx
// BAD — Nav silently breaks all routes
<Router>
  <Nav />
  <Route path="/" component={Home} />
  <Route path="/settings" component={Settings} />
</Router>

// GOOD — Layout wraps routes via root prop
function AppLayout(props: ParentProps) {
  return (
    <>
      <Nav />
      <main>{props.children}</main>
    </>
  );
}

<Router root={AppLayout}>
  <Route path="/" component={Home} />
  <Route path="/settings" component={Settings} />
</Router>
```

### Benefits

- Layout components have full access to router context (useLocation, useNavigate)
- No silent route table corruption
- Idiomatic @solidjs/router v0.14+ pattern

### Trade-offs

- Requires restructuring from React Router mental model
- Layout component must accept ParentProps and render `props.children`

### When to Use

- **Always** when using @solidjs/router v0.14+ with persistent layout elements
- When SolidJS app renders blank with no errors — check this first

### When NOT to Use

- @solidjs/router versions before v0.14 (different API)

### Related

- PAT-012: SolidJS render() Append Behavior
- PAT-013: ErrorBoundary on Network-Dependent Components

---

## SolidJS render() Appends, Doesn't Replace

**ID:** PAT-012
**Added:** 2026-04-02
**Added By:** scribe
**Category:** code
**Projects Used:** peakprotocol

### Problem

Static placeholder content in index.html (e.g., "Loading...") persists after SolidJS app mounts, because `render()` appends to the container rather than replacing its contents.

### Context

When building SolidJS applications where:
- index.html has placeholder/loading content inside the mount target `<div id="root">`
- The app appears not to mount, but actually rendered content is below the placeholder
- Unlike React's `createRoot().render()` which replaces container contents

### Pattern

Always clear the container's innerHTML before calling SolidJS `render()`:

```tsx
const root = document.getElementById("root");
if (root) {
  root.innerHTML = ""; // Clear placeholder content
  render(() => <App />, root);
}
```

### Benefits

- Clean mount with no leftover placeholder content
- Consistent behavior regardless of HTML placeholder content
- Prevents confusion during debugging

### Trade-offs

- Brief flash if clearing happens before render completes (negligible)

### When to Use

- **Always** when the mount target has any static HTML content
- Any SolidJS project with loading placeholders in index.html

### When NOT to Use

- When mount target is guaranteed empty

### Related

- PAT-011: SolidJS Router Root Prop Pattern

---

## ErrorBoundary on Network-Dependent Components

**ID:** PAT-013
**Added:** 2026-04-02
**Added By:** scribe
**Category:** code
**Projects Used:** peakprotocol

### Problem

Network-dependent components (auth flows, data fetching) crash the entire SolidJS render tree to a white screen when the backend is unreachable. SolidJS swallows errors in reactive computations silently.

### Context

When building SolidJS applications where:
- Components make fetch calls to an API backend
- The backend may be unreachable (local dev, mobile, network issues)
- No ErrorBoundary exists to catch the failure
- The app crashes to a blank white screen with no error displayed to the user

### Pattern

Wrap all network-dependent component subtrees in SolidJS ErrorBoundary with a contextual fallback UI:

```tsx
import { ErrorBoundary } from "solid-js";

function AuthGuard(props: ParentProps) {
  return (
    <ErrorBoundary fallback={(err) => (
      <div>
        <h2>Server Unavailable</h2>
        <p>{friendlyAuthError(err)}</p>
        <button onClick={() => location.reload()}>Retry</button>
      </div>
    )}>
      <AuthProvider>
        {props.children}
      </AuthProvider>
    </ErrorBoundary>
  );
}
```

### Benefits

- Graceful degradation when backend is unreachable
- User sees actionable error UI instead of blank screen
- Prevents cascade failure through the entire render tree

### Trade-offs

- Must design fallback UI for each boundary
- Error recovery may require full page reload in some cases

### When to Use

- **Always** around auth flows, data fetching components, any network-dependent UI
- SolidJS applications (errors in reactive computations are swallowed silently)

### When NOT to Use

- Pure presentational components with no side effects

### Related

- PAT-011: SolidJS Router Root Prop Pattern
- PAT-014: ES Module Silent Failure Defense

---

## ES Module Silent Failure Defense

**ID:** PAT-014
**Added:** 2026-04-02
**Added By:** scribe
**Category:** code
**Projects Used:** peakprotocol

### Problem

If a static import anywhere in the transitive dependency graph fails, the entire ES module silently does not execute. No console error appears. The app simply doesn't start.

### Context

When building modern web applications using ES modules where:
- The app fails to start with zero console output
- All module URLs serve 200 OK
- Import chain appears valid
- The issue is a single broken import deep in the dependency tree

### Pattern

Add defensive error listeners in index.html using a non-module script tag (which executes independently of the module graph):

```html
<script>
  // Catch any unhandled errors (including module load failures)
  window.addEventListener('error', (e) => {
    document.getElementById('root').innerHTML =
      '<pre style="color:red">Error: ' + e.message + '</pre>';
  });
  window.addEventListener('unhandledrejection', (e) => {
    document.getElementById('root').innerHTML =
      '<pre style="color:red">Unhandled: ' + e.reason + '</pre>';
  });
  // Unregister stale service workers that may serve broken cached modules
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(regs =>
      regs.forEach(r => r.unregister())
    );
  }
</script>
```

### Benefits

- Catches errors that ES module system swallows silently
- Provides visible error feedback when module graph fails
- Prevents stale SW from serving broken cached modules

### Trade-offs

- Extra script tag in HTML
- SW unregistration may cause brief recache on next load

### When to Use

- Any SPA using ES modules, especially during development
- When debugging blank-screen issues with no console output

### When NOT to Use

- Production builds where you want SW caching active (remove SW unregister)

### Related

- PAT-013: ErrorBoundary on Network-Dependent Components
- PAT-015: vite-plugin-pwa devOptions

---

## vite-plugin-pwa devOptions Configuration

**ID:** PAT-015
**Added:** 2026-04-02
**Added By:** scribe
**Category:** configuration
**Projects Used:** peakprotocol

### Problem

`vite-plugin-pwa` with `devOptions: { enabled: true }` causes Vite to attempt compiling the service worker in dev mode, but `self.__WB_MANIFEST` (Workbox manifest placeholder) is never injected during dev builds, causing compilation failures.

### Context

When using vite-plugin-pwa with InjectManifest strategy where:
- Dev server fails to start or SW fails to compile
- `self.__WB_MANIFEST` reference errors appear
- Service worker works fine in production build but breaks in dev

### Pattern

Keep `devOptions: { enabled: false }` (or omit entirely) unless you specifically need to debug service worker behavior in dev mode:

```typescript
// vite.config.ts
VitePWA({
  strategies: 'injectManifest',
  srcDir: 'src',
  filename: 'sw.ts',
  devOptions: {
    enabled: false // IMPORTANT: true causes __WB_MANIFEST compilation issues
  },
  // ...
})
```

### Benefits

- Dev server starts cleanly without SW compilation issues
- Production builds still get proper SW with injected manifest

### Trade-offs

- Cannot test SW behavior in dev mode (must use production build)
- May miss SW-related bugs until production testing

### When to Use

- **Default** for all vite-plugin-pwa InjectManifest configurations
- Any project where SW is not actively being debugged

### When NOT to Use

- When actively debugging service worker behavior (temporarily enable)

### Related

- PAT-014: ES Module Silent Failure Defense

---

## Rust/TypeScript Contract Alignment with Serde

**ID:** PAT-007
**Added:** 2026-04-01
**Added By:** scribe
**Category:** code
**Projects Used:** mission-control

### Problem

TypeScript interfaces don't match Rust structs, causing silent data mismatches, undefined field access, and runtime crashes when deserializing IPC responses.

### Context

When building Tauri applications where:
- Rust backend uses `serde` with `rename_all = "camelCase"` for JSON serialization
- TypeScript frontend expects specific field names
- Field names differ between layers (e.g., Rust `size` vs TypeScript `sizeBytes`)
- Nullable fields in Rust become `| null` in TypeScript

### Pattern

TypeScript interfaces MUST match Rust structs EXACTLY after serde camelCase transformation:

1. **Field name transformation:** Rust `event_type` becomes JSON/TypeScript `eventType`
2. **Optional fields:** Rust `Option<T>` becomes TypeScript `field: T | null`
3. **Integer types:** Rust `i64` becomes TypeScript `number`
4. **Boolean fields:** Don't use string enum when boolean is appropriate

### Structure

```rust
// Rust struct
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ArtifactInfo {
    pub path: String,
    pub size_bytes: u64,       // becomes sizeBytes
    pub is_dir: bool,          // becomes isDir
    pub last_modified: Option<String>, // becomes lastModified: string | null
}
```

```typescript
// TypeScript interface - MUST match exactly
interface ArtifactInfo {
    path: string;
    sizeBytes: number;         // NOT size
    isDir: boolean;            // NOT type: string
    lastModified: string | null; // NOT lastModified?: string
}
```

### Benefits

- No silent data mismatches
- No undefined field access crashes
- Type safety across IPC boundary
- Predictable serialization behavior

### Trade-offs

- Requires discipline to keep interfaces in sync
- Manual verification needed when Rust structs change
- Consider code generation tools for large APIs

### When to Use

- **Always** when building Tauri/Rust + TypeScript applications
- Any cross-language boundary with JSON serialization

### When NOT to Use

- Never skip this; contract alignment is essential

### Related

- PAT-001: Tauri + SolidJS Desktop App
- PAT-005: Tauri v2 IPC Configuration

---

## Pipeline Manifest Updates

**ID:** PAT-008
**Added:** 2026-04-01
**Added By:** scribe
**Category:** workflow
**Projects Used:** peakprotocol, project_development

### Problem

Pipeline stages complete but the project manifest doesn't reflect current progress, leading to stale status information and difficulty tracking where projects are in the pipeline.

### Context

When running multi-stage artifact pipelines where:
- Multiple agents work on different stages sequentially
- Each stage produces artifacts that feed into the next
- Project status needs to be visible to operators and monitoring tools
- Pipeline gates determine readiness for next stages

### Pattern

Pipeline agents should update `manifest.json` as they complete their stages:

1. **Before starting:** Check manifest for prerequisites and gate status
2. **On completion:** Update stage status to "complete", set gate to "passed"
3. **Update current_stage:** Reflect the new active stage
4. **Record artifact path:** Document what was produced

### Structure

```json
{
  "slug": "project-slug",
  "current_stage": "build-plan",
  "pipeline": {
    "stages": {
      "problem": {
        "status": "complete",
        "agent": "framer",
        "artifact": "problem.md",
        "gate": { "status": "passed", "attempts": 1 }
      },
      "eval-spec": {
        "status": "complete",
        "agent": "eval",
        "artifact": "eval-spec.md",
        "gate": { "status": "passed", "attempts": 1 }
      }
    }
  }
}
```

### Benefits

- Real-time pipeline visibility
- Clear audit trail of stage completion
- Enables monitoring dashboards (Mission Control)
- Supports pipeline restart from any stage
- Documents which agent completed each stage

### Trade-offs

- Requires discipline from pipeline agents
- Adds I/O overhead for manifest updates
- Must handle concurrent access if parallel stages exist

### When to Use

- Any multi-stage artifact pipeline
- When pipeline visibility is important
- When stages have gates or quality checks

### When NOT to Use

- Single-stage workflows
- Prototype/exploration work without formal pipeline

### Related

- PAT-002: Eval-First Development
- PAT-006: Interview-Style Project Intake

---

## Tauri v2 IPC Configuration (withGlobalTauri)

**ID:** PAT-005
**Added:** 2026-03-31
**Added By:** scribe
**Category:** code
**Projects Used:** mission-control

### Problem

Tauri v2 IPC calls from frontend JavaScript fail silently, returning undefined. The frontend cannot communicate with the Rust backend, causing fallback to mock data or error states.

### Context

When building Tauri v2 applications where:
- Frontend uses `@tauri-apps/api/core` to invoke Rust commands
- IPC calls return undefined or fail silently
- `window.__TAURI__` is undefined in the browser console
- App appears to work but uses mock data instead of real backend data

### Pattern

Always include `withGlobalTauri: true` in the Tauri v2 capabilities configuration. This flag instructs Tauri to inject the `window.__TAURI__` global into the webview, which is required for IPC to function.

### Structure

```json
// tauri.conf.json
{
  "app": {
    "withGlobalTauri": true,
    "windows": [
      {
        "title": "Your App",
        "width": 1200,
        "height": 800
      }
    ]
  }
}
```

### Example

Before (broken):
```json
{
  "app": {
    "windows": [{ "title": "Mission Control" }]
  }
}
```

After (working):
```json
{
  "app": {
    "withGlobalTauri": true,
    "windows": [{ "title": "Mission Control" }]
  }
}
```

### Benefits

- IPC communication works correctly
- Frontend can invoke Rust backend commands
- Real data flows from backend to frontend

### Trade-offs

- Slightly larger webview context (negligible)
- Exposes Tauri API globally (acceptable for desktop apps)

### When to Use

- **Always** when using Tauri v2 with frontend IPC calls
- This is essentially required for any Tauri app that communicates with its backend

### When NOT to Use

- Never skip this; it's required for IPC in Tauri v2

### Related

- PAT-001: Tauri v2 + SolidJS Desktop App
- DEC-006: Tauri v2 requires withGlobalTauri:true

---

## Frontend Absolute Paths for Rust Backend

**ID:** PAT-009
**Added:** 2026-04-01
**Added By:** scribe
**Category:** code
**Projects Used:** mission-control

### Problem

Frontend passes relative paths (e.g., `artifacts/slug`) to Rust backend commands, but Rust expects absolute paths. This causes silent failures where file operations don't find the expected files.

### Context

When building Tauri applications where:
- Frontend constructs paths to pass to Rust backend commands
- Rust uses standard library file operations expecting absolute paths
- Relative paths work during development but fail in production
- Path resolution behavior differs between frontend context and Rust context

### Pattern

**Frontend must ALWAYS pass absolute paths to Rust backend commands:**

1. Use SettingsContext or similar to access resolved base directories
2. Construct absolute paths by joining the base directory with relative segments
3. Never pass paths that start with `artifacts/` or other relative prefixes
4. Test with real backend (not mocks) to catch path issues early

### Structure

```typescript
// BAD - relative path
const path = `artifacts/${slug}`;
invoke('list_artifacts', { path });

// GOOD - absolute path
const { resolvedArtifactsDir } = useSettings();
const path = `${resolvedArtifactsDir}/${slug}`;
invoke('list_artifacts', { path });
```

### Benefits

- Reliable file operations across all environments
- No silent failures from path resolution issues
- Consistent behavior between development and production

### Trade-offs

- Requires access to settings/context in components that call backend
- Path construction logic in multiple places (consider utility function)

### When to Use

- **Always** when calling Tauri backend commands that accept file paths
- Any cross-boundary call where the backend expects filesystem paths

### When NOT to Use

- Never skip this; Rust requires absolute paths for reliability

### Related

- PAT-007: Rust/TypeScript Contract Alignment with Serde
- PAT-005: Tauri v2 IPC Configuration

---

## npm Fallback When pnpm Unavailable

**ID:** PAT-010
**Added:** 2026-04-01
**Added By:** scribe
**Category:** workflow
**Projects Used:** mission-control

### Problem

Shell environments (particularly Claude Code bash on Windows) may not have pnpm in PATH, causing build commands to fail even when pnpm is installed.

### Context

When running build tools in environments where:
- pnpm is the preferred package manager
- Shell environment doesn't inherit full user PATH
- CI/CD or agent environments have limited tool availability

### Pattern

Always have npm fallback commands ready when pnpm is primary:

1. Try pnpm command first
2. If "command not found", use equivalent npm command
3. Document both options in project README

### Structure

```bash
# Primary (pnpm)
pnpm run tauri dev

# Fallback (npm) - use when pnpm not in PATH
npm run tauri dev

# For CI/CD, check availability
command -v pnpm &> /dev/null && pnpm run tauri dev || npm run tauri dev
```

### Benefits

- Builds succeed in restricted environments
- No dependency on specific package manager availability
- CI/CD compatibility

### Trade-offs

- Slightly different lockfile behavior between npm/pnpm
- May need to maintain both lockfiles for strict environments

### When to Use

- Projects using pnpm as primary package manager
- Agent/automation environments
- CI/CD pipelines

### When NOT to Use

- Projects strictly requiring pnpm (e.g., monorepos with workspace features)

### Related

- PAT-004: GitHub Actions CI for Tauri Apps

---

### Testing

## Python Eval Harness with pytest

**ID:** PAT-003
**Added:** 2026-03-31
**Added By:** scribe
**Category:** testing
**Projects Used:** mission-control

### Problem

Need a structured way to validate application behavior against eval specs with clear pass/fail reporting and CI integration.

### Context

When you have an eval spec with defined test cases, scorers, and thresholds, and need automated validation.

### Pattern

Build a pytest-based eval harness that:
1. Loads fixture data
2. Interacts with the application (via WebDriver for GUI apps)
3. Executes scorers against application state
4. Reports pass/fail against thresholds

### Structure

```python
# evals/
#   conftest.py          # Fixtures setup
#   test_eval_cases.py   # Parameterized tests
#   scorers/
#     data_match.py      # Algorithmic scorers
#     performance.py
#   fixtures/
#     projects/          # Test data
```

### Benefits

- Standard pytest integration
- CI/CD compatible
- Clear reporting
- Parameterized tests for multiple eval cases

### Trade-offs

- Setup complexity for GUI testing
- May need WebDriver/Playwright for desktop apps

### When to Use

- Any application with an eval spec
- CI/CD pipelines

### When NOT to Use

- Purely manual testing scenarios

### Related

- PAT-002: Eval-First Development

---

## Frontend Type Contract Alignment

**ID:** PAT-016
**Added:** 2026-04-02
**Added By:** scribe
**Category:** workflow
**Projects Used:** mission-control, peakprotocol

### Problem

Frontend agents write TypeScript types/interfaces based on assumptions about the backend API, leading to type mismatches that compile successfully but fail at runtime.

### Context

When building full-stack applications where:
- A frontend agent implements API consumption (fetch calls, response types)
- The backend API already exists or is being built in parallel
- Types are written from memory or documentation rather than reading actual source

### Pattern

**Frontend MUST read the backend route/handler file before writing any types that consume that API.**

1. Before starting frontend work, identify which backend routes will be consumed
2. Read the actual backend route file (not docs, not memory, not assumptions)
3. Extract the exact response shape, field names, and types from the source
4. Write frontend types that match exactly
5. Reference the backend file in the work report

### Benefits

- Zero type mismatches at integration time
- Catches field naming discrepancies immediately
- Eliminates the most common source of CRITICAL bugs

### Trade-offs

- Requires backend to exist first (or use interface contract as fallback)
- Slightly slower start for frontend work

### When to Use

- **Always** when frontend consumes a backend API
- Any full-stack project with separate frontend and backend agents

### When NOT to Use

- Frontend-only projects with no backend
- When using a shared interface contract that both sides reference

### Related

- PAT-007: Rust/TypeScript Contract Alignment with Serde

---

## Local Verification Before Complete

**ID:** PAT-017
**Added:** 2026-04-02
**Added By:** scribe
**Category:** workflow
**Projects Used:** peakprotocol

### Problem

Projects are declared "complete" based on code review or build success, but the application has never actually been run end-to-end locally. Integration issues only surface when someone finally tries to use it.

### Context

When building any application with multiple services or layers where:
- Agents complete individual work items and report them done
- Build/compile succeeds
- No one has actually started the app and walked through core workflows

### Pattern

**Never declare a project complete without running it locally first.**

1. After all implementation work items are done, spawn Sentry for local verification
2. Sentry starts all services (frontend, backend, database, etc.)
3. Sentry walks through: services start, they communicate, auth works, core workflows complete
4. Only after ALL checks pass can the project be declared complete

### Benefits

- Catches integration issues before "done" declaration
- Validates the developer experience (can someone actually run this?)
- Prevents embarrassing "it doesn't start" moments

### Trade-offs

- Adds time to the completion process
- Requires documented startup procedures (see Dev Environment Setup Requirement)

### When to Use

- **Always** before declaring any project complete
- Any project with more than one service

### When NOT to Use

- Library projects with no runnable application
- Pure documentation projects

### Related

- PAT-016: Frontend Type Contract Alignment

---

## Auth Complexity Must Match User Count

**ID:** PAT-018
**Added:** 2026-04-02
**Added By:** scribe
**Category:** architecture
**Projects Used:** peakprotocol

### Problem

Auth systems are over-engineered for the actual user base, adding weeks of development time and unnecessary complexity. Multi-user auth infrastructure (WebAuthn, RBAC, complex session management) is built for apps that serve a single user or small team.

### Context

When designing authentication for a new project where:
- The user count is known or can be estimated
- The device topology is understood (single device, multi-device, etc.)
- There is pressure to build "enterprise-grade" auth regardless of actual needs

### Pattern

**Match auth complexity to actual user count and device topology.**

1. Define a "User & Device Profile" in architecture decisions
2. Answer: How many users? What devices? What's the threat model?
3. Select auth approach proportionally:
   - **Single-user:** Simple API key or local-only session
   - **Small team (2-10):** Basic token auth, simple passwords
   - **Public multi-tenant:** Full auth infrastructure (OAuth, WebAuthn, RBAC)

### Benefits

- Saves days or weeks of development time
- Reduces complexity and attack surface
- Right-sized security for actual needs

### Trade-offs

- May need to upgrade auth later if user base grows (but that's a good problem to have)
- Requires discipline to resist over-engineering

### When to Use

- **Always** during auth architecture decisions
- Especially for personal tools, single-user apps, internal tools

### When NOT to Use

- Never skip the user count analysis; it always applies

### Related

- PAT-016: Frontend Type Contract Alignment

---

## Defensive SPA Error Listeners

**ID:** PAT-019
**Added:** 2026-04-02
**Added By:** scribe
**Category:** code
**Projects Used:** peakprotocol

### Problem

Single-page applications using ES modules can fail silently with a blank screen and zero console output. The ES module system swallows errors in the dependency graph, leaving developers with no diagnostic information.

### Context

When building SPAs where:
- The app uses ES modules (standard for Vite, SolidJS, React, etc.)
- A broken import or runtime error kills the entire module graph
- The user sees a blank white screen with no indication of what went wrong
- This is especially common during initial development and deployment

### Pattern

**Always add global error handlers in index.html using a non-module `<script>` tag.**

```html
<script>
  window.addEventListener('error', (e) => {
    const root = document.getElementById('root');
    if (root) root.innerHTML = '<pre style="color:red;padding:2rem">Error: ' + e.message + '\n' + (e.filename || '') + ':' + (e.lineno || '') + '</pre>';
  });
  window.addEventListener('unhandledrejection', (e) => {
    const root = document.getElementById('root');
    if (root) root.innerHTML = '<pre style="color:red;padding:2rem">Unhandled: ' + (e.reason?.message || e.reason || 'Unknown') + '</pre>';
  });
</script>
```

This script MUST be a regular `<script>` (not `type="module"`) so it executes independently of the module graph it's protecting.

### Benefits

- Catches errors the ES module system swallows silently
- Provides visible feedback instead of blank screen
- Runs independently of the app's module graph
- Zero cost in happy path

### Trade-offs

- Extra script tag in HTML
- Error display is basic (not styled to match app)

### When to Use

- **Always** in any SPA using ES modules
- Should be a standard part of every SPA project's index.html

### When NOT to Use

- Never skip this; it's always beneficial

### Related

- PAT-014: ES Module Silent Failure Defense
- PAT-013: ErrorBoundary on Network-Dependent Components

---

### Deployment

## GitHub Actions CI for Tauri Apps

**ID:** PAT-004
**Added:** 2026-03-31
**Added By:** scribe
**Category:** deployment
**Projects Used:** mission-control

### Problem

Need automated builds and eval validation for Tauri desktop applications on every PR.

### Context

When you have a Tauri application with eval tests that need to run on every PR before merge.

### Pattern

Create a GitHub Actions workflow that:
1. Installs Rust toolchain and Node.js
2. Builds the Tauri application
3. Runs the Python eval harness
4. Blocks merge on eval failures

### Benefits

- Automated build verification
- Prevents regression
- Consistent build environment

### Trade-offs

- CI build times (Rust compilation)
- May need caching strategies

### When to Use

- Any Tauri project with eval suite
- Team collaboration

### When NOT to Use

- Solo development without CI

### Related

- PAT-001: Tauri + SolidJS Desktop App
- PAT-003: Python Eval Harness with pytest

---
