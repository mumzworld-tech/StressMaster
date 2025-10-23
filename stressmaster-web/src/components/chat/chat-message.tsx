"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { TestResults } from "./test-results";
import { useThemeStore } from "@/stores/themeStore";
import { cn, formatDate, formatBytes } from "@/lib/utils";
import { ChatMessage as ChatMessageType } from "@/types";
import { User, Bot, Settings, Play, FileText } from "lucide-react";

interface ChatMessageProps {
  message: ChatMessageType;
  className?: string;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({
  message,
  className,
}) => {
  const { isDark } = useThemeStore();

  const getMessageIcon = (type: string) => {
    switch (type) {
      case "user":
        return <User className="w-4 h-4 text-white" />;
      case "assistant":
        return <Bot className="w-4 h-4 text-white" />;
      case "system":
        return <Settings className="w-4 h-4 text-white" />;
      default:
        return <Bot className="w-4 h-4 text-white" />;
    }
  };

  const getMessageBubbleStyle = (type: string) => {
    switch (type) {
      case "user":
        return "bg-red-500 text-white ml-auto rounded-2xl rounded-br-sm shadow-sm";
      case "assistant":
        return isDark
          ? "bg-gray-700 text-white rounded-2xl rounded-bl-sm shadow-sm border border-gray-600"
          : "bg-gray-100 text-gray-900 rounded-2xl rounded-bl-sm shadow-sm border border-gray-200";
      case "system":
        return isDark
          ? "bg-gray-600 text-gray-200 rounded-2xl rounded-bl-sm shadow-sm"
          : "bg-gray-200 text-gray-700 rounded-2xl rounded-bl-sm shadow-sm";
      default:
        return isDark
          ? "bg-gray-700 text-white rounded-2xl rounded-bl-sm shadow-sm border border-gray-600"
          : "bg-gray-100 text-gray-900 rounded-2xl rounded-bl-sm shadow-sm border border-gray-200";
    }
  };

  const getMessageAlignment = (type: string) => {
    switch (type) {
      case "user":
        return "justify-end";
      case "assistant":
      case "system":
        return "justify-start";
      default:
        return "justify-start";
    }
  };

  return (
    <div
      className={cn(
        "flex w-full mb-3",
        getMessageAlignment(message.type),
        className
      )}
    >
      <div
        className={cn(
          "flex flex-col max-w-[70%] space-y-2",
          message.type === "user" ? "items-end" : "items-start"
        )}
      >
        <div
          className={cn(
            "px-4 py-2.5 max-w-full break-words",
            getMessageBubbleStyle(message.type)
          )}
        >
          {/* Message Header - Smaller and more subtle */}
          <div
            className={cn(
              "flex items-center space-x-2 text-xs",
              isDark ? "text-gray-400" : "text-gray-500",
              message.type === "user" ? "flex-row-reverse space-x-reverse" : ""
            )}
          >
            {getMessageIcon(message.type)}
            <span className="font-medium">
              {message.type === "user"
                ? "You"
                : message.type === "assistant"
                ? "StressMaster AI"
                : "System"}
            </span>
            <span>{formatDate(message.timestamp)}</span>
          </div>

          {/* Message Content */}
          <div className="mt-2">
            <p className="text-sm leading-relaxed">{message.content}</p>
          </div>
        </div>

        {/* Command Metadata */}
        {message.metadata?.commandType && (
          <Card
            className={cn(
              "w-full mt-2 border",
              isDark
                ? "border-gray-700 bg-gray-800"
                : "border-gray-200 bg-white"
            )}
          >
            <CardContent className="p-3">
              <div className="flex items-center space-x-2 mb-2">
                <Play className="w-3 h-3 text-red-500" />
                <span
                  className={cn(
                    "text-xs font-medium px-2 py-1 bg-red-100 text-red-700 rounded-full",
                    isDark
                      ? "bg-red-900/30 text-red-200"
                      : "bg-red-100 text-red-700"
                  )}
                >
                  Load Test Command
                </span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                {message.metadata.commandType}
              </p>
            </CardContent>
          </Card>
        )}

        {/* File Uploads */}
        {message.metadata?.fileUploads &&
          message.metadata.fileUploads.length > 0 && (
            <Card
              className={cn(
                "w-full mt-2 border",
                isDark
                  ? "border-gray-700 bg-gray-800"
                  : "border-gray-200 bg-white"
              )}
            >
              <CardContent className="p-3">
                <div className="flex items-center space-x-2 mb-2">
                  <FileText className="w-3 h-3" />
                  <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
                    Uploaded Files ({message.metadata.fileUploads.length})
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-1">
                  {message.metadata.fileUploads.map((file) => (
                    <div
                      key={file.id}
                      className={cn(
                        "flex items-center justify-between p-2 rounded border",
                        isDark
                          ? "bg-gray-700 border-gray-600"
                          : "bg-gray-50 border-gray-200"
                      )}
                    >
                      <div className="flex items-center space-x-2">
                        <FileText className="w-3 h-3 text-red-500" />
                        <span
                          className={cn(
                            "text-sm font-medium",
                            isDark ? "text-white" : "text-gray-900"
                          )}
                        >
                          {file.name}
                        </span>
                        <span
                          className={cn(
                            "text-xs",
                            isDark ? "text-gray-400" : "text-gray-500"
                          )}
                        >
                          ({file.type})
                        </span>
                      </div>
                      <span
                        className={cn(
                          "text-xs",
                          isDark ? "text-gray-400" : "text-gray-500"
                        )}
                      >
                        {formatBytes(file.size)}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

        {/* Test Results */}
        {message.metadata?.testResults && (
          <div className="mt-4 w-full">
            <TestResults
              status={message.metadata.testResults.status}
              metrics={message.metadata.testResults.metrics}
              testId={message.metadata.testResults.id}
              command={
                typeof message.metadata.testResults.command === "string"
                  ? message.metadata.testResults.command
                  : JSON.stringify(message.metadata.testResults.command)
              }
            />
          </div>
        )}
      </div>
    </div>
  );
};
