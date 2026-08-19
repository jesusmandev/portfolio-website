/**
 * BackgroundLoader — carga silenciosa de todos los assets del mundo.
 * BackgroundLoader — silent loading of all world assets.
 *
 * PERFORMANCE STRATEGY:
 *  - Assets are loaded in SERIES (one at a time) instead of in parallel.
 *    This prevents saturating the main thread with multiple simultaneous GLB parses
 *    that generate long tasks (>500ms) and V8 Major GC.
 *  - Control is yielded to the browser between assets with a small yield
 *    (setTimeout 0) so it can process UI events and keep the
 *    loading screen responsive.
 *  - THREE.Cache is enabled so game modules reuse
 *    already decoded data without a second network request.
 */
import * as THREE from 'three';
import { GLTFLoader }     from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { AssetCache }     from './AssetCache.js';

// ── 3D World Assets (order = loading priority) ──────────────────
// weight: relative weight for visual progress calculation.
const WORLD_ASSETS = [
    { url: '/personaje/model.glb',                    weight:  6 },  // smaller first → game ready sooner
    { url: '/base/Base.glb',                          weight:  1 },
    { url: '/estatua/estatua-v1.glb',                 weight:  4 },  // central park statue (meshopt)
    { url: '/big tree/ARBOL Gigantesco.glb',          weight:  3 },  // decorative big tree
];

const TOTAL_WEIGHT = WORLD_ASSETS.reduce((s, a) => s + a.weight, 0);
const ASSET_YIELD_MS = 350;
const MIN_LOAD_TIME_MS = 5000;

export class BackgroundLoader {
    constructor() {
        // Global cache: network responses remain in memory.
        THREE.Cache.enabled = true;

        this._weightLoaded = 0;
        this._onProgress   = null;
        this._onComplete   = null;
        this._startTime    = 0;
    }

    /**
     * Starts the sequential preload of all assets.
     * @param {function(number):void} onProgress  value 0-1
     * @param {function(object):void} onComplete  receives AssetCache
     */
    start(onProgress, onComplete) {
        this._onProgress = onProgress;
        this._onComplete = onComplete;
        this._startTime = performance.now();

        onProgress(0);

        // Start the sequential chain
        this._loadNext(0);
    }

    // ── Recursive loading one by one ─────────────────────────────────────
    _loadNext(index) {
        if (index >= WORLD_ASSETS.length) {
            const elapsed = performance.now() - this._startTime;
            const remaining = Math.max(0, MIN_LOAD_TIME_MS - elapsed);

            // Keep loading screen visible a bit longer so the map
            // finishes preparing everything and the first frame doesn't arrive with lag spikes.
            setTimeout(() => {
                if (this._onComplete) this._onComplete(AssetCache);
            }, remaining + 350);
            return;
        }

        const asset = WORLD_ASSETS[index];
        const baseUrl = import.meta.env.BASE_URL.replace(/\/$/, ''); // clean trailing /
        const fullUrl = `${baseUrl}${asset.url}`;

        const loader = new GLTFLoader();
        loader.setMeshoptDecoder(MeshoptDecoder);

        loader.load(
            fullUrl,
            (gltf) => {
                // Store in cache using the url without prefix so the game finds it the same way
                AssetCache.set(asset.url, gltf);
                this._reportProgress(asset.weight);

                // Give more breathing room between assets so as not to saturate the main thread
                // or trigger GC spikes when loading several GLBs in a row.
                setTimeout(() => this._loadNext(index + 1), ASSET_YIELD_MS);
            },
            undefined, // no individual progress callback
            (err) => {
                console.warn(`[BackgroundLoader] Could not load: ${fullUrl}`, err);
                this._reportProgress(asset.weight);
                setTimeout(() => this._loadNext(index + 1), ASSET_YIELD_MS);
            }
        );
    }

    _reportProgress(weight) {
        this._weightLoaded += weight;
        const progress = Math.min(this._weightLoaded / TOTAL_WEIGHT, 1);
        if (this._onProgress) this._onProgress(progress);
    }
}
