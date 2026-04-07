"use client"

import type { AuxEntitySnapshot, AuxMapSnapshot, Entity, EntityCategory } from "@/components/auxilium/types"

export interface EntityDisplayTokens {
  dotClassName: string
  textClassName: string
  lightHex: string
  darkHex: string
}

const primerPalette: Record<EntityCategory, EntityDisplayTokens> = {
  friend: {
    dotClassName: "bg-[#1f883d] dark:bg-[#3fb950]",
    textClassName: "text-[#1f883d] dark:text-[#3fb950]",
    lightHex: "#1f883d",
    darkHex: "#3fb950",
  },
  target: {
    dotClassName: "bg-[#cf222e] dark:bg-[#f85149]",
    textClassName: "text-[#cf222e] dark:text-[#f85149]",
    lightHex: "#cf222e",
    darkHex: "#f85149",
  },
  default: {
    dotClassName: "bg-[#6e7781] dark:bg-[#8b949e]",
    textClassName: "text-[#6e7781] dark:text-[#8b949e]",
    lightHex: "#6e7781",
    darkHex: "#8b949e",
  },
  worker: {
    dotClassName: "bg-[#b08800] dark:bg-[#f2cc60]",
    textClassName: "text-[#b08800] dark:text-[#f2cc60]",
    lightHex: "#b08800",
    darkHex: "#f2cc60",
  },
}

export function getCategoryLabel(category: EntityCategory) {
  if (category === "friend") {
    return "Friend"
  }

  if (category === "target") {
    return "Target"
  }

  if (category === "worker") {
    return "Worker"
  }

  return "Default"
}

export function getCategoryTokens(category: EntityCategory): EntityDisplayTokens {
  return primerPalette[category]
}

export function deriveAuxCategory(tags?: string[]): EntityCategory {
  if (!tags || tags.length === 0) return "default"
  
  if (tags.includes("friend")) return "friend"
  if (tags.includes("target")) return "target"
  if (tags.includes("worker")) return "worker"
  
  return "default"
}

export function mapAuxSnapshotToEntities(snapshot: AuxMapSnapshot): Entity[] {
  return snapshot.entities.map((entity) => {
    const category = deriveAuxCategory(entity.tags)

    return {
      id: String(entity.runtimeId),
      name: entity.username,
      category,
      position: [entity.position.x, entity.position.y, entity.position.z],
      health: entity.health,
      server: entity.server,
      description: `${getCategoryLabel(category)} entity on ${entity.server || 'Unknown Server'}`,
    }
  })
}

