/**
 * File and path manipulation utilities
 */

import * as path from "path";
import * as fs from "fs/promises";
import { Stats } from "fs";

/**
 * Ensures a directory exists, creating it if necessary
 */
export async function ensureDirectory(dirPath: string): Promise<void> {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
      throw error;
    }
  }
}

/**
 * Checks if a file exists
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Checks if a directory exists
 */
export async function directoryExists(dirPath: string): Promise<boolean> {
  try {
    const stats = await fs.stat(dirPath);
    return stats.isDirectory();
  } catch {
    return false;
  }
}

/**
 * Safely reads a file, returning null if it doesn't exist
 */
export async function safeReadFile(
  filePath: string,
  encoding: BufferEncoding = "utf8"
): Promise<string | null> {
  try {
    return await fs.readFile(filePath, encoding);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

/**
 * Safely writes a file, creating directories if necessary
 */
export async function safeWriteFile(
  filePath: string,
  content: string,
  encoding: BufferEncoding = "utf8"
): Promise<void> {
  const dir = path.dirname(filePath);
  await ensureDirectory(dir);
  await fs.writeFile(filePath, content, encoding);
}

/**
 * Gets the file extension from a path
 */
export function getFileExtension(filePath: string): string {
  return path.extname(filePath).toLowerCase();
}

/**
 * Gets the filename without extension
 */
export function getFileNameWithoutExtension(filePath: string): string {
  const basename = path.basename(filePath);
  const ext = path.extname(basename);
  return basename.slice(0, -ext.length);
}

/**
 * Normalizes a file path for the current platform
 */
export function normalizePath(filePath: string): string {
  return path.normalize(filePath);
}

/**
 * Joins path segments safely
 */
export function joinPaths(...segments: string[]): string {
  return path.join(...segments);
}

/**
 * Resolves a path to an absolute path
 */
export function resolvePath(filePath: string): string {
  return path.resolve(filePath);
}

/**
 * Gets the relative path from one path to another
 */
export function getRelativePath(from: string, to: string): string {
  return path.relative(from, to);
}

/**
 * Checks if a path is absolute
 */
export function isAbsolutePath(filePath: string): boolean {
  return path.isAbsolute(filePath);
}

/**
 * Creates a temporary file path with optional extension
 */
export function createTempFilePath(
  prefix = "temp",
  extension = ".tmp"
): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const filename = `${prefix}-${timestamp}-${random}${extension}`;
  return path.join(process.cwd(), "temp", filename);
}

/**
 * Gets file stats safely
 */
export async function getFileStats(filePath: string): Promise<Stats | null> {
  try {
    return await fs.stat(filePath);
  } catch {
    return null;
  }
}

/**
 * Gets the size of a file in bytes
 */
export async function getFileSize(filePath: string): Promise<number | null> {
  const stats = await getFileStats(filePath);
  return stats ? stats.size : null;
}

/**
 * Checks if a file is readable
 */
export async function isFileReadable(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath, fs.constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Checks if a file is writable
 */
export async function isFileWritable(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath, fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Lists files in a directory with optional filtering
 */
export async function listFiles(
  dirPath: string,
  options: {
    recursive?: boolean;
    extensions?: string[];
    pattern?: RegExp;
  } = {}
): Promise<string[]> {
  const { recursive = false, extensions, pattern } = options;

  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const files: string[] = [];

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory() && recursive) {
        const subFiles = await listFiles(fullPath, options);
        files.push(...subFiles);
      } else if (entry.isFile()) {
        let include = true;

        if (extensions) {
          const ext = getFileExtension(entry.name);
          include = extensions.includes(ext);
        }

        if (include && pattern) {
          include = pattern.test(entry.name);
        }

        if (include) {
          files.push(fullPath);
        }
      }
    }

    return files;
  } catch {
    return [];
  }
}

/**
 * Copies a file from source to destination
 */
export async function copyFile(
  source: string,
  destination: string
): Promise<void> {
  const dir = path.dirname(destination);
  await ensureDirectory(dir);
  await fs.copyFile(source, destination);
}

/**
 * Moves a file from source to destination
 */
export async function moveFile(
  source: string,
  destination: string
): Promise<void> {
  const dir = path.dirname(destination);
  await ensureDirectory(dir);
  await fs.rename(source, destination);
}

/**
 * Deletes a file safely (doesn't throw if file doesn't exist)
 */
export async function safeDeleteFile(filePath: string): Promise<boolean> {
  try {
    await fs.unlink(filePath);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return false; // File didn't exist
    }
    throw error;
  }
}

/**
 * Creates a backup of a file with timestamp
 */
export async function createBackup(filePath: string): Promise<string> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const ext = getFileExtension(filePath);
  const nameWithoutExt = getFileNameWithoutExtension(filePath);
  const dir = path.dirname(filePath);

  const backupPath = path.join(
    dir,
    `${nameWithoutExt}.backup.${timestamp}${ext}`
  );
  await copyFile(filePath, backupPath);

  return backupPath;
}
