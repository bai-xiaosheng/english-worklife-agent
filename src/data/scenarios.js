export const scenarios = [
  {
    id: "team-standup",
    title: "Daily Standup",
    category: "work",
    objective: "Describe progress, blockers, and next steps clearly.",
    starter:
      "Morning team, yesterday I finished the login API integration. Today I'll focus on fixing two production bugs."
  },
  {
    id: "one-on-one-manager",
    title: "1:1 with Manager",
    category: "work",
    objective: "Share updates and ask for support with confidence.",
    starter:
      "I'd like to align on my priorities this week and discuss one risk around delivery timeline."
  },
  {
    id: "renting-apartment",
    title: "Renting an Apartment",
    category: "life",
    objective: "Ask clear questions about lease, bills, and move-in.",
    starter:
      "Could you tell me what utilities are included in the monthly rent?"
  },
  {
    id: "doctor-visit",
    title: "Doctor Appointment",
    category: "life",
    objective: "Describe symptoms and understand next steps.",
    starter:
      "I've had a sore throat for three days and a mild fever since yesterday."
  },
  {
    id: "small-talk-colleague",
    title: "Small Talk with Colleague",
    category: "social",
    objective: "Start and maintain a light conversation naturally.",
    starter:
      "How was your weekend? I finally explored a hiking trail nearby."
  }
];

export function getScenarioById(scenarioId) {
  return scenarios.find((item) => item.id === scenarioId);
}

