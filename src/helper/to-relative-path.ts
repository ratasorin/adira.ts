import path from "path";

// Adjust the function to ensure paths are normalized to match tsconfig's file structure
export function toRelativePath(absolutePath: string, basePath: string): string {
  // Ensure both paths are absolute
  const absBasePath = path.resolve(basePath);
  const absAbsolutePath = path.resolve(absolutePath);

  // Compute the relative path from basePath to absolutePath
  const relative = path.relative(absBasePath, absAbsolutePath);

  // Normalize the path to use forward slashes and ensure it's correct
  return relative.replace(/\\/g, "/"); // Ensures POSIX path format (cross-platform)
}
