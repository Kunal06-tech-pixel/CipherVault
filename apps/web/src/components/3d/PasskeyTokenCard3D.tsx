import { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { RoundedBox } from '@react-three/drei'
import * as THREE from 'three'

interface PasskeyTokenCard3DProps {
  title?: string
  active?: boolean
}

export function PasskeyTokenCard3D({ active = false }: PasskeyTokenCard3DProps) {
  const cardGroupRef = useRef<THREE.Group>(null)
  const [hovered, setHovered] = useState(false)
  const [clicked, setClicked] = useState(false)

  useFrame((state) => {
    if (!cardGroupRef.current) return
    const t = state.clock.getElapsedTime()
    
    // Continuous idle floating + rotation
    const baseRotY = Math.sin(t * 0.8) * 0.25
    const baseRotX = Math.cos(t * 0.6) * 0.1
    
    cardGroupRef.current.rotation.y = THREE.MathUtils.lerp(
      cardGroupRef.current.rotation.y,
      hovered ? baseRotY + Math.PI * 0.2 : baseRotY,
      0.1
    )
    
    cardGroupRef.current.rotation.x = THREE.MathUtils.lerp(
      cardGroupRef.current.rotation.x,
      clicked ? baseRotX + 0.3 : baseRotX,
      0.1
    )

    cardGroupRef.current.position.y = Math.sin(t * 1.5) * 0.1
  })

  return (
    <group
      ref={cardGroupRef}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
      onClick={() => setClicked(!clicked)}
      scale={hovered ? 1.08 : 1.0}
    >
      {/* Main Token Body (Hardware Passkey Card) */}
      <RoundedBox args={[2.4, 3.6, 0.15]} radius={0.12} smoothness={4}>
        <meshStandardMaterial
          color="#0f172a"
          metalness={0.9}
          roughness={0.2}
          envMapIntensity={1.5}
        />
      </RoundedBox>

      {/* Golden Metallic Contact Chip */}
      <mesh position={[-0.5, 0.8, 0.08]}>
        <boxGeometry args={[0.5, 0.6, 0.02]} />
        <meshStandardMaterial color="#fbbf24" metalness={0.95} roughness={0.1} />
      </mesh>

      {/* Glowing Security Badge / NFC Ring Emblem */}
      <mesh position={[0, -0.6, 0.08]}>
        <ringGeometry args={[0.4, 0.5, 32]} />
        <meshStandardMaterial
          color={hovered || active ? '#38bdf8' : '#6366f1'}
          emissive={hovered || active ? '#0284c7' : '#4f46e5'}
          emissiveIntensity={1.5}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Central Key Icon Mesh */}
      <mesh position={[0, -0.6, 0.09]}>
        <circleGeometry args={[0.2, 32]} />
        <meshStandardMaterial color="#06b6d4" emissive="#0891b2" emissiveIntensity={1} />
      </mesh>
    </group>
  )
}
