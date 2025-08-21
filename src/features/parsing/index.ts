// Parsing Feature Module
// All utilities related to parsing natural language commands, JSON recovery, and intelligent parsing

export { InputNormalizer } from "./input-normalizer";
export { SyntaxFlexibilityEngine } from "./syntax-flexibility";
export { JsonRecovery } from "./json-recovery";
export { NaturalJsonBuilder } from "./natural-json-builder";
export { PatternLearner } from "./pattern-learner";
export { ClarificationEngine } from "./clarification-engine";
export { AdvancedErrorRecovery } from "./advanced-error-recovery";

// Re-export types for convenience
export type { ParsingPattern, UserPreference } from "./pattern-learner";
export type {
  ClarificationQuestion,
  ClarificationResponse,
} from "./clarification-engine";
export type {
  RecoveryStrategy,
  RecoveryResult,
} from "./advanced-error-recovery";
