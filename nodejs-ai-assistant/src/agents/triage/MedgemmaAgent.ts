import type { Channel, DefaultGenerics, Event, StreamChat } from "stream-chat";
import type { AIAgent } from "../types";

type ChatPair = [string, string];

export class MedgemmaAgent implements AIAgent {
    private lastInteractionTs = Date.now();
    private history: ChatPair[] = [];
    private readonly handler = (e: Event<DefaultGenerics>) => this.handleMessage(e);
    private gradioClient?: { predict: (path: string, payload: unknown) => Promise<unknown>; close: () => Promise<void> | void };

    constructor(
    readonly chatClient: StreamChat,
    readonly channel: Channel
    ) {}

    dispose = async () => {
        this.chatClient.off("message.new", this.handler);
        try { this.gradioClient?.close(); } catch {}
        await this.chatClient.disconnectUser();
    };

    get user() {
        return this.chatClient.user;
    }

    getLastInteraction = (): number => this.lastInteractionTs;

    init = async () => {
        const baseUrl = process.env.GRADIO_BASE_URL as string | undefined;
        if (!baseUrl) {
            throw new Error(
                "GRADIO_BASE_URL is required (set it to your gradio.live share URL, e.g. https://xxxx.gradio.live)"
            );
        }
        // Connect to Gradio once and reuse the client
        const mod: any = await (new Function('m', 'return import(m)'))('@gradio/client');
        this.gradioClient = await mod.Client.connect(baseUrl);
        this.chatClient.on("message.new", this.handler);
    };

    private handleMessage = async (e: Event<DefaultGenerics>) => {
        if (!e.message || e.message.ai_generated) return;
        const text = e.message.text;

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
            const apiName = (process.env.GRADIO_API_NAME as string) || "/chat";

            const mod: any = await (new Function('m', 'return import(m)'))('@gradio/client');
            if (!this.gradioClient) {
                this.gradioClient = await mod.Client.connect(baseUrl);
            }

            const attachments = e.message.attachments ?? [];
            const imageUrls = attachments
                .filter((attachment) => attachment.type === "image")
                .map((attachment) =>
                    attachment.image_url ||
                    attachment.asset_url ||
                    attachment.thumb_url ||
                    attachment.og_scrape_url
                )
                .filter((url): url is string => typeof url === "string" && url.length > 0);
            const files = imageUrls.map((url) => mod.handle_file(url));
            const userMessage = {
                text,
                files,
            };

            // Try payload style first, then fallback to positional args. Add a timeout to avoid hanging.
            const withTimeout = <T>(p: Promise<T>, ms: number): Promise<T> =>
                new Promise<T>((resolve, reject) => {
                    const t = setTimeout(() => reject(new Error('MedGemma timed out')), ms);
                    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
                });

            const tryPredict = async (): Promise<any> => {
                try {
                    return await this.gradioClient!.predict(apiName, { message_dict: userMessage } as any);
                } catch (err) {
                    const args = [userMessage, this.history];
                    return await this.gradioClient!.predict(apiName, args as any);
                }
            };

            const result: any = await withTimeout(tryPredict(), 45000);

            const parseText = (data: unknown): string => {
                if (!data) return "";
                if (typeof data === 'string') return data;
                if (Array.isArray(data)) return data.map(parseText).filter(Boolean).join('\n');
                if (typeof data === 'object') {
                    const obj: any = data;
                    const direct = [obj.response, obj.text, obj.output].find((v: any) => typeof v === 'string');
                    if (direct) return direct as string;
                    if (Array.isArray(obj.data)) return obj.data.map(parseText).filter(Boolean).join('\n');
                }
                return String(data);
            };

            let lastReply = "";
            const chatbotHistory = result?.data?.[1];
            const stateHistory = result?.data?.[2];
            if (Array.isArray(stateHistory) || Array.isArray(chatbotHistory)) {
                const newHistory: ChatPair[] = Array.isArray(stateHistory)
                    ? stateHistory
                    : (Array.isArray(chatbotHistory) ? chatbotHistory : this.history);
                this.history = newHistory;
                lastReply = this.history.length ? this.history[this.history.length - 1][1] : "";
            } else {
                lastReply = parseText(result?.data ?? result);
            }

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
}