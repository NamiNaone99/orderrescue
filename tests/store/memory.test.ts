import { MemoryStore } from "@/lib/store/memory";
import { storeContract } from "./contract";

storeContract(() => ({ store: new MemoryStore(), scenarioId: "hero" as const }));
