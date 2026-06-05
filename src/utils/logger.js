const LEVEL_ORDER = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
};
let minLevel = import.meta.env?.DEV ? 'debug' : 'info';
export function setLogLevel(level) {
    minLevel = level;
}
function shouldLog(level) {
    return LEVEL_ORDER[level] >= LEVEL_ORDER[minLevel];
}
function prefix(level) {
    return `[SXMCards][${level.toUpperCase()}]`;
}
function write(level, message, data) {
    if (!shouldLog(level)) {
        return;
    }
    const line = `${prefix(level)} ${message}`;
    if (data !== undefined) {
        console[level === 'debug' ? 'log' : level](line, data);
    }
    else {
        console[level === 'debug' ? 'log' : level](line);
    }
}
export const log = {
    debug: (message, data) => write('debug', message, data),
    info: (message, data) => write('info', message, data),
    warn: (message, data) => write('warn', message, data),
    error: (message, data) => write('error', message, data),
};
