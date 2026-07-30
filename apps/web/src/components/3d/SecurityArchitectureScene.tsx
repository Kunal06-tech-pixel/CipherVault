import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Float, Text } from '@react-three/drei'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import * as THREE from 'three'

gsap.registerPlugin(ScrollTrigger)

function Node1ClientSide() {
  const meshRef = useRef<THREE.Group>(null)

  useFrame((state) => {
    if (!meshRef.current) return
    meshRef.current.rotation.y = state.clock.getElapsedTime() * 0.4
  })

  return (
    <group position={[-3, 0, 0]} ref={meshRef}>
      {/* Encryption Key Shield */}
      <mesh>
        <octahedronGeometry args={[1.2, 1]} />
        <meshStandardMaterial color="#0284c7" emissive="#0369a1" emissiveIntensity={0.6} wireframe />
      </mesh>
      <mesh scale={0.7}>
        <dodecahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color="#38bdf8" metalness={0.9} roughness={0.1} />
      </mesh>
    </group>
  )
}

function Node2ZeroKnowledge() {
  const tunnelRef = useRef<THREE.Group>(null)

  useFrame((state) => {
    if (!tunnelRef.current) return
    const t = state.clock.getElapsedTime()
    tunnelRef.current.rotation.z = t * 0.3
  })

  return (
    <group position={[0, 0, -2]} ref={tunnelRef}>
      {/* Zero Knowledge Tunnel Rings */}
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} position={[0, 0, (i - 1.5) * 0.8]}>
          <torusGeometry args={[1.2 + i * 0.15, 0.05, 16, 32]} />
          <meshStandardMaterial
            color={i % 2 === 0 ? '#818cf8' : '#c084fc'}
            emissive={i % 2 === 0 ? '#4f46e5' : '#9333ea'}
            emissiveIntensity={1}
          />
        </mesh>
      ))}
      <mesh scale={0.5}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#a855f7" wireframe />
      </mesh>
    </group>
  )
}

function Node3LocalFirst() {
  const dbRef = useRef<THREE.Group>(null)

  useFrame((state) => {
    if (!dbRef.current) return
    dbRef.current.rotation.y = -state.clock.getElapsedTime() * 0.3
  })

  return (
    <group position={[3, 0, 0]} ref={dbRef}>
      {/* Database Cylinder Stack */}
      {[-0.6, 0, 0.6].map((y, i) => (
        <mesh key={i} position={[0, y, 0]}>
          <cylinderGeometry args={[1, 1, 0.35, 32]} />
          <meshStandardMaterial color="#10b981" metalness={0.8} roughness={0.2} />
        </mesh>
      ))}
      <mesh position={[0, 0, 0]} scale={1.1}>
        <cylinderGeometry args={[1.1, 1.1, 1.8, 16]} />
        <meshStandardMaterial color="#34d399" wireframe opacity={0.3} transparent />
      </mesh>
    </group>
  )
}

export function SecurityArchitectureScene() {
  const { camera } = useThree()
  const sceneGroupRef = useRef<THREE.Group>(null)

  useEffect(() => {
    const trigger = ScrollTrigger.create({
      trigger: '#security',
      start: 'top bottom',
      end: 'bottom top',
      scrub: 1.2,
      onUpdate: (self) => {
        const progress = self.progress
        // Camera trajectory along the 3 nodes: [-3, 0, 3]
        const camX = THREE.MathUtils.lerp(-3.5, 3.5, progress)
        const camZ = THREE.MathUtils.lerp(4.5, 3.5, Math.sin(progress * Math.PI))
        
        gsap.to(camera.position, {
          x: camX,
          y: Math.sin(progress * Math.PI * 2) * 0.8 + 0.5,
          z: camZ,
          duration: 0.2,
          overwrite: 'auto',
          onUpdate: () => {
            camera.lookAt(camX * 0.7, 0, 0)
          },
        })
      },
    })

    return () => {
      trigger.kill()
    }
  }, [camera])

  return (
    <group ref={sceneGroupRef}>
      <Float speed={1.5} floatIntensity={0.5}>
        <Node1ClientSide />
        <Node2ZeroKnowledge />
        <Node3LocalFirst />
      </Float>
    </group>
  )
}
