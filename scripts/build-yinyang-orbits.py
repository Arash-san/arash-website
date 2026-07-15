"""Build compact square Yin Yang solution orbit catalogs.

Each output entry stores one canonical solution and its distinct orbit size
under D4 board symmetry plus black and white exchange. The original CSV files
remain untouched and are only read as source material.
"""

from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import struct
from datetime import datetime, timezone
from pathlib import Path

import numpy as np


MAGIC = b"YYORBIT1"
CHUNK_SIZE = 1_000_000


def target_index(size: int, operation: int, row: int, col: int) -> int:
    if operation == 0:
        target = row, col
    elif operation == 1:
        target = col, size - 1 - row
    elif operation == 2:
        target = size - 1 - row, size - 1 - col
    elif operation == 3:
        target = size - 1 - col, row
    elif operation == 4:
        target = row, size - 1 - col
    elif operation == 5:
        target = size - 1 - row, col
    elif operation == 6:
        target = col, row
    else:
        target = size - 1 - col, size - 1 - row
    return target[0] * size + target[1]


def make_tables(size: int) -> np.ndarray:
    byte_count = (size * size + 7) // 8
    tables = np.zeros((8, byte_count, 256), dtype=np.uint64)
    for operation in range(8):
        for source in range(size * size):
            source_byte, source_bit = divmod(source, 8)
            target = target_index(size, operation, source // size, source % size)
            bit = np.uint64(1) << np.uint64(target)
            values = np.arange(256, dtype=np.uint16)
            tables[operation, source_byte, (values & (1 << source_bit)) != 0] |= bit
    return tables


def transform(values: np.ndarray, table: np.ndarray) -> np.ndarray:
    output = np.zeros(values.shape, dtype=np.uint64)
    for byte_index in range(table.shape[0]):
        source_bytes = ((values >> np.uint64(byte_index * 8)) & np.uint64(255)).astype(np.uint8)
        output |= table[byte_index, source_bytes]
    return output


def read_csv_values(path: Path):
    buffer: list[int] = []
    with path.open("r", encoding="utf-8", errors="ignore") as handle:
        next(handle, None)
        for line in handle:
            separator = line.find(",")
            if separator < 0:
                continue
            value = line[separator + 1 :].strip()
            if not value.isdigit():
                continue
            buffer.append(int(value))
            if len(buffer) == CHUNK_SIZE:
                yield np.asarray(buffer, dtype=np.uint64)
                buffer.clear()
    if buffer:
        yield np.asarray(buffer, dtype=np.uint64)


def read_catalog_values(path: Path):
    with path.open("rb") as handle:
        header = handle.read(20)
    magic, rows, cols, _, count = struct.unpack("<8sBBHQ", header)
    if magic != b"YYCAT641" or rows != cols:
        raise RuntimeError(f"unsupported square catalog header: {path}")
    values = np.memmap(path, dtype="<u8", mode="r", offset=20, shape=(count,))
    for start in range(0, count, CHUNK_SIZE):
        yield np.asarray(values[start : start + CHUNK_SIZE])


def read_values(path: Path):
    if path.suffix == ".yycat":
        yield from read_catalog_values(path)
    else:
        yield from read_csv_values(path)


def canonicalize(values: np.ndarray, tables: np.ndarray, mask: np.uint64) -> np.ndarray:
    canonical = np.full(values.shape, mask, dtype=np.uint64)
    for operation in range(8):
        transformed = transform(values, tables[operation])
        canonical = np.minimum(canonical, transformed)
        canonical = np.minimum(canonical, mask ^ transformed)
    return canonical


def orbit_sizes(representatives: np.ndarray, tables: np.ndarray, mask: np.uint64) -> np.ndarray:
    sizes = np.empty(representatives.shape, dtype=np.uint8)
    step = 200_000
    for start in range(0, representatives.size, step):
        values = representatives[start : start + step]
        forms = []
        for operation in range(8):
            transformed = transform(values, tables[operation])
            forms.append(transformed)
            forms.append(mask ^ transformed)
        stacked = np.stack(forms, axis=0)
        stacked.sort(axis=0)
        sizes[start : start + values.size] = 1 + np.count_nonzero(stacked[1:] != stacked[:-1], axis=0)
    return sizes


def build_one(source: Path, destination: Path, size: int) -> dict[str, object]:
    tables = make_tables(size)
    mask = np.uint64((1 << (size * size)) - 1)
    chunk_representatives = []
    source_solutions = 0
    for values in read_values(source):
        source_solutions += values.size
        chunk_representatives.append(np.unique(canonicalize(values, tables, mask)))
    representatives = np.unique(np.concatenate(chunk_representatives))
    sizes = orbit_sizes(representatives, tables, mask)
    total_solutions = int(sizes.astype(np.uint64).sum())
    if total_solutions != source_solutions:
        raise RuntimeError(
            f"{size}x{size}: orbit total {total_solutions} does not match CSV total {source_solutions}"
        )

    entries = np.empty(representatives.size, dtype=np.dtype([("representative", "<u8"), ("orbit", "u1")]))
    entries["representative"] = representatives
    entries["orbit"] = sizes
    payload = struct.pack("<8sBIQ", MAGIC, size, representatives.size, total_solutions) + entries.tobytes()
    destination.parent.mkdir(parents=True, exist_ok=True)
    with destination.open("wb") as raw:
        with gzip.GzipFile(filename="", mode="wb", compresslevel=9, fileobj=raw, mtime=0) as handle:
            handle.write(payload)
    compressed = destination.read_bytes()
    return {
        "size": size,
        "totalSolutions": total_solutions,
        "keySolutions": int(representatives.size),
        "largestOrbit": int(sizes.max()),
        "file": f"/yinyang/orbits/{destination.name}",
        "bytes": len(compressed),
        "sha256": hashlib.sha256(compressed).hexdigest(),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path, help="Directory containing the original square CSV catalogs")
    parser.add_argument("output", type=Path, help="Public output directory")
    parser.add_argument("--sizes", type=int, nargs="+", default=[3, 4, 5, 6, 7, 8])
    args = parser.parse_args()

    records = []
    for size in args.sizes:
        binary_source = args.source / f"{size}x{size}.yycat"
        source = binary_source if binary_source.exists() else args.source / f"{size}x{size} Solutions.csv"
        destination = args.output / f"{size}x{size}.bin.gz"
        record = build_one(source, destination, size)
        records.append(record)
        print(json.dumps(record))

    manifest = {
        "schemaVersion": 1,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "symmetry": "D4 plus color exchange",
        "records": records,
    }
    (args.output / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
