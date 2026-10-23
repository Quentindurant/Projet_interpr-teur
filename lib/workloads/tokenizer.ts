// Tokenizer BPE (byte-pair encoding) au niveau octet : entraînement, encode et decode.
// Sans dépendance, pour mesurer exactement la même charge sur Node, Bun et Deno.

export interface Tokenizer {
  readonly vocabSize: number;
  encode(text: string): number[];
  decode(ids: readonly number[]): string;
}

// Un mot = espace éventuel + caractères non blancs, ou une suite de blancs. Découpage sans perte.
const PRE_TOKENIZE = / ?\S+|\s+/g;
const BYTE_VOCAB = 256;
const KEY_BASE = 65536;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const pairKey = (left: number, right: number) => left * KEY_BASE + right;

function mergePair(ids: number[], left: number, right: number, merged: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < ids.length; i++) {
    if (i + 1 < ids.length && ids[i] === left && ids[i + 1] === right) {
      out.push(merged);
      i++;
    } else {
      out.push(ids[i]);
    }
  }
  return out;
}

/** Apprend `mergeCount` fusions : à chaque tour, la paire d'ids adjacents la plus fréquente. */
export function trainTokenizer(corpus: string, mergeCount: number): Tokenizer {
  const counts = new Map<string, number>();
  for (const word of corpus.match(PRE_TOKENIZE) ?? []) counts.set(word, (counts.get(word) ?? 0) + 1);
  const words = [...counts].map(([word, count]) => ({ ids: Array.from(encoder.encode(word)), count }));

  const ranks = new Map<number, number>();
  for (let rank = 0; rank < mergeCount; rank++) {
    const frequencies = new Map<number, number>();
    for (const { ids, count } of words) {
      for (let i = 0; i + 1 < ids.length; i++) {
        const key = pairKey(ids[i], ids[i + 1]);
        frequencies.set(key, (frequencies.get(key) ?? 0) + count);
      }
    }
    let best = -1;
    let bestCount = 0;
    for (const [key, count] of frequencies) {
      if (count > bestCount || (count === bestCount && key < best)) {
        best = key;
        bestCount = count;
      }
    }
    if (best < 0) break;
    ranks.set(best, rank);
    const left = Math.floor(best / KEY_BASE);
    const right = best % KEY_BASE;
    for (const word of words) word.ids = mergePair(word.ids, left, right, BYTE_VOCAB + rank);
  }
  return buildTokenizer(ranks);
}

function buildTokenizer(ranks: Map<number, number>): Tokenizer {
  // L'id BYTE_VOCAB + rang n'existe qu'après ses deux parties : on construit dans l'ordre des rangs.
  const vocab: Uint8Array[] = Array.from({ length: BYTE_VOCAB }, (_, byte) => Uint8Array.of(byte));
  for (const [key] of [...ranks].sort((a, b) => a[1] - b[1])) {
    const left = vocab[Math.floor(key / KEY_BASE)];
    const right = vocab[key % KEY_BASE];
    const bytes = new Uint8Array(left.length + right.length);
    bytes.set(left);
    bytes.set(right, left.length);
    vocab.push(bytes);
  }

  // Applique à chaque tour la fusion de plus petit rang, jusqu'à ce qu'il n'y en ait plus.
  function encodeWord(word: string): number[] {
    let ids = Array.from(encoder.encode(word));
    while (ids.length > 1) {
      let bestRank = Infinity;
      let bestKey = -1;
      for (let i = 0; i + 1 < ids.length; i++) {
        const key = pairKey(ids[i], ids[i + 1]);
        const rank = ranks.get(key);
        if (rank !== undefined && rank < bestRank) {
          bestRank = rank;
          bestKey = key;
        }
      }
      if (bestKey < 0) break;
      ids = mergePair(ids, Math.floor(bestKey / KEY_BASE), bestKey % KEY_BASE, BYTE_VOCAB + bestRank);
    }
    return ids;
  }

  return {
    vocabSize: vocab.length,
    encode(text) {
      const out: number[] = [];
      for (const word of text.match(PRE_TOKENIZE) ?? []) {
        for (const id of encodeWord(word)) out.push(id);
      }
      return out;
    },
    decode(ids) {
      const parts = ids.map((id) => {
        const part = vocab[id];
        if (!part) throw new RangeError(`id de token inconnu : ${id}`);
        return part;
      });
      const bytes = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
      let offset = 0;
      for (const part of parts) {
        bytes.set(part, offset);
        offset += part.length;
      }
      return decoder.decode(bytes);
    },
  };
}
