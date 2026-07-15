"""Count Yin Yang solution boards and symmetry orbits exactly.

The total counter is a row frontier dynamic program. Symmetry fixed points use
the same connectivity idea on cell orbits, followed by Burnside's lemma. The
script never enumerates or stores the complete 2^(rows*cols) state space.
"""

from __future__ import annotations

import argparse
import json
import time
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path


def canonical_labels(colors: list[int], roots: list[int]) -> tuple[int, ...]:
    mapping: dict[tuple[int, int], int] = {}
    result = []
    for color, root in zip(colors, roots):
        key = color, root
        if key not in mapping:
            mapping[key] = len(mapping)
        result.append(mapping[key])
    return tuple(result)


def compatible_rows(width: int) -> list[list[int]]:
    patterns = range(1 << width)
    result: list[list[int]] = []
    for previous in patterns:
        allowed = []
        for current in patterns:
            valid = True
            for col in range(width - 1):
                top = (previous >> col) & 3
                bottom = (current >> col) & 3
                if (top == 0 and bottom == 0) or (top == 3 and bottom == 3):
                    valid = False
                    break
            if valid:
                allowed.append(current)
        result.append(allowed)
    return result


def total_solutions(rows: int, cols: int, final_patterns: set[int] | None = None) -> int:
    height, width = max(rows, cols), min(rows, cols)
    patterns = range(1 << width)
    compatible = compatible_rows(width)
    # pattern, frontier labels, colors seen, colors already closed
    states: dict[tuple[int, tuple[int, ...], int, int], int] = {}

    for pattern in patterns:
        colors = [(pattern >> col) & 1 for col in range(width)]
        roots = [0]
        for col in range(1, width):
            roots.append(roots[-1] if colors[col] == colors[col - 1] else col)
        labels = canonical_labels(colors, roots)
        seen = (1 if 0 in colors else 0) | (2 if 1 in colors else 0)
        states[pattern, labels, seen, 0] = 1

    for _ in range(1, height):
        next_states: defaultdict[tuple[int, tuple[int, ...], int, int], int] = defaultdict(int)
        for (previous, labels, seen, closed), count in states.items():
            old_ids = sorted(set(labels))
            old_index = {label: index for index, label in enumerate(old_ids)}
            old_colors = {
                label: (previous >> labels.index(label)) & 1
                for label in old_ids
            }
            for current in compatible[previous]:
                colors = [(current >> col) & 1 for col in range(width)]
                present = (1 if 0 in colors else 0) | (2 if 1 in colors else 0)
                if closed & present:
                    continue

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
                rejected = False
                for color in (0, 1):
                    old_components = [label for label in old_ids if old_colors[label] == color]
                    new_roots = {find(old_count + col) for col in range(width) if colors[col] == color}
                    disappearing = [label for label in old_components if find(old_index[label]) not in new_roots]
                    if disappearing:
                        if len(disappearing) != 1 or new_roots:
                            rejected = True
                            break
                        next_closed |= 1 << color
                if rejected:
                    continue

                roots = [find(old_count + col) for col in range(width)]
                next_labels = canonical_labels(colors, roots)
                next_states[current, next_labels, seen | present, next_closed] += count
        states = next_states

    total = 0
    for (pattern, labels, seen, closed), count in states.items():
        if final_patterns is not None and pattern not in final_patterns:
            continue
        if seen != 3:
            continue
        valid = True
        for color in (0, 1):
            active = {labels[col] for col in range(width) if ((pattern >> col) & 1) == color}
            if closed & (1 << color):
                valid = valid and not active
            else:
                valid = valid and len(active) == 1
        if valid:
            total += count
    return total


def fixed_left_right(rows: int, cols: int) -> int:
    half_cols = (cols + 1) // 2
    if half_cols < rows:
        raise ValueError("the compact reflection counter requires a long rectangle")
    if cols % 2:
        final_patterns = set(range(1, (1 << rows) - 1))
    else:
        alternating = sum(1 << row for row in range(rows) if row % 2)
        final_patterns = {alternating, ((1 << rows) - 1) ^ alternating}
    return total_solutions(half_cols, rows, final_patterns)


def geometry_permutations(rows: int, cols: int) -> list[tuple[str, tuple[int, ...]]]:
    def index(row: int, col: int) -> int:
        return row * cols + col

    operations = [
        ("identity", lambda r, c: (r, c)),
        ("rotate 180", lambda r, c: (rows - 1 - r, cols - 1 - c)),
        ("flip left and right", lambda r, c: (r, cols - 1 - c)),
        ("flip up and down", lambda r, c: (rows - 1 - r, c)),
    ]
    if rows == cols:
        operations.extend([
            ("rotate 90", lambda r, c: (c, rows - 1 - r)),
            ("rotate 270", lambda r, c: (cols - 1 - c, r)),
            ("main diagonal", lambda r, c: (c, r)),
            ("other diagonal", lambda r, c: (rows - 1 - c, cols - 1 - r)),
        ])

    unique: dict[tuple[int, ...], str] = {}
    for name, operation in operations:
        permutation = tuple(index(*operation(row, col)) for row in range(rows) for col in range(cols))
        unique.setdefault(permutation, name)
    return [(name, permutation) for permutation, name in unique.items()]


