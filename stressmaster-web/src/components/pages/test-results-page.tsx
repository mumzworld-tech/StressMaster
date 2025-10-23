"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useThemeStore } from "@/stores/themeStore";
import { useChatStore } from "@/stores/chatStore";
import { cn } from "@/lib/utils";
import { ChatMessage } from "@/types";
import {
  BarChart3,
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  TrendingUp,
  Activity,
  ArrowLeft,
  Download,
  Filter,
  Search,
} from "lucide-react";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface TestResultsPageProps {
  className?: string;
}

interface TestData {
  id: string;
  timestamp: Date;
  command: string;
  metrics: {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    averageResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
    requestsPerSecond: number;
  };
  status: "completed" | "failed" | "running";
  duration: number;
}

export const TestResultsPage: React.FC<TestResultsPageProps> = ({
  className,
}) => {
  const { isDark } = useThemeStore();
  const { sessions, currentSession, switchSession } = useChatStore();
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    currentSession?.id || null
  );
  const [selectedTestId, setSelectedTestId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFilter, setDateFilter] = useState<string>("all");

  const selectedSession = sessions.find((s) => s.id === selectedSessionId);

  // Extract test data from messages
  const getTestData = (session: (typeof sessions)[0]): TestData[] => {
    return session.messages
      .filter((msg) => msg.type === "assistant" && msg.metadata?.testResults)
      .map((message) => {
        const metrics = message.metadata?.testResults?.metrics;
        const command =
          typeof message.metadata?.testResults?.command === "string"
            ? message.metadata.testResults.command
            : JSON.stringify(message.metadata?.testResults?.command || {});

        return {
          id: message.id,
          timestamp: message.timestamp,
          command:
            command.length > 100 ? command.substring(0, 100) + "..." : command,
          metrics: {
            totalRequests: metrics?.totalRequests || 0,
            successfulRequests: metrics?.successfulRequests || 0,
            failedRequests: metrics?.failedRequests || 0,
            averageResponseTime: metrics?.averageResponseTime || 0,
            p95ResponseTime: metrics?.p95ResponseTime || 0,
            p99ResponseTime: metrics?.p99ResponseTime || 0,
            requestsPerSecond: metrics?.requestsPerSecond || 0,
          },
          status: message.metadata?.testResults?.status || "completed",
          duration: 0, // We can calculate this from start/end times if needed
        };
      });
  };

  const getSessionStats = (session: (typeof sessions)[0]) => {
    const testData = getTestData(session);
    const totalTests = testData.length;
    const totalRequests = testData.reduce(
      (sum, test) => sum + test.metrics.totalRequests,
      0
    );
    const successfulRequests = testData.reduce(
      (sum, test) => sum + test.metrics.successfulRequests,
      0
    );
    const failedRequests = testData.reduce(
      (sum, test) => sum + test.metrics.failedRequests,
      0
    );
    const avgResponseTime =
      totalTests > 0
        ? testData.reduce(
            (sum, test) => sum + test.metrics.averageResponseTime,
            0
          ) / totalTests
        : 0;

    return {
      totalTests,
      totalRequests,
      successfulRequests,
      failedRequests,
      avgResponseTime,
      successRate:
        totalRequests > 0
          ? Math.round((successfulRequests / totalRequests) * 100)
          : 0,
    };
  };

  const filteredSessions = sessions.filter((session) => {
    const matchesSearch = session.title
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    // Add date filtering logic here if needed
    return matchesSearch;
  });

  const selectedTest =
    selectedSession && selectedTestId
      ? getTestData(selectedSession).find((test) => test.id === selectedTestId)
      : null;

  if (!selectedSession) {
    return (
      <div className={cn("p-6 space-y-6", className)}>
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1
            className={cn(
              "text-2xl font-bold",
              isDark ? "text-white" : "text-gray-900"
            )}
          >
            Test Results
          </h1>
        </div>

        {/* Session List */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredSessions.map((session) => {
            const stats = getSessionStats(session);
            const testData = getTestData(session);

            // Show sessions even if they don't have test results yet
            // if (testData.length === 0) return null;

            return (
              <Card
                key={session.id}
                className={cn(
                  "cursor-pointer transition-all duration-200 hover:shadow-lg",
                  isDark
                    ? "border-gray-700 bg-gray-800 hover:border-gray-600"
                    : "border-gray-200 bg-white hover:border-gray-300"
                )}
                onClick={() => setSelectedSessionId(session.id)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle
                      className={cn(
                        "text-sm font-medium truncate",
                        isDark ? "text-white" : "text-gray-900"
                      )}
                    >
                      {session.title}
                    </CardTitle>
                    <div className="flex items-center space-x-1 text-xs">
                      <Calendar
                        className={cn(
                          "w-3 h-3",
                          isDark ? "text-gray-500" : "text-gray-600"
                        )}
                      />
                      <span
                        className={cn(
                          isDark ? "text-gray-400" : "text-gray-600"
                        )}
                      >
                        {new Date(session.updatedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  {testData.length === 0 ? (
                    <div className="text-center py-4">
                      <p
                        className={cn(
                          "text-sm",
                          isDark ? "text-gray-400" : "text-gray-600"
                        )}
                      >
                        No test results yet
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center">
                        <div
                          className={cn(
                            "text-lg font-bold",
                            isDark ? "text-white" : "text-gray-900"
                          )}
                        >
                          {stats.totalTests}
                        </div>
                        <div
                          className={cn(
                            "text-xs",
                            isDark ? "text-gray-400" : "text-gray-600"
                          )}
                        >
                          Tests
                        </div>
                      </div>
                      <div className="text-center">
                        <div
                          className={cn(
                            "text-lg font-bold",
                            isDark ? "text-white" : "text-gray-900"
                          )}
                        >
                          {stats.totalRequests}
                        </div>
                        <div
                          className={cn(
                            "text-xs",
                            isDark ? "text-gray-400" : "text-gray-600"
                          )}
                        >
                          Requests
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold text-green-500">
                          {stats.successRate}%
                        </div>
                        <div
                          className={cn(
                            "text-xs",
                            isDark ? "text-gray-400" : "text-gray-600"
                          )}
                        >
                          Success Rate
                        </div>
                      </div>
                      <div className="text-center">
                        <div
                          className={cn(
                            "text-lg font-bold",
                            isDark ? "text-white" : "text-gray-900"
                          )}
                        >
                          {Math.round(stats.avgResponseTime)}ms
                        </div>
                        <div
                          className={cn(
                            "text-xs",
                            isDark ? "text-gray-400" : "text-gray-600"
                          )}
                        >
                          Avg Response
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {filteredSessions.length === 0 && (
          <Card
            className={cn(
              "p-8 text-center",
              isDark
                ? "border-gray-700 bg-gray-800"
                : "border-gray-200 bg-white"
            )}
          >
            <BarChart3 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3
              className={cn(
                "text-lg font-semibold mb-2",
                isDark ? "text-white" : "text-gray-900"
              )}
            >
              No Test Results Found
            </h3>
            <p
              className={cn(
                "text-sm",
                isDark ? "text-gray-400" : "text-gray-600"
              )}
            >
              Run some load tests to see detailed results and analytics here.
            </p>
          </Card>
        )}
      </div>
    );
  }

  const testData = getTestData(selectedSession);
  const sessionStats = getSessionStats(selectedSession);

  return (
    <div className={cn("p-6 space-y-6", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedSessionId(null)}
            className={cn(
              "flex items-center space-x-2",
              isDark
                ? "text-gray-300 hover:text-white hover:bg-gray-700"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
            )}
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Sessions</span>
          </Button>
          <h1
            className={cn(
              "text-2xl font-bold",
              isDark ? "text-white" : "text-gray-900"
            )}
          >
            {selectedSession.title} - Test Results
          </h1>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "flex items-center space-x-2",
              isDark
                ? "text-gray-300 hover:text-white hover:bg-gray-700"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
            )}
          >
            <Download className="w-4 h-4" />
            <span>Export</span>
          </Button>
        </div>
      </div>

      {/* Session Summary */}
      <Card
        className={cn(
          isDark ? "border-gray-700 bg-gray-800" : "border-gray-200 bg-white"
        )}
      >
        <CardHeader>
          <CardTitle
            className={cn(
              "text-lg font-semibold",
              isDark ? "text-white" : "text-gray-900"
            )}
          >
            Session Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="flex items-center justify-center w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg mx-auto mb-2">
                <Activity className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div
                className={cn(
                  "text-2xl font-bold",
                  isDark ? "text-white" : "text-gray-900"
                )}
              >
                {sessionStats.totalTests}
              </div>
              <div
                className={cn(
                  "text-sm",
                  isDark ? "text-gray-400" : "text-gray-600"
                )}
              >
                Total Tests
              </div>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-lg mx-auto mb-2">
                <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <div
                className={cn(
                  "text-2xl font-bold",
                  isDark ? "text-white" : "text-gray-900"
                )}
              >
                {sessionStats.successfulRequests}
              </div>
              <div
                className={cn(
                  "text-sm",
                  isDark ? "text-gray-400" : "text-gray-600"
                )}
              >
                Successful Requests
              </div>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-lg mx-auto mb-2">
                <XCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
              <div
                className={cn(
                  "text-2xl font-bold",
                  isDark ? "text-white" : "text-gray-900"
                )}
              >
                {sessionStats.failedRequests}
              </div>
              <div
                className={cn(
                  "text-sm",
                  isDark ? "text-gray-400" : "text-gray-600"
                )}
              >
                Failed Requests
              </div>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-lg mx-auto mb-2">
                <TrendingUp className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div
                className={cn(
                  "text-2xl font-bold",
                  isDark ? "text-white" : "text-gray-900"
                )}
              >
                {Math.round(sessionStats.avgResponseTime)}ms
              </div>
              <div
                className={cn(
                  "text-sm",
                  isDark ? "text-gray-400" : "text-gray-600"
                )}
              >
                Avg Response Time
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Individual Test Results */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {testData.map((test, index) => (
          <Card
            key={test.id}
            className={cn(
              "cursor-pointer transition-all duration-200",
              selectedTestId === test.id
                ? "ring-2 ring-red-500 border-red-500"
                : isDark
                ? "border-gray-700 bg-gray-800 hover:border-gray-600"
                : "border-gray-200 bg-white hover:border-gray-300"
            )}
            onClick={() => setSelectedTestId(test.id)}
          >
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle
                  className={cn(
                    "text-sm font-medium",
                    isDark ? "text-white" : "text-gray-900"
                  )}
                >
                  Test #{index + 1}
                </CardTitle>
                <div
                  className={cn(
                    "px-2 py-1 rounded-full text-xs font-medium",
                    test.status === "completed"
                      ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                      : test.status === "failed"
                      ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                      : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
                  )}
                >
                  {test.status}
                </div>
              </div>
              <p
                className={cn(
                  "text-xs truncate",
                  isDark ? "text-gray-400" : "text-gray-600"
                )}
              >
                {test.command}
              </p>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <div
                    className={cn(
                      "text-lg font-bold",
                      isDark ? "text-white" : "text-gray-900"
                    )}
                  >
                    {test.metrics.totalRequests}
                  </div>
                  <div
                    className={cn(
                      "text-xs",
                      isDark ? "text-gray-400" : "text-gray-600"
                    )}
                  >
                    Total Requests
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-green-500">
                    {test.metrics.successfulRequests}
                  </div>
                  <div
                    className={cn(
                      "text-xs",
                      isDark ? "text-gray-400" : "text-gray-600"
                    )}
                  >
                    Successful
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-red-500">
                    {test.metrics.failedRequests}
                  </div>
                  <div
                    className={cn(
                      "text-xs",
                      isDark ? "text-gray-400" : "text-gray-600"
                    )}
                  >
                    Failed
                  </div>
                </div>
                <div className="text-center">
                  <div
                    className={cn(
                      "text-lg font-bold",
                      isDark ? "text-white" : "text-gray-900"
                    )}
                  >
                    {Math.round(test.metrics.averageResponseTime)}ms
                  </div>
                  <div
                    className={cn(
                      "text-xs",
                      isDark ? "text-gray-400" : "text-gray-600"
                    )}
                  >
                    Avg Response
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Detailed Test Visualization */}
      {selectedTest && (
        <Card
          className={cn(
            isDark ? "border-gray-700 bg-gray-800" : "border-gray-200 bg-white"
          )}
        >
          <CardHeader>
            <CardTitle
              className={cn(
                "text-lg font-semibold",
                isDark ? "text-white" : "text-gray-900"
              )}
            >
              Test Details -{" "}
              {testData.findIndex((t) => t.id === selectedTest.id) + 1}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Performance Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Response Time Chart */}
                <div>
                  <h4
                    className={cn(
                      "text-sm font-medium mb-3",
                      isDark ? "text-white" : "text-gray-900"
                    )}
                  >
                    Response Time Analysis
                  </h4>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span
                        className={cn(
                          "text-xs",
                          isDark ? "text-gray-400" : "text-gray-600"
                        )}
                      >
                        Average
                      </span>
                      <span
                        className={cn(
                          "text-sm font-medium",
                          isDark ? "text-white" : "text-gray-900"
                        )}
                      >
                        {Math.round(selectedTest.metrics.averageResponseTime)}ms
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span
                        className={cn(
                          "text-xs",
                          isDark ? "text-gray-400" : "text-gray-600"
                        )}
                      >
                        P95
                      </span>
                      <span
                        className={cn(
                          "text-sm font-medium",
                          isDark ? "text-white" : "text-gray-900"
                        )}
                      >
                        {Math.round(selectedTest.metrics.p95ResponseTime)}ms
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span
                        className={cn(
                          "text-xs",
                          isDark ? "text-gray-400" : "text-gray-600"
                        )}
                      >
                        P99
                      </span>
                      <span
                        className={cn(
                          "text-sm font-medium",
                          isDark ? "text-white" : "text-gray-900"
                        )}
                      >
                        {Math.round(selectedTest.metrics.p99ResponseTime)}ms
                      </span>
                    </div>
                  </div>
                </div>

                {/* Throughput */}
                <div>
                  <h4
                    className={cn(
                      "text-sm font-medium mb-3",
                      isDark ? "text-white" : "text-gray-900"
                    )}
                  >
                    Throughput
                  </h4>
                  <div className="text-center">
                    <div
                      className={cn(
                        "text-2xl font-bold",
                        isDark ? "text-white" : "text-gray-900"
                      )}
                    >
                      {selectedTest.metrics.requestsPerSecond.toFixed(1)}
                    </div>
                    <div
                      className={cn(
                        "text-sm",
                        isDark ? "text-gray-400" : "text-gray-600"
                      )}
                    >
                      requests/second
                    </div>
                  </div>
                </div>

                {/* Success Rate */}
                <div>
                  <h4
                    className={cn(
                      "text-sm font-medium mb-3",
                      isDark ? "text-white" : "text-gray-900"
                    )}
                  >
                    Success Rate
                  </h4>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-500">
                      {selectedTest.metrics.totalRequests > 0
                        ? Math.round(
                            (selectedTest.metrics.successfulRequests /
                              selectedTest.metrics.totalRequests) *
                              100
                          )
                        : 0}
                      %
                    </div>
                    <div
                      className={cn(
                        "text-sm",
                        isDark ? "text-gray-400" : "text-gray-600"
                      )}
                    >
                      {selectedTest.metrics.successfulRequests}/
                      {selectedTest.metrics.totalRequests}
                    </div>
                  </div>
                </div>
              </div>

              {/* Command Details */}
              <div>
                <h4
                  className={cn(
                    "text-sm font-medium mb-3",
                    isDark ? "text-white" : "text-gray-900"
                  )}
                >
                  Test Command
                </h4>
                <div
                  className={cn(
                    "p-3 rounded-md text-sm font-mono",
                    isDark
                      ? "bg-gray-700 text-gray-300"
                      : "bg-gray-100 text-gray-800"
                  )}
                >
                  {selectedTest.command}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
