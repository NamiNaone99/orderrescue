import { interpret, InvalidMessageError } from "@/lib/interpreter";
import { heroSnapshot } from "@/lib/scenarios/hero";

async function main() {
  const message = process.argv.slice(2).join(" ");
  if (!message.trim()) throw new InvalidMessageError();
  const result = await interpret(message, heroSnapshot);
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
}

main().catch(error => {
  console.error(error instanceof InvalidMessageError
    ? 'Usage: pnpm try:interpret "<warehouse message, 1–500 characters>"'
    : "The interpreter could not run.");
  process.exitCode = 1;
});
