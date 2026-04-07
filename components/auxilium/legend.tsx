"use client"

import { ChevronDown, ChevronUp } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { getCategoryTokens } from "@/components/auxilium/entity-display"

const legendItems = [
  { color: getCategoryTokens("friend").dotClassName, label: "Friends" },
  { color: getCategoryTokens("enemy").dotClassName, label: "Enemies" },
  { color: getCategoryTokens("worker").dotClassName, label: "Workers" },
  { color: getCategoryTokens("default").dotClassName, label: "Defaults" },
]

export function Legend() {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className="absolute bottom-3 right-3 bg-card border border-border rounded-md shadow-sm">
      <div
        className="px-2.5 py-1.5 flex items-center justify-between gap-4 cursor-pointer"
        onClick={() => setCollapsed(!collapsed)}
      >
        <span className="text-[10px] font-medium text-muted-foreground">Legend</span>
        <Button variant="ghost" size="sm" className="h-4 w-4 p-0">
          {collapsed ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </Button>
      </div>
      {!collapsed && (
        <div className="px-2.5 pb-2 space-y-1">
          {legendItems.map((item) => (
            <div key={item.label} className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${item.color}`} />
              <span className="text-[10px] text-muted-foreground">{item.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
