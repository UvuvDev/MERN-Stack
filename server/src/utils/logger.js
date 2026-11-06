const LEVELS = {
  info: 'INFO',
  warn: 'WARN',
  error: 'ERROR',
};

function write(level, args) {
  const line = `[${new Date().toISOString()}] ${LEVELS[level]}`;
  if (level === 'error') {
    console.error(line, ...args);
  } else if (level === 'warn') {
    console.warn(line, ...args);
  } else {
    console.log(line, ...args);
  }
}

export const logger = {
  info(...args) {
    write('info', args);
  },
  warn(...args) {
    write('warn', args);
  },
  error(...args) {
    write('error', args);
  },
};

export default logger;
