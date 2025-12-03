/**
 * Backwards-compatible shim that re-exports the new modular AI provider system.
 *
 * The real implementations now live in `src/core/parser/ai/*`.
 * Keep this file extremely small so other parts of the codebase can continue
 * importing from `./ai-providers` without any changes.
 */

export * from "./ai";
