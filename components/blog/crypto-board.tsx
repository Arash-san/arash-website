export function CryptoBoard({ rows, label, compact = false }: { rows: string[]; label: string; compact?: boolean }) {
  const cols = rows[0]?.length ?? 1;
  return (
    <div
      className={compact ? "crypto-board is-compact" : "crypto-board"}
      role="img"
      aria-label={label}
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, aspectRatio: `${cols} / ${rows.length}` }}
    >
      {rows.flatMap((row, rowIndex) => Array.from(row, (cell, colIndex) => (
        <span
          key={`${rowIndex}:${colIndex}`}
          className={cell === "." ? "is-unknown" : cell === "1" ? "is-black" : "is-white"}
        />
      )))}
    </div>
  );
}
