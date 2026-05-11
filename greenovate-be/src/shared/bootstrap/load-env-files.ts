import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const loadEnvFileIfPresent = (relativePath: string) => {
  const absolutePath = resolve(process.cwd(), relativePath);

  if (!existsSync(absolutePath)) {
    return;
  }

  process.loadEnvFile(absolutePath);
};

export const loadEnvFiles = (relativePaths: string[]) => {
  for (const relativePath of relativePaths) {
    loadEnvFileIfPresent(relativePath);
  }
};
