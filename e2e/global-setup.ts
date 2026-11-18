import { execSync } from "node:child_process";
import { rmSync } from "node:fs";

export default function globalSetup() {
  process.env.DATABASE_URL = "file:./e2e.db";
  rmSync("prisma/e2e.db", { force: true });
  execSync("npx prisma migrate deploy", { stdio: "inherit" });
  execSync("npx prisma db seed", { stdio: "inherit" });
}
