/**
 * Voice interaction foundation (Step 12) — not required for platform completion.
 * Speech-to-text → AI Orchestrator → tools → text-to-speech adapters plug in here later.
 */
export type VoicePipelineStage =
  | "idle"
  | "listening"
  | "transcribing"
  | "orchestrating"
  | "speaking"
  | "error";

export interface VoiceFoundationConfig {
  enabled: boolean;
  speechToTextProvider: "NONE" | "BROWSER" | "EXTERNAL";
  textToSpeechProvider: "NONE" | "BROWSER" | "EXTERNAL";
}

export function getVoiceFoundationConfig(): VoiceFoundationConfig {
  return {
    enabled: process.env.AI_VOICE_ENABLED === "true",
    speechToTextProvider: (process.env.AI_STT_PROVIDER as VoiceFoundationConfig["speechToTextProvider"]) ?? "NONE",
    textToSpeechProvider: (process.env.AI_TTS_PROVIDER as VoiceFoundationConfig["textToSpeechProvider"]) ?? "NONE",
  };
}
