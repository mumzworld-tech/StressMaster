# Design Document

## Overview

This design outlines a comprehensive restructuring of the StressMaster codebase to reduce complexity, eliminate redundancy, and improve maintainability while preserving all existing functionality. The current codebase suffers from over-engineering, particularly in the parser module, with multiple overlapping implementations and excessive abstraction layers.

## Architecture

### Current State Analysis

The current architecture has several issues:

- **Parser Module Complexity**: 25+ files with overlapping functionality (command-parser.ts, universal-command-parser.ts, smart-ai-provider.ts)
- **Test Structure Chaos**: Tests scattered across multiple nested directories with inconsistent organization
- **Code Duplication**: Multiple implementations of similar parsing logic
- **Over-abstraction**: Excessive interfaces and abstract classes for simple operations
- **Configuration Sprawl**: Multiple configuration systems and monitoring approaches

### Target Architecture

The restructured architecture will follow these principles:

- **Single Responsibility**: Each module has one clear purpose
- **Minimal Abstraction**: Only abstract when truly needed for extensibility
- **Consistent Organization**: Uniform structure across all modules
- **Consolidated Functionality**: Merge duplicate implementations

## Components and Interfaces

### 1. Simplified Parser Module

**Current Structure (25+ files):**

```
src/parser/
├── command-parser.ts (1097 lines)
├── universal-command-parser.ts (1144 lines)
├── smart-ai-provider.ts
├── ai-provider.ts
├── ai-provider-factory.ts
├── smart-parser-config.ts
├── parsing-diagnostics.ts
├── parsing-metrics.ts
├── context-enhancer.ts
├── format-detector.ts
├── input-preprocessor.ts
├── smart-prompt-builder.ts
├── suggestion-engine.ts
├── error-recovery.ts
├── fallback-parser.ts
├── intelligent-fallback-parser.ts
├── response-parser.ts
├── command-validator.ts
├── ollama-client.ts
├── prompt-templates.ts
├── ai-error-handler.ts
└── providers/ (5 files)
```

**Target Structure (8 core files):**

```
src/parser/
├── index.ts                    # Main exports
├── command-parser.ts           # Unified parser (consolidates 3 parsers)
├── ai-providers.ts            # All AI provider implementations
├── prompt-builder.ts          # Consolidated prompt logic
├── response-handler.ts        # Response parsing and validation
├── fallback-parser.ts         # Simple fallback logic
├── config.ts                  # Unified configuration
└── utils.ts                   # Shared utilities
```

### 2. Reorganized Test Structure

**Current Structure:**

```
src/
├── __tests__/e2e/
├── __tests__/integration/
├── analyzer/__tests__/
├── cli/__tests__/
├── executor/__tests__/
├── generator/__tests__/
├── orchestrator/__tests__/
├── parser/__tests__/
│   ├── benchmarks/
│   ├── e2e/
│   ├── mocks/
│   ├── stress-tests/
│   └── test-data/
└── types/__tests__/
```

**Target Structure:**

```
tests/
├── unit/                      # All unit tests
│   ├── parser/
│   ├── executor/
│   ├── generator/
│   ├── analyzer/
│   └── cli/
├── integration/               # Integration tests
│   ├── workflow/
│   └── api/
├── e2e/                      # End-to-end tests
├── fixtures/                 # Test data and mocks
└── utils/                    # Test utilities
```

### 3. Consolidated Core Modules

**Target Module Structure:**

```
src/
├── core/                     # Core business logic
│   ├── parser/              # Simplified parser
│   ├── executor/            # Test execution
│   ├── generator/           # Script generation
│   └── analyzer/            # Results analysis
├── interfaces/              # CLI and API interfaces
│   ├── cli/
│   └── api/
├── utils/                   # Shared utilities
├── config/                  # Configuration management
└── types/                   # Type definitions
```

## Data Models

### Unified Configuration Model

```typescript
interface StressMasterConfig {
  ai: {
    provider: "ollama" | "openai" | "claude" | "gemini";
    endpoint?: string;
    apiKey?: string;
    model: string;
    timeout: number;
    maxRetries: number;
  };
  execution: {
    maxConcurrentTests: number;
    defaultTimeout: number;
    resourceLimits: {
      memory: string;
      cpu: string;
    };
  };
  logging: {
    level: "debug" | "info" | "warn" | "error";
    enableMetrics: boolean;
    enableDiagnostics: boolean;
  };
}
```

