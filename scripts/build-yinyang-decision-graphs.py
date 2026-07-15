"""Build compact ranked decision graphs for exact Yin Yang catalogs.

The graph merges board prefixes that have the same row frontier connectivity
state. Edge weights store the number of valid completions below each choice,
which permits direct reconstruction of solution k without enumerating earlier
solutions.
"""

from __future__ import annotations

import argparse
import gzip
import hashlib
import importlib.util
import json
import struct
import sys
import time
from datetime import datetime, timezone
from pathlib import Path


counter_path = Path(__file__).with_name("build-yinyang-rectangle-counts.py")
counter_spec = importlib.util.spec_from_file_location("yinyang_rectangle_counts", counter_path)
if counter_spec is None or counter_spec.loader is None:
    raise RuntimeError(f"could not load {counter_path}")
counter_module = importlib.util.module_from_spec(counter_spec)
sys.modules[counter_spec.name] = counter_module
counter_spec.loader.exec_module(counter_module)
canonical_labels = counter_module.canonical_labels
compatible_rows = counter_module.compatible_rows


MAGIC = b"YYDAG001"
State = tuple[int, tuple[int, ...], int, int]


def initial_states(width: int) -> set[State]:
    states = set()
    for pattern in range(1 << width):
        colors = [(pattern >> col) & 1 for col in range(width)]
        roots = [0]
        for col in range(1, width):
            roots.append(roots[-1] if colors[col] == colors[col - 1] else col)
        labels = canonical_labels(colors, roots)
        seen = (1 if 0 in colors else 0) | (2 if 1 in colors else 0)
        states.add((pattern, labels, seen, 0))
    return states


def advance(state: State, current: int, width: int) -> State | None:
    previous, labels, seen, closed = state
    old_ids = sorted(set(labels))
    old_index = {label: index for index, label in enumerate(old_ids)}
    old_colors = {label: (previous >> labels.index(label)) & 1 for label in old_ids}
    colors = [(current >> col) & 1 for col in range(width)]
    present = (1 if 0 in colors else 0) | (2 if 1 in colors else 0)
    if closed & present:
        return None

    old_count = len(old_ids)
    parent = list(range(old_count + width))

    def find(value: int) -> int:
        while parent[value] != value:
            parent[value] = parent[parent[value]]
            value = parent[value]
        return value

    def union(left: int, right: int) -> None:
        left, right = find(left), find(right)
        if left != right:
            parent[right] = left

    for col in range(1, width):
        if colors[col] == colors[col - 1]:
            union(old_count + col, old_count + col - 1)
    for col in range(width):
        if colors[col] == ((previous >> col) & 1):
            union(old_count + col, old_index[labels[col]])

    next_closed = closed
    for color in (0, 1):
        old_components = [label for label in old_ids if old_colors[label] == color]
        new_roots = {find(old_count + col) for col in range(width) if colors[col] == color}
        disappearing = [label for label in old_components if find(old_index[label]) not in new_roots]
        if disappearing:
            if len(disappearing) != 1 or new_roots:
                return None
            next_closed |= 1 << color

    roots = [find(old_count + col) for col in range(width)]
    next_labels = canonical_labels(colors, roots)
    return current, next_labels, seen | present, next_closed


def final_state_valid(state: State, width: int) -> bool:
    pattern, labels, seen, closed = state
    if seen != 3:
        return False
    for color in (0, 1):
        active = {labels[col] for col in range(width) if ((pattern >> col) & 1) == color}
        if closed & (1 << color):
            if active:
                return False
        elif len(active) != 1:
            return False
    return True


