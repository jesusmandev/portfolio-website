/**
 * DeviceTierManager.js — Detección de nivel de rendimiento del dispositivo (Tiering)
 *
 * Clasifica los dispositivos en 'low', 'medium' o 'high' inspeccionando:
 * - Movil vs Computador (UserAgent)
 * - GPU (vía WebGL debug info: Mali, Adreno, PowerVR, etc.)
 * - Memoria disponible y Núcleos de CPU (navigator.hardwareConcurrency / deviceMemory)
 */

export function detectDeviceTier() {
    const userAgent = navigator.userAgent || '';
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);

    let gpuRenderer = '';
    let maxTextureSize = 8192;

    try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
        if (gl) {
            const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
            if (debugInfo) {
                gpuRenderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || '';
            }
            maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE) || 8192;
        }
    } catch (e) {
        console.warn('[DeviceTier] No se pudo obtener información extendida de WebGL:', e);
    }

    const gpuLower = gpuRenderer.toLowerCase();
    const cores = navigator.hardwareConcurrency || 4;
    const mem = navigator.deviceMemory || 4; // GB aproximados si el navegador lo soporta

    // GPUs de teléfonos de gama baja o de rendimiento limitado
    const isLowEndGPU = /powervr|mali-g3|mali-g5|mali-4|adreno 61|adreno 60|adreno 5|adreno 4|swiftshader|llvmpipe/i.test(gpuLower);

    let tier = 'high';

    if (isMobile) {
        if (isLowEndGPU || maxTextureSize < 4096 || cores <= 4 || mem <= 4) {
            tier = 'low';
        } else {
            tier = 'medium';
        }
    } else {
        // Computadores (Windows, Mac, Linux)
        tier = 'high';
    }

    console.log(`[DeviceTier] Dispositivo detectado -> Movil: ${isMobile} | Tier: ${tier} | Cores: ${cores} | RAM ~${mem}GB | GPU: ${gpuRenderer || 'desconocida'}`);

    return {
        tier,
        isMobile,
        gpuRenderer,
        maxTextureSize,
        cores,
        mem
    };
}

export const TIER_CONFIG = {
    low: {
        tierName: 'Gama Baja (Móvil Entrada)',
        pixelRatio: 1.5,
        shadows: false,
        shadowMapSize: 512,
        maxGrassBlades: 8000,
        treeDensityFactor: 0.35,
        bushDensityFactor: 0.40,
        foliageClumpFactor: 0.22,
        foliagePlanesFactor: 0.25,
        planeSizeMult: 1.30,
        castFoliageShadows: false,
        simplifiedWind: true,
    },
    medium: {
        tierName: 'Gama Media (Móvil/Tablet)',
        pixelRatio: Math.min(window.devicePixelRatio || 1, 1.25),
        shadows: true,
        shadowMapSize: 512,
        maxGrassBlades: 25000,
        treeDensityFactor: 0.65,
        bushDensityFactor: 0.70,
        foliageClumpFactor: 0.40,
        foliagePlanesFactor: 0.45,
        planeSizeMult: 1.15,
        castFoliageShadows: false,
        simplifiedWind: true,
    },
    high: {
        tierName: 'Gama Alta (Desktop/Mac)',
        pixelRatio: 1.0, // Mantener 1.0 como estaba configurado en Game.js para consistencia
        shadows: true,
        shadowMapSize: 1024,
        maxGrassBlades: 70000,
        treeDensityFactor: 1.0,
        bushDensityFactor: 1.0,
        foliageClumpFactor: 1.0,
        foliagePlanesFactor: 1.0,
        planeSizeMult: 1.0,
        castFoliageShadows: true,
        simplifiedWind: false,
    }
};

export function getDeviceTierConfig() {
    const info = detectDeviceTier();
    const config = TIER_CONFIG[info.tier] || TIER_CONFIG.high;
    return {
        ...info,
        config
    };
}
