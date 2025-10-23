"use client";

import React, { useState } from "react";
import { TestResultsPage } from "@/components/pages/test-results-page";
import { Chat } from "@/components/chat/chat";
import { cn } from "@/lib/utils";
import { useThemeStore } from "@/stores/themeStore";

export type PageType = "chat" | "test-results" | "files" | "exports";

interface PageRouterProps {
  className?: string;
  currentPage?: PageType;
}

export const PageRouter: React.FC<PageRouterProps> = ({
  className,
  currentPage = "chat",
}) => {
  const { isDark } = useThemeStore();

  const renderPage = () => {
    switch (currentPage) {
      case "chat":
        return <Chat forceChatTab={true} />;
      case "test-results":
        return <TestResultsPage />;
      case "files":
        return (
          <div
            className={cn(
              "p-6 text-center",
              isDark ? "text-white" : "text-gray-900"
            )}
          >
            <h1 className="text-2xl font-bold mb-4">Files Page</h1>
            <p
              className={cn(
                "text-sm",
                isDark ? "text-gray-400" : "text-gray-600"
              )}
            >
              File management page coming soon...
            </p>
          </div>
        );
      case "exports":
        return (
          <div
            className={cn(
              "p-6 text-center",
              isDark ? "text-white" : "text-gray-900"
            )}
          >
            <h1 className="text-2xl font-bold mb-4">Exports Page</h1>
            <p
              className={cn(
                "text-sm",
                isDark ? "text-gray-400" : "text-gray-600"
              )}
            >
              Export management page coming soon...
            </p>
          </div>
        );
      default:
        return <Chat />;
    }
  };

  return (
    <div className={cn("flex-1 overflow-y-auto h-full", className)}>
      {renderPage()}
    </div>
  );
};

// Export the setCurrentPage function for use in navigation
export const usePageNavigation = () => {
  const [currentPage, setCurrentPage] = useState<PageType>("chat");

  return {
    currentPage,
    setCurrentPage,
  };
};
