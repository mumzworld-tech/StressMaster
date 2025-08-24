export interface RateLimiterConfig {
  maxRequestsPerMinute: number;
  maxRequestsPerHour: number;
  burstSize: number;
}

export class RateLimiter {
  private config: RateLimiterConfig;
  private requestHistory: number[] = [];

  constructor(config: RateLimiterConfig) {
    this.config = config;
  }

  canMakeRequest(): boolean {
    const now = Date.now();
    const oneMinuteAgo = now - 60 * 1000;
    const oneHourAgo = now - 60 * 60 * 1000;

    // Clean old requests
    this.requestHistory = this.requestHistory.filter(
      (timestamp) => timestamp > oneHourAgo
    );

    // Check minute limit
    const requestsInLastMinute = this.requestHistory.filter(
      (timestamp) => timestamp > oneMinuteAgo
    ).length;

    if (requestsInLastMinute >= this.config.maxRequestsPerMinute) {
      return false;
    }

    // Check hour limit
    if (this.requestHistory.length >= this.config.maxRequestsPerHour) {
      return false;
    }

    // Check burst limit
    const recentRequests = this.requestHistory.filter(
      (timestamp) => timestamp > now - 1000 // Last second
    ).length;

    if (recentRequests >= this.config.burstSize) {
      return false;
    }

    // Record this request
    this.requestHistory.push(now);
    return true;
  }

  getWaitTime(): number {
    const now = Date.now();
    const oneMinuteAgo = now - 60 * 1000;

    const requestsInLastMinute = this.requestHistory.filter(
      (timestamp) => timestamp > oneMinuteAgo
    ).length;

    if (requestsInLastMinute >= this.config.maxRequestsPerMinute) {
      const oldestRequest = Math.min(
        ...this.requestHistory.filter((timestamp) => timestamp > oneMinuteAgo)
      );
      return Math.max(0, oldestRequest + 60 * 1000 - now);
    }

    return 0;
  }

  reset(): void {
    this.requestHistory = [];
  }
}
