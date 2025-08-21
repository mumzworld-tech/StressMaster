# AI Prompts Directory

This directory contains all AI prompt templates used by the StressMaster parser system.

## Structure

```
prompts/
├── index.ts                 # Main exports
├── types.ts                 # TypeScript interfaces
├── command-parser-prompt.ts # Command parsing prompts
├── prompt-manager.ts        # Prompt management utilities
└── README.md               # This file
```

## Available Prompts

### 1. Command Parser Prompt (`command-parser`)

- **Purpose**: General purpose command parsing
- **Version**: 1.0.0
- **Use Case**: Standard load testing commands

### 2. Complex JSON Prompt (`complex-json-parser`)

- **Purpose**: Handling complex nested JSON structures
- **Version**: 1.0.0
- **Use Case**: Commands with deep nesting, arrays, incrementing fields

### 3. Flexible Command Prompt (`flexible-command-parser`)

- **Purpose**: Universal prompt for all command types
- **Version**: 2.0.0
- **Use Case**: Handles both simple and complex commands with intelligent parsing

## Usage

### Basic Usage

```typescript
import { selectPromptTemplate } from "./prompts";

const prompt = selectPromptTemplate(userInput);
```

### Advanced Usage with PromptManager

```typescript
import { PromptManager } from "./prompts";

const manager = new PromptManager();
const prompt = manager.selectPromptForInput(userInput);
```

## Adding New Prompts

1. Create a new prompt template in `command-parser-prompt.ts`
2. Add it to the `PromptManager` constructor
3. Update this README with the new prompt details

## Template Variables

All prompts support variable substitution using `{{variableName}}` syntax:

- `{{input}}` - The user's command input
- `{{method}}` - HTTP method (for method-specific prompts)
- `{{url}}` - Target URL (for URL-specific prompts)

## Future Enhancements

- [ ] Language-specific prompts (Spanish, French, etc.)
- [ ] Domain-specific prompts (e-commerce, banking, etc.)
- [ ] Context-aware prompts based on user history
- [ ] A/B testing for prompt effectiveness
