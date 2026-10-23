// Fusionne results/{node,bun,deno}.json et results/image-sizes.json en data/runtimes.json.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";
import type { BenchResult, RuntimeEntry, RuntimeName, RuntimesData } from "../types/runtimes.ts";

const RESULTS_DIR = process.env.RESULTS_DIR ?? "results";
const DATA_DIR = process.env.DATA_DIR ?? "data";
const ORDER: RuntimeName[] = ["node", "bun", "deno"];

const readJson = <T>(file: string): T => JSON.parse(readFileSync(join(RESULTS_DIR, file), "utf8")) as T;

const imageSizes = readJson<Record<RuntimeName, number>>("image-sizes.json");

const entries: RuntimeEntry[] = ORDER.map((name) => {
  const result = readJson<BenchResult>(`${name}.json`);
  if (result.runtime !== name) throw new Error(`${name}.json contient le runtime ${result.runtime}`);
  return { ...result, imageSizeMb: Math.round(imageSizes[name] / 1e6) };
});

const data: RuntimesData = {
  generatedAt: new Date().toISOString(),
  limits: {
    cpus: Number(process.env.BENCH_CPUS ?? 1),
    memoryMb: Number(process.env.BENCH_MEM_MB ?? 512),
  },
  entries,
};

mkdirSync(DATA_DIR, { recursive: true });
writeFileSync(join(DATA_DIR, "runtimes.json"), JSON.stringify(data, null, 2) + "\n");
console.log(`data/runtimes.json écrit (${entries.map((e) => `${e.runtime} ${e.version}`).join(", ")})`);
