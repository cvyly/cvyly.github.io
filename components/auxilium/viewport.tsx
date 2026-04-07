"use client"

import { useRef, useState, useEffect, Suspense, useMemo, useCallback } from "react"
import { Canvas, useFrame, useThree, useLoader } from "@react-three/fiber"
import { OrbitControls, PerspectiveCamera, Html } from "@react-three/drei"
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js"
import { useTheme } from "next-themes"
import * as THREE from "three"
import { getCategoryTokens } from "@/components/auxilium/entity-display"
import type { Entity } from "@/components/auxilium/types"

interface ViewportProps {
  selectedMap: string
  entities: Entity[]
  selectedEntity: Entity | null
  onSelectEntity: (entity: Entity | null) => void
  cameraResetTrigger: number
}

interface MapWorldBounds {
  minX: number
  maxX: number
  minY: number
  maxY: number
  minZ: number
  maxZ: number
}

interface MapAssetEntry {
  file: string
  order: number
}

interface MapMetadata {
  bounds: MapWorldBounds
  assets?: {
    format?: string
    terrain?: MapAssetEntry[]
    barriers?: MapAssetEntry[]
  }
}

interface MapLayers {
  terrain: THREE.Group
  barriers: THREE.Group
}

function getMapAssetBaseUrl() {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || ""
  return (process.env.NEXT_PUBLIC_MAPS || `${basePath}/maps`).replace(/\/+$/, "")
}

function getMapAssetUrl(mapId: string, fileName: string) {
  return `${getMapAssetBaseUrl()}/${mapId}/${fileName}`
}
function getOrderedAssetFiles(entries: MapAssetEntry[] | undefined, fallback: string) {
  if (!entries || entries.length === 0) {
    return [fallback]
  }

  return [...entries]
    .sort((a, b) => a.order - b.order)
    .map((entry) => entry.file)
}

function projectWorldPositionToTerrain(position: Entity["position"], worldBounds: MapWorldBounds, terrainBounds: THREE.Box3) {
  return [
    THREE.MathUtils.clamp(terrainBounds.min.x + (position[0] - worldBounds.minX), terrainBounds.min.x, terrainBounds.max.x),
    position[1],
    THREE.MathUtils.clamp(terrainBounds.min.z + (position[2] - worldBounds.minZ), terrainBounds.min.z, terrainBounds.max.z),
  ] as Entity["position"]
}

function applyMaterialToLayer(root: THREE.Object3D, material: THREE.MeshStandardMaterial) {
  root.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.material = material.clone()
      child.castShadow = true
      child.receiveShadow = true
    }
  })
}

function createChunkLayer(chunks: THREE.Group[], name: string) {
  const layer = new THREE.Group()
  layer.name = name

  for (const chunk of chunks) {
    layer.add(chunk.clone(true))
  }

  return layer
}

