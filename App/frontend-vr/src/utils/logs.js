/**
 * Centralized logging utility
 * - Global toggle via ShowLogsGlobal
 * - Per-file override by passing enabledOverride to createLogger
 */

export const ShowLogsGlobal = true; // set true to enable logs globally
export const ShowErrorsGlobal = true; // set false to silence errors globally

/**
 * Create a logger for a given file/component tag.
 * @param {string} tag - Label to prefix log messages, e.g. "[Agent Sphere]".
 * @param {boolean|undefined} enabledOverride - If true/false, overrides global; if undefined, uses global.
 * @returns {(message: string, data?: any) => void}
 */
export function createLogger(tag, enabledOverride = undefined, errorOverride = undefined) {
  const isEnabled = () => (enabledOverride !== undefined ? enabledOverride : ShowLogsGlobal);
  const isErrorEnabled = () => (errorOverride !== undefined ? errorOverride : ShowErrorsGlobal);

  const logger = (message, ...args) => {
    if (!isEnabled()) return;
    console.log(`${tag} ${message}`, ...args);
  };

  logger.info = (message, ...args) => {
    if (!isEnabled()) return;
    console.info(`${tag} ${message}`, ...args);
  };

  logger.warn = (message, ...args) => {
    if (!isEnabled()) return;
    console.warn(`${tag} ${message}`, ...args);
  };

  logger.error = (message, ...args) => {
    if (!isErrorEnabled()) return;
    console.error(`${tag} ${message}`, ...args);
  };

  return logger;
}
