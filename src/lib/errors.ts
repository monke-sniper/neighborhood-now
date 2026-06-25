export type UpstreamSource =
  | 'nominatim'
  | 'overpass'
  | 'builddata'
  | 'complaints'
  | 'census'
  | 'weather'
  | 'ollama'
  | 'unknown';

export class UpstreamError extends Error {
  readonly source: UpstreamSource;
  readonly status: number | null;
  readonly cause: unknown;

  constructor(
    source: UpstreamSource,
    message: string,
    options: { status?: number | null; cause?: unknown } = {},
  ) {
    super(message);
    this.name = 'UpstreamError';
    this.source = source;
    this.status = options.status ?? null;
    this.cause = options.cause;
  }

  toJSON(): { source: string; message: string; status: number | null } {
    return {
      source: this.source,
      message: this.message,
      status: this.status,
    };
  }
}

export function isUpstreamError(e: unknown): e is UpstreamError {
  return e instanceof UpstreamError;
}