class ParityUnionFind:
    def __init__(self, size: int):
        self.parent = list(range(size))
        self.rank = [0] * size
        self.parity = [0] * size

    def find(self, value: int) -> tuple[int, int]:
        if self.parent[value] == value:
            return value, 0
        root, parity = self.find(self.parent[value])
        self.parity[value] ^= parity
        self.parent[value] = root
        return root, self.parity[value]

    def union(self, left: int, right: int, parity: int) -> bool:
        left_root, left_parity = self.find(left)
        right_root, right_parity = self.find(right)
        if left_root == right_root:
            return (left_parity ^ right_parity) == parity
        if self.rank[left_root] < self.rank[right_root]:
            left_root, right_root = right_root, left_root
            left_parity, right_parity = right_parity, left_parity
        self.parent[right_root] = left_root
        self.parity[right_root] = left_parity ^ right_parity ^ parity
        if self.rank[left_root] == self.rank[right_root]:
            self.rank[left_root] += 1
        return True


@dataclass(frozen=True)
class OrbitModel:
    cell_variable: tuple[int, ...]
    cell_parity: tuple[int, ...]
    variable_cells: tuple[tuple[int, ...], ...]


def orbit_model(permutation: tuple[int, ...], exchange: int) -> OrbitModel | None:
    cells = len(permutation)
    union_find = ParityUnionFind(cells)
    for source, target in enumerate(permutation):
        if not union_find.union(source, target, exchange):
            return None

    roots: dict[int, int] = {}
    cell_variable = []
    cell_parity = []
    variable_cells: list[list[int]] = []
    for cell in range(cells):
        root, parity = union_find.find(cell)
        if root not in roots:
            roots[root] = len(roots)
            variable_cells.append([])
        variable = roots[root]
        cell_variable.append(variable)
        cell_parity.append(parity)
        variable_cells[variable].append(cell)
    return OrbitModel(tuple(cell_variable), tuple(cell_parity), tuple(tuple(group) for group in variable_cells))


