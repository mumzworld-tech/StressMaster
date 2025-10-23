"use client";

import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useThemeStore } from "@/stores/themeStore";
import { Send, Upload, FileText, X, Bot, Play } from "lucide-react";
import { FileUpload } from "@/types";

interface ChatInputProps {
  onSendMessage: (content: string, files?: FileUpload[]) => void;
  isLoading?: boolean;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  onSendMessage,
  isLoading = false,
}) => {
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState<FileUpload[]>([]);
  const [showFileUpload, setShowFileUpload] = useState(false);
  const [showCommands, setShowCommands] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { isDark } = useThemeStore();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() || files.length > 0) {
      onSendMessage(message, files);
      setMessage("");
      setFiles([]);
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = "48px";
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as React.FormEvent);
    }
  };

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const uploadedFiles = Array.from(event.target.files || []);

    try {
      for (const file of uploadedFiles) {
        // Map file types to allowed types
        let fileType: "openapi" | "json" | "media" | "other" = "other";
        if (file.type.includes("json") || file.name.endsWith(".json")) {
          fileType = "json";
        } else if (
          file.type.includes("yaml") ||
          file.type.includes("yml") ||
          file.name.endsWith(".yaml") ||
          file.name.endsWith(".yml")
        ) {
          fileType = "openapi";
        } else if (
          file.type.startsWith("image/") ||
          file.type.startsWith("video/") ||
          file.type.startsWith("audio/")
        ) {
          fileType = "media";
        }

        // Create local file upload object (no backend upload needed)
        const newFileUpload: FileUpload = {
          id: `file_${Date.now()}_${Math.random()}`,
          name: file.name,
          type: fileType,
          size: file.size,
          content: undefined,
          url: URL.createObjectURL(file), // Keep local preview
        };

        setFiles((prev) => [...prev, newFileUpload]);
      }
    } catch (error) {
      console.error("File upload failed:", error);
      // TODO: Show error message to user
    }
  };

  const removeFile = (fileId: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== fileId));
  };

  const commandSuggestions = [
    "Send 100 requests to my API",
    "Test my website with 50 concurrent users",
    "Load test my database endpoint",
    "Stress test my authentication service",
    "Performance test my microservice",
  ];

  return (
    <div className="space-y-4">
      {/* File Upload Area */}
      {showFileUpload && (
        <Card
          className={cn(
            "border-2 border-dashed",
            isDark ? "border-red-400 bg-red-900/20" : "border-red-300 bg-white"
          )}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <span
                className={cn(
                  "text-sm font-medium",
                  isDark ? "text-red-200" : "text-red-800"
                )}
              >
                Drop files here or click to upload
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowFileUpload(false)}
                className={cn(
                  "h-6 px-2",
                  isDark
                    ? "text-red-300 hover:text-red-200 hover:bg-red-800/30"
                    : "text-red-600 hover:text-red-800"
                )}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileUpload}
              className="hidden"
              accept=".json,.yaml,.yml,.txt,.md,.js,.ts,.py,.java,.xml,.jpg,.jpeg,.png,.gif,.mp4,.mp3,.pdf"
            />

            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "w-full",
                isDark
                  ? "border-red-400 text-red-200 hover:bg-red-800/30"
                  : "border-red-300 text-red-600 hover:bg-red-50"
              )}
            >
              <Upload className="w-4 h-4 mr-2" />
              Choose Files
            </Button>
          </CardContent>
        </Card>
      )}

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((file) => (
            <div
              key={file.id}
              className={cn(
                "flex items-center justify-between p-2 rounded border",
                isDark
                  ? "bg-gray-700 border-gray-600"
                  : "bg-white border-gray-200"
              )}
            >
              <div className="flex items-center space-x-2">
                <FileText className="w-4 h-4 text-red-500" />
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
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeFile(file.id)}
                className="h-6 w-6 p-0 text-gray-400 hover:text-red-500"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Command Suggestions */}
      {showCommands && (
        <Card
          className={cn(
            "border-2",
            isDark
              ? "border-red-400 bg-red-900/20"
              : "border-red-300 bg-red-50/50"
          )}
        >
          <CardContent className="p-4">
            <div className="flex items-center space-x-2 mb-3">
              <Bot className="w-5 h-5 text-red-500" />
              <span
                className={cn(
                  "text-sm font-medium",
                  isDark ? "text-red-200" : "text-red-800"
                )}
              >
                Quick Commands
              </span>
            </div>
            <div className="grid grid-cols-1 gap-2">
              {commandSuggestions.map((cmd, index) => (
                <Button
                  key={index}
                  variant="ghost"
                  onClick={() => {
                    setMessage(cmd);
                    setShowCommands(false);
                  }}
                  className={cn(
                    "justify-start h-auto p-2 text-left text-sm",
                    isDark
                      ? "text-red-200 hover:text-red-100 hover:bg-red-800/30"
                      : "text-red-700 hover:text-red-900 hover:bg-red-100"
                  )}
                >
                  <Play className="w-3 h-3 mr-2" />
                  {cmd}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Message Input */}
      <form onSubmit={handleSubmit} className="flex items-center space-x-2">
        <textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onInput={(e) => {
            const target = e.target as HTMLTextAreaElement;
            target.style.height = "auto";
            target.style.height = `${Math.min(target.scrollHeight, 120)}px`;
          }}
          onKeyDown={handleKeyDown}
          placeholder="Describe your load test or ask me anything..."
          className={cn(
            "flex-1 resize-none rounded-md border px-3 py-2 text-base leading-6 transition-all duration-200 focus:outline-none focus:ring-0",
            isDark
              ? "border-gray-600 bg-gray-700 text-white placeholder:text-gray-400 focus:border-gray-400 min-h-[48px] max-h-[120px]"
              : "bg-white text-gray-900 placeholder:text-gray-500 border-gray-300 focus:border-gray-400 min-h-[48px] max-h-[120px]"
          )}
          disabled={isLoading}
          rows={1}
          style={{ height: "48px" }}
        />

        <div className="flex items-center space-x-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowFileUpload(!showFileUpload)}
            className={cn(
              "h-12 w-12 border-2 border-dashed transition-all duration-200",
              isDark
                ? "border-gray-500 hover:border-gray-400 hover:text-red-400"
                : "bg-gray-50 text-gray-900 hover:bg-red-600 hover:text-white border-gray-300"
            )}
          >
            <Upload className="w-5 h-5" />
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowCommands(!showCommands)}
            className={cn(
              "h-12 w-12 transition-all duration-200",
              isDark
                ? "border-gray-600 bg-gray-700 text-gray-200 hover:border-gray-500 hover:bg-gray-600"
                : "bg-gray-50 text-gray-900 hover:bg-red-600 hover:text-white border-gray-200"
            )}
          >
            <Bot className="w-5 h-5" />
          </Button>

          <Button
            type="submit"
            disabled={isLoading || (!message.trim() && files.length === 0)}
            className="h-12 px-6 bg-red-600 hover:bg-red-700 text-white font-semibold shadow-lg"
          >
            <Send className="w-5 h-5" />
          </Button>
        </div>
      </form>
    </div>
  );
};
