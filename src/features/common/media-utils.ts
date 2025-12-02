import * as fs from "fs";
import * as path from "path";
import { MediaSpec, MediaFile } from "../../types/load-test-spec";

export interface ProcessedMedia {
  formData: any;
  headers: Record<string, string>;
  hasFiles: boolean;
}

export class MediaProcessor {
  private static readonly MIME_TYPES: Record<string, string> = {
    // Images
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".bmp": "image/bmp",

    // Documents
    ".pdf": "application/pdf",
    ".doc": "application/msword",
    ".docx":
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xls": "application/vnd.ms-excel",
    ".xlsx":
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".ppt": "application/vnd.ms-powerpoint",
    ".pptx":
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",

    // Text files
    ".txt": "text/plain",
    ".csv": "text/csv",
    ".json": "application/json",
    ".xml": "application/xml",
    ".html": "text/html",
    ".css": "text/css",
    ".js": "application/javascript",

    // Archives
    ".zip": "application/zip",
    ".rar": "application/vnd.rar",
    ".7z": "application/x-7z-compressed",
    ".tar": "application/x-tar",
    ".gz": "application/gzip",

    // Audio/Video
    ".mp3": "audio/mpeg",
    ".mp4": "video/mp4",
    ".avi": "video/x-msvideo",
    ".mov": "video/quicktime",
    ".wav": "audio/wav",

    // Default
    ".bin": "application/octet-stream",
  };

  /**
   * Process media specification and generate appropriate form data and headers
   */
  static processMedia(media?: MediaSpec): ProcessedMedia {
    if (!media || !media.files || media.files.length === 0) {
      return {
        formData: null,
        headers: {},
        hasFiles: false,
      };
    }

    const formData: any = {};
    const headers: Record<string, string> = {};

    // Process files
    for (const file of media.files) {
      try {
        const filePath = this.resolveFilePath(file.filePath);
        const fileBuffer = fs.readFileSync(filePath);
        const fileName = file.fileName || path.basename(filePath);
        const mimeType = file.mimeType || this.detectMimeType(filePath);

        formData[file.fieldName] = {
          value: fileBuffer,
          options: {
            filename: fileName,
            contentType: mimeType,
          },
        };

        console.log(`📁 Processed file: ${fileName} (${mimeType})`);
      } catch (error) {
        console.error(`❌ Failed to process file ${file.filePath}:`, error);
        throw new Error(`File not found or cannot be read: ${file.filePath}`);
      }
    }

    // Add additional form data
    if (media.formData) {
      Object.assign(formData, media.formData);
    }

    // Set appropriate headers
    if (
      media.contentType === "application/octet-stream" &&
      media.files.length === 1
    ) {
      // Single file upload - use binary content type
      const file = media.files[0];
      const filePath = this.resolveFilePath(file.filePath);
      headers["Content-Type"] = file.mimeType || this.detectMimeType(filePath);
    } else {
      // Multiple files or mixed data - use multipart
      headers["Content-Type"] = "multipart/form-data";
    }

    return {
      formData,
      headers,
      hasFiles: true,
    };
  }

  /**
   * Parse media references from command string (e.g., "file: @image.jpg")
   */
  static parseMediaReferences(command: string): MediaSpec | null {
    const mediaRegex = /(\w+):\s*@([^\s,]+)/g;
    const files: MediaFile[] = [];
    const formData: Record<string, any> = {};
    let hasMedia = false;

    let match;
    while ((match = mediaRegex.exec(command)) !== null) {
      const fieldName = match[1];
      const filePath = match[2];

      // Skip if it's not a file reference (e.g., "data: @something")
      if (fieldName.toLowerCase() === "data") {
        continue;
      }

      files.push({
        fieldName,
        filePath: this.resolveFilePath(filePath),
      });
      hasMedia = true;
    }

    // Also look for "with" clause that might contain additional data
    const withMatch = command.match(/with\s+{([^}]+)}/);
    if (withMatch) {
      try {
        const jsonStr = `{${withMatch[1]}}`;
        const additionalData = JSON.parse(jsonStr);
        Object.assign(formData, additionalData);
      } catch (error) {
        // Ignore JSON parsing errors for now
      }
    }

    if (!hasMedia) {
      return null;
    }

    return {
      files,
      formData: Object.keys(formData).length > 0 ? formData : undefined,
      contentType:
        files.length === 1 ? "application/octet-stream" : "multipart/form-data",
    };
  }

  /**
   * Detect MIME type based on file extension
   */
  private static detectMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    return this.MIME_TYPES[ext] || "application/octet-stream";
  }

  /**
   * Resolve file path using centralized FileResolver
   * All files are resolved from root directory (where CLI is executed)
   */
  private static resolveFilePath(filePath: string): string {
    // Use centralized file resolver for consistent behavior
    // Note: Using require for sync compatibility
    const { FileResolver } = require("../../utils/file-resolver");
    
    try {
      const result = FileResolver.resolveFile(filePath, {
        throwIfNotFound: false, // Don't throw, let caller handle
      });
      return result.exists ? result.resolvedPath : filePath;
    } catch {
      return filePath; // Return original if resolution fails
    }
  }

  /**
   * Validate file exists and is readable
   */
  static validateFile(filePath: string): boolean {
    try {
      const resolvedPath = this.resolveFilePath(filePath);
      return fs.existsSync(resolvedPath) && fs.statSync(resolvedPath).isFile();
    } catch {
      return false;
    }
  }

  /**
   * Get file size in bytes
   */
  static getFileSize(filePath: string): number {
    try {
      const resolvedPath = this.resolveFilePath(filePath);
      return fs.statSync(resolvedPath).size;
    } catch {
      return 0;
    }
  }
}
