import { useAIAgentStatus } from "@/hooks/use-ai-agent-status";
import { Bot, Menu, Sparkles } from "lucide-react";
import { useRef, useState } from "react";
import {
  Channel,
  MessageList,
  useAIState,
  useChannelActionContext,
  useChannelStateContext,
  useChatContext,
  Window,
} from "stream-chat-react";
import { AIAgentControl } from "./ai-agent-control";
import { ChatInput, ChatInputProps } from "./chat-input";
import ChatMessage from "./chat-message";
import { Button } from "./ui/button";
 

interface ChatInterfaceProps {
  onToggleSidebar: () => void;
  onNewChatMessage: (message: { text: string; files?: File[] }) => Promise<void>;
  backendUrl: string;
}

const EmptyStateWithInput: React.FC<{
  onNewChatMessage: (message: { text: string; files?: File[] }) => Promise<void>;
}> = ({ onNewChatMessage }) => {
  const [inputText, setInputText] = useState("");

  // Prompts removed for a cleaner UI

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 flex items-center justify-center overflow-y-auto p-6">
        <div className="text-center max-w-3xl w-full">
          {/* Hero Section */}
          <div className="mb-6">
            <div className="relative inline-flex items-center justify-center w-16 h-16 mb-4">
              <div className="absolute inset-0 bg-primary/10 rounded-2xl"></div>
              <Sparkles className="h-8 w-8 text-primary relative z-10" />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-2">AI Assistant</h1>
            <p className="text-sm text-muted-foreground mb-4">Ask anything. Share images. Get answers.</p>
          </div>
        </div>
      </div>

      {/* Input Area */}
      <div className="border-t bg-background/95 backdrop-blur-sm">
        <div className="p-4">
          <ChatInput
            sendMessage={async ({ text }) => onNewChatMessage({ text })}
            allowImageUpload={true}
            onSubmit={async ({ text, files }) => onNewChatMessage({ text, files })}
            placeholder="Type a message or attach images..."
            value={inputText}
            onValueChange={setInputText}
            className="!p-4"
            isGenerating={false}
            onStopGenerating={() => {}}
          />
          <div className="flex items-center justify-center gap-4 mt-3 text-xs text-muted-foreground">
            <span>Press Enter to send</span>
            <span>•</span>
            <span>Shift + Enter for new line</span>
          </div>
        </div>
      </div>
    </div>
  );
};

const MessageListEmptyIndicator = () => (
  <div className="h-full flex items-center justify-center">
    <div className="text-center px-4">
      <div className="relative inline-flex items-center justify-center w-12 h-12 mb-4">
        <div className="absolute inset-0 bg-primary/10 rounded-xl"></div>
        <Bot className="h-6 w-6 text-primary/80 relative z-10" />
      </div>
      <h2 className="text-lg font-medium text-foreground mb-2">
        Ready to Write
      </h2>
      <p className="text-sm text-muted-foreground">
        Start the conversation and let's create something amazing together.
      </p>
    </div>
  </div>
);

const MessageListContent = () => {
  const { messages, thread } = useChannelStateContext();
  const isThread = !!thread;

  if (isThread) return null;

  return (
    <div className="flex-1 min-h-0">
      {!messages?.length ? (
        <MessageListEmptyIndicator />
      ) : (
        <MessageList Message={ChatMessage} />
      )}
    </div>
  );
};

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
  onToggleSidebar,
  onNewChatMessage,
  backendUrl,
}) => {
  const { channel } = useChatContext();
  const agentStatus = useAIAgentStatus({
    channelId: channel?.id ?? null,
    backendUrl,
  });

  const ChannelMessageInputComponent = () => {
    const { sendMessage } = useChannelActionContext();
    const { channel, messages } = useChannelStateContext();
    const { aiState } = useAIState(channel);
    const [inputText, setInputText] = useState("");
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const isGenerating =
      aiState === "AI_STATE_THINKING" ||
      aiState === "AI_STATE_GENERATING" ||
      aiState === "AI_STATE_EXTERNAL_SOURCES";

    const handleStopGenerating = () => {
      if (channel) {
        const aiMessage = [...messages]
          .reverse()
          .find((m) => m.user?.id.startsWith("ai-bot"));
        if (aiMessage) {
          channel.sendEvent({
            type: "ai_indicator.stop",
            cid: channel.cid,
            message_id: aiMessage.id,
          });
        }
      }
    };

    const onSubmit = async ({ text, files }: { text: string; files: File[] }) => {
      if (!channel) return;
      try {
        // Upload images to Stream and collect attachments
        const attachments = await Promise.all(
          (files || []).map(async (file) => {
            const res = (await channel.sendImage(file)) as any;
            const url = (res?.file ?? "") as string;
            if (!url) return null;
            return {
              type: "image",
              image_url: url,
              asset_url: url,
              thumb_url: url,
              title: file.name,
              file_size: file.size,
              mime_type: file.type,
            } as any;
          })
        );

        const filtered = attachments.filter(Boolean) as any[];
        await sendMessage({ text, attachments: filtered });
      } catch (err) {
        console.error("Failed to send message with images:", err);
        // Fallback to sending text-only if attachments fail
        await sendMessage({ text });
      }
    };

    return (
      <ChatInput
        sendMessage={sendMessage}
        value={inputText}
        onValueChange={setInputText}
        textareaRef={textareaRef}
        showPromptToolbar={false}
        className="!p-4"
        isGenerating={isGenerating}
        onStopGenerating={handleStopGenerating}
        allowImageUpload={true}
        onSubmit={onSubmit}
      />
    );
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Enhanced Header */}
      <header className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b bg-background/95 backdrop-blur-sm z-10">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleSidebar}
            className="lg:hidden h-9 w-9"
          >
            <Menu className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-8 h-8 bg-gradient-to-br from-primary to-violet-500 rounded-lg flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              {channel?.id && agentStatus.status === "connected" && (
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-background"></div>
              )}
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">
                {channel?.data?.name || "New Chat"}
              </h2>
              <p className="text-xs text-muted-foreground">AI Assistant</p>
            </div>
          </div>
        </div>
        {channel?.id && (
          <AIAgentControl
            status={agentStatus.status}
            loading={agentStatus.loading}
            error={agentStatus.error}
            toggleAgent={agentStatus.toggleAgent}
            checkStatus={agentStatus.checkStatus}
            channelId={channel.id}
          />
        )}
      </header>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-0">
        {!channel ? (
          <EmptyStateWithInput onNewChatMessage={onNewChatMessage} />
        ) : (
          <Channel channel={channel}>
            <Window>
              <MessageListContent />
              <ChannelMessageInputComponent />
            </Window>
          </Channel>
        )}
      </div>
    </div>
  );
};
