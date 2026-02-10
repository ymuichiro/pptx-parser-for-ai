import * as fs from "node:fs/promises";
import * as path from "node:path";
import { IOError } from "../errors";

function isSubPath(basePath: string, targetPath: string): boolean {
  const relative = path.relative(basePath, targetPath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

export async function resolveAndValidatePath(inputPath: string, allowedRoots: string[]): Promise<string> {
  const absoluteInput = path.resolve(inputPath);
  const canonicalRoots = await Promise.all(
    allowedRoots.map(async (root) => {
      const absoluteRoot = path.resolve(root);
      try {
        return await fs.realpath(absoluteRoot);
      } catch {
        return absoluteRoot;
      }
    })
  );

  let targetRealPath: string;
  try {
    targetRealPath = await fs.realpath(absoluteInput);
  } catch {
    targetRealPath = absoluteInput;
  }

  const isAllowed = canonicalRoots.some((root) => isSubPath(root, targetRealPath));
  if (!isAllowed) {
    throw new IOError(`Path is outside of allowed roots: ${inputPath}`);
  }

  return targetRealPath;
}

export async function ensureOutputDir(filePath: string): Promise<void> {
  const directory = path.dirname(filePath);
  await fs.mkdir(directory, { recursive: true });
}
