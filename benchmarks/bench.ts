// Même script pour Node, Bun et Deno : tous exécutent le TypeScript sans étape de build.
// Syntaxe "effaçable" uniquement (pas d'enum ni de namespace) pour le type stripping de Node.
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { makeVocabulary, syntheticText } from "../lib/workloads/corpus.ts";
import { mulberry32 } from "../lib/workloads/prng.ts";
import { buildSseStream, createSseParser, splitRandomly } from "../lib/workloads/sse.ts";
import { trainTokenizer } from "../lib/workloads/tokenizer.ts";
import { buildIndex, topK, vectorAt } from "../lib/workloads/vectors.ts";
import type { BenchResult, RuntimeName, Stat, Workload } from "../types/runtimes.ts";

const RUNS = Number(process.env.RUNS ?? 10);
const RESULTS_DIR = process.env.RESULTS_DIR ?? "results";
const HERE = dirname(fileURLToPath(import.meta.url));

const versions = process.versions;
const runtime: RuntimeName = versions.bun ? "bun" : versions.deno ? "deno" : "node";
const version = versions.bun ?? versions.deno ?? versions.node;

const round = (n: number) => Math.round(n * 100) / 100;

function summarize(samples: number[]): Stat {
  const sorted = [...samples].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  return { median: round(median), min: round(sorted[0]), max: round(sorted[sorted.length - 1]) };
}

// Une passe d'échauffement non comptée, puis RUNS mesures. `setup` n'est pas chronométré.
function measure<T>(setup: () => T, task: (input: T) => unknown): Stat {
  task(setup());
  const samples: number[] = [];
  for (let i = 0; i < RUNS; i++) {
    const input = setup();
    const start = performance.now();
    task(input);
    samples.push(performance.now() - start);
  }
  return summarize(samples);
}

const HELLO = join(HERE, "hello.ts");
const COLD_START_ARGS: Record<RuntimeName, string[]> = {
  node: [HELLO],
  bun: [HELLO],
  deno: ["run", HELLO],
};

function coldStart(): Stat {
  return measure(
    () => undefined,
    () => {
      const { status } = spawnSync(process.execPath, COLD_START_ARGS[runtime], { stdio: "ignore" });
      if (status !== 0) throw new Error(`démarrage à froid en échec (code ${status})`);
    },
  );
}

function fib(n: number): number {
  return n < 2 ? n : fib(n - 1) + fib(n - 2);
}

function fibonacci(): Stat {
  return measure(
    () => 35,
    (n) => {
      if (fib(n) !== 9227465) throw new Error("fib(35) incorrect");
    },
  );
}

function sortNumbers(): Stat {
  return measure(
    () => Array.from({ length: 1_000_000 }, mulberry32(42)),
    (data) => {
      data.sort((a, b) => a - b);
      if (data[0] > data[data.length - 1]) throw new Error("tri incorrect");
    },
  );
}

const JSON_ROWS = 150_000;
const jsonPath = join(tmpdir(), `bench-${process.pid}.json`);

function parseJsonFile(): Stat {
  const rand = mulberry32(7);
  const rows = Array.from({ length: JSON_ROWS }, (_, id) => ({
    id,
    name: `item-${id}`,
    score: rand(),
    tags: ["a", "b", "c"].slice(0, 1 + (id % 3)),
  }));
  writeFileSync(jsonPath, JSON.stringify(rows));
  return measure(
    () => jsonPath,
    (path) => {
      const parsed = JSON.parse(readFileSync(path, "utf8")) as unknown[];
      if (parsed.length !== JSON_ROWS) throw new Error("JSON incomplet");
    },
  );
}

const toWorkload = (stat: Stat, items: number): Workload => ({
  ...stat,
  items,
  itemsPerSec: Math.round(items / (stat.median / 1000)),
});

// Charges IA : graines fixes, donc mêmes entrées pour les trois runtimes.
// Les entrées sont construites une seule fois, hors du chronomètre.
const VOCAB_SIZE = 3000;

