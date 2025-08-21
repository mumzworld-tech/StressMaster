import { LoadTestSpec } from "../../types/load-test-spec";

export interface ParsingPattern {
  input: string;
  successfulParse: boolean;
  confidence: number;
  timestamp: Date;
  userId?: string;
  extractedFields: {
    urls: string[];
    methods: string[];
    headers: Record<string, string>;
    bodies: string[];
    variables: string[];
  };
}

export interface UserPreference {
  userId: string;
  preferredSyntax: string[];
  commonPhrases: string[];
  successfulPatterns: ParsingPattern[];
  failedPatterns: ParsingPattern[];
  lastUpdated: Date;
}

export class PatternLearner {
  private static instance: PatternLearner;
  private userPreferences: Map<string, UserPreference> = new Map();
  private globalPatterns: ParsingPattern[] = [];
  private readonly maxPatternsPerUser = 100;
  private readonly maxGlobalPatterns = 1000;

  static getInstance(): PatternLearner {
    if (!PatternLearner.instance) {
      PatternLearner.instance = new PatternLearner();
    }
    return PatternLearner.instance;
  }

  /**
   * Record a parsing attempt for learning
   */
  recordParsingAttempt(
    input: string,
    successful: boolean,
    confidence: number,
    extractedFields: ParsingPattern["extractedFields"],
    userId?: string
  ): void {
    const pattern: ParsingPattern = {
      input: input.toLowerCase().trim(),
      successfulParse: successful,
      confidence,
      timestamp: new Date(),
      userId,
      extractedFields,
    };

    // Store globally
    this.globalPatterns.push(pattern);
    if (this.globalPatterns.length > this.maxGlobalPatterns) {
      this.globalPatterns.shift(); // Remove oldest
    }

    // Store per user
    if (userId) {
      let userPref = this.userPreferences.get(userId);
      if (!userPref) {
        userPref = {
          userId,
          preferredSyntax: [],
          commonPhrases: [],
          successfulPatterns: [],
          failedPatterns: [],
          lastUpdated: new Date(),
        };
        this.userPreferences.set(userId, userPref);
      }

      if (successful) {
        userPref.successfulPatterns.push(pattern);
        if (userPref.successfulPatterns.length > this.maxPatternsPerUser) {
          userPref.successfulPatterns.shift();
        }
      } else {
        userPref.failedPatterns.push(pattern);
        if (userPref.failedPatterns.length > this.maxPatternsPerUser) {
          userPref.failedPatterns.shift();
        }
      }

      userPref.lastUpdated = new Date();
      this.updateUserPreferences(userId);
    }
  }

  /**
   * Get suggestions based on user's past successful patterns
   */
  getSuggestions(input: string, userId?: string): string[] {
    const suggestions: string[] = [];
    const lowerInput = input.toLowerCase().trim();

    if (userId) {
      const userPref = this.userPreferences.get(userId);
      if (userPref) {
        // Find similar successful patterns
        const similarPatterns = userPref.successfulPatterns
          .filter((p) => this.calculateSimilarity(lowerInput, p.input) > 0.3)
          .sort(
            (a, b) =>
              this.calculateSimilarity(lowerInput, b.input) -
              this.calculateSimilarity(lowerInput, a.input)
          )
          .slice(0, 3);

        similarPatterns.forEach((pattern) => {
          if (pattern.input !== lowerInput) {
            suggestions.push(`Try: "${pattern.input}"`);
          }
        });

        // Suggest based on common phrases
        userPref.commonPhrases
          .filter((phrase) => !lowerInput.includes(phrase))
          .slice(0, 2)
          .forEach((phrase) => {
            suggestions.push(`Consider adding: "${phrase}"`);
          });
      }
    }

    // Global suggestions
    const globalSimilar = this.globalPatterns
      .filter(
        (p) =>
          p.successfulParse &&
          this.calculateSimilarity(lowerInput, p.input) > 0.4
      )
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 2);

    globalSimilar.forEach((pattern) => {
      if (pattern.input !== lowerInput) {
        suggestions.push(`Popular pattern: "${pattern.input}"`);
      }
    });

