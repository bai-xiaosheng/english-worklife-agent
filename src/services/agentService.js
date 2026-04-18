import { requestRoleplayReply } from "./openaiClient.js";

function buildSystemPrompt({ scenario, profile, useChineseHint }) {
  const hintRule = useChineseHint
    ? "After the English roleplay response, add one short Chinese coaching sentence."
    : "Output in English only.";

  return [
    "You are an English conversation partner for a Chinese learner preparing for overseas work and life.",
    `Scenario: ${scenario.title}. Objective: ${scenario.objective}.`,
    `Learner level: ${profile.level}.`,
    "Style rules:",
    "- Continue the roleplay naturally.",
    "- Keep reply under 80 words.",
    "- Ask one follow-up question so the learner keeps speaking.",
    `- ${hintRule}`
  ].join("\n");
}

function fallbackReply({ scenario, userMessage, useChineseHint }) {
  const base = [
    "Thanks for sharing. That sounds clear.",
    `In this ${scenario.title.toLowerCase()} situation, you can add one more detail to sound confident.`,
    "Could you explain your next action and when you will do it?"
  ].join(" ");

  if (!useChineseHint) return base;
  return `${base}\n教练提示：先说结论，再补充时间和原因，会更像真实职场沟通。`;
}

export async function generateRoleplayReply({
  scenario,
  profile,
  useChineseHint,
  history,
  userMessage
}) {
  const systemPrompt = buildSystemPrompt({ scenario, profile, useChineseHint });

  try {
    const modelReply = await requestRoleplayReply({
      systemPrompt,
      history,
      userMessage
    });

    if (modelReply) {
      return {
        text: modelReply,
        source: "openai"
      };
    }
  } catch (error) {
    return {
      text: fallbackReply({ scenario, userMessage, useChineseHint }),
      source: "fallback",
      fallbackReason: error.message
    };
  }

  return {
    text: fallbackReply({ scenario, userMessage, useChineseHint }),
    source: "fallback",
    fallbackReason: "missing-openai-api-key"
  };
}

