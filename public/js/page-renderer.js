
/**
 * Dalkhola Online - Module Page Renderer
 *
 * Renders Business, Education, Services and Transport pages
 * using the shared PortalData loader.
 */

(function () {
    "use strict";

    const container = document.getElementById("content-list");
    const moduleId = document.body.dataset.category;

    if (!container || !["business", "education", "services", "transport"].includes(moduleId)) {
        return;
    }

    function createElement(tag, className, text) {
        const element = document.createElement(tag);

        if (className) {
            element.className = className;
        }

        if (text !== undefined && text !== null && text !== "") {
            element.textContent = String(text);
        }

        return element;
    }

    function createCard(record, title, details) {
        const card = createElement("article", "snap s2");
        card.id = `record-${record.id}`;

        card.appendChild(createElement("h3", "", title));

        details.forEach(detail => {
            if (detail.value) {
                card.appendChild(
                    createElement("p", "", `${detail.label}: ${detail.value}`)
                );
            }
        });

        if (record.id) {
            card.appendChild(
                createElement("p", "record-id", `Record ID: ${record.id}`)
            );
        }

        return card;
    }

    function createSection(title, records, cardBuilder) {
        if (!records || records.length === 0) {
            return null;
        }

        const section = createElement("section", "content-section");
        section.appendChild(createElement("h2", "", title));

        const grid = createElement("div", "bento");

        records.forEach(record => {
            if (record && record.id) {
                grid.appendChild(cardBuilder(record));
            }
        });

        if (!grid.children.length) {
            return null;
        }

        section.appendChild(grid);
        return section;
    }

    // BUSINESS DIRECTORY: category cards and filtered listings

    function renderBusiness(data) {
        if (!data || !data.business) {
            console.error("Business data is missing:", data);
            container.textContent = "Unable to load business information.";
            return [];
        }

        const records = data.business.directory || [];

        // Keep the original Cloudinary URLs here.
        const categories = [
            {
                id: "eat",
                title: "Eat",
                image: "https://res.cloudinary.com/m8ojhenk/image/upload/v1793901399/eat3.png",
                description: "Restaurants, hotels, cafés and food businesses."
            },
            {
                id: "shop",
                title: "Shop",
                image: "https://res.cloudinary.com/m8ojhenk/image/upload/v1793901398/shop.png",
                description: "Shops, markets and local retail businesses."
            },
            {
                id: "entertain",
                title: "Entertain",
                image: "https://res.cloudinary.com/m8ojhenk/image/upload/v1793901399/entern.png",
                description: "Entertainment, recreation and leisure."
            },
            {
                id: "miscellaneous",
                title: "Miscellaneous",
                image: "https://res.cloudinary.com/m8ojhenk/image/upload/v1793901398/misc.png",
                description: "Other businesses and local establishments."
            }
        ];

        function openCategory(category) {
            const filteredRecords = records.filter(record =>
                (record.section || "miscellaneous") === category.id
            );

            container.replaceChildren();

            const backButton = createElement(
                "button",
                "business-directory-back",
                "← Back to categories"
            );

            backButton.type = "button";
            backButton.addEventListener("click", showCategories);
            container.appendChild(backButton);

            const heading = createElement(
                "h2",
                "business-directory-title",
                `${category.title} in Dalkhola`
            );

            container.appendChild(heading);

            if (!filteredRecords.length) {
                container.appendChild(
                    createElement(
                        "p",
                        "loading-message",
                        "No listings are currently available in this category."
                    )
                );
                return;
            }

            const section = createSection(
                category.title,
                filteredRecords,
                record => createCard(record, record.name, [
                    { label: "Category", value: record.category },
                    { label: "Area", value: record.area },
                    { label: "Address", value: record.address },
                    {
                        label: "Verification",
                        value: record.verification_status === "unverified"
                            ? "Not yet verified"
                            : ""
                    }
                ])
            );

            if (section) {
                section.querySelector("h2")?.remove();
                container.appendChild(section);
            }

            requestAnimationFrame(scrollToRequestedRecord);
        }

        function showCategories() {
            const grid = createElement("div", "business-category-grid");

            categories.forEach(category => {
                const count = records.filter(record =>
                    (record.section || "miscellaneous") === category.id
                ).length;

                const card = createElement(
                    "button",
                    "business-category-card"
                );

                card.type = "button";
                card.setAttribute(
                    "aria-label",
                    `Explore ${category.title} businesses`
                );

                // Image container
                const imageContainer = createElement(
                    "div",
                    "business-category-image"
                );

                const img = document.createElement("img");
                img.src = category.image;
                img.alt = `${category.title} businesses in Dalkhola`;
                img.loading = "lazy";
                img.decoding = "async";

                img.onerror = function () {
                    console.error(
                        `Unable to load category image: ${category.title}`,
                        category.image
                    );
                    imageContainer.style.display = "none";
                };

                imageContainer.appendChild(img);
                card.appendChild(imageContainer);

                // Card text
                const content = createElement(
                    "div",
                    "business-category-content"
                );

                content.appendChild(
                    createElement("span", "business-category-name", category.title)
                );

                content.appendChild(
                    createElement(
                        "span",
                        "business-category-description",
                        category.description
                    )
                );

                content.appendChild(
                    createElement(
                        "span",
                        "business-category-count",
                        `${count} ${count === 1 ? "listing" : "listings"}`
                    )
                );

                content.appendChild(
                    createElement(
                        "span",
                        "business-category-arrow",
                        "Explore →"
                    )
                );

                card.appendChild(content);

                // Pass the category object, not data and category.id.
                card.addEventListener("click", () => {
                    openCategory(category);
                });

                grid.appendChild(card);
            });

            container.replaceChildren(grid);
        }

        // Preserve direct links to individual records.
        function openCategoryFromHash() {
            if (!window.location.hash.startsWith("#record-")) {
                return false;
            }

            const recordId = window.location.hash.slice("#record-".length);

            const record = records.find(item => item.id === recordId);

            if (!record) {
                return false;
            }

            const category = categories.find(
                item => item.id === (record.section || "miscellaneous")
            );

            if (category) {
                openCategory(category);
                return true;
            }

            return false;
        }

        showCategories();
        openCategoryFromHash();

        return [];
    }

    function renderEducation(data) {
        const education = data.education || {};

        return [
            createSection("Colleges", education.colleges || [], record =>
                createCard(record, record.name, [
                    { label: "Type", value: record.type },
                    { label: "Affiliated to", value: record.affiliated_to }
                ])
            ),

            createSection("Schools", education.schools || [], record =>
                createCard(record, record.name, [
                    { label: "Type", value: record.type },
                    { label: "Medium", value: record.medium }
                ])
            )
        ];
    }

    function renderServices(data) {
        const services = data.services || {};

        return [
            createSection("Healthcare", services.healthcare || [], record =>
                createCard(record, record.name, [
                    { label: "Type", value: record.type },
                    { label: "Contact", value: record.contact }
                ])
            ),

            createSection("Civic & Banking", services.civic_and_banking || [], record =>
                createCard(record, record.name, [
                    { label: "Type", value: record.type },
                    { label: "Ward", value: record.ward },
                    { label: "IFSC", value: record.ifsc }
                ])
            )
        ];
    }

    function renderTransport(data) {
        const transport = data.transport || {};
        const sections = [];

        if (transport.railway) {
            const railway = transport.railway;

            sections.push(
                createSection("Railway", [railway], record =>
                    createCard(record, record.station, [
                        { label: "Station Code", value: record.code },
                        { label: "Zone / Division", value: record.zone }
                    ])
                )
            );
        }

        sections.push(
            createSection("Highways & Roads", transport.highways || [], record =>
                createCard(record, record.name, [
                    { label: "Description", value: record.description }
                ])
            )
        );

        return sections;
    }

    function scrollToRequestedRecord() {
        if (!window.location.hash) {
            return;
        }

        let targetId;

        try {
            targetId = decodeURIComponent(window.location.hash.slice(1));
        } catch {
            targetId = window.location.hash.slice(1);
        }

        const target = document.getElementById(targetId);

        if (target && typeof target.scrollIntoView === "function") {
            target.scrollIntoView({
                behavior: "smooth",
                block: "center"
            });
        }
    }

    async function init() {
        container.setAttribute("aria-live", "polite");
        container.appendChild(
            createElement("p", "loading-message", "Loading information...")
        );

        try {
            if (!window.PortalData) {
                throw new Error("The shared data loader has not been loaded.");
            }

            const data = await window.PortalData.load(moduleId);

            container.replaceChildren();

            if (moduleId === "business") {
                renderBusiness(data);
                return;
            }

            const renderers = {
                education: renderEducation,
                services: renderServices,
                transport: renderTransport
            };

            const sections = renderers[moduleId](data).filter(Boolean);

            if (!sections.length) {
                container.appendChild(
                    createElement("p", "", "No records are currently available.")
                );
                return;
            }

            sections.forEach(section => container.appendChild(section));

            requestAnimationFrame(scrollToRequestedRecord);

        } catch (error) {
            console.error("Page rendering failed:", error);

            container.replaceChildren(
                createElement(
                    "p",
                    "error-message",
                    "Unable to load this information. Please try again later."
                )
            );
        }
    }

    init();
})();
