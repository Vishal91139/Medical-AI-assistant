import type { Channel, StreamChat } from "stream-chat";
import { AIAgent } from "./types";
import { SAAgent } from "./symptomAnalyzer/SAAgent";
import { IAAgent } from "./ImageAnalyzer/IAAgent";

// Composite agent that initializes both SAAgent (text) and IAAgent (image+text)
// and lets each one decide when to respond based on the incoming message.
export class MultiAgent implements AIAgent {
  private sa: SAAgent;
  private ia: IAAgent;

  constructor(
    readonly chatClient: StreamChat,
    readonly channel: Channel
  ) {
    this.sa = new SAAgent(chatClient, channel);
    this.ia = new IAAgent(chatClient, channel);
  }

  init = async () => {
    await this.sa.init();
    await this.ia.init();
  };

  dispose = async () => {
    await this.sa.dispose();
    await this.ia.dispose();
  };

  get user() {
    // Both share the same underlying client user
    return this.chatClient.user;
  }

  getLastInteraction = (): number => {
    const a = this.sa.getLastInteraction();
    const b = this.ia.getLastInteraction();
    return Math.max(a, b);
  };
}