    return suggestions;
  }

  /**
   * Learn from successful parsing to improve future attempts
   */
  learnFromSuccess(input: string, spec: LoadTestSpec, userId?: string): void {
    const extractedFields = {
      urls: spec.requests.map((r) => r.url).filter(Boolean),
      methods: spec.requests.map((r) => r.method).filter(Boolean),
      headers: spec.requests.reduce((acc, r) => ({ ...acc, ...r.headers }), {}),
      bodies: spec.requests.map((r) => r.body || r.payload).filter(Boolean),
      variables: this.extractVariables(spec),
    };

    this.recordParsingAttempt(input, true, 1.0, extractedFields, userId);
  }

  /**
   * Get confidence boost based on learned patterns
   */
  getConfidenceBoost(input: string, userId?: string): number {
    let boost = 0;
    const lowerInput = input.toLowerCase().trim();

    // User-specific boost
    if (userId) {
      const userPref = this.userPreferences.get(userId);
      if (userPref) {
        const exactMatch = userPref.successfulPatterns.find(
          (p) => p.input === lowerInput
        );
        if (exactMatch) {
          boost += 0.3; // Exact match gets significant boost
        }

        const similarMatches = userPref.successfulPatterns.filter(
          (p) => this.calculateSimilarity(lowerInput, p.input) > 0.7
        ).length;
        boost += similarMatches * 0.1; // Similar patterns get smaller boost
      }
    }

    // Global boost
    const globalExactMatch = this.globalPatterns.find(
      (p) => p.successfulParse && p.input === lowerInput
    );
    if (globalExactMatch) {
      boost += 0.2;
    }

    return Math.min(boost, 0.5); // Cap at 50% boost
  }

  private calculateSimilarity(str1: string, str2: string): number {
    const words1 = str1.split(/\s+/);
    const words2 = str2.split(/\s+/);
    const commonWords = words1.filter((word) => words2.includes(word));
    return commonWords.length / Math.max(words1.length, words2.length);
  }

  private extractVariables(spec: LoadTestSpec): string[] {
    const variables: string[] = [];
    spec.requests.forEach((request) => {
      if (request.payload?.variables) {
        request.payload.variables.forEach((v) => {
          if (v.name) variables.push(v.name);
        });
      }
    });
    return variables;
  }

  private updateUserPreferences(userId: string): void {
    const userPref = this.userPreferences.get(userId);
    if (!userPref) return;

    // Extract common phrases from successful patterns
    const allWords = userPref.successfulPatterns
      .flatMap((p) => p.input.split(/\s+/))
      .filter((word) => word.length > 3);

    const wordCount = new Map<string, number>();
    allWords.forEach((word) => {
      wordCount.set(word, (wordCount.get(word) || 0) + 1);
    });

    userPref.commonPhrases = Array.from(wordCount.entries())
      .filter(([_, count]) => count > 2)
      .sort(([_, a], [__, b]) => b - a)
      .slice(0, 10)
      .map(([word, _]) => word);

    // Extract preferred syntax patterns
    userPref.preferredSyntax = userPref.successfulPatterns
      .map((p) => this.extractSyntaxPattern(p.input))
      .filter(Boolean)
      .slice(0, 5);
  }

  private extractSyntaxPattern(input: string): string {
    // Extract common syntax patterns like "send X requests to Y"
    const patterns = [
      /send\s+\d+\s+\w+\s+requests?\s+to/i,
      /blast\s+\d+\s+requests?\s+to/i,
      /increment\s+\w+(?:\s+and\s+\w+)*/i,
      /\d+\s+POST\s+requests?\s+to/i,
    ];

    for (const pattern of patterns) {
      const match = input.match(pattern);
      if (match) return match[0];
    }

    return "";
  }

  /**
   * Get statistics about learning
   */
  getStats(): {
    totalPatterns: number;
    successfulPatterns: number;
    userCount: number;
    averageConfidence: number;
  } {
    const successful = this.globalPatterns.filter((p) => p.successfulParse);
    const avgConfidence =
      successful.length > 0
        ? successful.reduce((sum, p) => sum + p.confidence, 0) /
          successful.length
        : 0;

    return {
      totalPatterns: this.globalPatterns.length,
      successfulPatterns: successful.length,
      userCount: this.userPreferences.size,
      averageConfidence: avgConfidence,
    };
  }
}