def fixed_solutions(rows: int, cols: int, permutation: tuple[int, ...], exchange: int) -> int:
    model = orbit_model(permutation, exchange)
    if model is None:
        return 0
    cell_count = rows * cols
    variables = len(model.variable_cells)

    neighbors: list[set[int]] = [set() for _ in range(cell_count)]
    squares: list[tuple[int, int, int, int]] = []
    cell_squares: list[list[int]] = [[] for _ in range(cell_count)]
    for row in range(rows):
        for col in range(cols):
            cell = row * cols + col
            if row + 1 < rows:
                other = (row + 1) * cols + col
                neighbors[cell].add(other)
                neighbors[other].add(cell)
            if col + 1 < cols:
                other = row * cols + col + 1
                neighbors[cell].add(other)
                neighbors[other].add(cell)
            if row + 1 < rows and col + 1 < cols:
                square = (cell, cell + 1, cell + cols, cell + cols + 1)
                square_index = len(squares)
                squares.append(square)
                for member in square:
                    cell_squares[member].append(square_index)

    candidates = [
        sorted(range(variables), key=lambda variable: min(model.variable_cells[variable])),
        sorted(range(variables), key=lambda variable: min((cell % cols, cell // cols) for cell in model.variable_cells[variable])),
        sorted(range(variables), key=lambda variable: min((abs(2 * (cell % cols) - (cols - 1)), cell // cols) for cell in model.variable_cells[variable])),
        sorted(range(variables), key=lambda variable: min((abs(2 * (cell // cols) - (rows - 1)), cell % cols) for cell in model.variable_cells[variable])),
        sorted(range(variables), key=lambda variable: min((abs(2 * (cell % cols) - (cols - 1)) + abs(2 * (cell // cols) - (rows - 1)), cell) for cell in model.variable_cells[variable])),
    ]
    constraint_neighbors = [set(group) for group in neighbors]
    for square in squares:
        for cell in square:
            constraint_neighbors[cell].update(member for member in square if member != cell)

    def order_cost(candidate: list[int]) -> tuple[int, int]:
        variable_step = {variable: step for step, variable in enumerate(candidate)}
        steps = [variable_step[model.cell_variable[cell]] for cell in range(cell_count)]
        widths = []
        for step in range(variables):
            widths.append(sum(
                steps[cell] <= step and any(steps[other] > step for other in constraint_neighbors[cell])
                for cell in range(cell_count)
            ))
        return max(widths, default=0), sum(widths)

    order = min(candidates, key=order_cost)
    position = {variable: step for step, variable in enumerate(order)}
    cell_step = [position[model.cell_variable[cell]] for cell in range(cell_count)]

    keep_after: list[tuple[int, ...]] = []
    live_after: list[set[int]] = []
    completed_squares: list[list[int]] = [[] for _ in range(variables)]
    for square_index, square in enumerate(squares):
        completed_squares[max(cell_step[cell] for cell in square)].append(square_index)

    assigned: set[int] = set()
    for step, variable in enumerate(order):
        assigned.update(model.variable_cells[variable])
        keep = []
        live = set()
        for cell in assigned:
            future_neighbor = any(cell_step[other] > step for other in neighbors[cell])
            future_square = any(max(cell_step[member] for member in squares[square]) > step for square in cell_squares[cell])
            if future_neighbor:
                live.add(cell)
            if future_neighbor or future_square:
                keep.append(cell)
        keep_after.append(tuple(sorted(keep)))
        live_after.append(live)

    # State entries follow the deterministic keep list: color, component label.
    states: dict[tuple[tuple[tuple[int, int], ...], int, int], int] = {((), 0, 0): 1}
    previous_keep: tuple[int, ...] = ()

    for step, variable in enumerate(order):
        new_cells = model.variable_cells[variable]
        current_keep = keep_after[step]
        next_states: defaultdict[tuple[tuple[tuple[int, int], ...], int, int], int] = defaultdict(int)
        for (entries, seen, closed), count in states.items():
            old_color = {cell: entries[index][0] for index, cell in enumerate(previous_keep)}
            old_label = {cell: entries[index][1] for index, cell in enumerate(previous_keep)}
            for base_color in (0, 1):
                colors = dict(old_color)
                for cell in new_cells:
                    colors[cell] = base_color ^ model.cell_parity[cell]
                present = 0
                for cell in new_cells:
                    present |= 1 << colors[cell]
                if closed & present:
                    continue

                working = list(previous_keep) + [cell for cell in new_cells if cell not in old_color]
                cell_index = {cell: index for index, cell in enumerate(working)}
                parent = list(range(len(working)))

                def find(value: int) -> int:
                    while parent[value] != value:
                        parent[value] = parent[parent[value]]
                        value = parent[value]
                    return value

                def union(left: int, right: int) -> None:
                    left, right = find(left), find(right)
                    if left != right:
                        parent[right] = left

                label_representatives: dict[int, int] = {}
                for cell in previous_keep:
                    label = old_label[cell]
                    if label < 0:
                        continue
                    if label in label_representatives:
                        union(cell_index[cell], cell_index[label_representatives[label]])
                    else:
                        label_representatives[label] = cell

                for cell in new_cells:
                    for other in neighbors[cell]:
                        if other in cell_index and colors[other] == colors[cell]:
                            union(cell_index[cell], cell_index[other])

                rejected = False
                for square_index in completed_squares[step]:
                    square_colors = [colors[cell] for cell in squares[square_index]]
                    if square_colors.count(square_colors[0]) == 4:
                        rejected = True
                        break
                if rejected:
                    continue

                live_roots = {find(cell_index[cell]) for cell in live_after[step]}
                roots_by_color: dict[int, set[int]] = {0: set(), 1: set()}
                for cell in working:
                    if old_label.get(cell, 0) < 0:
                        continue
                    roots_by_color[colors[cell]].add(find(cell_index[cell]))

                next_closed = closed
                for color in (0, 1):
                    roots = roots_by_color[color]
                    closing = roots - live_roots
                    living = roots & live_roots
                    if closing:
                        if len(closing) != 1 or living:
                            rejected = True
                            break
                        next_closed |= 1 << color
                if rejected:
                    continue

                label_map: dict[tuple[int, int], int] = {}
                next_entries = []
                for cell in current_keep:
                    root = find(cell_index[cell])
                    if root not in live_roots:
                        next_entries.append((colors[cell], -1))
                        continue
                    key = colors[cell], root
                    if key not in label_map:
                        label_map[key] = len(label_map)
                    next_entries.append((colors[cell], label_map[key]))
                next_states[tuple(next_entries), seen | present, next_closed] += count
        states = next_states
        previous_keep = current_keep

    return states.get(((), 3, 3), 0)


def board_record(rows: int, cols: int) -> dict[str, object]:
    started = time.perf_counter()
    if rows == 3 and cols > 3:
        total = 2 * cols * cols + 2 * cols + 10
        values = {
            ("identity", 0): total,
            ("identity", 1): 0,
            ("rotate 180", 0): 2,
            ("rotate 180", 1): 2 * cols if cols % 2 == 0 else 0,
            ("flip left and right", 0): 2 if cols % 2 == 0 else 2 * cols + 4,
            ("flip left and right", 1): 0,
            ("flip up and down", 0): 10,
            ("flip up and down", 1): 0,
        }
        fixed = [
            {"operation": name, "colorExchange": bool(exchange), "fixedSolutions": str(values[name, exchange])}
            for name, _ in geometry_permutations(rows, cols)
            for exchange in (0, 1)
        ]
        fixed_sum = sum(values[name, exchange] for name, _ in geometry_permutations(rows, cols) for exchange in (0, 1))
        return {
            "board": f"{rows}x{cols}", "rows": rows, "cols": cols,
            "cells": rows * cols, "stateSpace": str(1 << (rows * cols)),
            "solutions": str(total), "symmetryGroupSize": 8,
            "keySolutions": str(fixed_sum // 8),
            "elapsedSeconds": round(time.perf_counter() - started, 6), "fixed": fixed,
        }
    total = total_solutions(rows, cols)
    fixed: list[dict[str, object]] = []
    fixed_sum = 0
    geometries = geometry_permutations(rows, cols)
    fixed_cache: dict[tuple[str, int], int] = {}
    square_classes = {
        "rotate 270": "rotate 90",
        "flip up and down": "flip left and right",
        "other diagonal": "main diagonal",
    }
    for name, permutation in geometries:
        for exchange in (0, 1):
            operation_class = square_classes.get(name, name) if rows == cols else name
            cache_key = operation_class, exchange
            if cache_key in fixed_cache:
                value = fixed_cache[cache_key]
            else:
                if name == "identity" and exchange == 0:
                    value = total
                elif name == "flip left and right" and exchange == 0 and (cols + 1) // 2 >= rows:
                    value = fixed_left_right(rows, cols)
                elif name == "flip left and right" and exchange == 1:
                    value = 0
                else:
                    value = fixed_solutions(rows, cols, permutation, exchange)
                fixed_cache[cache_key] = value
            fixed.append({"operation": name, "colorExchange": bool(exchange), "fixedSolutions": str(value)})
            fixed_sum += value
    group_size = len(geometries) * 2
    if fixed_sum % group_size:
        raise RuntimeError(f"Burnside sum is not divisible for {rows} by {cols}")
    return {
        "board": f"{rows}x{cols}",
        "rows": rows,
        "cols": cols,
        "cells": rows * cols,
        "stateSpace": str(1 << (rows * cols)),
        "solutions": str(total),
        "symmetryGroupSize": group_size,
        "keySolutions": str(fixed_sum // group_size),
        "elapsedSeconds": round(time.perf_counter() - started, 6),
        "fixed": fixed,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("output", type=Path)
    parser.add_argument("--max-cells", type=int, default=100)
    parser.add_argument("--min-side", type=int, default=1)
    parser.add_argument("--max-short-side", type=int)
    parser.add_argument("--board", nargs=2, type=int)
    parser.add_argument("--merge", nargs="+", type=Path)
    args = parser.parse_args()

    if args.merge:
        inputs = [json.loads(path.read_text(encoding="utf-8")) for path in args.merge]
        records_by_board = {
            record["board"]: record
            for payload in inputs
            for record in payload["records"]
        }
        payload = dict(inputs[0])
        payload["generatedAt"] = datetime.now(timezone.utc).isoformat()
        payload["records"] = sorted(records_by_board.values(), key=lambda record: (record["rows"], record["cols"]))
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
        print(json.dumps({"records": len(payload["records"]), "output": str(args.output)}))
        return

    boards = [tuple(args.board)] if args.board else [
        (rows, cols)
        for rows in range(args.min_side, args.max_cells + 1)
        for cols in range(rows, args.max_cells // rows + 1)
        if args.max_short_side is None or rows <= args.max_short_side
    ]
    records = []
    generated_at = datetime.now(timezone.utc).isoformat()
    for rows, cols in boards:
        record = board_record(rows, cols)
        records.append(record)
        print(json.dumps({key: value for key, value in record.items() if key != "fixed"}))
        payload = {
            "schemaVersion": 1,
            "generatedAt": generated_at,
            "maxCells": args.max_cells,
            "definition": "Both colors are nonempty and orthogonally connected; no monochrome 2 by 2 block.",
            "symmetry": "All distinct board automorphisms plus color exchange; key counts use Burnside's lemma.",
            "records": records,
        }
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