def build_graph(rows: int, cols: int, destination: Path) -> dict[str, object]:
    started = time.perf_counter()
    height, width = max(rows, cols), min(rows, cols)
    compatible = compatible_rows(width)
    layers: list[set[State]] = [initial_states(width)]

    for _ in range(1, height):
        next_layer: set[State] = set()
        for state in layers[-1]:
            for pattern in compatible[state[0]]:
                next_state = advance(state, pattern, width)
                if next_state is not None:
                    next_layer.add(next_state)
        layers.append(next_layer)

    backward: list[dict[State, int]] = [{} for _ in range(height)]
    backward[-1] = {state: 1 for state in layers[-1] if final_state_valid(state, width)}
    outgoing: list[dict[State, list[tuple[int, State, int]]]] = [{} for _ in range(height)]

    for layer in range(height - 2, -1, -1):
        counts: dict[State, int] = {}
        layer_edges: dict[State, list[tuple[int, State, int]]] = {}
        child_counts = backward[layer + 1]
        for state in layers[layer]:
            edges = []
            total = 0
            for pattern in compatible[state[0]]:
                next_state = advance(state, pattern, width)
                count = child_counts.get(next_state, 0) if next_state is not None else 0
                if count:
                    edges.append((pattern, next_state, count))
                    total += count
            if total:
                counts[state] = total
                layer_edges[state] = edges
        backward[layer] = counts
        outgoing[layer] = layer_edges

    ordered_layers = [sorted(counts) for counts in backward]
    node_ids: dict[tuple[int, State], int] = {}
    next_id = 1
    for layer, states in enumerate(ordered_layers):
        for state in states:
            node_ids[layer, state] = next_id
            next_id += 1

    node_edges: list[list[tuple[int, int, int]]] = [[] for _ in range(next_id)]
    total_solutions = sum(backward[0].values())
    for state in ordered_layers[0]:
        node_edges[0].append((state[0], node_ids[0, state], backward[0][state]))
    for layer in range(height - 1):
        for state in ordered_layers[layer]:
            node = node_ids[layer, state]
            node_edges[node] = [
                (pattern, node_ids[layer + 1, child], count)
                for pattern, child, count in outgoing[layer][state]
            ]

    flat_edges = [edge for edges in node_edges for edge in edges]
    header = struct.pack(
        "<8sBBBBIIQ",
        MAGIC, rows, cols, height, width, len(node_edges), len(flat_edges), total_solutions,
    )
    node_table = bytearray()
    edge_table = bytearray()
    edge_offset = 0
    for edges in node_edges:
        node_table.extend(struct.pack("<IH", edge_offset, len(edges)))
        edge_offset += len(edges)
        for pattern, child, count in edges:
            edge_table.extend(struct.pack("<HIQ", pattern, child, count))
    payload = header + node_table + edge_table

    destination.parent.mkdir(parents=True, exist_ok=True)
    with destination.open("wb") as raw:
        with gzip.GzipFile(filename="", mode="wb", compresslevel=9, fileobj=raw, mtime=0) as zipped:
            zipped.write(payload)
    compressed = destination.read_bytes()
    return {
        "board": f"{rows}x{cols}",
        "rows": rows,
        "cols": cols,
        "solutions": str(total_solutions),
        "nodes": len(node_edges),
        "edges": len(flat_edges),
        "rawBytes": len(payload),
        "bytes": len(compressed),
        "elapsedSeconds": round(time.perf_counter() - started, 6),
        "file": f"/yinyang/graphs/{destination.name}",
        "sha256": hashlib.sha256(compressed).hexdigest(),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("output", type=Path)
    parser.add_argument("--board", nargs=2, type=int, action="append", required=True)
    parser.add_argument("--manifest", type=Path)
    args = parser.parse_args()

    records = []
    for rows, cols in args.board:
        record = build_graph(rows, cols, args.output / f"{rows}x{cols}.dag.gz")
        records.append(record)
        print(json.dumps(record))
    manifest_path = args.manifest or args.output / "manifest.json"
    existing = json.loads(manifest_path.read_text(encoding="utf-8")) if manifest_path.exists() else {"records": []}
    merged = {record["board"]: record for record in existing["records"]}
    merged.update({record["board"]: record for record in records})
    manifest = {"schemaVersion": 1, "generatedAt": datetime.now(timezone.utc).isoformat(), "records": sorted(merged.values(), key=lambda record: (record["rows"], record["cols"]))}
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
