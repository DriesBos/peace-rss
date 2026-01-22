"use client";

import { useRef, useEffect, useMemo, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import vertexShader from "./shaders/vertex.glsl";
import fragmentShader from "./shaders/fragment.glsl";

interface KomorebiShaderProps {
  className?: string;
  intensity?: number;
  speed?: number;
  textureUrl?: string;
  scale1?: number;
  scale2?: number;
  softness?: number;
}

function ShaderPlane({
  intensity = 1.0,
  speed = 1.0,
  scale1 = 2.5,
  scale2 = 4.0,
  softness = 0.5,
  texture,
}: {
  intensity: number;
  speed: number;
  scale1: number;
  scale2: number;
  softness: number;
  texture: THREE.Texture;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const { size } = useThree();

  const uniforms = useMemo(
    () => ({
      iTime: { value: 0 },
      iResolution: { value: new THREE.Vector3(size.width, size.height, 1) },
      iMouse: { value: new THREE.Vector4(0, 0, 0, 0) },
      iChannel0: { value: texture },
      uIntensity: { value: intensity },
      uSpeed: { value: speed },
      uScale1: { value: scale1 },
      uScale2: { value: scale2 },
      uSoftness: { value: softness },
    }),
    [texture, intensity, speed, scale1, scale2, softness, size.width, size.height]
  );

  useEffect(() => {
    uniforms.iResolution.value.set(size.width, size.height, 1);
  }, [size, uniforms]);

  useEffect(() => {
    uniforms.uIntensity.value = intensity;
    uniforms.uSpeed.value = speed;
    uniforms.uScale1.value = scale1;
    uniforms.uScale2.value = scale2;
    uniforms.uSoftness.value = softness;
  }, [intensity, speed, scale1, scale2, softness, uniforms]);

  useFrame((state) => {
    if (meshRef.current) {
      const material = meshRef.current.material as THREE.ShaderMaterial;
      material.uniforms.iTime.value = state.clock.elapsedTime;
    }
  });

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      if (meshRef.current) {
        const material = meshRef.current.material as THREE.ShaderMaterial;
        material.uniforms.iMouse.value.set(
          event.clientX,
          size.height - event.clientY,
          1,
          0
        );
      }
    };

    window.addEventListener("pointermove", handlePointerMove);
    return () => window.removeEventListener("pointermove", handlePointerMove);
  }, [size.height]);

  return (
    <mesh ref={meshRef}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        transparent={true}
        depthWrite={false}
        depthTest={false}
      />
    </mesh>
  );
}

function createNoiseTexture(): THREE.DataTexture {
  const size = 128;
  const data = new Uint8Array(size * size * 4);

  for (let i = 0; i < size * size; i++) {
    const stride = i * 4;
    const value = Math.random() * 255;
    data[stride] = value;
    data[stride + 1] = value;
    data[stride + 2] = value;
    data[stride + 3] = 255;
  }

  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;

  return texture;
}

export default function KomorebiShader({
  intensity = 0.3,
  speed = 0.2,
  textureUrl,
  scale1 = 2.5,
  scale2 = 4.0,
  softness = 0.5,
}: KomorebiShaderProps) {
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    if (textureUrl) {
      const loader = new THREE.TextureLoader();
      loader.load(
        textureUrl,
        (loadedTexture) => {
          loadedTexture.wrapS = THREE.RepeatWrapping;
          loadedTexture.wrapT = THREE.RepeatWrapping;
          loadedTexture.minFilter = THREE.LinearMipMapLinearFilter;
          loadedTexture.magFilter = THREE.LinearFilter;
          setTexture(loadedTexture);
        },
        undefined,
        () => {
          console.warn("Failed to load texture, using fallback noise texture");
          setTexture(createNoiseTexture());
        }
      );
    } else {
      setTexture(createNoiseTexture());
    }
  }, [textureUrl]);

  if (!texture) {
    return null;
  }

  const effectiveSpeed = prefersReducedMotion ? 0 : speed;

  return (
    <div className={styles.komorebiShader}>
      <Canvas
        orthographic
        camera={{ position: [0, 0, 1], zoom: 1 }}
        gl={{
          alpha: true,
          antialias: false,
          powerPreference: "high-performance",
        }}
        dpr={[1, 1.5]}
      >
        <ShaderPlane
          intensity={intensity}
          speed={effectiveSpeed}
          scale1={scale1}
          scale2={scale2}
          softness={softness}
          texture={texture}
        />
      </Canvas>
    </div>
  );
}
