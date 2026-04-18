import dotenv from "dotenv";

dotenv.config();

export const config = {
  port: Number(process.env.PORT || 3000),
  defaultLevel: process.env.DEFAULT_LEVEL || "A2",
  usePostgres: String(process.env.USE_POSTGRES || "false").toLowerCase() === "true",
  databaseUrl: process.env.DATABASE_URL || "",
  auth: {
    jwtSecret: process.env.JWT_SECRET || "dev-secret-change-me",
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d"
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY || "",
    model: process.env.OPENAI_MODEL || "gpt-4.1-mini"
  }
};