function bpeTokenization(): Workload {
  const vocab = makeVocabulary(mulberry32(1), VOCAB_SIZE);
  const tokenizer = trainTokenizer(syntheticText(vocab, mulberry32(2), 40_000), 300);
  const text = syntheticText(vocab, mulberry32(3), 170_000);
  const tokenCount = tokenizer.encode(text).length;
  if (tokenizer.decode(tokenizer.encode(text)) !== text) throw new Error("tokenizer non réversible");
  const stat = measure(
    () => text,
    (input) => {
      if (tokenizer.encode(input).length !== tokenCount) throw new Error("nombre de tokens instable");
    },
  );
  return toWorkload(stat, tokenCount);
}

const SSE_TOKENS = 100_000;

function sseParsing(): Workload {
  const rand = mulberry32(4);
  const vocab = makeVocabulary(mulberry32(1), VOCAB_SIZE);
  const tokens = Array.from({ length: SSE_TOKENS }, () => ` ${vocab[Math.floor(vocab.length * rand() ** 3)]}`);
  const chunks = splitRandomly(buildSseStream(tokens), rand, 16, 512);
  const eventCount = SSE_TOKENS + 2; // tokens + motif de fin + [DONE]
  const stat = measure(
    () => chunks,
    (input) => {
      const parser = createSseParser();
      let received = 0;
      for (const chunk of input) received += parser.push(chunk).length;
      if (received !== eventCount) throw new Error(`${received} événements au lieu de ${eventCount}`);
    },
  );
  return toWorkload(stat, eventCount);
}

const VECTOR_COUNT = 20_000;
const VECTOR_DIM = 384;
const VECTOR_QUERIES = 10;

function vectorSearch(): Workload {
  const index = buildIndex(mulberry32(5), VECTOR_COUNT, VECTOR_DIM);
  const queryIds = Array.from({ length: VECTOR_QUERIES }, (_, i) => (i * 1997) % VECTOR_COUNT);
  const stat = measure(
    () => queryIds,
    (ids) => {
      for (const id of ids) {
        if (topK(index, vectorAt(index, id), 5)[0].id !== id) throw new Error("recherche vectorielle incorrecte");
      }
    },
  );
  return toWorkload(stat, VECTOR_QUERIES);
}

// VmHWM = pic de mémoire résidente (Linux). Repli sur la valeur courante ailleurs.
function peakRssMb(): number {
  try {
    const match = /VmHWM:\s+(\d+) kB/.exec(readFileSync("/proc/self/status", "utf8"));
    if (match) return round(Number(match[1]) / 1024);
  } catch {
    // pas de /proc
  }
  return round(process.memoryUsage().rss / 1024 / 1024);
}

console.log(`${runtime} ${version} : 1 échauffement + ${RUNS} mesures par test`);

// JSON.stringify : console.log affiche les objets différemment selon le runtime.
const coldStartMs = coldStart();
console.log("  démarrage à froid", JSON.stringify(coldStartMs));
const fibMs = fibonacci();
console.log("  fib(35)          ", JSON.stringify(fibMs));
const sortMs = sortNumbers();
console.log("  tri de 1M nombres", JSON.stringify(sortMs));
const jsonMs = parseJsonFile();
console.log("  lecture + JSON   ", JSON.stringify(jsonMs));
rmSync(jsonPath, { force: true });
const tokenizeMs = bpeTokenization();
console.log("  tokenisation BPE ", JSON.stringify(tokenizeMs));
const sseMs = sseParsing();
console.log("  flux SSE         ", JSON.stringify(sseMs));
const vectorMs = vectorSearch();
console.log("  recherche vect.  ", JSON.stringify(vectorMs));

const result: BenchResult = {
  runtime,
  version,
  runs: RUNS,
  measuredAt: new Date().toISOString(),
  coldStartMs,
  fibMs,
  sortMs,
  jsonMs,
  tokenizeMs,
  sseMs,
  vectorMs,
  peakRssMb: peakRssMb(),
};
console.log("  pic mémoire (Mo) ", result.peakRssMb);

mkdirSync(RESULTS_DIR, { recursive: true });
writeFileSync(join(RESULTS_DIR, `${runtime}.json`), JSON.stringify(result, null, 2) + "\n");
