/**
 * Structured logger.
 *
 * SECURITY POLICY: Never pass `req.headers` or any object that may contain
 * `X-Ollama-Key`, `X-Census-Key`, `X-Weather-Key`, `X-Ollama-Base`,
 * `X-Ollama-Model` or any user-supplied API key to this logger. The logger
 * emits to stdout/stderr, which on Vercel is captured to the function log
 * and is retained for the deployment lifetime.
 */

type Level = 'debug' | 'info' | 'warn' | 'error';

interface LogFields {
  [k: string]: unknown;
}

function emit(level: Level, msg: string, fields?: LogFields): void {
  const entry: Record<string, unknown> = {
    t: new Date().toISOString(),
    level,
    msg,
    ...(fields ?? {}),
  };
  const line = JSON.stringify(entry);
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export const log = {
  debug(msg: string, fields?: LogFields): void {
    if (process.env.LOG_LEVEL === 'debug') emit('debug', msg, fields);
  },
  info(msg: string, fields?: LogFields): void {
    emit('info', msg, fields);
  },
  warn(msg: string, fields?: LogFields): void {
    emit('warn', msg, fields);
  },
  error(msg: string, fields?: LogFields): void {
    emit('error', msg, fields);
  },
};
