declare module "@gradio/client" {
  export const Client: {
    connect: (url: string) => Promise<{
      predict: (path: string, payload: unknown) => Promise<unknown>;
      close: () => Promise<void> | void;
    }>;
  };

  export const handle_file: (url: string) => unknown;
}
