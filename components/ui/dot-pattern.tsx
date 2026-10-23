import { cn } from "@/lib/utils";
import type { CSSProperties, HTMLAttributes } from "react";

interface DotPatternProps extends HTMLAttributes<HTMLDivElement> {
  width?: number;
  height?: number;
  x?: number;
  y?: number;
  cx?: number;
  cy?: number;
  cr?: number;
  className?: string;
  /** Kept for compatibility with older callers; the glow animation is gone. */
  glow?: boolean;
}

/**
 * A dotted background drawn by one CSS gradient tile. The previous version
 * rendered one animated SVG circle per dot (thousands on a normal screen),
 * which made pages slow to start and scroll.
 */
export function DotPattern({
  width = 16,
  height = 16,
  x = 0,
  y = 0,
  cx = 1,
  cy = 1,
  cr = 1,
  className,
  glow: _glow,
  style,
  ...props
}: DotPatternProps) {
  void _glow;
  const tile: CSSProperties = {
    backgroundImage: `radial-gradient(circle at ${cx}px ${cy}px, currentColor ${cr}px, transparent ${cr + 0.6}px)`,
    backgroundSize: `${width}px ${height}px`,
    backgroundPosition: `${x}px ${y}px`,
  };
  return (
    <div
      aria-hidden="true"
      className={cn("pointer-events-none absolute inset-0 h-full w-full text-neutral-400/80", className)}
      style={{ ...tile, ...style }}
      {...props}
    />
  );
}
