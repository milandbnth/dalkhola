/**
 * Dalkhola Online - Shared Data Loader
 *
 * Compatible with GitHub Pages, project sub-paths and custom domains.
 * The site root is derived from this script's own URL, so the portal
 * works whether it is served from / or from /repo-name/.
 *
 * Usage:
 * const data = await PortalData.load("services");
 */

(function (window) {
    "use strict";

    const scriptSrc =
        (document.currentScript && document.currentScript.src) || "";

    const BASE_URL = scriptSrc
        ? new URL("../../", scriptSrc)
        : new URL("/", window.location.href);

    const REGISTRY_URL = new URL("data/modules.json", BASE_URL).href;

    let registryPromise = null;

    const cache = new Map();

    /**
     * Resolve a module data_url against the detected site root, so that
     * values such as "/data/dalkhola.json" keep working from a sub-path.
     */
    function resolveUrl(url) {
        const value = String(url || "");

        if (/^https?:\/\//i.test(value)) {
            return value;
        }

        return new URL(value.replace(/^\/+/, ""), BASE_URL).href;
    }

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
            const data = await fetchJSON(resolveUrl(module.data_url));

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
