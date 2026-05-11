import pino from "pino";

const isDev = process.env.NODE_ENV !== "production";

function createTransport(): pino.TransportMultiOptions | undefined {
  if (isDev) {
    return {
      targets: [
        { target: "pino-pretty", options: { colorize: true } },
        { target: "pino/file", options: { destination: "logs/output.log", mkdir: true } },
      ],
    };
  }
  return undefined; // production: plain JSON to stdout
}

/** Root logger instance. All child loggers derive from this. */
export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  transport: createTransport(),
});

/** Create a top-level child logger for a module (API handlers, scripts). */
export const createLogger = (module: string) => logger.child({ module });

/** Create a child logger scoped to a service, preserving parent request context. */
export const createModuleLogger = (module: string, parentLogger: pino.Logger) =>
  parentLogger.child({ module });
