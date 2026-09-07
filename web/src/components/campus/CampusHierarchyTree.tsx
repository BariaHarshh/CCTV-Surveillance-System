"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronRight } from "lucide-react";

export interface HierarchyNode {
  id: string;
  label: string;
  type: "campus" | "building" | "floor" | "room";
  children?: HierarchyNode[];
  meta?: Record<string, string | number>;
}

export function CampusHierarchyTree({ node, depth = 0 }: { node: HierarchyNode; depth?: number }) {
  const [open, setOpen] = useState(depth < 2);
  const hasChildren = Boolean(node.children?.length);

  return (
    <div className={cn(depth > 0 && "ml-4 border-l border-border pl-3")}>
      <button
        type="button"
        onClick={() => hasChildren && setOpen(!open)}
        className={cn("flex w-full items-center gap-2 rounded-lg py-1.5 text-left text-sm hover:bg-glass", !hasChildren && "cursor-default")}
      >
        {hasChildren ? (open ? <ChevronDown className="h-4 w-4 text-muted" /> : <ChevronRight className="h-4 w-4 text-muted" />) : <span className="w-4" />}
        <span className={cn(node.type === "campus" && "font-semibold text-accent", node.type === "building" && "font-medium")}>{node.label}</span>
        {node.meta?.status && <span className="text-xs text-muted">({node.meta.status})</span>}
      </button>
      {open && node.children?.map((child) => <CampusHierarchyTree key={child.id} node={child} depth={depth + 1} />)}
    </div>
  );
}
