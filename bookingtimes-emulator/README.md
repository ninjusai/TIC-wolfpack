# Bookingtimes Content Emulator

SvelteKit application running on local Node.js with SQLite, filesystem storage, and in-memory cache.

## Setup

```bash
npm install
```

## Development

Start the local dev server (Vite + Node adapter):

```bash
npm run dev
```

This runs the SvelteKit dev server with hot reload. All data services (DB, storage, cache) are available locally.

## Production Build

```bash
npm run build
node build
```

## Data Services

The app uses three local data services, initialized automatically on startup:

| Service | Implementation | Location |
|---------|---------------|----------|
| Database | better-sqlite3 | `data/bce.db` |
| Storage | Filesystem | `data/storage/` |
| Cache | lru-cache (in-memory) | N/A (memory only) |

Access services in SvelteKit server routes via `locals`:

```typescript
export async function GET({ locals }) {
  const db = locals.db;       // better-sqlite3 instance
  const storage = locals.storage;  // LocalStorage (fs-backed)
  const cache = locals.cache;      // LocalCache (lru-cache)
}
```

## Database Migrations

Migrations are applied automatically on startup via `scripts/migrate.js`. Migration files are stored in the `migrations/` directory.

```bash
# Run migrations manually
npm run db:migrate
```

## Type Checking

```bash
npm run check
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `STORAGE_PATH` | Override filesystem storage directory | `data/storage` |
| `DATABASE_PATH` | Override SQLite database path | `data/bce.db` |
| `ANTHROPIC_API_KEY` | API key for AI generation | (required) |

## Architecture Note

This project was originally deployed to Cloudflare (Pages + D1 + R2 + KV) and has been migrated to local Node.js deployment. The `wrangler.toml` file is retained for reference but is no longer used.
