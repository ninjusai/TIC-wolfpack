/**
 * Local file-based storage — replacement for Cloudflare R2.
 * Provides a filesystem-backed storage interface that mirrors the R2 API
 * (put/get/delete/list) so consumer code needs minimal changes.
 *
 * Supports customMetadata via .meta.json sidecar files.
 */

import fs from 'node:fs';
import path from 'node:path';

export interface LocalStorage {
  put(
    key: string,
    value: string | Buffer | ArrayBuffer | ReadableStream,
    options?: { customMetadata?: Record<string, string> }
  ): Promise<void>;
  get(
    key: string
  ): Promise<{
    text(): Promise<string>;
    arrayBuffer(): Promise<ArrayBuffer>;
    customMetadata?: Record<string, string>;
  } | null>;
  delete(key: string): Promise<void>;
  list(options?: {
    prefix?: string;
  }): Promise<{ objects: { key: string; size: number; uploaded: string }[] }>;
}

const STORAGE_DIR = process.env.STORAGE_PATH || path.join(process.cwd(), 'data', 'storage');

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function keyToPath(key: string): string {
  // Sanitize key for filesystem use
  const sanitized = key.replace(/[<>:"|?*]/g, '_');
  return path.join(STORAGE_DIR, sanitized);
}

export function getLocalStorage(): LocalStorage {
  ensureDir(STORAGE_DIR);

  return {
    async put(
      key: string,
      value: string | Buffer | ArrayBuffer | ReadableStream,
      options?: { customMetadata?: Record<string, string> }
    ) {
      const filePath = keyToPath(key);
      ensureDir(path.dirname(filePath));

      if (typeof value === 'string') {
        fs.writeFileSync(filePath, value, 'utf-8');
      } else if (value instanceof ArrayBuffer) {
        fs.writeFileSync(filePath, Buffer.from(value));
      } else if (Buffer.isBuffer(value)) {
        fs.writeFileSync(filePath, value);
      } else {
        // ReadableStream — collect chunks
        const reader = (value as ReadableStream).getReader();
        const chunks: Uint8Array[] = [];
        let done = false;
        while (!done) {
          const result = await reader.read();
          done = result.done;
          if (result.value) chunks.push(result.value);
        }
        fs.writeFileSync(filePath, Buffer.concat(chunks));
      }

      // Write metadata sidecar if provided
      if (options?.customMetadata) {
        fs.writeFileSync(filePath + '.meta.json', JSON.stringify(options.customMetadata));
      }
    },

    async get(key: string) {
      const filePath = keyToPath(key);
      if (!fs.existsSync(filePath)) return null;

      const buffer = fs.readFileSync(filePath);
      return {
        async text() {
          return buffer.toString('utf-8');
        },
        async arrayBuffer() {
          return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
        },
        customMetadata: (() => {
          try {
            const metaPath = filePath + '.meta.json';
            if (fs.existsSync(metaPath))
              return JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
          } catch {
            /* ignore */
          }
          return {};
        })()
      };
    },

    async delete(key: string) {
      const filePath = keyToPath(key);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      const metaPath = filePath + '.meta.json';
      if (fs.existsSync(metaPath)) fs.unlinkSync(metaPath);
    },

    async list(options?: { prefix?: string }) {
      const prefix = options?.prefix || '';
      ensureDir(STORAGE_DIR);

      const objects: { key: string; size: number; uploaded: string }[] = [];
      function walk(dir: string) {
        if (!fs.existsSync(dir)) return;
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          if (entry.name.endsWith('.meta.json')) continue;
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            walk(fullPath);
          } else {
            const key = path.relative(STORAGE_DIR, fullPath).replace(/\\/g, '/');
            if (!prefix || key.startsWith(prefix)) {
              const stat = fs.statSync(fullPath);
              objects.push({
                key,
                size: stat.size,
                uploaded: stat.mtime.toISOString()
              });
            }
          }
        }
      }

      walk(STORAGE_DIR);
      return { objects };
    }
  };
}
