"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { useThemeStore } from "@/stores/themeStore";
import { cn } from "@/lib/utils";
import {
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  Zap,
  Target,
  Timer,
  Activity,
} from "lucide-react";

interface TestResultsProps {
  status: "running" | "completed" | "failed";
  metrics: {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    averageResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
    requestsPerSecond: number;
  };
  testId: string;
  command: string;
}

export const TestResults: React.FC<TestResultsProps> = ({
  status,
  metrics,
  testId,
  command,
}) => {
  const { isDark } = useThemeStore();

  const getStatusIcon = () => {
    switch (status) {
      case "completed":
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case "failed":
        return <XCircle className="w-5 h-5 text-red-500" />;
      case "running":
        return <Clock className="w-5 h-5 text-yellow-500 animate-spin" />;
      default:
        return <Activity className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case "completed":
        return isDark
          ? "bg-green-900/30 text-green-300"
          : "bg-green-100 text-green-700";
      case "failed":
        return isDark
          ? "bg-red-900/30 text-red-300"
          : "bg-red-100 text-red-700";
      case "running":
        return isDark
          ? "bg-yellow-900/30 text-yellow-300"
          : "bg-yellow-100 text-yellow-700";
      default:
        return isDark
          ? "bg-gray-900/30 text-gray-300"
          : "bg-gray-100 text-gray-700";
    }
  };

  const successRate =
    metrics.totalRequests > 0
      ? Math.round((metrics.successfulRequests / metrics.totalRequests) * 100)
      : 0;

  const formatTime = (ms: number) => {
    if (ms === 0) return "0ms";
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  return (
    <Card
      className={cn(
        "w-full max-w-4xl mx-auto",
        isDark ? "border-gray-700 bg-gray-800" : "border-gray-200 bg-white"
      )}
    >
      <CardContent className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            {getStatusIcon()}
            <div>
              <h3
                className={cn(
                  "text-lg font-semibold",
                  isDark ? "text-white" : "text-gray-900"
                )}
              >
                Load Test Results
              </h3>
              <p
                className={cn(
                  "text-sm",
                  isDark ? "text-gray-400" : "text-gray-600"
                )}
              >
                Test ID: {testId}
              </p>
            </div>
          </div>
          <div
            className={cn(
              "px-3 py-1 rounded-full text-sm font-medium",
              getStatusColor()
            )}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </div>
        </div>

        {/* Command */}
        <div
          className={cn(
            "p-3 rounded-lg mb-6",
            isDark ? "bg-gray-700" : "bg-gray-50"
          )}
        >
          <p
            className={cn(
              "text-sm font-medium mb-1",
              isDark ? "text-gray-300" : "text-gray-700"
            )}
          >
            Command:
          </p>
          <p
            className={cn(
              "text-sm font-mono",
              isDark ? "text-gray-200" : "text-gray-800"
            )}
          >
            {command}
          </p>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Requests */}
          <div
            className={cn(
              "p-4 rounded-lg",
              isDark ? "bg-gray-700" : "bg-gray-50"
            )}
          >
            <div className="flex items-center space-x-2 mb-2">
              <Target className="w-4 h-4 text-blue-500" />
              <span
                className={cn(
                  "text-sm font-medium",
                  isDark ? "text-gray-300" : "text-gray-700"
                )}
              >
                Total Requests
              </span>
            </div>
            <p
              className={cn(
                "text-2xl font-bold",
                isDark ? "text-white" : "text-gray-900"
              )}
            >
              {metrics.totalRequests}
            </p>
          </div>

          {/* Success Rate */}
          <div
            className={cn(
              "p-4 rounded-lg",
              isDark ? "bg-gray-700" : "bg-gray-50"
            )}
          >
            <div className="flex items-center space-x-2 mb-2">
              <TrendingUp className="w-4 h-4 text-green-500" />
              <span
                className={cn(
                  "text-sm font-medium",
                  isDark ? "text-gray-300" : "text-gray-700"
                )}
              >
                Success Rate
              </span>
            </div>
            <p
              className={cn(
                "text-2xl font-bold",
                successRate >= 95
                  ? "text-green-500"
                  : successRate >= 80
                  ? "text-yellow-500"
                  : "text-red-500"
              )}
            >
              {successRate}%
            </p>
            <p
              className={cn(
                "text-xs",
                isDark ? "text-gray-400" : "text-gray-600"
              )}
            >
              {metrics.successfulRequests}/{metrics.totalRequests}
            </p>
          </div>

          {/* Average Response Time */}
          <div
            className={cn(
              "p-4 rounded-lg",
              isDark ? "bg-gray-700" : "bg-gray-50"
            )}
          >
            <div className="flex items-center space-x-2 mb-2">
              <Timer className="w-4 h-4 text-purple-500" />
              <span
                className={cn(
                  "text-sm font-medium",
                  isDark ? "text-gray-300" : "text-gray-700"
                )}
              >
                Avg Response Time
              </span>
            </div>
            <p
              className={cn(
                "text-2xl font-bold",
                isDark ? "text-white" : "text-gray-900"
              )}
            >
              {formatTime(metrics.averageResponseTime)}
            </p>
          </div>

          {/* Requests Per Second */}
          <div
            className={cn(
              "p-4 rounded-lg",
              isDark ? "bg-gray-700" : "bg-gray-50"
            )}
          >
            <div className="flex items-center space-x-2 mb-2">
              <Zap className="w-4 h-4 text-orange-500" />
              <span
                className={cn(
                  "text-sm font-medium",
                  isDark ? "text-gray-300" : "text-gray-700"
                )}
              >
                Requests/Second
              </span>
            </div>
            <p
              className={cn(
                "text-2xl font-bold",
                isDark ? "text-white" : "text-gray-900"
              )}
            >
              {metrics.requestsPerSecond.toFixed(1)}
            </p>
          </div>
        </div>

        {/* Additional Metrics */}
        {(metrics.p95ResponseTime > 0 || metrics.p99ResponseTime > 0) && (
          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
            <h4
              className={cn(
                "text-sm font-medium mb-3",
                isDark ? "text-gray-300" : "text-gray-700"
              )}
            >
              Performance Percentiles
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {metrics.p95ResponseTime > 0 && (
                <div className="flex justify-between items-center">
                  <span
                    className={cn(
                      "text-sm",
                      isDark ? "text-gray-400" : "text-gray-600"
                    )}
                  >
                    P95 Response Time
                  </span>
                  <span
                    className={cn(
                      "text-sm font-medium",
                      isDark ? "text-white" : "text-gray-900"
                    )}
                  >
                    {formatTime(metrics.p95ResponseTime)}
                  </span>
                </div>
              )}
              {metrics.p99ResponseTime > 0 && (
                <div className="flex justify-between items-center">
                  <span
                    className={cn(
                      "text-sm",
                      isDark ? "text-gray-400" : "text-gray-600"
                    )}
                  >
                    P99 Response Time
                  </span>
                  <span
                    className={cn(
                      "text-sm font-medium",
                      isDark ? "text-white" : "text-gray-900"
                    )}
                  >
                    {formatTime(metrics.p99ResponseTime)}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Failed Requests */}
        {metrics.failedRequests > 0 && (
          <div className="mt-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
            <div className="flex items-center space-x-2">
              <XCircle className="w-4 h-4 text-red-500" />
              <span className="text-sm font-medium text-red-700 dark:text-red-300">
                {metrics.failedRequests} request
                {metrics.failedRequests !== 1 ? "s" : ""} failed
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};





