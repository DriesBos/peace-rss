"use client";

import dynamic from "next/dynamic";

const KomorebiShader = dynamic(() => import("./KomorebiShader"), {
  ssr: false,
});

interface KomorebiShaderClientProps {
  intensity?: number;
  speed?: number;
  scale1?: number;
  scale2?: number;
  softness?: number;
  textureUrl?: string;
  className?: string;
}

export default function KomorebiShaderClient(props: KomorebiShaderClientProps) {
  return <KomorebiShader {...props} />;
}
