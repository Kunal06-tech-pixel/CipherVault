import { useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Float, MeshTransmissionMaterial, Sparkles } from '@react-three/drei'
import * as THREE from 'three'

function KeyShard({ index, total }: { index: number; total: number }) {
  const meshRef = useRef<THREE.Mesh>(null)
  const radius = 2.4
  const angle = (index / total) * Math.PI * 2
  
  useFrame((state) => {
    if (!meshRef.current) return
    const t = state.clock.getElapsedTime() * 0.8 + index
    meshRef.current.position.x = Math.cos(angle + t * 0.3) * radius
    meshRef.current.position.z = Math.sin(angle + t * 0.3) * radius
    meshRef.current.position.y = Math.sin(t * 1.5 + index) * 0.35
    meshRef.current.rotation.x = t * 0.5
    meshRef.current.rotation.y = t * 0.8
  })

  return (
    <mesh ref={meshRef} scale={0.28}>
      <octahedronGeometry args={[1, 0]} />
      <meshStandardMaterial
        color="#06b6d4"
        emissive="#0891b2"
        emissiveIntensity={0.8}
        roughness={0.2}
        metalness={0.9}
      />
    </mesh>
  )
}

function VaultCore() {
  const groupRef = useRef<THREE.Group>(null)
  const outerCubeRef = useRef<THREE.Mesh>(null)
  const innerCoreRef = useRef<THREE.Mesh>(null)
  const lockRingRef = useRef<THREE.Group>(null)
  const [hovered, setHovered] = useState(false)
  const { viewport, pointer } = useThree()

  useFrame((state) => {
    const t = state.clock.getElapsedTime()
    
    // Smooth lerp tilt toward cursor pointer
    if (groupRef.current) {
      const targetX = (pointer.y * viewport.height) / 8
      const targetY = (pointer.x * viewport.width) / 8
      groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, -targetX * 0.15, 0.05)
      groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, targetY * 0.2 + t * 0.1, 0.05)
    }

    if (outerCubeRef.current) {
      outerCubeRef.current.rotation.z = Math.sin(t * 0.5) * 0.05
    }

    if (innerCoreRef.current) {
      innerCoreRef.current.rotation.y = -t * 0.6
      innerCoreRef.current.rotation.x = t * 0.3
    }

    if (lockRingRef.current) {
      lockRingRef.current.rotation.z = t * 0.4
    }
  })

  return (
    <group
      ref={groupRef}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      {/* Outer Glassmorphic Vault Frame */}
      <mesh ref={outerCubeRef} scale={hovered ? 1.08 : 1.0}>
        <boxGeometry args={[2.2, 2.2, 2.2]} />
        <MeshTransmissionMaterial
          backside
          samples={4}
          thickness={0.5}
          chromaticAberration={0.06}
          anisotropy={0.1}
          distortion={0.1}
          distortionScale={0.2}
          temporalDistortion={0.1}
          clearcoat={1}
          attenuationDistance={0.5}
          attenuationColor="#0284c7"
          color="#0f172a"
          roughness={0.15}
        />
      </mesh>

      {/* Internal Metallic Core Cube */}
      <mesh ref={innerCoreRef} scale={0.9}>
        <boxGeometry args={[1.2, 1.2, 1.2]} />
        <meshStandardMaterial
          color="#1e293b"
          metalness={0.95}
          roughness={0.1}
          wireframe
        />
      </mesh>

      {/* Center Glowing Energy Sphere (The Encryption Key Core) */}
      <mesh scale={0.45}>
        <sphereGeometry args={[1, 32, 32]} />
        <meshStandardMaterial
          color={hovered ? '#ec4899' : '#38bdf8'}
          emissive={hovered ? '#db2777' : '#0284c7'}
          emissiveIntensity={hovered ? 2.5 : 1.8}
          roughness={0.1}
        />
      </mesh>

      {/* Outer Lock Status Rings */}
      <group ref={lockRingRef}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.6, 0.04, 16, 64]} />
          <meshStandardMaterial color="#06b6d4" emissive="#0284c7" emissiveIntensity={1} />
        </mesh>
        <mesh rotation={[0, Math.PI / 2, 0]}>
          <torusGeometry args={[1.8, 0.03, 16, 64]} />
          <meshStandardMaterial color="#6366f1" emissive="#4f46e5" emissiveIntensity={0.8} />
        </mesh>
      </group>
    </group>
  )
}

export function HeroVaultScene() {
  const shardsCount = 7
  return (
    <>
      <Float speed={2} rotationIntensity={0.5} floatIntensity={0.8}>
        <VaultCore />
      </Float>

      {Array.from({ length: shardsCount }).map((_, i) => (
        <KeyShard key={i} index={i} total={shardsCount} />
      ))}

      <Sparkles count={40} scale={6} size={3} speed={0.4} color="#38bdf8" />
    </>
  )
}
