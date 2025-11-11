import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { ArrowRight, Square, X, Image as ImageIcon } from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { WritingPromptsToolbar } from "./writing-prompts-toolbar";

export interface ChatInputProps {
  className?: string;
  sendMessage: (message: { text: string; attachments?: any[] }) => Promise<void> | void;
  isGenerating?: boolean;
  onStopGenerating?: () => void;
  placeholder?: string;
  value: string;
  onValueChange: (text: string) => void;
  textareaRef?: React.RefObject<HTMLTextAreaElement>;
  showPromptToolbar?: boolean;
  enableImageMode?: boolean;
  onImageModeChange?: (active: boolean) => void;
  imageMode?: boolean;
  // Optional: parent can resolve a File to a CDN URL (e.g., Stream channel.sendImage)
  onResolveImageUrl?: (file: File) => Promise<string>;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  className,
  sendMessage,
  isGenerating,
  onStopGenerating,
  placeholder = "Ask me to write something, or paste text to improve...",
  value,
  onValueChange,
  textareaRef: externalTextareaRef,
  showPromptToolbar = false,
  enableImageMode = false,
  imageMode = false,
  onImageModeChange,
  onResolveImageUrl,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const internalTextareaRef = useRef<HTMLTextAreaElement>(null);
  const textareaRef = externalTextareaRef || internalTextareaRef;

  const handlePromptSelect = (prompt: string) => {
    // Append the prompt to existing text or set it if empty
    onValueChange(value ? `${value.trim()} ${prompt}` : prompt);
    textareaRef.current?.focus();
  };

  // Auto-resize textarea
  const updateTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      const scrollHeight = textarea.scrollHeight;
      const maxHeight = 120; // ~6 lines
      const textareaHeight = Math.min(scrollHeight, maxHeight);
      textarea.style.height = `${textareaHeight}px`;
    }
  }, [textareaRef]);

  // Auto-resize textarea
  useEffect(() => {
    updateTextareaHeight();
  }, [value, updateTextareaHeight]);

  const [selectedImage, setSelectedImage] = useState<File | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim() || isLoading || isGenerating || !sendMessage) return;

    setIsLoading(true);
    try {
      const attachments: any[] = [];
      if (imageMode && selectedImage) {
        if (!onResolveImageUrl) {
          console.error("Image selected but no onResolveImageUrl provided; aborting send.");
          setIsLoading(false);
          return;
        }
        let finalUrl: string;
        try {
          finalUrl = await onResolveImageUrl(selectedImage);
        } catch (err) {
          console.error("Failed to resolve image URL via onResolveImageUrl:", err);
          setIsLoading(false);
          return;
        }
        attachments.push({
          type: "image",
          image_url: finalUrl,
          title: selectedImage.name,
        });
      }
      await sendMessage({
        text: value.trim(),
        attachments: attachments.length ? attachments : undefined,
      });
      onValueChange("");
      setSelectedImage(null);
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    } catch (error) {
      console.error("Error sending message:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const onImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImage(file);
    } else {
      setSelectedImage(null);
    }
  };

  return (
    <div
      className={cn(
        "flex flex-col bg-background",
        showPromptToolbar && "border-t border-border/50"
      )}
    >
      {showPromptToolbar && (
        <WritingPromptsToolbar onPromptSelect={handlePromptSelect} />
      )}
      <div className={cn("p-4", className)}>
        <form onSubmit={handleSubmit}>
          <div className="relative">
            <Textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => onValueChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              className={cn(
                "min-h-[44px] max-h-[120px] resize-none py-3 pl-4 pr-20 text-sm",
                "border-input focus:border-primary/50 rounded-lg",
                "transition-colors duration-200 bg-background"
              )}
              disabled={isLoading || isGenerating}
            />

            {/* Clear button */}
            {value.trim() && !isLoading && !isGenerating && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => onValueChange("")}
                className="absolute right-12 bottom-2 h-8 w-8 rounded-md text-muted-foreground hover:text-foreground"
                title="Clear text"
              >
                <X className="h-4 w-4" />
              </Button>
            )}

            {enableImageMode && (
              <div className="absolute left-2 bottom-2 flex items-center gap-2">
                <Button
                  type="button"
                  variant={imageMode ? "default" : "secondary"}
                  size="icon"
                  onClick={() => onImageModeChange?.(!imageMode)}
                  title={imageMode ? "Image mode on" : "Enable image mode"}
                  className="h-8 w-8"
                >
                  <ImageIcon className="h-4 w-4" />
                </Button>
                {imageMode && (
                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={onImageFileChange}
                      className="text-xs max-w-[140px]"
                    />
                    {selectedImage && (
                      <span className="text-xs text-muted-foreground truncate max-w-[120px]">
                        {selectedImage.name}
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Send/Stop Button inside textarea */}
            {isGenerating ? (
              <Button
                type="button"
                onClick={onStopGenerating}
                className="absolute right-2 bottom-2 h-8 w-8 rounded-md flex-shrink-0 p-0"
                variant="destructive"
                title="Stop generating"
              >
                <Square className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                type="submit"
                disabled={!value.trim() || isLoading || isGenerating}
                className={cn(
                  "absolute right-2 bottom-2 h-8 w-8 rounded-md flex-shrink-0 p-0",
                  "transition-all duration-200",
                  "disabled:opacity-30 disabled:cursor-not-allowed",
                  !value.trim() ? "bg-muted hover:bg-muted" : ""
                )}
                variant={value.trim() ? "default" : "ghost"}
              >
                <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
