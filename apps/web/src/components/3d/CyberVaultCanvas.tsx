import React, { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { Environment, Preload } from '@react-three/drei'

interface CyberVaultCanvasProps {
  children: React.ReactNode
  className?: string
  cameraPosition?: [number, number, number]
  fov?: number
  frameloop?: 'always' | 'demand'
}

export function CyberVaultCanvas({
  children,
  className = '',
  cameraPosition = [0, 1.5, 6],
  fov = 50,
  frameloop = 'always',
}: CyberVaultCanvasProps) {
  return (
    <div className={`cyber-vault-canvas-container ${className}`} style={{ width: '100%', height: '100%', position: 'relative' }}>
      <Canvas
        frameloop={frameloop}
        dpr={[1, 2]}
        camera={{ position: cameraPosition, fov }}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        style={{ pointerEvents: 'auto' }}
      >
        <ambientLight intensity={0.6} />
        <directionalLight position={[10, 15, 10]} intensity={1.5} castShadow />
        <directionalLight position={[-10, -10, -5]} intensity={0.4} color="#3b82f6" />
        <pointLight position={[0, 0, 3]} intensity={1.2} color="#06b6d4" />
        
        <Suspense fallback={null}>
          <Environment preset="city" />
          {children}
          <Preload all />
        </Suspense>
      </Canvas>
    </div>
  )
}
