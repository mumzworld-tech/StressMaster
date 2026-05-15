/**
 * File Autocomplete for Interactive CLI
 * Provides file suggestions when user types @ in commands
 * NOTE: Does NOT provide URL autocomplete
 */

import { FileResolver } from "../../utils/file-resolver";
import * as path from "path";

export interface AutocompleteSuggestion {
  text: string;
  description?: string;
}

export class FileAutocomplete {
  /**
   * Get file suggestions for autocomplete
   * Triggered when user types @ in command
   */
  static getFileSuggestions(input: string, cursorPosition: number): AutocompleteSuggestion[] {
    const suggestions: AutocompleteSuggestion[] = [];

    try {
      // Extract the part before cursor
      const beforeCursor = input.substring(0, cursorPosition);
      
      // Find @ symbol and extract partial filename
      const lastAt = beforeCursor.lastIndexOf("@");
      if (lastAt === -1) {
        return suggestions; // No @ found
      }

      const afterAt = beforeCursor.substring(lastAt + 1);
      
      // Extract partial filename (up to space or end)
      const spaceIndex = afterAt.indexOf(" ");
      const partialFilename = spaceIndex === -1 
        ? afterAt 
        : afterAt.substring(0, spaceIndex);

      // If partial filename is empty or just whitespace, show common files
      if (!partialFilename.trim()) {
        return this.getCommonFiles();
      }

      // Search for files matching partial filename
      const matchingFiles = FileResolver.findFilesByPattern(
        partialFilename,
        FileResolver.getRootDirectory(),
        10 // Limit to 10 suggestions
      );

      for (const filePath of matchingFiles) {
        const filename = path.basename(filePath);
        const relativePath = path.relative(
          FileResolver.getRootDirectory(),
          filePath
        );

        suggestions.push({
          text: `@${filename}`,
          description: relativePath !== filename ? relativePath : undefined,
        });
      }
    } catch {
      // Ignore errors, return empty suggestions
    }

    return suggestions;
  }

  /**
   * Get common file suggestions (when @ is typed with no partial match)
   */
  private static getCommonFiles(): AutocompleteSuggestion[] {
    const commonPatterns = ["api.yaml", "api.yml", "payload.json", "config.json"];
    const suggestions: AutocompleteSuggestion[] = [];

    for (const pattern of commonPatterns) {
      const files = FileResolver.findFilesByPattern(
        pattern,
        FileResolver.getRootDirectory(),
        1
      );

      if (files.length > 0) {
        const filename = path.basename(files[0]);
        suggestions.push({
          text: `@${filename}`,
          description: "Common file",
        });
      }
    }

    return suggestions;
  }

  /**
   * Check if autocomplete should be triggered
   */
  static shouldTrigger(input: string, cursorPosition: number): boolean {
    const beforeCursor = input.substring(0, cursorPosition);
    const lastChar = beforeCursor[beforeCursor.length - 1];
    
    // Trigger on @ or when typing after @
    return lastChar === "@" || beforeCursor.includes("@");
  }
}


