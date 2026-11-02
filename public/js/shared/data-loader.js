/**
 * Dalkhola Online - Shared Data Loader
 *
 * Compatible with GitHub Pages and custom domains.
 *
 * Usage:
 * const data = await PortalData.load("services");
 */

(function (window) {
    "use strict";

    const REGISTRY_URL = "/data/modules.json";

    let registryPromise = null;

    const cache = new Map();

    /**
     * Fetch JSON from a URL.
     */
    async function fetchJSON(url) {
        const response = await fetch(url, {
            headers: {
                Accept: "application/json"
            }
        });

        if (!response.ok) {
            throw new Error(
                `Failed to load ${url}: HTTP ${response.status}`
            );
        }

        return response.json();
    }

    /**
     * Load the public module registry.
     */
    async function getRegistry(forceRefresh = false) {
        if (forceRefresh) {
            registryPromise = null;
        }

        if (!registryPromise) {
            registryPromise = fetchJSON(REGISTRY_URL)
                .catch(error => {
                    registryPromise = null;
                    throw error;
                });
        }

        return registryPromise;
    }

    /**
     * Find a registered module.
     */
    async function getModule(moduleId) {
        const registry = await getRegistry();

        const module = registry.modules?.find(
            item => item.id === moduleId
        );

        if (!module) {
            throw new Error(
                `Module "${moduleId}" is not registered.`
            );
        }

        if (!module.enabled) {
            throw new Error(
                `Module "${moduleId}" is disabled.`
            );
        }

        return module;
    }

    /**
     * Load a module's published JSON.
     */
    async function load(moduleId, options = {}) {
        const { forceRefresh = false } = options;

        if (!forceRefresh && cache.has(moduleId)) {
            return cache.get(moduleId);
        }

        const module = await getModule(moduleId);

        try {
            const data = await fetchJSON(module.data_url);

            cache.set(moduleId, data);

            return data;

        } catch (error) {
            throw new Error(
                `Unable to load ${module.title}: ${error.message}`
            );
        }
    }

    /**
     * Load all enabled modules.
     */
    async function loadAll() {
        const registry = await getRegistry();

        const enabledModules = registry.modules.filter(
            module => module.enabled
        );

        const results = await Promise.all(
            enabledModules.map(async module => {
                try {
                    return {
                        id: module.id,
                        data: await load(module.id),
                        error: null
                    };
                } catch (error) {
                    return {
                        id: module.id,
                        data: null,
                        error: error.message
                    };
                }
            })
        );

        return results;
    }

    /**
     * Clear cached module data.
     */
    function clearCache(moduleId) {
        if (moduleId) {
            cache.delete(moduleId);
        } else {
            cache.clear();
        }
    }

    /**
     * Public API.
     */
    window.PortalData = Object.freeze({
        load,
        loadAll,
        getModule,
        getRegistry,
        clearCache
    });

})(window);