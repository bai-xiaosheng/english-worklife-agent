import { config } from "../config.js";

function extractOutputText(data) {
  if (typeof data?.output_text === "string" && data.output_text.trim()) {
    return data.output_text.trim();
  }

  if (!Array.isArray(data?.output)) return "";
  const chunks = [];

  for (const outputItem of data.output) {
    if (!Array.isArray(outputItem?.content)) continue;
    for (const contentItem of outputItem.content) {
      if (typeof contentItem?.text === "string") {
        chunks.push(contentItem.text);
      }
    }
  }

  return chunks.join("\n").trim();
}

export async function requestRoleplayReply({ systemPrompt, history, userMessage }) {
  if (!config.openai.apiKey) return null;

  const input = [
    {
      role: "system",
      content: [{ type: "input_text", text: systemPrompt }]
    },
    ...(history || []).map((entry) => ({
      role: entry.role,
      content: [{ type: "input_text", text: entry.text }]
    })),
    {
      role: "user",
      content: [{ type: "input_text", text: userMessage }]
    }
  ];

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.openai.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: config.openai.model,
      input,
      max_output_tokens: 280,
      temperature: 0.6
    })
  });

  if (!response.ok) {
    const reason = await response.text();
    throw new Error(`OpenAI request failed: ${response.status} ${reason}`);
  }

  const data = await response.json();
  const outputText = extractOutputText(data);
  return outputText || null;
}

