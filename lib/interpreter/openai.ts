import "server-only";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { ZodError } from "zod";
import { INTERPRETER_TIMEOUT_MS, type InterpreterClient } from "./chain";
import { rawInterpretationSchema, chatInterpretationSchema } from "./schema";

const incidentFormat = zodTextFormat(rawInterpretationSchema, "incident");
const warehouseFormat = zodTextFormat(chatInterpretationSchema, "warehouse_report");

export function createOpenAIInterpreter(model: string): InterpreterClient {
  const client = new OpenAI({ timeout: INTERPRETER_TIMEOUT_MS, maxRetries: 0, logLevel: "off" });
  return {
    name: `openai:${model}`,
    async run({ systemPrompt, message, signal, chat }) {
      try {
        const response = await client.responses.parse({
          model,
          instructions: systemPrompt,
          input: message,
          text: { format: chat ? warehouseFormat : incidentFormat },
          reasoning: { effort: "low" },
          max_output_tokens: 2048,
          store: false,
        }, { signal });
        if (response.status === "incomplete") return { status: "incomplete" };
        if (response.output.some(item => item.type === "message" && item.content.some(part => part.type === "refusal"))) {
          return { status: "refusal" };
        }
        if (response.status !== "completed" || response.output_parsed == null) return { status: "missing_output" };
        return { status: "parsed", output: response.output_parsed };
      } catch (error) {
        if (error instanceof OpenAI.APIConnectionTimeoutError) return { status: "timeout" };
        if (error instanceof OpenAI.AuthenticationError) return { status: "authentication" };
        if (error instanceof ZodError || error instanceof SyntaxError) return { status: "invalid_output" };
        return { status: "error" };
      }
    },
  };
}
