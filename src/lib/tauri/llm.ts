import { fetch } from "@tauri-apps/plugin-http";
import type { LlmSettings } from "../storage/settings";
import {
  EXPLAIN_SYSTEM_PROMPT,
  explainPrompt,
  GRAMMAR_SYSTEM_PROMPT,
  parseReport,
  type GrammarIssue,
} from "../utils/grammar";
import { requestOptions } from "../utils/llmOptions";

/**
 * OpenAI-compatible `/chat/completions`, which covers OpenAI, OpenRouter, Groq,
 * Ollama and LM Studio. Requests go through the Rust side so provider CORS rules
 * do not apply.
 */
async function chat(llm: LlmSettings, system: string, prompt: string) {
  const baseUrl = llm.baseUrl.trim().replace(/\/+$/, "");

  if (!baseUrl || !llm.model.trim()) {
    throw new Error("Set an LLM base URL and model in Settings > AI");
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(llm.apiKey.trim() ? { Authorization: `Bearer ${llm.apiKey.trim()}` } : {}),
    },
    body: JSON.stringify({
      model: llm.model.trim(),
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
      ...requestOptions(llm),
    }),
  });

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload?.error?.message ?? `LLM request failed (${response.status})`);
  }

  const content = payload?.choices?.[0]?.message?.content;

  if (typeof content !== "string" || !content.trim()) {
    throw new Error("LLM returned no content");
  }

  return content.trim();
}

export function generateContent(llm: LlmSettings, prompt: string) {
  return chat(llm, llm.systemPrompt, prompt);
}

export async function checkGrammar(llm: LlmSettings, text: string) {
  return parseReport(await chat(llm, GRAMMAR_SYSTEM_PROMPT, text));
}

export function explainIssue(llm: LlmSettings, issue: GrammarIssue) {
  return chat(llm, EXPLAIN_SYSTEM_PROMPT, explainPrompt(issue));
}
