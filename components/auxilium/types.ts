"use client"

export type EntityCategory = "friend" | "enemy" | "default" | "worker"

export interface Entity {
  id: string
  name: string
  category: EntityCategory
  position: [number, number, number]
  health?: number | null
  description?: string
  server?: string
}

export interface AuxEntitySnapshot {
  runtimeId: number | string
  username: string
  server?: string
  position: {
    x: number
    y: number
    z: number
  }
  health?: number | null
  tags?: string[]
}

export interface AuxMapSnapshot {
  map?: string
  entities: AuxEntitySnapshot[]
}

export interface AuxMapIndex {
  generatedAt: number
  maps: Record<
    string,
    {
      updatedAt: number
      entityCount: number
    }
  >
}

