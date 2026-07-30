import { useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'

interface LockMeshProps {
  isLocked: boolean
}

function LockMesh({ isLocked }: LockMeshProps) {
  const groupRef = useRef<THREE.Group>(null)
  const shackleRef = useRef<THREE.Mesh>(null)

  useFrame((state) => {
    if (!groupRef.current) return
    const t = state.clock.getElapsedTime()
    groupRef.current.rotation.y = t * 0.8

    if (shackleRef.current) {
      const targetY = isLocked ? 0.35 : 0.65
      const targetRotZ = isLocked ? 0 : Math.PI * 0.25
      shackleRef.current.position.y = THREE.MathUtils.lerp(shackleRef.current.position.y, targetY, 0.1)
      shackleRef.current.rotation.z = THREE.MathUtils.lerp(shackleRef.current.rotation.z, targetRotZ, 0.1)
    }
  })

  return (
    <group ref={groupRef}>
      {/* Padlock Body */}
      <mesh position={[0, -0.2, 0]}>
        <boxGeometry args={[0.8, 0.7, 0.4]} />
        <meshStandardMaterial
          color={isLocked ? '#f59e0b' : '#10b981'}
          emissive={isLocked ? '#d97706' : '#059669'}
          emissiveIntensity={0.8}
          metalness={0.9}
          roughness={0.2}
        />
      </mesh>

      {/* Padlock Shackle */}
      <mesh ref={shackleRef} position={[0, 0.35, 0]}>
        <torusGeometry args={[0.25, 0.07, 16, 32, Math.PI]} />
        <meshStandardMaterial color="#e2e8f0" metalness={0.95} roughness={0.1} />
      </mesh>
    </group>
  )
}

export function LockStatus3D({ isLocked = true, size = 48 }: { isLocked?: boolean; size?: number }) {
  return (
    <div style={{ width: size, height: size, display: 'inline-block', verticalAlign: 'middle' }}>
      <Canvas camera={{ position: [0, 0.2, 2.2], fov: 45 }} gl={{ antialias: true, alpha: true }}>
        <ambientLight intensity={0.8} />
        <directionalLight position={[3, 5, 4]} intensity={1.5} />
        <LockMesh isLocked={isLocked} />
      </Canvas>
    </div>
  )
}
