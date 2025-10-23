"use client";

import React, { useState } from "react";
import { PageRouter, PageType } from "@/components/layout/page-router";
import { Button } from "@/components/ui/button";
import { useChatStore } from "@/stores/chatStore";
import { useThemeStore } from "@/stores/themeStore";
import { cn } from "@/lib/utils";
import {
  MessageSquare,
  Menu,
  X,
  Play,
  BarChart3,
  FileText,
  Download,
  Sun,
  Moon,
  Trash2,
} from "lucide-react";

interface MainLayoutProps {
  className?: string;
}

export const MainLayout: React.FC<MainLayoutProps> = ({ className }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<PageType>("chat");
  const {
    sessions,
    currentSession,
    switchSession,
    createSession,
    deleteSession,
  } = useChatStore();
  const { isDark, toggleDarkMode } = useThemeStore();

  const handleNewSession = () => {
    createSession("New Session");
    setSidebarOpen(false);
  };

  const handleSessionSwitch = (sessionId: string) => {
    switchSession(sessionId);
    setSidebarOpen(false);
  };

  const handleDeleteSession = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent session selection
    setSessionToDelete(sessionId);
  };

  const confirmDeleteSession = () => {
    if (sessionToDelete) {
      deleteSession(sessionToDelete);
      setSessionToDelete(null);
    }
  };

  const cancelDeleteSession = () => {
    setSessionToDelete(null);
  };

  return (
    <div
      className={cn(
        "flex h-screen",
        isDark ? "bg-gray-900" : "bg-gray-50",
        className
      )}
    >
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
          isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
        )}
      >
        <div
          className={cn(
            "flex flex-col h-full border-r",
            isDark ? "border-gray-700" : "border-gray-200"
          )}
        >
          {/* Sidebar Header */}
          <div
            className={cn(
              "flex items-center justify-between p-4 border-b",
              isDark ? "border-gray-700" : "border-gray-200"
            )}
          >
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-r from-red-500 to-red-600 rounded-lg flex items-center justify-center">
                <Play className="w-5 h-5 text-white" />
              </div>
              <span
                className={cn(
                  "text-lg font-bold",
                  isDark ? "text-white" : "text-gray-900"
                )}
              >
                StressMaster
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarOpen(false)}
              className={cn(
                "lg:hidden",
                isDark
                  ? "text-gray-300 hover:text-white hover:bg-gray-700"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
              )}
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-2">
            <div className="space-y-1">
              <h3
                className={cn(
                  "text-xs font-semibold uppercase tracking-wider mb-3",
                  isDark ? "text-gray-300" : "text-gray-800"
                )}
              >
                Navigation
              </h3>

              <Button
                variant="ghost"
                className={cn(
                  "w-full justify-start space-x-3 h-12 transition-all duration-200",
                  currentPage === "chat"
                    ? isDark
                      ? "bg-gray-700 text-white"
                      : "bg-red-600 text-white"
                    : isDark
                    ? "text-gray-200 hover:bg-gray-700 hover:text-white"
                    : "!bg-gray-50 !text-gray-900 hover:!bg-red-600 hover:!text-white"
                )}
                onClick={() => {
                  setCurrentPage("chat");
                  setSidebarOpen(false);
                }}
              >
                <MessageSquare className="w-5 h-5" />
                <span>Chat</span>
              </Button>

              <Button
                variant="ghost"
                className={cn(
                  "w-full justify-start space-x-3 h-12 transition-all duration-200",
                  currentPage === "test-results"
                    ? isDark
                      ? "bg-gray-700 text-white"
                      : "bg-red-600 text-white"
                    : isDark
                    ? "text-gray-200 hover:bg-gray-700 hover:text-white"
                    : "!bg-gray-50 !text-gray-900 hover:!bg-red-600 hover:!text-white"
                )}
                onClick={() => {
                  setCurrentPage("test-results");
                  setSidebarOpen(false);
                }}
              >
                <BarChart3 className="w-5 h-5" />
                <span>Test Results</span>
              </Button>

              <Button
                variant="ghost"
                className={cn(
                  "w-full justify-start space-x-3 h-12 transition-all duration-200",
                  currentPage === "files"
                    ? isDark
                      ? "bg-gray-700 text-white"
                      : "bg-red-600 text-white"
                    : isDark
                    ? "text-gray-200 hover:bg-gray-700 hover:text-white"
                    : "!bg-gray-50 !text-gray-900 hover:!bg-red-600 hover:!text-white"
                )}
                onClick={() => {
                  setCurrentPage("files");
                  setSidebarOpen(false);
                }}
              >
                <FileText className="w-5 h-5" />
                <span>Files</span>
              </Button>

              <Button
                variant="ghost"
                className={cn(
                  "w-full justify-start space-x-3 h-12 transition-all duration-200",
                  currentPage === "exports"
                    ? isDark
                      ? "bg-gray-700 text-white"
                      : "bg-red-600 text-white"
                    : isDark
                    ? "text-gray-200 hover:bg-gray-700 hover:text-white"
                    : "!bg-gray-50 !text-gray-900 hover:!bg-red-600 hover:!text-white"
                )}
                onClick={() => {
                  setCurrentPage("exports");
                  setSidebarOpen(false);
                }}
              >
                <Download className="w-5 h-5" />
                <span>Exports</span>
              </Button>
            </div>

            {/* Sessions */}
            <div className="space-y-1 pt-6">
              <div className="flex items-center justify-between">
                <h3
                  className={cn(
                    "text-xs font-semibold uppercase tracking-wider",
                    isDark ? "text-gray-300" : "text-gray-800"
                  )}
                >
                  Sessions
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleNewSession}
                  className={cn(
                    "h-6 px-2",
                    isDark
                      ? "text-red-400 hover:text-red-300 hover:bg-red-900/30"
                      : "text-red-600 hover:text-red-700 hover:bg-red-50"
                  )}
                >
                  <Play className="w-3 h-3" />
                </Button>
              </div>

              <div className="space-y-1 max-h-48 overflow-y-auto">
                {sessions.map((session) => (
                  <div
                    key={session.id}
                    className={cn(
                      "group relative rounded-md transition-all duration-200",
                      currentSession?.id === session.id
                        ? isDark
                          ? "bg-gray-700"
                          : "bg-red-600"
                        : isDark
                        ? "hover:bg-gray-700"
                        : "hover:bg-red-600"
                    )}
                  >
                    <Button
                      variant="ghost"
                      className={cn(
                        "w-full justify-start text-left h-auto p-2 transition-all duration-200",
                        currentSession?.id === session.id
                          ? isDark
                            ? "bg-transparent text-white"
                            : "!bg-transparent !text-white"
                          : isDark
                          ? "text-gray-200 hover:bg-transparent hover:text-white"
                          : "!bg-transparent !text-gray-900 hover:!bg-transparent hover:!text-white"
                      )}
                      onClick={() => handleSessionSwitch(session.id)}
                    >
                      <div className="flex flex-col items-start space-y-1 flex-1">
                        <span className="text-sm font-medium truncate w-full">
                          {session.title}
                        </span>
                        <span
                          className={cn(
                            "text-xs",
                            currentSession?.id === session.id
                              ? isDark
                                ? "text-gray-300"
                                : "text-red-100"
                              : isDark
                              ? "text-gray-400"
                              : "text-gray-700"
                          )}
                        >
                          {session.messages.length} messages
                        </span>
                      </div>
                    </Button>
                    <button
                      onClick={(e) => handleDeleteSession(session.id, e)}
                      className={cn(
                        "absolute top-2 right-2 p-1 rounded-md opacity-0 group-hover:opacity-100 transition-all duration-200",
                        currentSession?.id === session.id
                          ? isDark
                            ? "text-gray-300 hover:text-red-400 hover:bg-gray-600"
                            : "text-red-100 hover:text-white hover:bg-red-700"
                          : isDark
                          ? "text-gray-400 hover:text-red-400 hover:bg-gray-600"
                          : "text-gray-500 hover:text-red-500 hover:bg-gray-100"
                      )}
                      title="Delete session"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </nav>

          {/* Sidebar Footer */}
          <div
            className={cn(
              "p-4 border-t",
              isDark ? "border-gray-700" : "border-gray-200"
            )}
          >
            {/* Dark Mode Toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleDarkMode}
              className={cn(
                "w-full justify-center space-x-2 transition-all duration-300",
                isDark
                  ? "border-gray-500 bg-gray-700 text-gray-200 hover:border-gray-400 hover:bg-gray-600"
                  : "!bg-gray-50 !text-gray-900 hover:!bg-red-600 hover:!text-white"
              )}
            >
              {isDark ? (
                <Sun className="w-4 h-4" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
              <span>{isDark ? "Light" : "Dark"} Mode</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Top Bar */}
        <div
          className={cn(
            "flex items-center justify-between p-4 border-b",
            isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
          )}
        >
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSidebarOpen(true)}
            className={cn(
              "lg:hidden",
              isDark
                ? "text-gray-300 hover:text-white hover:bg-gray-700"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
            )}
          >
            <Menu className="w-5 h-5" />
          </Button>

          <div className="flex items-center space-x-4">
            <h1
              className={cn(
                "text-xl font-semibold",
                isDark ? "text-white" : "text-gray-900"
              )}
            >
              {currentSession?.title || "StressMaster AI"}
            </h1>
          </div>

          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleNewSession}
              className={cn(
                "hidden sm:flex transition-all duration-200",
                isDark
                  ? "border-gray-500 bg-gray-700 text-gray-200 hover:border-gray-400 hover:bg-gray-600"
                  : "!bg-gray-50 !text-gray-900 hover:!bg-red-600 hover:!text-white"
              )}
            >
              <Play className="w-4 h-4 mr-2" />
              New Session
            </Button>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto">
          <PageRouter currentPage={currentPage} />
        </div>
      </div>

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
    </div>
  );
};
