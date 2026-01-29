// Declare global customScript to avoid circular dependency with main index
declare var customScript: {
  log: (message: string) => void;
  error: (error: string) => void;
};

export const LOG_LEVEL_DEBUG = 'debug';
export const LOG_LEVEL_DEBUG_NUM = '0';
export const LOG_LEVEL_INFO = 'info';
export const LOG_LEVEL_INFO_NUM = '1';
export const LOG_LEVEL_WARN = 'warn';
export const LOG_LEVEL_WARN_NUM = '2';
export const LOG_LEVEL_ERROR = 'error';
export const LOG_LEVEL_ERROR_NUM = '3';
export const LOG_LEVEL_EMERGENCY = 'emergency';
export const LOG_LEVEL_EMERGENCY_NUM = '4';
export const LOG_LEVEL_SILENT = 'silent';
export const LOG_LEVEL_SILENT_NUM = '10';

export type LogLevel =
  | typeof LOG_LEVEL_DEBUG
  | typeof LOG_LEVEL_INFO
  | typeof LOG_LEVEL_WARN
  | typeof LOG_LEVEL_ERROR
  | typeof LOG_LEVEL_EMERGENCY
  | typeof LOG_LEVEL_SILENT;

export type LogLevelNum =
  | typeof LOG_LEVEL_DEBUG_NUM
  | typeof LOG_LEVEL_INFO_NUM
  | typeof LOG_LEVEL_WARN_NUM
  | typeof LOG_LEVEL_ERROR_NUM
  | typeof LOG_LEVEL_EMERGENCY_NUM
  | typeof LOG_LEVEL_SILENT_NUM;

export function parseLogLevel(level: LogLevel | LogLevelNum | string): number {
  switch (level) {
    case LOG_LEVEL_DEBUG:
    case LOG_LEVEL_DEBUG_NUM:
      return 0;

    case LOG_LEVEL_INFO:
    case LOG_LEVEL_INFO_NUM:
      return 1;

    case LOG_LEVEL_WARN:
    case LOG_LEVEL_WARN_NUM:
      return 2;

    case LOG_LEVEL_ERROR:
    case LOG_LEVEL_ERROR_NUM:
      return 3;

    case LOG_LEVEL_EMERGENCY:
    case LOG_LEVEL_EMERGENCY_NUM:
      return 4;

    case LOG_LEVEL_SILENT:
    case LOG_LEVEL_SILENT_NUM:
      return 10;

    default:
      return 1;
  }
}

// Internal log level state (defaults to INFO)
let logLevel: number = parseLogLevel(LOG_LEVEL_INFO);

/**
 * Sets the log level for the logging system
 * @param level - The log level to set (string or number)
 */
export function setLogLevel(level: LogLevel | LogLevelNum | string | number): void {
  if (typeof level === 'number') {
    logLevel = level;
  } else {
    logLevel = parseLogLevel(level);
  }
}

/**
 * Gets the current log level as a number
 * @returns The current log level number
 */
export function getLogLevel(): number {
  return logLevel;
}

interface LogQueueItem {
  message: string;
  level: number;
  time: number;
}

const logQueue: LogQueueItem[] = [];
let queueTimer: NodeJS.Timeout | null = null;
const QUEUE_BATCH_TIME = 200; // Reduced from 500ms to 200ms for faster processing
const MAX_QUEUE_SIZE = 20; // Increased from 10 to 20 for better batching
let currentQueueLevel: number | null = null;

function flushLogQueue() {
  if (logQueue.length === 0) {
    return;
  }

  const messages = logQueue.map(
    (item) => `${item.message}${log.PERFORMANCE ? ` +${getLogTime()}ms` : ''}`,
  );

  const combinedMessage = messages.join('\n');
  customScript.log(combinedMessage);

  // Clear the queue
  logQueue.length = 0;
  currentQueueLevel = null;

  if (queueTimer) {
    clearTimeout(queueTimer);
    queueTimer = null;
  }
}

function addToQueue(message: string, level: number) {
  // If queue has different level, flush existing messages
  if (currentQueueLevel !== null && currentQueueLevel !== level) {
    flushLogQueue();
  }

  // Add new message to queue
  logQueue.push({
    message,
    level,
    time: Date.now(),
  });

  currentQueueLevel = level;

  // If queue is full, flush immediately
  if (logQueue.length >= MAX_QUEUE_SIZE) {
    flushLogQueue();

    return;
  }

  // Set timer to flush after batch time
  if (queueTimer) {
    clearTimeout(queueTimer);
  }

  queueTimer = setTimeout(() => {
    flushLogQueue();
  }, QUEUE_BATCH_TIME);
}

export function log(
  message: string,
  level: number | string | LogLevel | LogLevelNum,
) {
  if (typeof level === 'string') {
    level = parseLogLevel(level);
  }

  if (level > parseLogLevel(LOG_LEVEL_WARN)) {
    level = parseLogLevel(LOG_LEVEL_WARN);
  }

  if (level >= logLevel) {
    addToQueue(message, level);
  }
}

log.startTime = performance.now();
log.PERFORMANCE = false;

function getLogTime() {
  return (-log.startTime + (log.startTime = performance.now())) >> 0;
}

export function error(message: string, emergency?: boolean) {
  if (
    parseLogLevel(LOG_LEVEL_ERROR) >= logLevel ||
    (emergency && parseLogLevel(LOG_LEVEL_EMERGENCY) >= logLevel)
  ) {
    customScript.error(message);
  }
}
