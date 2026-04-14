/** Types for artifact browsing */

export interface ArtifactEntry {
  path: string;
  name: string;
  size: number;
  lastModified: string;
  isDir: boolean;
}

export interface ArtifactInfo {
  path: string;
  exists: boolean;
  content: string | null;
  frontmatter: Record<string, unknown> | null;
  sizeBytes: number;
  modified: string | null;
}
