export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

let minLevel: LogLevel = import.meta.env?.DEV ? 'debug' : 'info';

export function setLogLevel(level: LogLevel): void {
  minLevel = level;
}

function shouldLog(level: LogLevel): boolean {
  return LEVEL_ORDER[level] >= LEVEL_ORDER[minLevel];
}

function prefix(level: LogLevel): string {
  return `[SXMCards][${level.toUpperCase()}]`;
}

function write(level: LogLevel, message: string, data?: unknown): void {
  if (!shouldLog(level)) {
    return;
  }
  const line = `${prefix(level)} ${message}`;
  if (data !== undefined) {
    console[level === 'debug' ? 'log' : level](line, data);
  } else {
    console[level === 'debug' ? 'log' : level](line);
  }
}

export const log = {
  debug: (message: string, data?: unknown) => write('debug', message, data),
  info: (message: string, data?: unknown) => write('info', message, data),
  warn: (message: string, data?: unknown) => write('warn', message, data),
  error: (message: string, data?: unknown) => write('error', message, data),
};
