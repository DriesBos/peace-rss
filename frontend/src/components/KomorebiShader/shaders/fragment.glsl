precision highp float;

uniform vec3 iResolution;
uniform float iTime;
uniform vec4 iMouse;
uniform sampler2D iChannel0;
uniform float uIntensity;
uniform float uSpeed;
uniform float uScale1;
uniform float uScale2;
uniform float uSoftness;

varying vec2 vUv;

// Mirror/tile texture coordinates for seamless tiling
vec2 mirror(vec2 m)
{
    vec2 f = fract(m * 0.5) * 2.0;
    return vec2(1.0) - abs(vec2(1.0) - f);
}

// Simple 2D rotation matrix
mat2 rot2D(float angle)
{
    float s = sin(angle);
    float c = cos(angle);
    return mat2(c, -s, s, c);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord)
{
    // Normalize coordinates
    vec2 uv = fragCoord / iResolution.xy;
    
    // Aspect-corrected coordinates for rotation
    vec2 p = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
    
    // Animated time with speed control
    float t = iTime * uSpeed;
    
    // Slow drift motion (simulates wind/sun movement)
    vec2 drift1 = vec2(0.03, 0.02) * t;
    vec2 drift2 = vec2(-0.02, 0.025) * t;
    
    // Subtle rotation over time
    float angle = t * 0.05;
    mat2 rotation = rot2D(angle);
    
    // Layer 1: Larger leaf clusters
    // Use aspect-corrected coordinates for proper scaling
    vec2 uv1 = (p * uScale1) + drift1;
    uv1 = (rotation * uv1);
    float n1 = texture(iChannel0, mirror(uv1)).r;
    
    // Layer 2: Smaller leaf details
    vec2 uv2 = (p * uScale2) - drift2 * 0.7;
    uv2 = rot2D(-angle * 0.6) * uv2;
    float n2 = texture(iChannel0, mirror(uv2)).r;
    
    // Layer 3: Very fine detail (almost static)
    vec2 uv3 = (p * (uScale1 * 1.5)) + drift1 * 0.3;
    float n3 = texture(iChannel0, mirror(uv3)).r;
    
    // Combine layers with different weights
    float n = 0.5 * n1 + 0.3 * n2 + 0.2 * n3;
    
    // Add slight vignette effect from center (more shadows at edges)
    float vignette = 1.0 - length(p) * 0.15;
    n *= vignette;
    
    // Shape into organic "leaf shadow" blobs with soft edges
    float thresholdLow = 0.35 - uSoftness * 0.1;
    float thresholdHigh = 0.65 + uSoftness * 0.1;
    float mask = smoothstep(thresholdLow, thresholdHigh, n);
    
    // Convert to shadow: darker where mask is low (shadow areas)
    // Output as black with alpha for proper blending
    float shadow = (1.0 - mask) * uIntensity;
    
    // Output black with alpha (for multiply blend or normal alpha blend)
    fragColor = vec4(0.0, 0.0, 0.0, shadow);
}

void main() {
  vec2 fragCoord = vUv * iResolution.xy;
  vec4 fragColor;
  mainImage(fragColor, fragCoord);
  
  gl_FragColor = fragColor;
}
