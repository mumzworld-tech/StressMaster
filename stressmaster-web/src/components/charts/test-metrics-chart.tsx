"use client";

import React from "react";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useThemeStore } from "@/stores/themeStore";
import { cn } from "@/lib/utils";
import { ChatMessage } from "@/types";

interface TestMetricsChartProps {
  messages: ChatMessage[];
  className?: string;
}

interface ChartData {
  name: string;
  timestamp: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  requestsPerSecond: number;
  successRate: number;
}

export const TestMetricsChart: React.FC<TestMetricsChartProps> = ({
  messages,
  className,
}) => {
  const { isDark } = useThemeStore();

  // Extract test data from messages
  const testMessages = messages.filter(
    (msg) =>
      msg.metadata?.commandType === "load-test" && msg.metadata?.testResults
  );

  const chartData: ChartData[] = testMessages.map((message, index) => {
    const metrics = message.metadata?.testResults?.metrics;
    const successRate =
      metrics && metrics.totalRequests > 0
        ? Math.round((metrics.successfulRequests / metrics.totalRequests) * 100)
        : 0;

    return {
      name: `Test ${index + 1}`,
      timestamp: new Date(message.timestamp).toLocaleTimeString(),
      totalRequests: metrics?.totalRequests || 0,
      successfulRequests: metrics?.successfulRequests || 0,
      failedRequests: metrics?.failedRequests || 0,
      averageResponseTime: metrics?.averageResponseTime || 0,
      requestsPerSecond: metrics?.requestsPerSecond || 0,
      successRate,
    };
  });

  const pieData = [
    {
      name: "Successful",
      value: testMessages.reduce(
        (sum, msg) =>
          sum + (msg.metadata?.testResults?.metrics?.successfulRequests || 0),
        0
      ),
      color: "#10b981",
    },
    {
      name: "Failed",
      value: testMessages.reduce(
        (sum, msg) =>
          sum + (msg.metadata?.testResults?.metrics?.failedRequests || 0),
        0
      ),
      color: "#ef4444",
    },
  ];

  const responseTimeData = testMessages.map((message, index) => {
    const metrics = message.metadata?.testResults?.metrics;
    return {
      name: `Test ${index + 1}`,
      avg: metrics?.averageResponseTime || 0,
      p95: metrics?.p95ResponseTime || 0,
      p99: metrics?.p99ResponseTime || 0,
    };
  });

  if (testMessages.length === 0) {
    return (
      <Card
        className={cn(
          "w-full",
          isDark ? "border-gray-700 bg-gray-800" : "border-gray-200 bg-white",
          className
        )}
      >
        <CardContent className="p-6 text-center">
          <p
            className={cn(
              "text-sm",
              isDark ? "text-gray-400" : "text-gray-600"
            )}
          >
            No test data available. Run some load tests to see charts!
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* Overview Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Success/Failure Pie Chart */}
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
              Request Success Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) =>
                    `${name} ${((percent || 0) * 100).toFixed(0)}%`
                  }
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: isDark ? "#374151" : "#ffffff",
                    border: isDark ? "1px solid #4b5563" : "1px solid #e5e7eb",
                    borderRadius: "8px",
                    color: isDark ? "#ffffff" : "#000000",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Response Time Trends */}
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
              Response Time Trends
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={responseTimeData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={isDark ? "#4b5563" : "#e5e7eb"}
                />
                <XAxis
                  dataKey="name"
                  stroke={isDark ? "#9ca3af" : "#6b7280"}
                  fontSize={12}
                />
                <YAxis
                  stroke={isDark ? "#9ca3af" : "#6b7280"}
                  fontSize={12}
                  label={{ value: "ms", angle: -90, position: "insideLeft" }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: isDark ? "#374151" : "#ffffff",
                    border: isDark ? "1px solid #4b5563" : "1px solid #e5e7eb",
                    borderRadius: "8px",
                    color: isDark ? "#ffffff" : "#000000",
                  }}
                  formatter={(value: number) => [`${value}ms`, ""]}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="avg"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  name="Average"
                />
                <Line
                  type="monotone"
                  dataKey="p95"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  name="P95"
                />
                <Line
                  type="monotone"
                  dataKey="p99"
                  stroke="#ef4444"
                  strokeWidth={2}
                  name="P99"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Requests Over Time */}
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
              Requests Over Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={chartData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={isDark ? "#4b5563" : "#e5e7eb"}
                />
                <XAxis
                  dataKey="name"
                  stroke={isDark ? "#9ca3af" : "#6b7280"}
                  fontSize={12}
                />
                <YAxis stroke={isDark ? "#9ca3af" : "#6b7280"} fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: isDark ? "#374151" : "#ffffff",
                    border: isDark ? "1px solid #4b5563" : "1px solid #e5e7eb",
                    borderRadius: "8px",
                    color: isDark ? "#ffffff" : "#000000",
                  }}
                />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="successfulRequests"
                  stackId="1"
                  stroke="#10b981"
                  fill="#10b981"
                  fillOpacity={0.6}
                  name="Successful"
                />
                <Area
                  type="monotone"
                  dataKey="failedRequests"
                  stackId="1"
                  stroke="#ef4444"
                  fill="#ef4444"
                  fillOpacity={0.6}
                  name="Failed"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Throughput Chart */}
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
              Throughput (Requests/Second)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={isDark ? "#4b5563" : "#e5e7eb"}
                />
                <XAxis
                  dataKey="name"
                  stroke={isDark ? "#9ca3af" : "#6b7280"}
                  fontSize={12}
                />
                <YAxis
                  stroke={isDark ? "#9ca3af" : "#6b7280"}
                  fontSize={12}
                  label={{ value: "req/s", angle: -90, position: "insideLeft" }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: isDark ? "#374151" : "#ffffff",
                    border: isDark ? "1px solid #4b5563" : "1px solid #e5e7eb",
                    borderRadius: "8px",
                    color: isDark ? "#ffffff" : "#000000",
                  }}
                  formatter={(value: number) => [
                    `${value.toFixed(1)} req/s`,
                    "",
                  ]}
                />
                <Bar dataKey="requestsPerSecond" fill="#8b5cf6" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Summary Statistics */}
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
            Test Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div
                className={cn(
                  "text-2xl font-bold",
                  isDark ? "text-white" : "text-gray-900"
                )}
              >
                {testMessages.length}
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
              <div className={cn("text-2xl font-bold text-green-500")}>
                {testMessages.reduce(
                  (sum, msg) =>
                    sum +
                    (msg.metadata?.testResults?.metrics?.successfulRequests ||
                      0),
                  0
                )}
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
              <div className={cn("text-2xl font-bold text-red-500")}>
                {testMessages.reduce(
                  (sum, msg) =>
                    sum +
                    (msg.metadata?.testResults?.metrics?.failedRequests || 0),
                  0
                )}
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
              <div
                className={cn(
                  "text-2xl font-bold",
                  isDark ? "text-white" : "text-gray-900"
                )}
              >
                {testMessages.length > 0
                  ? Math.round(
                      testMessages.reduce(
                        (sum, msg) =>
                          sum +
                          (msg.metadata?.testResults?.metrics
                            ?.averageResponseTime || 0),
                        0
                      ) / testMessages.length
                    )
                  : 0}
                ms
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
    </div>
  );
};
