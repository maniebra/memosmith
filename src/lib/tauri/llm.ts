import { fetch } from "@tauri-apps/plugin-http";
import { translate } from "../i18n";
import { mergeLlm, type GrammarProfile, type LlmSettings } from "../storage/settings";
import {
  checkPrompt,
  EXPLAIN_SYSTEM_PROMPT,
  explainPrompt,
  parseReport,
  systemPromptFor,
  type GrammarIssue,
  type GrammarMode,
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
    throw new Error(translate("error.llmRequired"));
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

export async function checkGrammar(
  llm: LlmSettings,
  text: string,
  mode: GrammarMode,
  profile: GrammarProfile,
) {
  return parseReport(
    await chat(
      mergeLlm(llm, profile.llm),
      systemPromptFor(mode),
      checkPrompt(text, profile.task, profile.wordTarget),
    ),
  );
}

export function explainIssue(llm: LlmSettings, issue: GrammarIssue, profile: GrammarProfile) {
  return chat(mergeLlm(llm, profile.llm), EXPLAIN_SYSTEM_PROMPT, explainPrompt(issue));
}
