// Recherche vectorielle (étape de récupération d'un RAG) : similarité cosinus sur des Float32Array.
// Les vecteurs sont normalisés à la construction : le cosinus se réduit à un produit scalaire.

export interface VectorIndex {
  dim: number;
  count: number;
  /** `count` vecteurs de `dim` valeurs, mis bout à bout. */
  data: Float32Array;
}

export interface Hit {
  id: number;
  score: number;
}

export function buildIndex(rand: () => number, count: number, dim: number): VectorIndex {
  const data = new Float32Array(count * dim);
  for (let v = 0; v < count; v++) {
    const offset = v * dim;
    let norm = 0;
    for (let d = 0; d < dim; d++) {
      const x = rand() * 2 - 1;
      data[offset + d] = x;
      norm += x * x;
    }
    const inverse = 1 / Math.sqrt(norm);
    for (let d = 0; d < dim; d++) data[offset + d] *= inverse;
  }
  return { dim, count, data };
}

export function vectorAt(index: VectorIndex, id: number): Float32Array {
  return index.data.subarray(id * index.dim, (id + 1) * index.dim);
}

/** Les `k` vecteurs les plus proches de `query`, du plus au moins similaire. */
export function topK(index: VectorIndex, query: Float32Array, k: number): Hit[] {
  const { data, dim, count } = index;
  const ids = new Array<number>(k).fill(-1);
  const scores = new Array<number>(k).fill(-Infinity);
  for (let v = 0; v < count; v++) {
    const offset = v * dim;
    let score = 0;
    for (let d = 0; d < dim; d++) score += data[offset + d] * query[d];
    if (score <= scores[k - 1]) continue;
    let slot = k - 1;
    while (slot > 0 && scores[slot - 1] < score) {
      scores[slot] = scores[slot - 1];
      ids[slot] = ids[slot - 1];
      slot--;
    }
    scores[slot] = score;
    ids[slot] = v;
  }
  return ids.map((id, i) => ({ id, score: scores[i] })).filter((hit) => hit.id >= 0);
}