### Simplified Parser Interfaces

```typescript
interface CommandParser {
  parseCommand(input: string): Promise<LoadTestSpec>;
  validateSpec(spec: LoadTestSpec): ValidationResult;
}

interface AIProvider {
  name: string;
  generateCompletion(request: CompletionRequest): Promise<CompletionResponse>;
  healthCheck(): Promise<boolean>;
}

interface ParseResult {
  spec: LoadTestSpec;
  confidence: number;
  warnings: string[];
  suggestions: string[];
}
```

## Error Handling

### Unified Error System

Instead of multiple error handling systems (ai-error-handler.ts, error-recovery.ts, parsing-diagnostics.ts), implement a single error handling approach:

```typescript
class StressMasterError extends Error {
  constructor(
    message: string,
    public code: string,
    public context?: any,
    public suggestions?: string[]
  ) {
    super(message);
    this.name = "StressMasterError";
  }
}

class ErrorHandler {
  static handle(error: Error, context: string): StressMasterError {
    // Unified error classification and handling
  }

  static getSuggestions(error: StressMasterError): string[] {
    // Consolidated suggestion logic
  }
}
```

## Testing Strategy

### Test Organization Principles

1. **Co-location**: Unit tests stay with their modules in `__tests__` folders
2. **Separation by Type**: Clear distinction between unit, integration, and e2e tests
3. **Shared Utilities**: Common test utilities in centralized location
4. **Consistent Naming**: Uniform naming conventions across all test files

### Test Consolidation Plan

- **Merge Similar Tests**: Combine overlapping test suites (e.g., multiple parser test files)
- **Eliminate Redundancy**: Remove duplicate test scenarios
- **Standardize Mocks**: Create reusable mock implementations
- **Simplify Test Data**: Consolidate test datasets and fixtures

### Test Coverage Targets

- **Unit Tests**: 90% coverage for core business logic
- **Integration Tests**: Key workflow scenarios
- **E2E Tests**: Critical user journeys only

## Implementation Strategy

### Phase 1: Parser Module Consolidation

1. **Merge Parser Implementations**

   - Combine command-parser.ts, universal-command-parser.ts, and smart-ai-provider.ts
   - Extract common functionality into shared utilities
   - Eliminate duplicate interfaces and types

2. **Consolidate AI Providers**

   - Merge all provider implementations into single file
   - Standardize provider interface
   - Remove provider factory complexity

3. **Simplify Configuration**
   - Merge parsing-diagnostics.ts, parsing-metrics.ts, and smart-parser-config.ts
   - Create unified configuration system
   - Remove redundant monitoring systems

### Phase 2: Test Restructuring

1. **Reorganize Test Structure**

   - Move tests to new directory structure
   - Consolidate test utilities
   - Standardize test naming

2. **Eliminate Test Redundancy**
   - Merge similar test files
   - Remove duplicate test scenarios
   - Consolidate mock implementations

### Phase 3: Module Simplification

1. **Reduce File Count**

   - Merge small utility files
   - Eliminate unnecessary abstractions
   - Consolidate related functionality

2. **Standardize Interfaces**
   - Simplify complex interfaces
   - Remove unused abstractions
   - Ensure consistent patterns

### Phase 4: Documentation and Cleanup

1. **Update Documentation**

   - Reflect new structure in README
   - Update API documentation
   - Create migration guide

2. **Final Cleanup**
   - Remove unused files
   - Update imports and exports
   - Verify all tests pass

## Migration Considerations

### Backward Compatibility

- All public APIs must remain unchanged
- CLI commands must work identically
- Configuration files should be backward compatible where possible

### Risk Mitigation

- Comprehensive test coverage before refactoring
- Incremental changes with validation at each step
- Rollback plan for each phase
- Performance benchmarking to ensure no regressions

### Success Metrics

- **Code Reduction**: Target 40% reduction in total lines of code
- **File Reduction**: Target 50% reduction in number of files
- **Test Organization**: 100% of tests in new structure
- **Functionality Preservation**: 100% of existing features working
- **Performance**: No degradation in parsing or execution speed
