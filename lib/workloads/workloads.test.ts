// Lancer avec : node --test lib/workloads/workloads.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { makeVocabulary, syntheticText } from "./corpus.ts";
import { mulberry32 } from "./prng.ts";
import { buildSseStream, createSseParser, splitRandomly } from "./sse.ts";
import { trainTokenizer } from "./tokenizer.ts";
import { buildIndex, topK, vectorAt } from "./vectors.ts";

const vocab = makeVocabulary(mulberry32(1), 200);
const corpus = syntheticText(vocab, mulberry32(2), 5_000);
const tokenizer = trainTokenizer(corpus, 100);

test("mulberry32 est déterministe", () => {
  const a = mulberry32(42);
  const b = mulberry32(42);
  assert.deepEqual(Array.from({ length: 5 }, () => a()), Array.from({ length: 5 }, () => b()));
});

test("tokenizer : encode puis decode redonne le texte (UTF-8, espaces, retours à la ligne)", () => {
  const texts = ["", "hello world", "  deux  espaces\n\n\ttab", "héllo wörld — ça va ? 🚀 日本語", corpus.slice(0, 2_000)];
  for (const text of texts) assert.equal(tokenizer.decode(tokenizer.encode(text)), text);
});

test("tokenizer : les fusions réduisent le nombre de tokens du texte appris", () => {
  const bytes = new TextEncoder().encode(corpus).length;
  const tokens = tokenizer.encode(corpus).length;
  assert.ok(tokens < bytes * 0.7, `${tokens} tokens pour ${bytes} octets`);
});

test("tokenizer : l'entraînement est déterministe", () => {
  const again = trainTokenizer(corpus, 100);
  assert.deepEqual(again.encode(corpus.slice(0, 500)), tokenizer.encode(corpus.slice(0, 500)));
  assert.equal(again.vocabSize, tokenizer.vocabSize);
});

test("tokenizer : decode refuse un id inconnu", () => {
  assert.throws(() => tokenizer.decode([999_999]), RangeError);
});

test("SSE : le parser reconstitue les événements quel que soit le découpage", () => {
  const tokens = [" Bonjour", " le", " monde", " é", "!"];
  const stream = buildSseStream(tokens);
  const expected = [
    ...tokens.map((text) => ({ type: "token", text })),
    { type: "finish", reason: "stop" },
    { type: "done" },
  ];
  for (const [min, max, seed] of [[1, 1, 1], [1, 40, 2], [1, 40, 3], [16, 512, 4], [stream.length, stream.length, 5]]) {
    const parser = createSseParser();
    const events = splitRandomly(stream, mulberry32(seed), min, max).flatMap((chunk) => parser.push(chunk));
    assert.deepEqual(events, expected, `découpage ${min}-${max}`);
  }
});

test("SSE : un événement incomplet reste en attente", () => {
  const parser = createSseParser();
  assert.deepEqual(parser.push('data: {"choices":[{"delta":{"content":"a"},'), []);
  assert.deepEqual(parser.push('"finish_reason":null}]}\n\n'), [{ type: "token", text: "a" }]);
});

test("vecteurs : topK retrouve le vecteur interrogé en premier, scores décroissants", () => {
  const index = buildIndex(mulberry32(7), 500, 32);
  const hits = topK(index, vectorAt(index, 123), 5);
  assert.equal(hits.length, 5);
  assert.equal(hits[0].id, 123);
  assert.ok(Math.abs(hits[0].score - 1) < 1e-4);
  for (let i = 1; i < hits.length; i++) assert.ok(hits[i - 1].score >= hits[i].score);
});

test("vecteurs : topK renvoie moins de résultats que k si l'index est plus petit", () => {
  const index = buildIndex(mulberry32(7), 3, 8);
  assert.equal(topK(index, vectorAt(index, 0), 5).length, 3);
});
