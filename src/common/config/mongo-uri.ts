const URI_ENV_KEYS = ['MONGO_URI', 'MONGODB_URI', 'MONGO_URL', 'DATABASE_URL'] as const;

function stripQuotes(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"'))
    || (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

export function resolveMongoUri(env: NodeJS.ProcessEnv = process.env): string {
  for (const key of URI_ENV_KEYS) {
    const raw = env[key];
    if (!raw) continue;
    const uri = stripQuotes(raw);
    if (uri.startsWith('mongodb://') || uri.startsWith('mongodb+srv://')) {
      return uri;
    }
  }

  const present = URI_ENV_KEYS.filter((k) => env[k]).join(', ') || 'none';
  throw new Error(
    `MongoDB connection string missing or invalid. Set MONGO_URI (mongodb:// or mongodb+srv://). Checked: ${present}`,
  );
}
