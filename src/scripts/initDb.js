import { createRepository } from "../data/repository.js";

async function main() {
  const repo = await createRepository();
  if (repo.mode !== "postgres") {
    console.log("USE_POSTGRES is false. Skip DB init.");
    return;
  }
  console.log("PostgreSQL schema initialized successfully.");
}

main().catch((error) => {
  console.error("Failed to initialize database schema:", error);
  process.exit(1);
});

