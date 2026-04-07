"use client"

import * as Ably from "ably"
import { mapAuxSnapshotToEntities } from "@/components/auxilium/entity-display"
import type { AuxMapSnapshot, Entity } from "@/components/auxilium/types"

const ABLY_SUBSCRIBE_KEY = process.env.NEXT_PUBLIC_ABLY_KEY || ""

let ablyInstance: Ably.Realtime | null = null

export function getAbly() {
  if (typeof window === "undefined") return null
  if (!ABLY_SUBSCRIBE_KEY) {
    console.warn("Ably: No authentication key provided. Real-time features disabled.")
    return null
  }
  if (!ablyInstance) {
    ablyInstance = new Ably.Realtime({ key: ABLY_SUBSCRIBE_KEY })
  }
  return ablyInstance
}

export function subscribeToMapEntities(
  mapId: string,
  onUpdate: (entities: Entity[]) => void
) {
  const ably = getAbly()
  if (!ably) return () => { }

  const channel = ably.channels.get("aux")

  const handleMessage = (message: Ably.Message) => {
    try {
      const data = typeof message.data === "string" ? JSON.parse(message.data) : message.data
      const snapshots = Array.isArray(data) ? data : [data]
      const targetMap = mapId.toLowerCase()

      const snapshot = snapshots.find((s: any) => s.map && s.map.toLowerCase() === targetMap)
      
      if (!snapshot) {
        return
      }

      onUpdate(mapAuxSnapshotToEntities({ entities: snapshot.entities || [] }))
    } catch (err) {
      console.error("Failed to parse realtime map snapshot:", err)
    }
  }

  channel.subscribe("snapshot", handleMessage)

  return () => {
    channel.unsubscribe("snapshot", handleMessage)
  }
}

