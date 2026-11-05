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

    function renderBusiness(data) {
        const records = data.business?.directory || [];

        return [
            createSection("Business Directory", records, record =>
                createCard(record, record.name, [
                    { label: "Category", value: record.category },
                    { label: "Area", value: record.area }
                ])
            )
        ];
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

            const renderers = {
                business: renderBusiness,
                education: renderEducation,
                services: renderServices,
                transport: renderTransport
            };

            const sections = renderers[moduleId](data)
                .filter(Boolean);

            container.replaceChildren();

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
