"use client";

import { cn } from "@/lib/utils";
import { motion, useTransform, MotionValue } from "framer-motion";
import React from "react";

interface SubsectionSwitcherProps {
  title: string;
  isActiveProgress: MotionValue<number>; // 0..1 progress controlling overlay activation
  general: React.ReactNode; // base content
  overlay: React.ReactNode; // overlay content
  onSelectGeneral?: () => void;
  onSelectOverlay?: () => void;
  size?: "sm" | "md";
}

export function SubsectionSwitcher({
  title,
  isActiveProgress,
  general,
  overlay,
  onSelectGeneral,
  onSelectOverlay,
  size = "md",
}: SubsectionSwitcherProps) {
  const overlayOpacity = useTransform(isActiveProgress, [0, 1], [0, 1]);
  const overlayY = useTransform(isActiveProgress, [0, 1], [24, 0]);
  const generalOpacity = useTransform(isActiveProgress, [0, 1], [1, 0]);
  const generalHeight = useTransform(isActiveProgress, [0, 1], ["auto" as any, 0 as any]);

  const buttonBase = size === "sm" ? "px-2 py-1 text-xs" : "px-3 py-1 text-sm";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className={cn(size === "sm" ? "text-2xl" : "text-5xl xl:text-6xl", "font-bold text-black")}>{title}</h1>
        <div className="flex items-center gap-2">
          <button
            role="tab"
            aria-selected={false}
            onPointerDown={(e) => { e.preventDefault(); onSelectGeneral?.(); }}
            onClick={(e) => { e.preventDefault(); onSelectGeneral?.(); }}
            className={cn(buttonBase, "rounded-full border transition-colors", "bg-transparent text-black/80 border-black/40 hover:border-black hover:text-black")}
            style={{ touchAction: "manipulation" }}
          >
            in general
          </button>
          <button
            role="tab"
            aria-selected={true}
            onPointerDown={(e) => { e.preventDefault(); onSelectOverlay?.(); }}
            onClick={(e) => { e.preventDefault(); onSelectOverlay?.(); }}
            className={cn(buttonBase, "rounded-full border transition-colors", "bg-black text-white border-black")}
            style={{ touchAction: "manipulation" }}
          >
            current mood
          </button>
        </div>
      </div>

      <motion.div style={{ opacity: generalOpacity, height: generalHeight }} className="overflow-hidden">
        {general}
      </motion.div>

      <motion.div style={{ opacity: overlayOpacity, y: overlayY, pointerEvents: useTransform(isActiveProgress, [0, 1], ["none", "auto"]) }} className="rounded-lg border border-black/20 bg-white shadow-sm p-4">
        {overlay}
      </motion.div>
    </div>
  );
}


