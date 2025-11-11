import { AIAgent } from "../types";
import type { Channel, DefaultGenerics, Event, StreamChat } from "stream-chat";

// IAAgent: Image Analyzer agent that sends a text prompt + image to a Gradio app
// running on Kaggle. It mirrors SAAgent but supports image attachments.
export class IAAgent implements AIAgent {
  private lastInteractionTs = Date.now();
  private readonly handler = (e: Event<DefaultGenerics>) => this.handleMessage(e);

  constructor(
    readonly chatClient: StreamChat,
    readonly channel: Channel
  ) {}

  init = async () => {
    const baseUrl = (process.env.GRADIO_IMAGE_BASE_URL || process.env.GRADIO_BASE_URL) as string | undefined;
    if (!baseUrl) {
      throw new Error(
        "GRADIO_IMAGE_BASE_URL or GRADIO_BASE_URL is required (e.g. https://xxxx.gradio.live)"
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
    const text = e.message.text || "";

    // Extract first image attachment (Stream Chat attachment types)
    const att = (e.message.attachments || []).find(
      (a: any) => a?.type === "image" && (a.image_url || a.asset_url || a.thumb_url || a.og_scrape_url)
    );
    // If there's no image, let SAAgent handle it; do nothing here.
    if (!att) {
      console.log("[IAAgent] Skipping text-only message; handled by SAAgent.")
      return;
    }

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
      const baseUrl = (process.env.GRADIO_IMAGE_BASE_URL || process.env.GRADIO_BASE_URL) as string;
  const apiName = (process.env.GRADIO_IMAGE_API_NAME || "/generate") as string;
      const maxNewTokens = parseInt(process.env.MEDGEMMA_MAX_NEW_TOKENS || "512", 10);
      const doSample = (process.env.MEDGEMMA_DO_SAMPLE || "false").toLowerCase() === "true";
      const temperature = parseFloat(process.env.MEDGEMMA_TEMPERATURE || "0.7");
      const topP = parseFloat(process.env.MEDGEMMA_TOP_P || "0.9");
      const systemPrompt = process.env.MEDGEMMA_SYSTEM_PROMPT || "You are an expert radiologist.";
      const userPrompt = text || "Describe the medical image.";

      const imageUrl = (att.image_url || att.asset_url || att.thumb_url || att.og_scrape_url || "");
      if (!imageUrl) {
        throw new Error("Attachment does not contain a valid image URL.");
      }

      const { Client } = await (new Function("m", "return import(m)"))("@gradio/client");
      console.log(`[IAAgent] Connecting to Gradio at ${baseUrl}, api=${apiName}`);
      const client = await Client.connect(baseUrl);

      // Prefer passing the direct URL to the Gradio app as image_url
      // This avoids Node-side uploads and mirrors apps that accept either a file or a URL.
      console.log(`[IAAgent] Using image_url direct path (len=${imageUrl.length})`);
      const namedPayload: any = {
        image_file: null,
        image_url: imageUrl,
        system_prompt: systemPrompt,
        user_prompt: userPrompt,
        max_new_tokens: maxNewTokens,
        do_sample: doSample,
        temperature,
        top_p: topP,
      };

      let result: any;
      try {
        console.log(`[IAAgent] Calling predict(api=${apiName}) with named args (image_url)`);
        result = await client.predict(apiName, namedPayload);
      } catch (namedErr) {
        console.warn(`[IAAgent] Named (image_url) predict failed, trying positional array (image_url)`, namedErr);
        const positional = [null, imageUrl, systemPrompt, userPrompt, maxNewTokens, doSample, temperature, topP];
        console.log(`[IAAgent] Calling predict(api=${apiName}) with positional args (image_url)`);
        result = await client.predict(apiName, positional);
      }

      let response: string = "";
      if (typeof result === "string") response = result;
      else if (Array.isArray(result?.data)) response = String(result.data[0] ?? "");
      else if (typeof result?.data === "string") response = result.data;
      else response = JSON.stringify(result ?? {});
      response = response.trim();

      await this.chatClient.partialUpdateMessage(channelMessage.id, {
        set: { text: response || "(no response)" },
      });
      console.log(`[IAAgent] Predict completed. Response length=${response.length}`);

      await this.channel.sendEvent({
        type: "ai_indicator.clear",
        cid: channelMessage.cid,
        message_id: channelMessage.id,
      });
    } catch (error) {
      console.error("[IAAgent] Error during upload/predict:", error);
      await this.channel.sendEvent({
        type: "ai_indicator.update",
        ai_state: "AI_STATE_ERROR",
        cid: channelMessage.cid,
        message_id: channelMessage.id,
      });
      await this.chatClient.partialUpdateMessage(channelMessage.id, {
        set: {
          text:
            error instanceof Error
              ? error.message
              : "Error generating the message",
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
