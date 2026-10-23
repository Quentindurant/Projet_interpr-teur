// Types partagés entre les benchmarks (benchmarks/*.ts) et l'API Next.js.
// Uniquement des types : le fichier est entièrement effacé à l'exécution,
// ce qui permet à Node, Bun et Deno de l'importer sans transpilation.

export type RuntimeName = "node" | "bun" | "deno";

/** Statistiques d'une mesure, en millisecondes. */
export interface Stat {
  median: number;
  min: number;
  max: number;
}

/** Mesure d'une charge IA : durée (ms), volume traité par passe et débit calculé sur la médiane. */
export interface Workload extends Stat {
  items: number;
  itemsPerSec: number;
}

/** Résultat écrit par un conteneur (benchmarks/bench.ts). */
export interface BenchResult {
  runtime: RuntimeName;
  version: string;
  /** Nombre de mesures retenues (hors échauffement). */
  runs: number;
  measuredAt: string;
  /** Lancement d'un processus qui affiche "hello". */
  coldStartMs: Stat;
  /** fib(35) récursif. */
  fibMs: Stat;
  /** Tri numérique d'un million de nombres. */
  sortMs: Stat;
  /** Lecture d'un gros fichier JSON puis JSON.parse. */
  jsonMs: Stat;
  /** Tokenisation BPE d'environ 1 Mo de texte ; items = tokens produits. */
  tokenizeMs: Workload;
  /** Parsing d'un flux SSE de 100 000 tokens ; items = événements. */
  sseMs: Workload;
  /** 10 recherches top-5 sur 20 000 vecteurs de dimension 384 ; items = requêtes. */
  vectorMs: Workload;
  /** Pic de mémoire résidente du processus, en Mo. */
  peakRssMb: number;
}

/** Résultat enrichi par benchmarks/merge.ts avec la taille de l'image Docker. */
export interface RuntimeEntry extends BenchResult {
  imageSizeMb: number;
}

/** Contenu de data/runtimes.json, servi par l'API. */
export interface RuntimesData {
  generatedAt: string;
  limits: { cpus: number; memoryMb: number };
  entries: RuntimeEntry[];
}
