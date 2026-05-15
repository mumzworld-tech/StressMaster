/**
 * Helper module to safely require stressmaster-dir utilities
 * This handles module resolution correctly in both development and when installed as a package
 */

/**
 * Require stressmaster-dir module with proper path resolution
 * Uses multiple fallback strategies to find the module
 */
export function requireStressMasterDir(): any {
  // Strategy 1: Try relative path from current file location
  // This works when the module structure is preserved in dist/
  // From dist/utils/require-stressmaster-dir.js to dist/utils/stressmaster-dir.js
  try {
    return require("./stressmaster-dir");
  } catch (e1: any) {
    // Strategy 2: Try resolving from __dirname (available at runtime in CommonJS)
    // Calculate relative path from caller's location
    try {
      // __dirname will be available at runtime in compiled CommonJS
      // TypeScript will inject this, but we can't reference it directly in source
      // So we use a runtime check
      const path = require("path");
      if (typeof __dirname !== "undefined") {
        // From dist/core/parser/command/ to dist/utils/
        const modulePath = path.resolve(
          __dirname,
          "../../utils/stressmaster-dir"
        );
        if (require("fs").existsSync(modulePath + ".js")) {
          return require(modulePath);
        }
      }
    } catch (e2: any) {
      // Strategy 3: Find package root and resolve from there
      try {
        const path = require("path");
        const fs = require("fs");

        // Start from caller's location or current working directory
        let searchDir =
          typeof __dirname !== "undefined" ? __dirname : process.cwd();

        // Walk up the directory tree looking for package.json or node_modules/stressmaster
        for (let i = 0; i < 10; i++) {
          // Check if we're in a node_modules/stressmaster directory
          const nodeModulesPath = path.join(
            searchDir,
            "node_modules",
            "stressmaster",
            "dist",
            "utils",
            "stressmaster-dir.js"
          );
          if (fs.existsSync(nodeModulesPath)) {
            return require(nodeModulesPath);
          }

          // Check if we're in the stressmaster package root
          const packageJsonPath = path.join(searchDir, "package.json");
          if (fs.existsSync(packageJsonPath)) {
            try {
              const packageJson = JSON.parse(
                fs.readFileSync(packageJsonPath, "utf8")
              );
              if (packageJson.name === "stressmaster") {
                const modulePath = path.join(
                  searchDir,
                  "dist",
                  "utils",
                  "stressmaster-dir"
                );
                if (fs.existsSync(modulePath + ".js")) {
                  return require(modulePath);
                }
              }
            } catch {
              // Invalid package.json, continue searching
            }
          }

          // Move up one level
          const parentDir = path.dirname(searchDir);
          if (parentDir === searchDir) break; // Reached filesystem root
          searchDir = parentDir;
        }
      } catch (e3: any) {
        // All strategies failed
        const errorMsg =
          `Failed to resolve stressmaster-dir module.\n` +
          `Strategy 1 (relative): ${e1?.message || "unknown"}\n` +
          `Strategy 2 (__dirname): ${e2?.message || "unknown"}\n` +
          `Strategy 3 (package root): ${e3?.message || "unknown"}`;
        throw new Error(errorMsg);
      }
    }
  }

  // This should never be reached, but TypeScript needs it
  throw new Error("Failed to resolve stressmaster-dir module");
}
