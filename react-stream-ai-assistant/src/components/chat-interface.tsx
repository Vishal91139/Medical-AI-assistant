import { useAIAgentStatus } from "@/hooks/use-ai-agent-status";
import {
  Bot,
  Stethoscope,
  HeartPulse,
  Pill,
  Ambulance,
  Menu,
  Thermometer,
  Sparkles,
} from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";

interface ChatInterfaceProps {
  onToggleSidebar: () => void;
  onNewChatMessage: (message: { text: string }) => Promise<void>;
  backendUrl: string;
}

const EmptyStateWithInput: React.FC<{
  onNewChatMessage: ChatInputProps["sendMessage"];
}> = ({ onNewChatMessage }) => {
  const [inputText, setInputText] = useState("");

  // Medical assistant prompts organized by category
  const medicalCategories = [
    {
      id: "symptoms",
      icon: <Thermometer className="h-4 w-4" />,
      title: "Symptoms",
      prompts: [
        "I have a fever, cough, and sore throat for 2 days",
        "I feel chest tightness when climbing stairs",
        "I have stomach pain after eating spicy food",
        "I’m feeling dizzy and weak since this morning",
      ],
    },
    {
      id: "medications",
      icon: <Pill className="h-4 w-4" />,
      title: "Medications",
      prompts: [
        "Can I take ibuprofen and paracetamol together?",
        "What are common side effects of amoxicillin?",
        "Is antihistamine safe with my blood pressure medicine?",
        "How to read a prescription label correctly?",
      ],
    },
    {
      id: "firstaid",
      icon: <Ambulance className="h-4 w-4" />,
      title: "First Aid",
      prompts: [
        "What should I do immediately for a minor burn?",
        "How to manage a nosebleed at home?",
        "When is a headache an emergency?",
        "What’s the RICE method for ankle sprain?",
      ],
    },
    {
      id: "wellness",
      icon: <HeartPulse className="h-4 w-4" />,
      title: "Wellness",
      prompts: [
        "How much water should I drink per day?",
        "Beginner-friendly home workout plan",
        "Healthy sleep tips for night-shift workers",
        "Low-sodium diet suggestions",
      ],
    },
  ];

  const handlePromptClick = (prompt: string) => {
    setInputText(prompt);
  };

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-background via-background to-muted/20">
      <div className="flex-1 flex items-center justify-center overflow-y-auto p-6">
        <div className="text-center max-w-3xl w-full">
          {/* Hero Section */}
          <div className="mb-6">
            <div className="relative inline-flex items-center justify-center w-16 h-16 mb-4">
              <div className="absolute inset-0 bg-primary/20 rounded-2xl animate-pulse"></div>
              <Stethoscope className="h-8 w-8 text-primary relative z-10" />
              <Sparkles className="h-4 w-4 text-primary/60 absolute -top-1 -right-1" />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-2">
              Your Medical AI Assistant
            </h1>
            <p className="text-sm text-muted-foreground mb-4">
              Get guidance on symptoms, medications, first-aid, and wellness.
              This is educational only and not a diagnosis.
            </p>
          </div>

          {/* Writing Prompt Categories - Tabbed Interface */}
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">
              What do you need help with today?
            </h2>

            <Tabs defaultValue="business" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                {medicalCategories.map((category) => (
                  <TabsTrigger
                    key={category.id}
                    value={category.id}
                    className="flex items-center gap-1.5 text-xs"
                  >
                    {category.icon}
                    <span className="hidden sm:inline">{category.title}</span>
                  </TabsTrigger>
                ))}
              </TabsList>

              {medicalCategories.map((category) => (
                <TabsContent
                  key={category.id}
                  value={category.id}
                  className="mt-4"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {category.prompts.map((prompt, promptIndex) => (
                      <button
                        key={promptIndex}
                        onClick={() => handlePromptClick(prompt)}
                        className="p-3 text-left text-sm rounded-lg bg-muted/30 hover:bg-muted/50 transition-all duration-200 border border-muted/50 hover:border-muted group"
                      >
                        <span className="text-foreground group-hover:text-primary transition-colors">
                          {prompt}
                        </span>
                      </button>
                    ))}
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          </div>
        </div>
      </div>

      {/* Input Area */}
      <div className="border-t bg-background/95 backdrop-blur-sm">
        <div className="p-4">
          <ChatInput
            sendMessage={onNewChatMessage}
            placeholder="Describe your symptoms or ask a health question..."
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
            <span>•</span>
            <span className="text-red-600 dark:text-red-400">Not medical advice</span>
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

    console.log("aiState", aiState);

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

    return (
      <ChatInput
        sendMessage={sendMessage}
        value={inputText}
        onValueChange={setInputText}
        textareaRef={textareaRef}
        showPromptToolbar={true}
        className="!p-4"
        isGenerating={isGenerating}
        onStopGenerating={handleStopGenerating}
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
              <div className="w-8 h-8 bg-gradient-to-br from-primary to-primary/80 rounded-lg flex items-center justify-center">
                <Stethoscope className="h-4 w-4 text-primary-foreground" />
              </div>
              {channel?.id && agentStatus.status === "connected" && (
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-background"></div>
              )}
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">
                {channel?.data?.name || "New Consultation"}
              </h2>
              <p className="text-xs text-muted-foreground">
                Medical AI Assistant • Educational only, not a diagnosis
              </p>
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
