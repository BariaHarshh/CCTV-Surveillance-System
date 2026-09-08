/**
 * AIProvider adapters — never hardcode a single vendor through the app.
 */

export type AIProviderId = "NONE" | "OPENAI" | "ANTHROPIC" | "GOOGLE" | "LOCAL";

export interface ChatCompletionRequest {
  system: string;
  messages: Array<{ role: "user" | "assistant" | "system"; content: string }>;
  model?: string;
  maxTokens?: number;
}

export interface ChatCompletionResult {
  content: string;
  model: string;
  provider: AIProviderId;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
}

export interface AIProvider {
  id: AIProviderId;
  available(): boolean;
  complete(req: ChatCompletionRequest): Promise<ChatCompletionResult>;
}

class NoneProvider implements AIProvider {
  id: AIProviderId = "NONE";
  available() {
    return false;
  }
  async complete(): Promise<ChatCompletionResult> {
    throw new Error("AI provider is not configured.");
  }
}

class OpenAICompatibleProvider implements AIProvider {
  id: AIProviderId = "OPENAI";
  constructor(
    private apiKey: string,
    private baseUrl = "https://api.openai.com/v1",
    private defaultModel = "gpt-4o-mini"
  ) {}
  available() {
    return Boolean(this.apiKey);
  }
  async complete(req: ChatCompletionRequest): Promise<ChatCompletionResult> {
    const started = Date.now();
    const model = req.model ?? this.defaultModel;
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: req.maxTokens ?? 1200,
        messages: [{ role: "system", content: req.system }, ...req.messages],
      }),
      signal: AbortSignal.timeout(45_000),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`AI provider error: ${res.status} ${err.slice(0, 200)}`);
    }
    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
      model?: string;
    };
    return {
      content: json.choices?.[0]?.message?.content ?? "",
      model: json.model ?? model,
      provider: this.id,
      inputTokens: json.usage?.prompt_tokens ?? 0,
      outputTokens: json.usage?.completion_tokens ?? 0,
      latencyMs: Date.now() - started,
    };
  }
}

export function getConfiguredProvider(): AIProvider {
  const key = process.env.AI_PROVIDER_KEY ?? process.env.OPENAI_API_KEY ?? "";
  const provider = (process.env.AI_PROVIDER ?? "NONE").toUpperCase();
  if (!key || provider === "NONE") return new NoneProvider();
  if (provider === "ANTHROPIC") {
    // Anthropic Messages API via compatible wrapper endpoint if configured
    return new OpenAICompatibleProvider(
      key,
      process.env.AI_BASE_URL ?? "https://api.anthropic.com/v1",
      process.env.AI_MODEL ?? "claude-3-5-haiku-latest"
    );
  }
  return new OpenAICompatibleProvider(
    key,
    process.env.AI_BASE_URL ?? "https://api.openai.com/v1",
    process.env.AI_MODEL ?? "gpt-4o-mini"
  );
}

export function getAIStatus() {
  const provider = getConfiguredProvider();
  return {
    available: provider.available(),
    provider: provider.id,
    model: process.env.AI_MODEL ?? (provider.available() ? "configured" : "tools-only"),
    mode: provider.available() ? ("llm" as const) : ("tools" as const),
    message: provider.available()
      ? "External AI provider configured."
      : "No external AI provider configured — using permission-aware data tools only (not inventing answers).",
  };
}
