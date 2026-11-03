/**
 * Dalkhola Online — Universal Search
 * Searches all enabled modules using the shared PortalData loader.
 */

(function () {
    "use strict";

    const input = document.getElementById("portal-search");
    const resultsBox = document.getElementById("portal-search-results");

    if (!input || !resultsBox) {
        console.warn("Portal search: required HTML elements not found.");
        return;
    }

    const EXCLUDED_FIELDS = new Set([
        "metadata",
        "id",
        "image",
        "image_url",
        "url",
        "last_updated"
    ]);

    let searchIndex = null;
    let loadingPromise = null;
    let debounceTimer = null;

    // Search result styles. No existing stylesheet needs to change.
    const style = document.createElement("style");

    style.textContent = `
        #portal-search-results {
            display: none;
            width: 100%;
            max-width: 680px;
            margin: -16px 0 24px;
            padding: 14px;
            background: #ffffff;
            border: 1px solid #dbe2ea;
            border-radius: 14px;
            box-shadow: 0 8px 28px rgba(0,0,0,0.08);
            color: #172c46;
            box-sizing: border-box;
            text-align: left;
        }

        .portal-search-heading {
            margin: 0 0 10px;
            font-size: 13px;
            font-weight: 600;
            color: #64748b;
        }

        .portal-search-result {
            display: block;
            padding: 12px;
            border-radius: 9px;
            text-decoration: none;
            color: #172c46;
            transition: background 0.15s ease;
        }

        .portal-search-result:hover,
        .portal-search-result:focus {
            background: #f1f5f9;
            outline: none;
        }

        .portal-search-result-title {
            display: block;
            font-size: 15px;
            font-weight: 600;
        }

        .portal-search-result-description {
            display: block;
            margin-top: 4px;
            color: #64748b;
            font-size: 13px;
            line-height: 1.5;
        }

        .portal-search-result-module {
            display: inline-block;
            margin-top: 6px;
            color: #2563eb;
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.04em;
        }

        .portal-search-message {
            padding: 12px;
            color: #64748b;
            font-size: 14px;
        }

        .portal-search-divider {
            height: 1px;
            margin: 4px 0;
            background: #edf0f4;
            border: 0;
        }
    `;

    document.head.appendChild(style);

    /**
     * Normalize text for case-insensitive searching.
     */
    function normalize(value) {
        return String(value)
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .trim();
    }

    /**
     * Collect searchable text from an object.
     * Image URLs, IDs and metadata are excluded.
     */
    function collectText(value, output = []) {
        if (value === null || value === undefined) {
            return output;
        }

        if (typeof value === "string" || typeof value === "number") {
            output.push(String(value));
            return output;
        }

        if (Array.isArray(value)) {
            value.forEach(item => collectText(item, output));
            return output;
        }

        if (typeof value === "object") {
            Object.entries(value).forEach(([key, child]) => {
                if (EXCLUDED_FIELDS.has(key.toLowerCase())) {
                    return;
                }

                collectText(child, output);
            });
        }

        return output;
    }

    /**
     * Find a useful display title for a data record.
     */
    function getTitle(record) {
        const titleFields = [
            "name",
            "title",
            "station",
            "hero_title",
            "market"
        ];

        for (const field of titleFields) {
            const value = record[field];

            if (typeof value === "string" && value.trim()) {
                return value.trim();
            }
        }

        return null;
    }

    /**
     * Convert nested module JSON into searchable records.
     */
    function collectRecords(
        value,
        moduleId,
        moduleTitle,
        modulePage,
        path,
        records
    ) {
        if (value === null || value === undefined) {
            return;
        }

        // Handle arrays of objects and arrays of plain text.
        if (Array.isArray(value)) {
            value.forEach(item => {
                collectRecords(
                    item,
                    moduleId,
                    moduleTitle,
                    modulePage,
                    path,
                    records
                );
            });

            return;
        }

        // Plain text entries, such as market and industry names.
        if (typeof value === "string" || typeof value === "number") {
            const title = String(value).trim();

            if (title) {
                records.push({
                    moduleId,
                    moduleTitle,
                    modulePage,
                    id: null,
                    section: path[path.length - 1] || moduleTitle,
                    title,
                    description: "",
                    searchText: normalize(title)
                });
            }

            return;
        }

        if (typeof value !== "object") {
            return;
        }

        const title = getTitle(value);

        // An object with a recognizable title becomes a result.
        if (title) {
            const searchableValues = collectText(value)
                .map(item => item.trim())
                .filter(Boolean);

            const description = searchableValues
                .filter(item => normalize(item) !== normalize(title))
                .filter((item, index, array) => array.indexOf(item) === index)
                .join(" · ")
                .slice(0, 240);

            records.push({
                moduleId,
                moduleTitle,
                modulePage,
                id: typeof value.id === "string" ? value.id : null,
                section: path[path.length - 1] || moduleTitle,
                title,
                description,
                searchText: normalize(
                    [title, ...searchableValues, path.join(" ")].join(" ")
                )
            });
        }

        // Continue into nested objects and arrays.
        Object.entries(value).forEach(([key, child]) => {
            if (
                key.toLowerCase() === "city_summary" ||
                EXCLUDED_FIELDS.has(key.toLowerCase())
            ) {
                return;
            }

            collectRecords(
                child,
                moduleId,
                moduleTitle,
                modulePage,
                [...path, key],
                records
            );
        });
    }

    /**
     * Load all enabled modules using the existing shared loader.
     */
    async function buildSearchIndex() {
        if (!window.PortalData) {
            throw new Error(
                "The shared data loader has not been loaded."
            );
        }

        const [registry, loadedModules] = await Promise.all([
            window.PortalData.getRegistry(),
            window.PortalData.loadAll()
        ]);

        const moduleTitles = new Map(
            (registry.modules || []).map(module => [
                module.id,
                module.title
            ])
        );

        const modulePages = new Map(
            (registry.modules || []).map(module => [
                module.id,
                module.page
            ])
        );

        const records = [];
        const failedModules = [];

        loadedModules.forEach(result => {
            if (result.error || !result.data) {
                failedModules.push(result.id);
                return;
            }

            collectRecords(
                result.data,
                result.id,
                moduleTitles.get(result.id) || result.id,
                modulePages.get(result.id) || "index.html",
                [],
                records
            );
        });

        // Avoid duplicate entries, for example in summary sections.
        const uniqueRecords = [];
        const seen = new Map();

        records.forEach(record => {
            const key = normalize(
                `${record.moduleId}|${record.title}`
            );

            if (!seen.has(key)) {
                seen.set(key, uniqueRecords.length);
                uniqueRecords.push(record);
                return;
            }

            // Prefer the canonical record over an unlinked duplicate.
            const existingIndex = seen.get(key);

            if (
                !uniqueRecords[existingIndex].id &&
                record.id
            ) {
                uniqueRecords[existingIndex] = record;
            }
        });

        return {
            records: uniqueRecords,
            failedModules
        };
    }

    /**
     * Reuse the same loaded index for subsequent searches.
     */
    function getSearchIndex() {
        if (searchIndex) {
            return Promise.resolve(searchIndex);
        }

        if (!loadingPromise) {
            loadingPromise = buildSearchIndex()
                .then(index => {
                    searchIndex = index;
                    return index;
                })
                .catch(error => {
                    loadingPromise = null;
                    throw error;
                });
        }

        return loadingPromise;
    }

    /**
     * Score records against the search query.
     */
    function searchRecords(records, query) {
        const normalizedQuery = normalize(query);
        const words = normalizedQuery.split(/\s+/).filter(Boolean);

        return records
            .map(record => {
                const title = normalize(record.title);

                const matches = words.every(word =>
                    record.searchText.includes(word)
                );

                if (!matches) {
                    return null;
                }

                let score = 0;

                if (title === normalizedQuery) {
                    score += 120;
                } else if (title.startsWith(normalizedQuery)) {
                    score += 90;
                } else if (title.includes(normalizedQuery)) {
                    score += 70;
                } else {
                    score += 30;
                }

                words.forEach(word => {
                    if (title.includes(word)) {
                        score += 10;
                    }
                });

                return {
                    ...record,
                    score
                };
            })
            .filter(Boolean)
            .sort((a, b) => b.score - a.score)
            .slice(0, 12);
    }

    /**
     * Create a result element safely using textContent.
     */
    function createResultElement(record) {
        const link = document.createElement("a");

        link.className = "portal-search-result";

        const modulePage = record.modulePage || "index.html";

        link.href = record.id
            ? `${modulePage}#record-${encodeURIComponent(record.id)}`
            : modulePage;

        const title = document.createElement("span");
        title.className = "portal-search-result-title";
        title.textContent = record.title;

        link.appendChild(title);

        if (record.description) {
            const description = document.createElement("span");

            description.className =
                "portal-search-result-description";

            description.textContent = record.description;

            link.appendChild(description);
        }

        const module = document.createElement("span");

        module.className = "portal-search-result-module";
        module.textContent = record.moduleTitle;

        link.appendChild(module);

        return link;
    }

    /**
     * Display search results.
     */
    function renderResults(matches, query, failedModules = []) {
        resultsBox.replaceChildren();
        resultsBox.style.display = "block";

        const heading = document.createElement("p");
        heading.className = "portal-search-heading";

        heading.textContent = matches.length
            ? `${matches.length} results for "${query}"`
            : `No results found for "${query}"`;

        resultsBox.appendChild(heading);

        if (!matches.length) {
            const message = document.createElement("div");
            message.className = "portal-search-message";
            message.textContent =
                "Try another keyword, business name, location or category.";

            resultsBox.appendChild(message);
        } else {
            matches.forEach((record, index) => {
                if (index > 0) {
                    const divider = document.createElement("hr");
                    divider.className = "portal-search-divider";
                    resultsBox.appendChild(divider);
                }

                resultsBox.appendChild(
                    createResultElement(record)
                );
            });
        }

        if (failedModules.length) {
            const warning = document.createElement("div");
            warning.className = "portal-search-message";
            warning.textContent =
                "Some sections could not be loaded. Results may be incomplete.";

            resultsBox.appendChild(warning);
        }
    }

    /**
     * Run a search after the visitor types.
     */
    async function runSearch(query) {
        if (query.length < 2) {
            resultsBox.style.display = "none";
            resultsBox.replaceChildren();
            return;
        }

        resultsBox.style.display = "block";
        resultsBox.replaceChildren();

        const loading = document.createElement("div");
        loading.className = "portal-search-message";
        loading.textContent = "Searching all sections...";

        resultsBox.appendChild(loading);

        try {
            const index = await getSearchIndex();

            // Ignore outdated searches if the user has typed again.
            if (normalize(input.value) !== normalize(query)) {
                return;
            }

            const matches = searchRecords(
                index.records,
                query
            );

            renderResults(
                matches,
                query,
                index.failedModules
            );

        } catch (error) {
            console.error("Portal search failed:", error);

            resultsBox.replaceChildren();

            const message = document.createElement("div");
            message.className = "portal-search-message";
            message.textContent =
                "Search is temporarily unavailable. Please try again.";

            resultsBox.appendChild(message);
        }
    }

    // Search as the visitor types.
    input.addEventListener("input", () => {
        clearTimeout(debounceTimer);

        const query = input.value.trim();

        debounceTimer = setTimeout(() => {
            runSearch(query);
        }, 200);
    });

    // Enter opens the first matching result.
    input.addEventListener("keydown", event => {
        if (event.key === "Enter") {
            const firstResult = resultsBox.querySelector(
                ".portal-search-result"
            );

            if (firstResult) {
                window.location.href = firstResult.href;
            }
        }

        if (event.key === "Escape") {
            resultsBox.style.display = "none";
        }
    });

})();