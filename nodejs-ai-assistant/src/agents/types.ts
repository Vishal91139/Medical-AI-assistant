import type { Channel, StreamChat, User } from "stream-chat";

export interface AIAgent {
  user?: User;
  channel: Channel;
  chatClient: StreamChat;
  getLastInteraction: () => number;
  init: () => Promise<void>;
  dispose: () => Promise<void>;
}

export enum AgentPlatform {
  MEDGEMMA = "medgemma",
}

