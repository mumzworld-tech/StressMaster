"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useThemeStore } from "@/stores/themeStore";
import { useChatStore } from "@/stores/chatStore";
import { TestMetricsChart } from "../charts/test-metrics-chart";
import { cn } from "@/lib/utils";
import { ChatMessage } from "@/types";
import {
  BarChart3,
  Calendar,
  MessageSquare,
  TrendingUp,
  Clock,
  CheckCircle,
  XCircle,
  Activity,
  Trash2,
} from "lucide-react";

interface SessionDashboardProps {
  className?: string;
}

export const SessionDashboard: React.FC<SessionDashboardProps> = ({
  className,
}) => {
  const { isDark } = useThemeStore();
  const {
    sessions,
    switchSession,
    currentSession,
    deleteSession,
    deleteAllSessions,
  } = useChatStore();
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    currentSession?.id || null
  );
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);
  const [showDeleteAllDialog, setShowDeleteAllDialog] = useState(false);

  const selectedSession = sessions.find((s) => s.id === selectedSessionId);

  const getSessionStats = (session: (typeof sessions)[0]) => {
    const testMessages = session.messages.filter(
      (msg) =>
        msg.metadata?.commandType === "load-test" && msg.metadata?.testResults
    );

    const totalRequests = testMessages.reduce(
      (sum, msg) =>
        sum + (msg.metadata?.testResults?.metrics?.totalRequests || 0),
      0
    );

    const successfulRequests = testMessages.reduce(
      (sum, msg) =>
        sum + (msg.metadata?.testResults?.metrics?.successfulRequests || 0),
      0
    );

    const failedRequests = testMessages.reduce(
      (sum, msg) =>
        sum + (msg.metadata?.testResults?.metrics?.failedRequests || 0),
      0
    );

    const avgResponseTime =
      testMessages.length > 0
        ? testMessages.reduce(
            (sum, msg) =>
              sum +
              (msg.metadata?.testResults?.metrics?.averageResponseTime || 0),
            0
          ) / testMessages.length
        : 0;

    return {
      totalTests: testMessages.length,
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

  const handleSessionSelect = (sessionId: string) => {
    setSelectedSessionId(sessionId);
    switchSession(sessionId);
  };

  const handleDeleteSession = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent session selection
    setSessionToDelete(sessionId);
  };

  const confirmDeleteSession = () => {
    if (sessionToDelete) {
      deleteSession(sessionToDelete);
      setSessionToDelete(null);
      // If we deleted the selected session, select the first available one
      if (selectedSessionId === sessionToDelete) {
        const remainingSessions = sessions.filter(
          (s) => s.id !== sessionToDelete
        );
        if (remainingSessions.length > 0) {
          setSelectedSessionId(remainingSessions[0].id);
        } else {
          setSelectedSessionId(null);
        }
      }
    }
  };

  const cancelDeleteSession = () => {
    setSessionToDelete(null);
  };

  const handleDeleteAllSessions = () => {
    setShowDeleteAllDialog(true);
  };

  const confirmDeleteAllSessions = () => {
    deleteAllSessions();
    setShowDeleteAllDialog(false);
    setSelectedSessionId(null);
  };

  const cancelDeleteAllSessions = () => {
    setShowDeleteAllDialog(false);
  };

  if (sessions.length === 0) {
    return (
      <Card
        className={cn(
          "w-full",
          isDark ? "border-gray-700 bg-gray-800" : "border-gray-200 bg-white",
          className
        )}
      >
        <CardContent className="p-8 text-center">
          <BarChart3 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3
            className={cn(
              "text-lg font-semibold mb-2",
              isDark ? "text-white" : "text-gray-900"
            )}
          >
            No Test Sessions Found
          </h3>
          <p
            className={cn(
              "text-sm",
              isDark ? "text-gray-400" : "text-gray-600"
            )}
          >
            Start running load tests to see detailed analytics and charts here.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* Session Overview Header */}
      <div className="flex items-center justify-between">
        <h2
          className={cn(
            "text-xl font-bold",
            isDark ? "text-white" : "text-gray-900"
          )}
        >
          Test Sessions ({sessions.length})
        </h2>
        {sessions.length > 0 && (
          <button
            onClick={handleDeleteAllSessions}
            className={cn(
              "px-4 py-2 rounded-md text-sm font-medium transition-colors",
              isDark
                ? "bg-red-600 text-white hover:bg-red-700"
                : "bg-red-600 text-white hover:bg-red-700"
            )}
          >
            Delete All Sessions
          </button>
        )}
      </div>

      {/* Session Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {sessions.map((session) => {
          const stats = getSessionStats(session);
          const isSelected = selectedSessionId === session.id;

          return (
            <Card
              key={session.id}
              className={cn(
                "cursor-pointer transition-all duration-200",
                isSelected
                  ? "ring-2 ring-red-500 border-red-500"
                  : isDark
                  ? "border-gray-700 bg-gray-800 hover:border-gray-600"
                  : "border-gray-200 bg-white hover:border-gray-300"
              )}
              onClick={() => handleSessionSelect(session.id)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle
                    className={cn(
                      "text-sm font-medium truncate flex-1",
                      isDark ? "text-white" : "text-gray-900"
                    )}
                  >
                    {session.title}
                  </CardTitle>
                  <div className="flex items-center space-x-2">
                    {isSelected && (
                      <div className="w-2 h-2 bg-red-500 rounded-full" />
                    )}
                    <button
                      onClick={(e) => handleDeleteSession(session.id, e)}
                      className={cn(
                        "p-1 rounded-md transition-colors",
                        isDark
                          ? "text-gray-400 hover:text-red-400 hover:bg-gray-700"
                          : "text-gray-500 hover:text-red-500 hover:bg-gray-100"
                      )}
                      title="Delete session"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                <div className="flex items-center space-x-4 text-xs">
                  <div className="flex items-center space-x-1">
                    <Calendar
                      className={cn(
                        "w-3 h-3",
                        isDark ? "text-gray-500" : "text-gray-600"
                      )}
                    />
                    <span
                      className={cn(isDark ? "text-gray-400" : "text-gray-600")}
                    >
                      {new Date(session.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <MessageSquare
                      className={cn(
                        "w-3 h-3",
                        isDark ? "text-gray-500" : "text-gray-600"
                      )}
                    />
                    <span
                      className={cn(isDark ? "text-gray-400" : "text-gray-600")}
                    >
                      {session.messages.length} messages
                    </span>
                  </div>
                </div>
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
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Selected Session Charts */}
      {selectedSession && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2
              className={cn(
                "text-xl font-bold",
                isDark ? "text-white" : "text-gray-900"
              )}
            >
              {selectedSession.title} - Test Analytics
            </h2>
            <div className="flex items-center space-x-2 text-sm">
              <Clock
                className={cn(
                  "w-4 h-4",
                  isDark ? "text-gray-500" : "text-gray-600"
                )}
              />
              <span className={cn(isDark ? "text-gray-400" : "text-gray-600")}>
                Last updated:{" "}
                {new Date(selectedSession.updatedAt).toLocaleString()}
              </span>
            </div>
          </div>

          <TestMetricsChart messages={selectedSession.messages} />
        </div>
      )}

      {/* All Sessions Summary */}
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
            All Sessions Summary
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
                {sessions.length}
              </div>
              <div
                className={cn(
                  "text-sm",
                  isDark ? "text-gray-400" : "text-gray-600"
                )}
              >
                Total Sessions
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
                {sessions.reduce((sum, session) => {
                  const stats = getSessionStats(session);
                  return sum + stats.successfulRequests;
                }, 0)}
              </div>
              <div
                className={cn(
                  "text-sm",
                  isDark ? "text-gray-400" : "text-gray-600"
                )}
              >
                Total Successful Requests
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
                {sessions.reduce((sum, session) => {
                  const stats = getSessionStats(session);
                  return sum + stats.failedRequests;
                }, 0)}
              </div>
              <div
                className={cn(
                  "text-sm",
                  isDark ? "text-gray-400" : "text-gray-600"
                )}
              >
                Total Failed Requests
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
                {sessions.reduce((sum, session) => {
                  const stats = getSessionStats(session);
                  return sum + stats.totalTests;
                }, 0)}
              </div>
              <div
                className={cn(
                  "text-sm",
                  isDark ? "text-gray-400" : "text-gray-600"
                )}
              >
                Total Tests Run
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      {sessionToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div
            className={cn(
              "bg-white rounded-lg p-6 max-w-md w-full mx-4",
              isDark && "bg-gray-800"
            )}
          >
            <h3
              className={cn(
                "text-lg font-semibold mb-4",
                isDark ? "text-white" : "text-gray-900"
              )}
            >
              Delete Session
            </h3>
            <p
              className={cn(
                "text-sm mb-6",
                isDark ? "text-gray-300" : "text-gray-600"
              )}
            >
              Are you sure you want to delete this session? This action cannot
              be undone.
            </p>
            <div className="flex space-x-3 justify-end">
              <button
                onClick={cancelDeleteSession}
                className={cn(
                  "px-4 py-2 rounded-md text-sm font-medium transition-colors",
                  isDark
                    ? "bg-gray-700 text-gray-300 hover:bg-gray-600"
                    : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                )}
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteSession}
                className="px-4 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete All Confirmation Dialog */}
      {showDeleteAllDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div
            className={cn(
              "bg-white rounded-lg p-6 max-w-md w-full mx-4",
              isDark && "bg-gray-800"
            )}
          >
            <h3
              className={cn(
                "text-lg font-semibold mb-4",
                isDark ? "text-white" : "text-gray-900"
              )}
            >
              Delete All Sessions
            </h3>
            <p
              className={cn(
                "text-sm mb-6",
                isDark ? "text-gray-300" : "text-gray-600"
              )}
            >
              Are you sure you want to delete all {sessions.length} sessions?
              This action cannot be undone and will permanently remove all test
              data and analytics.
            </p>
            <div className="flex space-x-3 justify-end">
              <button
                onClick={cancelDeleteAllSessions}
                className={cn(
                  "px-4 py-2 rounded-md text-sm font-medium transition-colors",
                  isDark
                    ? "bg-gray-700 text-gray-300 hover:bg-gray-600"
                    : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                )}
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteAllSessions}
                className="px-4 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 transition-colors"
              >
                Delete All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
