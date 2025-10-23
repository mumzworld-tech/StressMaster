"use client";

import React, { useState } from "react";
import { ChatMessage } from "./chat-message";
import { ChatInput } from "./chat-input";
import { ExportDialog } from "../export/export-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useChatStore } from "@/stores/chatStore";
import { useThemeStore } from "@/stores/themeStore";
import { cn } from "@/lib/utils";
import { ChatMessage as ChatMessageType, FileUpload } from "@/types";
import {
  stressMasterBackend,
  BackendExecutionResponse,
} from "@/services/stressmaster-backend";
import {
  Play,
  FileText,
  BarChart3,
  Download,
  Trash2,
  Bot,
  Plus,
  History,
  MessageSquare,
} from "lucide-react";
import { SessionDashboard } from "../dashboard/session-dashboard";

// Use the properly typed interfaces from the backend service
type BackendTestResult = BackendExecutionResponse;

interface ChatProps {
  forceChatTab?: boolean;
}

export const Chat: React.FC<ChatProps> = ({ forceChatTab = false }) => {
  const {
    messages,
    currentSession,
    sessions,
    addMessage,
    clearCurrentSession,
    createSession,
    switchSession,
  } = useChatStore();
  const { isDark } = useThemeStore();
  const [isLoading, setIsLoading] = useState(false);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"chat" | "dashboard">(
    forceChatTab ? "chat" : "chat"
  );

  // Use the top-level messages array for immediate display
  const hasMessages = messages && messages.length > 0;

  const handleSendMessage = async (
    content: string,
    files: FileUpload[] = []
  ) => {
    if (!content.trim() && files.length === 0) return;

    // Add user message immediately
    const userMessage: ChatMessageType = {
      id: Date.now().toString(),
      type: "user",
      content,
      timestamp: new Date(),
      metadata:
        files.length > 0
          ? {
              fileUploads: files,
            }
          : undefined,
    };
    addMessage(userMessage);

    setIsLoading(true);
    try {
      let enhancedCommand = content;

      // If we have files, upload them first and enhance the command
      if (files.length > 0) {
        console.log("📁 Processing uploaded files:", files);

        // Process files and create references
        const fileReferences = files
          .map((file) => {
            if (file.type === "json") {
              return `file: @${file.name}`;
            } else if (file.type === "openapi") {
              return `openapi: @${file.name}`;
            } else if (file.type === "media") {
              return `media: @${file.name}`;
            } else {
              return `file: @${file.name}`;
            }
          })
          .join(", ");

        enhancedCommand = `${content} ${fileReferences}`;
        console.log("🔄 Enhanced command with files:", enhancedCommand);
      }

      // Send the enhanced command to your CLI engine
      console.log(
        "🚀 Sending enhanced command to CLI engine:",
        enhancedCommand
      );

      const testResult: BackendTestResult =
        await stressMasterBackend.executeLoadTest({
          command: enhancedCommand, // Send enhanced command with file references
        });

      console.log("✅ CLI engine response:", testResult);

      // Add response message with results
      const assistantMessage: ChatMessageType = {
        id: (Date.now() + 1).toString(),
        type: "assistant",
        content: `✅ Load test completed successfully! Your test results are displayed below.`,
        timestamp: new Date(),
        metadata: {
          commandType: "load-test",
          testResults: {
            id: testResult.testId || `test_${Date.now()}`,
            command: enhancedCommand,
            status: (testResult.status === "queued"
              ? "running"
              : testResult.status) as "running" | "completed" | "failed",
            startTime: new Date(),
            endTime: new Date(),
            metrics: {
              totalRequests: testResult.results?.metrics?.totalRequests || 0,
              successfulRequests:
                testResult.results?.metrics?.successfulRequests || 0,
              failedRequests: testResult.results?.metrics?.failedRequests || 0,
              averageResponseTime:
                testResult.results?.metrics?.responseTime?.avg ||
                testResult.results?.metrics?.averageResponseTime ||
                0,
              p95ResponseTime:
                testResult.results?.metrics?.responseTime?.p95 ||
                testResult.results?.metrics?.p95ResponseTime ||
                0,
              p99ResponseTime:
                testResult.results?.metrics?.responseTime?.p99 ||
                testResult.results?.metrics?.p99ResponseTime ||
                0,
              requestsPerSecond:
                testResult.results?.metrics?.throughput?.requestsPerSecond ||
                testResult.results?.metrics?.requestsPerSecond ||
                0,
            },
          },
        },
      };

      addMessage(assistantMessage);
    } catch (error) {
      console.error("❌ Failed to execute load test:", error);

      // Add error message
      const errorMessage: ChatMessageType = {
        id: (Date.now() + 1).toString(),
        type: "assistant",
        content: "Failed to execute the load test. Please try again.",
        timestamp: new Date(),
        metadata: {
          commandType: "error",
        },
      };
      addMessage(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExport = () => {
    setIsExportDialogOpen(true);
  };

  const handleClear = () => {
    clearCurrentSession();
  };

  const handleNewSession = () => {
    createSession();
  };

  const handleSessionSwitch = (sessionId: string) => {
    switchSession(sessionId);
  };

  return (
    <div className="flex flex-col h-full max-h-screen">
      {/* Chat Header */}
      <div
        className={cn(
          "flex items-center justify-between p-4 border-b",
          isDark
            ? "bg-gray-800/80 border-gray-700"
            : "bg-white/80 border-gray-200"
        )}
      >
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-r from-red-500 to-red-600 rounded-full flex items-center justify-center">
            <Bot className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1
              className={cn(
                "text-xl font-bold",
                isDark ? "text-white" : "text-gray-900"
              )}
            >
              StressMaster AI
            </h1>
            <p
              className={cn(
                "text-sm",
                isDark ? "text-gray-300" : "text-gray-600"
              )}
            >
              AI-Powered Load Testing Assistant
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {/* Tab Navigation - Only show when not forced to chat tab */}
          {!forceChatTab && (
            <div className="flex items-center space-x-1 mr-4">
              <Button
                variant={activeTab === "chat" ? "default" : "ghost"}
                size="sm"
                onClick={() => setActiveTab("chat")}
                className={cn(
                  "flex items-center space-x-2",
                  activeTab === "chat"
                    ? "bg-red-600 text-white"
                    : isDark
                    ? "text-gray-300 hover:text-white hover:bg-gray-700"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                )}
              >
                <MessageSquare className="w-4 h-4" />
                <span>Chat</span>
              </Button>
              <Button
                variant={activeTab === "dashboard" ? "default" : "ghost"}
                size="sm"
                onClick={() => setActiveTab("dashboard")}
                className={cn(
                  "flex items-center space-x-2",
                  activeTab === "dashboard"
                    ? "bg-red-600 text-white"
                    : isDark
                    ? "text-gray-300 hover:text-white hover:bg-gray-700"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                )}
              >
                <BarChart3 className="w-4 h-4" />
                <span>Analytics</span>
              </Button>
            </div>
          )}

          {/* Session Selector */}
          {sessions.length > 0 && (activeTab === "chat" || forceChatTab) && (
            <div className="flex items-center space-x-2 mr-4">
              <History className="w-4 h-4 text-gray-500" />
              <select
                value={currentSession?.id || ""}
                onChange={(e) => handleSessionSwitch(e.target.value)}
                className={cn(
                  "px-3 py-1 rounded-md text-sm border",
                  isDark
                    ? "bg-gray-700 border-gray-600 text-white"
                    : "bg-white border-gray-300 text-gray-900"
                )}
              >
                {sessions.map((session) => (
                  <option key={session.id} value={session.id}>
                    {session.title.length > 40
                      ? session.title.substring(0, 40) + "..."
                      : session.title}{" "}
                    ({session.messages.length} messages)
                  </option>
                ))}
              </select>
            </div>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={handleNewSession}
            className={cn(
              "flex items-center space-x-2 transition-all duration-200",
              isDark
                ? "border-gray-600 bg-gray-700 text-gray-200 hover:border-gray-500 hover:bg-gray-600"
                : "bg-gray-50 text-gray-900 hover:bg-red-600 hover:text-white border-gray-200"
            )}
          >
            <Plus className="w-4 h-4" />
            <span>New Session</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleExport}
            className={cn(
              "flex items-center space-x-2 transition-all duration-200",
              isDark
                ? "border-gray-600 bg-gray-700 text-gray-200 hover:border-gray-500 hover:bg-gray-600"
                : "bg-gray-50 text-gray-900 hover:bg-red-600 hover:text-white border-gray-200"
            )}
          >
            <Download className="w-4 h-4" />
            <span>Export</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleClear}
            className={cn(
              "flex items-center space-x-2 transition-all duration-200",
              isDark
                ? "border-gray-600 bg-gray-700 text-gray-200 hover:border-gray-500 hover:bg-gray-600"
                : "bg-gray-50 text-gray-900 hover:bg-red-600 hover:text-white border-gray-200"
            )}
          >
            <Trash2 className="w-4 h-4" />
            <span>Clear</span>
          </Button>
        </div>
      </div>

      {/* Main Content Area */}
      <div
        className={cn(
          "flex-1 overflow-y-auto p-4 space-y-4 min-h-0",
          isDark
            ? "bg-gradient-to-b from-gray-900 to-gray-800"
            : "bg-gradient-to-b from-gray-50 to-white"
        )}
      >
        {activeTab === "chat" ? (
          // Chat View
          !hasMessages ? (
            // Welcome Screen
            <div className="flex flex-col items-center justify-center h-full text-center space-y-8">
              <div className="w-20 h-20 bg-gradient-to-r from-red-500 to-red-600 rounded-full flex items-center justify-center">
                <Play className="w-10 h-10 text-white" />
              </div>

              <div className="space-y-4">
                <h2
                  className={cn(
                    "text-2xl font-bold mb-2",
                    isDark ? "text-white" : "text-gray-900"
                  )}
                >
                  Welcome to StressMaster AI
                </h2>
                <p
                  className={cn(
                    "max-w-md",
                    isDark ? "text-gray-300" : "text-gray-600"
                  )}
                >
                  I&apos;m here to help you with load testing! Upload files,
                  describe your test requirements, or ask me anything about
                  performance testing.
                </p>
              </div>

              {/* Quick Action Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl">
                <Card
                  className={cn(
                    "p-4 text-center transition-all duration-200 cursor-pointer",
                    isDark
                      ? "border-gray-600 bg-gray-800 hover:border-red-500 hover:bg-gray-700"
                      : "bg-white hover:bg-red-50 hover:shadow-md border-gray-200 text-gray-900"
                  )}
                >
                  <FileText className="w-8 h-8 text-red-500 mx-auto mb-2" />
                  <h3
                    className={cn(
                      "font-semibold",
                      isDark ? "text-white" : "text-gray-900"
                    )}
                  >
                    Upload Files
                  </h3>
                  <p
                    className={cn(
                      "text-sm",
                      isDark ? "text-gray-400" : "text-gray-600"
                    )}
                  >
                    OpenAPI, JSON, media
                  </p>
                </Card>

                <Card
                  className={cn(
                    "p-4 text-center transition-all duration-200 cursor-pointer",
                    isDark
                      ? "border-gray-600 bg-gray-800 hover:border-red-500 hover:bg-gray-700"
                      : "bg-white hover:bg-red-50 hover:shadow-md border-gray-200 text-gray-900"
                  )}
                >
                  <BarChart3 className="w-8 h-8 text-red-500 mx-auto mb-2" />
                  <h3
                    className={cn(
                      "font-semibold",
                      isDark ? "text-white" : "text-gray-900"
                    )}
                  >
                    Run Tests
                  </h3>
                  <p
                    className={cn(
                      "text-sm",
                      isDark ? "text-gray-400" : "text-gray-600"
                    )}
                  >
                    Performance & load testing
                  </p>
                </Card>
              </div>
            </div>
          ) : (
            // Chat Messages
            <div className="space-y-4">
              {messages.map((message) => (
                <ChatMessage key={message.id} message={message} />
              ))}
            </div>
          )
        ) : (
          // Dashboard View
          <SessionDashboard />
        )}
      </div>

      {/* Chat Input */}
      {(activeTab === "chat" || forceChatTab) && (
        <div
          className={cn(
            "p-4 border-t flex-shrink-0",
            isDark ? "border-gray-700 bg-gray-800" : "border-gray-200 bg-white"
          )}
        >
          <ChatInput onSendMessage={handleSendMessage} isLoading={isLoading} />
        </div>
      )}

      {/* Export Dialog */}
      <ExportDialog
        messages={messages}
        sessionName="StressMaster Session"
        isOpen={isExportDialogOpen}
        onClose={() => setIsExportDialogOpen(false)}
      />
    </div>
  );
};
