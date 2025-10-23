import { create } from "zustand";
import { persist } from "zustand/middleware";
import { ChatMessage, ChatSession, LoadTestResult, FileUpload } from "@/types";

interface ChatState {
  // Current session
  currentSession: ChatSession | null;

  // All sessions
  sessions: ChatSession[];

  // Current messages
  messages: ChatMessage[];

  // File uploads
  fileUploads: FileUpload[];

  // Test results
  testResults: LoadTestResult[];

  // UI state
  isLoading: boolean;
  isTyping: boolean;

  // Actions
  createSession: (title?: string) => void;
  switchSession: (sessionId: string) => void;
  deleteSession: (sessionId: string) => void;
  deleteAllSessions: () => void;
  addMessage: (message: Omit<ChatMessage, "id" | "timestamp">) => void;
  updateMessage: (id: string, updates: Partial<ChatMessage>) => void;
  addFileUpload: (file: Omit<FileUpload, "id">) => void;
  removeFileUpload: (id: string) => void;
  addTestResult: (result: LoadTestResult) => void;
  updateTestResult: (id: string, updates: Partial<LoadTestResult>) => void;
  setLoading: (loading: boolean) => void;
  setTyping: (typing: boolean) => void;
  clearCurrentSession: () => void;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      currentSession: null,
      sessions: [],
      messages: [],
      fileUploads: [],
      testResults: [],
      isLoading: false,
      isTyping: false,

      createSession: (title?: string) => {
        const sessionCount = get().sessions.length + 1;
        const defaultTitle = `Session ${sessionCount} - ${new Date().toLocaleDateString()}`;

        const newSession: ChatSession = {
          id: crypto.randomUUID(),
          title: title || defaultTitle,
          messages: [],
          createdAt: new Date(),
          updatedAt: new Date(),
          testResults: [],
        };

        set((state) => ({
          sessions: [newSession, ...state.sessions],
          currentSession: newSession,
          messages: [],
          fileUploads: [],
        }));
      },

      switchSession: (sessionId: string) => {
        const session = get().sessions.find((s) => s.id === sessionId);
        if (session) {
          set({
            currentSession: session,
            messages: session.messages,
            fileUploads: [],
          });
        }
      },

      deleteSession: (sessionId: string) => {
        set((state) => {
          const updatedSessions = state.sessions.filter(
            (s) => s.id !== sessionId
          );
          const wasCurrentSession = state.currentSession?.id === sessionId;

          return {
            sessions: updatedSessions,
            currentSession: wasCurrentSession
              ? updatedSessions.length > 0
                ? updatedSessions[0]
                : null
              : state.currentSession,
            messages:
              wasCurrentSession && updatedSessions.length > 0
                ? updatedSessions[0].messages
                : wasCurrentSession
                ? []
                : state.messages,
            fileUploads: wasCurrentSession ? [] : state.fileUploads,
          };
        });
      },

      deleteAllSessions: () => {
        set({
          sessions: [],
          currentSession: null,
          messages: [],
          fileUploads: [],
        });
      },

      addMessage: (messageData) => {
        const message: ChatMessage = {
          ...messageData,
          id: crypto.randomUUID(),
          timestamp: new Date(),
        };

        set((state) => {
          const newMessages = [...state.messages, message];

          // Update current session
          if (state.currentSession) {
            let updatedSession = {
              ...state.currentSession,
              messages: newMessages,
              updatedAt: new Date(),
            };

            // Auto-update session title if it's the first user message and still has default name
            if (
              message.type === "user" &&
              state.currentSession.messages.length === 0 &&
              state.currentSession.title.startsWith("Session")
            ) {
              const commandPreview =
                message.content.length > 30
                  ? message.content.substring(0, 30) + "..."
                  : message.content;
              updatedSession = {
                ...updatedSession,
                title: commandPreview,
              };
            }

            const updatedSessions = state.sessions.map((s) =>
              s.id === state.currentSession!.id ? updatedSession : s
            );

            return {
              messages: newMessages,
              sessions: updatedSessions,
              currentSession: updatedSession,
            };
          }

          return { messages: newMessages };
        });
      },

      updateMessage: (id, updates) => {
        set((state) => ({
          messages: state.messages.map((msg) =>
            msg.id === id ? { ...msg, ...updates } : msg
          ),
        }));
      },

      addFileUpload: (fileData) => {
        const file: FileUpload = {
          ...fileData,
          id: crypto.randomUUID(),
        };

        set((state) => ({
          fileUploads: [...state.fileUploads, file],
        }));
      },

      removeFileUpload: (id) => {
        set((state) => ({
          fileUploads: state.fileUploads.filter((f) => f.id !== id),
        }));
      },

      addTestResult: (result) => {
        set((state) => ({
          testResults: [...state.testResults, result],
        }));
      },

      updateTestResult: (id, updates) => {
        set((state) => ({
          testResults: state.testResults.map((result) =>
            result.id === id ? { ...result, ...updates } : result
          ),
        }));
      },

      setLoading: (loading) => set({ isLoading: loading }),
      setTyping: (typing) => set({ isTyping: typing }),

      clearCurrentSession: () => {
        set({
          currentSession: null,
          messages: [],
          fileUploads: [],
        });
      },
    }),
    {
      name: "stressmaster-chat-storage",
      partialize: (state) => ({
        sessions: state.sessions,
        testResults: state.testResults,
      }),
    }
  )
);