function EntityMarker({
  entity,
  isSelected,
  onClick,
}: {
  entity: Entity
  isSelected: boolean
  onClick: () => void
}) {
  const meshRef = useRef<THREE.Mesh>(null)
  const [hovered, setHovered] = useState(false)
  const colorTokens = getCategoryTokens(entity.category)
  const color = colorTokens.darkHex
  const animatedPosition = useRef(new THREE.Vector3(...entity.position))
  const targetPosition = useRef(new THREE.Vector3(...entity.position))
  const blockWidth = isSelected ? 1.15 : 1
  const blockHeight = isSelected ? 2.3 : 2

  useEffect(() => {
    const nextTarget = new THREE.Vector3(...entity.position)
    if (animatedPosition.current.distanceTo(nextTarget) > 48) {
      animatedPosition.current.copy(nextTarget)
    }
    targetPosition.current.copy(nextTarget)
  }, [entity.position])

  useFrame((state, delta) => {
    if (meshRef.current) {
      const smoothingFactor = 1 - Math.exp(-8 * delta)
      animatedPosition.current.lerp(targetPosition.current, smoothingFactor)
      const verticalOffset = -blockHeight / 2 + 0.12
      const bobOffset = (Math.sin(state.clock.elapsedTime * 2) + 1) * 0.04
      meshRef.current.position.set(
        animatedPosition.current.x,
        animatedPosition.current.y + verticalOffset + bobOffset,
        animatedPosition.current.z,
      )
    }
  })

  return (
    <mesh
      ref={meshRef}
      position={animatedPosition.current}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      onPointerOver={(e) => {
        e.stopPropagation()
        setHovered(true)
        document.body.style.cursor = "pointer"
      }}
      onPointerOut={() => {
        setHovered(false)
        document.body.style.cursor = "auto"
      }}
    >
      <boxGeometry args={[blockWidth, blockHeight, blockWidth]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={hovered || isSelected ? 0.5 : 0.2}
        transparent
        opacity={hovered || isSelected ? 1 : 0.8}
      />
      {(hovered || isSelected) && (
        <Html
          position={[0, blockHeight + 1.1, 0]}
          center
          style={{
            pointerEvents: "none",
          }}
        >
          <div className="bg-popover text-popover-foreground text-[10px] px-1.5 py-0.5 rounded border border-border whitespace-nowrap">
            {entity.name}
          </div>
        </Html>
      )}
    </mesh>
  )
}

function MapModel({
  mapId,
  metadata,
  isDark,
  showBarriers = false,
  onBoundsCalculated,
}: {
  mapId: string
  metadata: MapMetadata
  isDark: boolean
  showBarriers?: boolean
  onBoundsCalculated?: (bounds: THREE.Box3) => void
}) {
  const terrainFiles = useMemo(
    () => getOrderedAssetFiles(metadata.assets?.terrain, `${mapId}.obj`),
    [mapId, metadata.assets?.terrain],
  )
  const barrierFiles = useMemo(
    () => getOrderedAssetFiles(metadata.assets?.barriers, "").filter(Boolean),
    [metadata.assets?.barriers],
  )
  const terrainPaths = useMemo(() => terrainFiles.map((file) => getMapAssetUrl(mapId, file)), [mapId, terrainFiles])
  const barrierPaths = useMemo(() => barrierFiles.map((file) => getMapAssetUrl(mapId, file)), [barrierFiles, mapId])
  const terrainChunks = useLoader(OBJLoader, terrainPaths) as THREE.Group[]
  const barrierChunks = useLoader(OBJLoader, barrierPaths) as THREE.Group[]

  const modelColor = isDark ? "#2f2f2f" : "#e5e5e5"

  const layers = useMemo(() => {
    const terrain = createChunkLayer(terrainChunks, "terrain")
    const barriers = createChunkLayer(barrierChunks, "barriers")

    applyMaterialToLayer(
      terrain,
      new THREE.MeshStandardMaterial({
        color: modelColor,
        roughness: 0.8,
        metalness: 0.1,
        side: THREE.DoubleSide,
      }),
    )

    applyMaterialToLayer(
      barriers,
      new THREE.MeshStandardMaterial({
        color: "#38bdf8",
        roughness: 0.4,
        metalness: 0,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.2,
        depthWrite: false,
      }),
    )

    return { terrain, barriers }
  }, [barrierChunks, modelColor, terrainChunks])

  useEffect(() => {
    if (onBoundsCalculated) {
      const box = new THREE.Box3().setFromObject(layers.terrain)
      onBoundsCalculated(box.clone())
    }
  }, [layers, onBoundsCalculated])

  return (
    <>
      <primitive object={layers.terrain} />
      {showBarriers ? <primitive object={layers.barriers} /> : null}
    </>
  )
}

function LoadingFallback() {
  return (
    <Html center>
      <div className="text-muted-foreground text-sm">Loading map...</div>
    </Html>
  )
}

function CameraController({
  resetTrigger,
  mapCenter,
  mapSize,
}: {
  resetTrigger: number
  mapCenter: THREE.Vector3 | null
  mapSize: THREE.Vector3 | null
}) {
  const { camera } = useThree()
  const controlsRef = useRef<any>(null)
  const hasInitialized = useRef(false)

  useEffect(() => {
    if (mapCenter && mapSize && !hasInitialized.current) {
      const maxDim = Math.max(mapSize.x, mapSize.y, mapSize.z)
      const distance = maxDim * 1.2

      camera.position.set(mapCenter.x + distance * 0.7, mapCenter.y + distance * 0.5, mapCenter.z + distance * 0.7)
      camera.lookAt(mapCenter)

      if (controlsRef.current) {
        controlsRef.current.target.copy(mapCenter)
        controlsRef.current.update()
      }
      hasInitialized.current = true
    }
  }, [mapCenter, mapSize, camera])

  useEffect(() => {
    if (resetTrigger > 0 && mapCenter && mapSize) {
      const maxDim = Math.max(mapSize.x, mapSize.y, mapSize.z)
      const distance = maxDim * 1.2

      camera.position.set(mapCenter.x + distance * 0.7, mapCenter.y + distance * 0.5, mapCenter.z + distance * 0.7)
      camera.lookAt(mapCenter)

      if (controlsRef.current) {
        controlsRef.current.target.copy(mapCenter)
        controlsRef.current.update()
      }
    }
  }, [resetTrigger, mapCenter, mapSize, camera])

  useEffect(() => {
    hasInitialized.current = false
  }, [mapCenter])

  const maxDistance = mapSize ? Math.max(mapSize.x, mapSize.y, mapSize.z) * 3 : 1000

  return (
    <OrbitControls
      makeDefault
      ref={controlsRef}
      enablePan={true}
      enableZoom={true}
      enableRotate={true}
      minDistance={1}
      maxDistance={maxDistance}
      maxPolarAngle={Math.PI / 2 - 0.01}
    />
  )
}

function Scene({
  selectedMap,
  entities,
  selectedEntity,
  onSelectEntity,
  cameraResetTrigger,
  isDark,
}: ViewportProps & { isDark: boolean }) {
  const [mapCenter, setMapCenter] = useState<THREE.Vector3 | null>(null)
  const [mapSize, setMapSize] = useState<THREE.Vector3 | null>(null)
  const [terrainBounds, setTerrainBounds] = useState<THREE.Box3 | null>(null)
  const [mapMetadata, setMapMetadata] = useState<MapMetadata | null>(null)

  const handleBoundsCalculated = useCallback((bounds: THREE.Box3) => {
    const center = bounds.getCenter(new THREE.Vector3())
    const size = bounds.getSize(new THREE.Vector3())
    setMapCenter(center)
    setMapSize(size)
    setTerrainBounds(bounds)
  }, [])

  useEffect(() => {
    setMapCenter(null)
    setMapSize(null)
    setTerrainBounds(null)
    setMapMetadata(null)
  }, [selectedMap])

  useEffect(() => {
    let cancelled = false

    const loadMapMetadata = async () => {
      try {
        const response = await fetch(getMapAssetUrl(selectedMap, "meta.json"), { cache: "no-store" })
        if (!response.ok) {
          throw new Error(`Failed to load metadata for ${selectedMap}`)
        }

        const metadata = (await response.json()) as MapMetadata
        if (!cancelled) {
          setMapMetadata(metadata)
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to load map metadata", error)
          setMapMetadata(null)
        }
      }
    }

    void loadMapMetadata()

    return () => {
      cancelled = true
    }
  }, [selectedMap])

  const renderedEntities = useMemo(() => {
    if (!terrainBounds || !mapMetadata) {
      return []
    }

    return entities.map((entity) => ({
      ...entity,
      position: projectWorldPositionToTerrain(entity.position, mapMetadata.bounds, terrainBounds),
    }))
  }, [entities, mapMetadata, terrainBounds])

  return (
    <>
      <PerspectiveCamera makeDefault position={[200, 150, 200]} fov={50} />
      <CameraController resetTrigger={cameraResetTrigger} mapCenter={mapCenter} mapSize={mapSize} />

      <ambientLight intensity={isDark ? 0.4 : 0.6} />
      <directionalLight position={[100, 200, 100]} intensity={isDark ? 0.6 : 0.8} castShadow />
      <pointLight position={[-100, 100, -100]} intensity={isDark ? 0.3 : 0.4} />

      <Suspense fallback={<LoadingFallback />}>
        {mapMetadata ? (
          <MapModel
            key={selectedMap}
            mapId={selectedMap}
            metadata={mapMetadata}
            isDark={isDark}
            onBoundsCalculated={handleBoundsCalculated}
          />
        ) : null}
      </Suspense>

      {renderedEntities.map((entity) => (
        <EntityMarker
          key={entity.id}
          entity={entity}
          isSelected={selectedEntity?.id === entity.id}
          onClick={() => onSelectEntity(selectedEntity?.id === entity.id ? null : entity)}
        />
      ))}
    </>
  )
}

export function Viewport({ selectedMap, entities, selectedEntity, onSelectEntity, cameraResetTrigger }: ViewportProps) {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const isDark = mounted ? resolvedTheme === "dark" : true
  const bgColor = isDark ? "#0d0d0d" : "#f5f5f5"

  return (
    <div className="absolute inset-0 bg-background" onContextMenu={(e) => e.preventDefault()}>
      <Canvas
        shadows
        gl={{ antialias: true }}
        style={{ width: "100%", height: "100%", background: bgColor, touchAction: "none", userSelect: "none" }}
        onPointerMissed={() => onSelectEntity(null)}
      >
        <Suspense fallback={null}>
          <Scene
            selectedMap={selectedMap}
            entities={entities}
            selectedEntity={selectedEntity}
            onSelectEntity={onSelectEntity}
            cameraResetTrigger={cameraResetTrigger}
            isDark={isDark}
          />
        </Suspense>
      </Canvas>

      <div className="absolute bottom-3 left-3 text-[10px] text-muted-foreground font-mono bg-card/80 px-2 py-1 rounded border border-border">
        Pan: Right Click | Rotate: Left Click | Zoom: Scroll
      </div>
    </div>
  )
}







