export type YinYangEnumeration = {
  board: string;
  rows: number;
  cols: number;
  solutions: number;
};

const records = `
3x3 34
3x4 50
3x5 70
3x6 94
3x7 122
3x8 154
3x9 190
3x10 230
3x11 274
3x12 322
3x13 374
3x14 430
3x15 490
3x16 554
3x17 622
3x18 694
3x19 770
3x20 850
3x21 934
4x4 96
4x5 220
4x6 420
4x7 924
4x8 1780
4x9 3784
4x10 7376
4x11 15312
4x12 30128
4x13 61600
4x14 121984
4x15 247104
4x16 491328
5x5 660
5x6 1948
5x7 5718
5x8 16460
5x9 47128
5x10 133408
5x11 375238
5x12 1047660
6x6 7736
6x7 36352
6x8 143164
6x9 658428
6x10 2612956
7x7 230568
7x8 1428028
7x9 8921002
8x8 11974112
`.trim();

export const yinYangEnumerations: YinYangEnumeration[] = records.split("\n").map((line) => {
  const [board, count] = line.trim().split(/\s+/);
  const [rows, cols] = board.split("x").map(Number);
  return { board, rows, cols, solutions: Number(count) };
});

export const yinYangSweep = {
  generatedAt: "2026-07-14T05:06:35Z",
  timeoutSecondsPerBoard: 3600,
  completed: 49,
  timedOut: 0,
  largestBoard: "8x8",
  largestCount: 11_974_112,
} as const;
