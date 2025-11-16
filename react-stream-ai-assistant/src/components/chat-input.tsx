import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { ArrowRight, Image as ImageIcon, Paperclip, Square, X } from "lucide-react";
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
  allowImageUpload?: boolean;
  onSubmit?: (payload: { text: string; files: File[] }) => Promise<void> | void;
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
  allowImageUpload = false,
  onSubmit,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const hasText = !!value.trim();
    const hasImages = files.length > 0;
    if ((!hasText && !hasImages) || isLoading || isGenerating || !sendMessage)
      return;

    setIsLoading(true);
    try {
      if (onSubmit) {
        await onSubmit({ text: value.trim(), files });
      } else {
        await sendMessage({ text: value.trim() });
      }
      onValueChange("");
      setFiles([]);
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

  const onPickFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files || []).filter((f) => f.type.startsWith("image/"));
    if (picked.length) {
      setFiles((prev) => [...prev, ...picked].slice(0, 4));
    }
    e.currentTarget.value = "";
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
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

            {allowImageUpload && (
              <div className="absolute left-2 bottom-2 flex items-center gap-1">
                <label
                  className={cn(
                    "h-8 w-8 inline-flex items-center justify-center rounded-md cursor-pointer",
                    "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  )}
                  title="Attach images"
                >
                  <input type="file" accept="image/*" multiple className="hidden" onChange={onPickFiles} />
                  <Paperclip className="h-4 w-4" />
                </label>
              </div>
            )}

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
                disabled={(!value.trim() && files.length === 0) || isLoading || isGenerating}
                className={cn(
                  "absolute right-2 bottom-2 h-8 w-8 rounded-md flex-shrink-0 p-0",
                  "transition-all duration-200",
                  "disabled:opacity-30 disabled:cursor-not-allowed",
                  (!value.trim() && files.length === 0) ? "bg-muted hover:bg-muted" : ""
                )}
                variant={(value.trim() || files.length > 0) ? "default" : "ghost"}
              >
                <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </div>
          {allowImageUpload && files.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {files.map((file, idx) => (
                <div
                  key={`${file.name}-${idx}`}
                  className="relative h-16 w-16 rounded-md overflow-hidden border border-muted/60 bg-muted/30"
                  title={file.name}
                >
                  <img src={URL.createObjectURL(file)} alt={file.name} className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeFile(idx)}
                    className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-background border shadow flex items-center justify-center text-xs"
                    aria-label="Remove image"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {files.length < 4 && (
                <label className="h-16 w-16 rounded-md border border-dashed border-muted/60 bg-muted/10 hover:bg-muted/20 cursor-pointer flex items-center justify-center">
                  <input type="file" accept="image/*" multiple className="hidden" onChange={onPickFiles} />
                  <ImageIcon className="h-5 w-5 text-muted-foreground" />
                </label>
              )}
            </div>
          )}
        </form>
      </div>
    </div>
  );
};
