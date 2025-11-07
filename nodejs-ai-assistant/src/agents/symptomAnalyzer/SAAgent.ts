import { AIAgent } from "../types";
import type { Channel, DefaultGenerics, Event, StreamChat } from "stream-chat";

// Gradio Chatbot expects history as array of [user, assistant] pairs
type ChatPair = [string, string];

export class SAAgent implements AIAgent {
    private lastInteractionTs = Date.now();
    private history: ChatPair[] = [];
    private readonly handler = (e: Event<DefaultGenerics>) => this.handleMessage(e);

    constructor(
        readonly chatClient: StreamChat,
        readonly channel: Channel
    ) {}

    init = async () => {
        const baseUrl = process.env.GRADIO_BASE_URL as string | undefined;
        if (!baseUrl) {
            throw new Error(
                "GRADIO_BASE_URL is required (set it to your gradio.live share URL, e.g. https://xxxx.gradio.live)"
            );
        }
        this.chatClient.on("message.new", this.handler);
    };

    dispose = async () => {
        this.chatClient.off("message.new", this.handler);
        await this.chatClient.disconnectUser();
    };

    get user() {
        return this.chatClient.user;
    }

    getLastInteraction = (): number => this.lastInteractionTs;

    private handleMessage = async (e: Event<DefaultGenerics>) => {
        if (!e.message || e.message.ai_generated) return;
        const text = e.message.text;
        if (!text) return;

        this.lastInteractionTs = Date.now();

        const { message: channelMessage } = await this.channel.sendMessage({
            text: "",
            ai_generated: true,
        });
        await this.channel.sendEvent({
            type: "ai_indicator.update",
            ai_state: "AI_STATE_THINKING",
            cid: channelMessage.cid,
            message_id: channelMessage.id,
        });

        try {
            const baseUrl = process.env.GRADIO_BASE_URL as string;
            // Accept either GRADIO_API_NAME or GRADIO_PREDICT_PATH; default to '/chat'
            const apiName =
                (process.env.GRADIO_API_NAME as string) ||
                (process.env.GRADIO_PREDICT_PATH as string) ||
                "/chat";

            // Dynamically import ESM-only @gradio/client inside CommonJS project
           const { Client } = await (new Function('m', 'return import(m)'))('@gradio/client');
            const client = await Client.connect(baseUrl);

            // Call the Gradio endpoint with positional arguments in order:
            // generate_chat(user_message, history)
            const args = [text, this.history];
            const result: any = await client.predict(apiName, args);
            const chatbotHistory = result?.data?.[1];
            const stateHistory = result?.data?.[2];
            const newHistory: ChatPair[] = Array.isArray(stateHistory)
                ? stateHistory
                : (Array.isArray(chatbotHistory) ? chatbotHistory : this.history);
            this.history = newHistory;
            const lastReply = this.history.length ? this.history[this.history.length - 1][1] : "";

            await this.chatClient.partialUpdateMessage(channelMessage.id, {
                set: { text: String(lastReply || "") },
            });

            await this.channel.sendEvent({
                type: "ai_indicator.clear",
                cid: channelMessage.cid,
                message_id: channelMessage.id,
            });
            // History already updated from Gradio state
        } catch (error) {
            // Attach a concise diagnostic to help trace config issues
            const hint = `Gradio call failed (baseUrl=${process.env.GRADIO_BASE_URL}, apiName=${(process.env.GRADIO_API_NAME || process.env.GRADIO_PREDICT_PATH || '/chat')})`;
            await this.channel.sendEvent({
                type: "ai_indicator.update",
                ai_state: "AI_STATE_ERROR",
                cid: channelMessage.cid,
                message_id: channelMessage.id,
            });
            await this.chatClient.partialUpdateMessage(channelMessage.id, {
                set: {
                    text: error instanceof Error ? `${error.message} - ${hint}` : `Error generating the message - ${hint}`,
                },
            });
            await this.channel.sendEvent({
                type: "ai_indicator.clear",
                cid: channelMessage.cid,
                message_id: channelMessage.id,
            });
        }
    };

    private getSystemPrompt = () =>
        "You are a helpful medical symptom analyzer assistant. Never provide diagnoses; suggest potential causes and advise seeing a professional.";
}