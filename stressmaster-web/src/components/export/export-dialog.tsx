"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useThemeStore } from "@/stores/themeStore";
import { cn } from "@/lib/utils";
import {
  exportService,
  ExportFormat,
  ExportOptions,
} from "@/services/export-service";
import { ChatMessage } from "@/types";
import { Download, FileText, Globe, Database, Check, X } from "lucide-react";

interface ExportDialogProps {
  messages: ChatMessage[];
  sessionName?: string;
  isOpen: boolean;
  onClose: () => void;
}

export const ExportDialog: React.FC<ExportDialogProps> = ({
  messages,
  sessionName = "StressMaster Session",
  isOpen,
  onClose,
}) => {
  const { isDark } = useThemeStore();
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>("html");
  const [options, setOptions] = useState<ExportOptions>({
    format: "html",
    includeTimestamps: true,
    includeMetadata: true,
    includeTestResults: true,
  });
  const [isExporting, setIsExporting] = useState(false);

  if (!isOpen) return null;

  const handleFormatChange = (format: ExportFormat) => {
    setSelectedFormat(format);
    setOptions((prev) => ({ ...prev, format }));
  };

  const handleOptionChange = (key: keyof ExportOptions, value: boolean) => {
    setOptions((prev) => ({ ...prev, [key]: value }));
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const blob = await exportService.exportSession(
        messages,
        options,
        sessionName
      );
      const filename = exportService.generateFilename(
        sessionName,
        selectedFormat
      );
      exportService.downloadBlob(blob, filename);
      onClose();
    } catch (error) {
      console.error("Export failed:", error);
      // TODO: Show error toast
    } finally {
      setIsExporting(false);
    }
  };

  const formatOptions = [
    {
      id: "html" as ExportFormat,
      name: "HTML Report",
      description: "Beautiful web report with charts and styling",
      icon: Globe,
      recommended: true,
    },
    {
      id: "csv" as ExportFormat,
      name: "CSV Data",
      description: "Spreadsheet-compatible data export",
      icon: FileText,
      recommended: false,
    },
    {
      id: "json" as ExportFormat,
      name: "JSON Data",
      description: "Complete data export for developers",
      icon: Database,
      recommended: false,
    },
  ];

  const testMessages = messages.filter(
    (msg) =>
      msg.metadata?.commandType === "load-test" && msg.metadata?.testResults
  );

  const totalRequests = testMessages.reduce(
    (sum, msg) =>
      sum + (msg.metadata?.testResults?.metrics?.totalRequests || 0),
    0
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card
        className={cn(
          "w-full max-w-2xl max-h-[90vh] overflow-y-auto",
          isDark ? "border-gray-700 bg-gray-800" : "border-gray-200 bg-white"
        )}
      >
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle
              className={cn(
                "text-xl font-bold flex items-center space-x-2",
                isDark ? "text-white" : "text-gray-900"
              )}
            >
              <Download className="w-5 h-5 text-red-500" />
              <span>Export Session</span>
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className={cn(
                "h-8 w-8 p-0",
                isDark ? "hover:bg-gray-700" : "hover:bg-gray-100"
              )}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
          <p
            className={cn(
              "text-sm",
              isDark ? "text-gray-400" : "text-gray-600"
            )}
          >
            Export your chat session with all test results and metrics
          </p>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Session Summary */}
          <div
            className={cn(
              "p-4 rounded-lg",
              isDark ? "bg-gray-700" : "bg-gray-50"
            )}
          >
            <h3
              className={cn(
                "font-semibold mb-2",
                isDark ? "text-white" : "text-gray-900"
              )}
            >
              Session Summary
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span
                  className={cn(
                    "font-medium",
                    isDark ? "text-gray-300" : "text-gray-700"
                  )}
                >
                  Messages:
                </span>
                <span
                  className={cn(
                    "ml-1",
                    isDark ? "text-white" : "text-gray-900"
                  )}
                >
                  {messages.length}
                </span>
              </div>
              <div>
                <span
                  className={cn(
                    "font-medium",
                    isDark ? "text-gray-300" : "text-gray-700"
                  )}
                >
                  Tests:
                </span>
                <span
                  className={cn(
                    "ml-1",
                    isDark ? "text-white" : "text-gray-900"
                  )}
                >
                  {testMessages.length}
                </span>
              </div>
              <div>
                <span
                  className={cn(
                    "font-medium",
                    isDark ? "text-gray-300" : "text-gray-700"
                  )}
                >
                  Requests:
                </span>
                <span
                  className={cn(
                    "ml-1",
                    isDark ? "text-white" : "text-gray-900"
                  )}
                >
                  {totalRequests}
                </span>
              </div>
              <div>
                <span
                  className={cn(
                    "font-medium",
                    isDark ? "text-gray-300" : "text-gray-700"
                  )}
                >
                  Session:
                </span>
                <span
                  className={cn(
                    "ml-1",
                    isDark ? "text-white" : "text-gray-900"
                  )}
                >
                  {sessionName}
                </span>
              </div>
            </div>
          </div>

          {/* Format Selection */}
          <div>
            <h3
              className={cn(
                "font-semibold mb-3",
                isDark ? "text-white" : "text-gray-900"
              )}
            >
              Export Format
            </h3>
            <div className="grid gap-3">
              {formatOptions.map((format) => {
                const Icon = format.icon;
                return (
                  <div
                    key={format.id}
                    className={cn(
                      "p-4 rounded-lg border-2 cursor-pointer transition-all",
                      selectedFormat === format.id
                        ? "border-red-500 bg-red-50 dark:bg-red-900/20"
                        : isDark
                        ? "border-gray-600 bg-gray-700 hover:border-gray-500"
                        : "border-gray-200 bg-white hover:border-gray-300"
                    )}
                    onClick={() => handleFormatChange(format.id)}
                  >
                    <div className="flex items-center space-x-3">
                      <div
                        className={cn(
                          "w-10 h-10 rounded-lg flex items-center justify-center",
                          selectedFormat === format.id
                            ? "bg-red-500 text-white"
                            : isDark
                            ? "bg-gray-600 text-gray-300"
                            : "bg-gray-100 text-gray-600"
                        )}
                      >
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <h4
                            className={cn(
                              "font-medium",
                              isDark ? "text-white" : "text-gray-900"
                            )}
                          >
                            {format.name}
                          </h4>
                          {format.recommended && (
                            <span className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded-full">
                              Recommended
                            </span>
                          )}
                        </div>
                        <p
                          className={cn(
                            "text-sm",
                            isDark ? "text-gray-400" : "text-gray-600"
                          )}
                        >
                          {format.description}
                        </p>
                      </div>
                      <div
                        className={cn(
                          "w-5 h-5 rounded-full border-2 flex items-center justify-center",
                          selectedFormat === format.id
                            ? "border-red-500 bg-red-500"
                            : isDark
                            ? "border-gray-500"
                            : "border-gray-300"
                        )}
                      >
                        {selectedFormat === format.id && (
                          <Check className="w-3 h-3 text-white" />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Export Options */}
          <div>
            <h3
              className={cn(
                "font-semibold mb-3",
                isDark ? "text-white" : "text-gray-900"
              )}
            >
              Export Options
            </h3>
            <div className="space-y-3">
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={options.includeTimestamps}
                  onChange={(e) =>
                    handleOptionChange("includeTimestamps", e.target.checked)
                  }
                  className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
                />
                <span
                  className={cn(
                    "text-sm",
                    isDark ? "text-gray-300" : "text-gray-700"
                  )}
                >
                  Include timestamps
                </span>
              </label>
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={options.includeMetadata}
                  onChange={(e) =>
                    handleOptionChange("includeMetadata", e.target.checked)
                  }
                  className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
                />
                <span
                  className={cn(
                    "text-sm",
                    isDark ? "text-gray-300" : "text-gray-700"
                  )}
                >
                  Include message metadata
                </span>
              </label>
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={options.includeTestResults}
                  onChange={(e) =>
                    handleOptionChange("includeTestResults", e.target.checked)
                  }
                  className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
                />
                <span
                  className={cn(
                    "text-sm",
                    isDark ? "text-gray-300" : "text-gray-700"
                  )}
                >
                  Include detailed test results
                </span>
              </label>
            </div>
          </div>

          {/* Export Button */}
          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button variant="outline" onClick={onClose} disabled={isExporting}>
              Cancel
            </Button>
            <Button
              onClick={handleExport}
              disabled={isExporting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {isExporting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" />
                  Export Session
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};





