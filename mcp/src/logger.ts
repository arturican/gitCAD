function formatUnknown(value: unknown): string {
  if (value instanceof Error) {
    return `${value.name}: ${value.message}`;
  }
  if (typeof value === "string") {
    return value;
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function logInfo(message: string, details?: unknown): void {
  const suffix = details === undefined ? "" : ` ${formatUnknown(details)}`;
  process.stderr.write(`[mcp][info] ${message}${suffix}\n`);
}

export function logError(message: string, details?: unknown): void {
  const suffix = details === undefined ? "" : ` ${formatUnknown(details)}`;
  process.stderr.write(`[mcp][error] ${message}${suffix}\n`);
}

