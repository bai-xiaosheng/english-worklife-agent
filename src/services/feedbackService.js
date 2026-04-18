import { clampScore } from "../utils/score.js";

const correctionRules = [
  {
    pattern: /\bI very like\b/i,
    replace: "I really like",
    reason: "Use an adverb before the verb: 'really like'.",
    errorTag: "word-order"
  },
  {
    pattern: /\bHe go\b/i,
    replace: "He goes",
    reason: "Third-person singular verbs usually need -s.",
    errorTag: "subject-verb-agreement"
  },
  {
    pattern: /\bI am agree\b/i,
    replace: "I agree",
    reason: "Agree is a verb, so you do not need 'am'.",
    errorTag: "verb-form"
  },
  {
    pattern: /\bHow to\b/i,
    replace: "How do I",
    reason: "In full questions, use auxiliary verb form.",
    errorTag: "question-form"
  }
];

function countWords(message) {
  return (message.trim().match(/[A-Za-z']+/g) || []).length;
}

export function analyzeMessage(message, level = "A2") {
  const trimmed = (message || "").trim();
  const quickFixes = [];
  let rewritten = trimmed;
  const errorTags = new Set();
  let fluencyScore = 72;
  let accuracyScore = 75;

  if (!trimmed) {
    return {
      quickFixes: [],
      rewrite: "",
      coachTip: "Try saying one short sentence first, then we can expand it together.",
      vocabularyTips: [],
      fluencyScore: 0,
      accuracyScore: 0,
      errorTags: ["empty-input"]
    };
  }

  if (/[\u4e00-\u9fa5]/.test(trimmed)) {
    errorTags.add("native-language-mix");
    quickFixes.push({
      original: trimmed,
      suggestion: "Try to express this in simple English first.",
      reason: "Training in English improves automatic response speed in real conversations."
    });
    fluencyScore -= 10;
    accuracyScore -= 8;
  }

  correctionRules.forEach((rule) => {
    if (!rule.pattern.test(rewritten)) return;
    const before = rewritten;
    rewritten = rewritten.replace(rule.pattern, rule.replace);
    quickFixes.push({
      original: before,
      suggestion: rewritten,
      reason: rule.reason
    });
    errorTags.add(rule.errorTag);
    accuracyScore -= 7;
  });

  const wordCount = countWords(trimmed);
  if (wordCount < 5) {
    fluencyScore -= 10;
    errorTags.add("short-utterance");
  }

  if (!/[?.!]$/.test(trimmed)) {
    accuracyScore -= 3;
    errorTags.add("punctuation");
  }

  const vocabularyTips = buildVocabularyTips(level);

  const coachTip =
    quickFixes.length > 0
      ? "Good effort. Say the improved sentence once more aloud to build speaking muscle memory."
      : "Nice sentence. Next step: add one detail such as time, reason, or impact.";

  return {
    quickFixes,
    rewrite: rewritten,
    coachTip,
    vocabularyTips,
    fluencyScore: clampScore(fluencyScore),
    accuracyScore: clampScore(accuracyScore),
    errorTags: Array.from(errorTags)
  };
}

function buildVocabularyTips(level) {
  if (level === "A1" || level === "A2") {
    return [
      { phrase: "Could you clarify ...?", usage: "Ask for explanation politely." },
      { phrase: "From my perspective ...", usage: "Express your opinion in meetings." }
    ];
  }

  return [
    { phrase: "To align expectations ...", usage: "Set common goals in work discussions." },
    { phrase: "One concern I have is ...", usage: "Raise risks in a constructive way." }
  ];
}

