/**
 * AssetCache — global registry of already parsed GLTFs.
 *
 * BackgroundLoader stores all preloaded assets here.
 * Game modules (Character, CityBuilder, etc.) check
 * this cache before making a network request, achieving
 * instant loading when starting the world.
 */
export const AssetCache = {
    _cache: new Map(),

    set(url, gltf) {
        this._cache.set(url, gltf);
    },

    get(url) {
        return this._cache.get(url);
    },

    has(url) {
        return this._cache.has(url);
    },

    delete(url) {
        this._cache.delete(url);
    },

    clear() {
        this._cache.clear();
    }
};
