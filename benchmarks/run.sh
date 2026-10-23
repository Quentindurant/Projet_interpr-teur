#!/usr/bin/env bash
# Lance le benchmark Node / Bun / Deno, un conteneur après l'autre (jamais en parallèle),
# puis écrit data/runtimes.json. Seul Docker est nécessaire sur l'hôte.
# Variables : RUNS (défaut 10), BENCH_CPUS (défaut 1), BENCH_MEM_MB (défaut 512).
set -euo pipefail
cd "$(dirname "$0")"

export HOST_UID="$(id -u)" HOST_GID="$(id -g)"
export RUNS="${RUNS:-10}" BENCH_CPUS="${BENCH_CPUS:-1}" BENCH_MEM_MB="${BENCH_MEM_MB:-512}"

runtimes=(node bun deno)
mkdir -p results ../data

docker compose build

for rt in "${runtimes[@]}"; do
  echo "==> $rt"
  docker compose run --rm -T "$rt"
done

# Taille des images (octets) pour merge.ts
{
  printf '{'
  sep=''
  for rt in "${runtimes[@]}"; do
    printf '%s"%s": %s' "$sep" "$rt" "$(docker image inspect -f '{{.Size}}' "runtime-bench-$rt")"
    sep=', '
  done
  printf '}\n'
} > results/image-sizes.json

docker compose run --rm -T merge
