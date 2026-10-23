// Texte synthétique et déterministe pour entraîner puis mesurer le tokenizer.

const SYLLABLES = ["ka", "lo", "mi", "ra", "te", "su", "no", "vé", "qui", "ber", "tan", "ül", "pro", "dat", "mod", "el", "ing", "tion", "ai", "tok"];

/** Mots pseudo-aléatoires de 1 à 4 syllabes, dont des caractères UTF-8 multi-octets. */
export function makeVocabulary(rand: () => number, size: number): string[] {
  return Array.from({ length: size }, () => {
    let word = "";
    for (let syllables = 1 + Math.floor(rand() * 4); syllables > 0; syllables--) {
      word += SYLLABLES[Math.floor(rand() * SYLLABLES.length)];
    }
    return word;
  });
}

/** Texte de distribution proche de Zipf : quelques mots très fréquents, une longue traîne. */
export function syntheticText(vocab: readonly string[], rand: () => number, wordCount: number): string {
  const parts: string[] = [];
  for (let i = 0; i < wordCount; i++) {
    parts.push(vocab[Math.floor(vocab.length * rand() ** 3)]);
    const r = rand();
    parts.push(r < 0.08 ? ". " : r < 0.14 ? ", " : r < 0.15 ? ".\n\n" : " ");
  }
  return parts.join("");
}
