
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

        // Image
        if (record.image) {
            const image = createElement("img", "service-card-image");
            image.src = record.image;
            image.alt = title || record.name || "Service image";
            image.loading = "lazy";
            image.onerror = function () {
                this.style.display = "none";
            };
            card.appendChild(image);
        }

        // Title
        card.appendChild(createElement("h3", "", title));

        // Description
        if (record.description) {
            card.appendChild(
                createElement("p", "service-description", record.description)
            );
        }

        // Details
        details.forEach(detail => {
            if (detail.value !== null && detail.value !== undefined && detail.value !== "") {
                card.appendChild(
                    createElement("p", "", `${detail.label}: ${detail.value}`)
                );
            }
        });

        // Additional hospital facilities
        if (Array.isArray(record.facilities) && record.facilities.length) {
            const heading = createElement("h4", "", "Facilities");
            card.appendChild(heading);

            record.facilities.forEach(facility => {
                const item = createElement("p", "");
                item.textContent = `${facility.name || ""}${facility.beds ? ` — ${facility.beds} beds` : ""}${facility.purpose ? `: ${facility.purpose}` : ""}`;
                card.appendChild(item);
            });
        }

        // Development information
        if (record.development) {
            const development = record.development;

            card.appendChild(
                createElement("h4", "", development.name || "Development Update")
            );

            if (development.status) {
                card.appendChild(
                    createElement("p", "", `Status: ${development.status}`)
                );
            }

            if (development.update) {
                card.appendChild(
                    createElement("p", "", development.update)
                );
            }
        }

        // Map link
        if (record.mapUrl) {
            const mapLink = createElement("a", "service-map-link", "View on Google Maps");
            mapLink.href = record.mapUrl;
            mapLink.target = "_blank";
            mapLink.rel = "noopener noreferrer";
            card.appendChild(mapLink);
        }

        // Record ID
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

    // EDUCATION DIRECTORY: category cards and filtered listings

    function renderEducation(data) {
        const education = data && data.education;

        if (!education) {
            console.error("Education data is missing:", data);
            container.textContent = "Unable to load education information.";
            return [];
        }

        // Set "image" to a URL or local path to use a photo instead of the emoji.
        const categories = [
            {
                id: "colleges",
                title: "Colleges",
                icon: "🎓",
                image: "",
                description: "Degree colleges and higher education in Dalkhola.",
                records: education.colleges || [],
                details: record => [
                    { label: "Type", value: record.type },
                    { label: "Affiliated to", value: record.affiliated_to },
                    { label: "Established", value: record.established },
                    { label: "Address", value: record.address },
                    { label: "Phone", value: record.phone },
                    { label: "Email", value: record.email }
                ]
            },
            {
                id: "schools",
                title: "Schools",
                icon: "🏫",
                image: "",
                description: "Primary, secondary and higher secondary schools.",
                records: education.schools || [],
                details: record => [
                    { label: "Type", value: record.type },
                    { label: "Medium", value: record.medium },
                    { label: "Board", value: record.board },
                    { label: "Established", value: record.established },
                    { label: "Address", value: record.address },
                    { label: "Email", value: record.email }
                ]
            },
            {
                id: "training_institutes",
                title: "Training & Coaching",
                icon: "🛠️",
                image: "",
                description: "Coaching centres, skill training and vocational courses.",
                records: education.training_institutes || [],
                details: record => [
                    { label: "Type", value: record.type },
                    {
                        label: "Courses",
                        value: Array.isArray(record.courses)
                            ? record.courses.join(", ")
                            : record.courses
                    },
                    { label: "Address", value: record.address },
                    { label: "Phone", value: record.phone },
                    { label: "Email", value: record.email }
                ]
            }
        ];


        function createEducationCard(record, category) {
            const card = createElement("article", "edu-card");

            if (record.id) {
                card.id = `record-${record.id}`;
            }

            // Clickable header: image + title + summary
            const toggle = createElement("div", "edu-card-toggle");
            toggle.setAttribute("role", "button");
            toggle.setAttribute("aria-expanded", "false");
            toggle.tabIndex = 0;

            const media = createElement("div", "edu-card-media");

            function showPlaceholder() {
                media.replaceChildren();
                media.classList.add("edu-card-placeholder");
                media.setAttribute("aria-hidden", "true");
                media.textContent = category.icon;
            }

            if (record.image) {
                const img = document.createElement("img");
                img.src = record.image;
                img.alt = record.image_alt || record.name;
                img.loading = "lazy";
                img.decoding = "async";
                img.onerror = showPlaceholder;
                media.appendChild(img);
            } else {
                showPlaceholder();
            }

            toggle.appendChild(media);

            const head = createElement("div", "edu-card-head");
            head.appendChild(createElement("h3", "", record.name));

            if (record.type) {
                head.appendChild(createElement("span", "edu-card-type", record.type));
            }

            if (record.description) {
                head.appendChild(createElement("p", "edu-card-summary", record.description));
            }

            const more = createElement("span", "edu-card-more", "View details ▾");
            head.appendChild(more);
            toggle.appendChild(head);
            card.appendChild(toggle);

            // Expandable body: all the information
            const body = createElement("div", "edu-card-body");
            body.hidden = true;
            body.id = `details-${record.id || Math.random().toString(36).slice(2)}`;
            toggle.setAttribute("aria-controls", body.id);

            const rows = [
                { label: "Official name", value: record.official_name },
                ...category.details(record).filter(row => row.label !== "Type")
            ];

            const list = createElement("dl", "edu-card-details");

            rows.forEach(row => {
                if (row.value) {
                    list.appendChild(createElement("dt", "", row.label));
                    list.appendChild(createElement("dd", "", row.value));
                }
            });

            if (list.children.length) {
                body.appendChild(list);
            }

            if (Array.isArray(record.facts) && record.facts.length) {
                body.appendChild(createElement("h4", "edu-card-facts-title", "Interesting facts"));

                const facts = createElement("ul", "edu-card-facts");
                record.facts.forEach(fact => facts.appendChild(createElement("li", "", fact)));
                body.appendChild(facts);
            }

            if (record.url && /^https?:\/\//i.test(record.url)) {
                const link = createElement("a", "edu-card-link", "Visit website ↗");
                link.href = record.url;
                link.target = "_blank";
                link.rel = "noopener noreferrer";
                body.appendChild(link);
            }

            card.appendChild(body);

            function setOpen(open) {
                card.classList.toggle("is-open", open);
                body.hidden = !open;
                toggle.setAttribute("aria-expanded", String(open));
                more.textContent = open ? "Hide details ▴" : "View details ▾";

                if (open) {
                    card.scrollIntoView({ behavior: "smooth", block: "nearest" });
                }
            }

            toggle.addEventListener("click", () => setOpen(body.hidden));

            toggle.addEventListener("keydown", event => {
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setOpen(body.hidden);
                }
            });

            return card;
        }

        function openCategory(category) {
            container.replaceChildren();

            const backButton = createElement(
                "button",
                "business-directory-back",
                "← Back to categories"
            );
            backButton.type = "button";
            backButton.addEventListener("click", showCategories);
            container.appendChild(backButton);

            container.appendChild(
                createElement(
                    "h2",
                    "business-directory-title",
                    `${category.title} in Dalkhola`
                )
            );

            // ---- everything below this line is the part that changed ----

            const section = createSection(
                category.title,
                category.records,
                record => createEducationCard(record, category)   // was: createCard(...)
            );

            if (!section) {
                container.appendChild(
                    createElement(
                        "p",
                        "loading-message",
                        "No listings are currently available in this category."
                    )
                );
                return;
            }

            section.querySelector("h2")?.remove();
            section.classList.add("edu-records");                 // new line
            container.appendChild(section);

            requestAnimationFrame(scrollToRequestedRecord);
        }

        function showCategories() {
            const grid = createElement(
                "div",
                "business-category-grid education-category-grid"
            );

            categories.forEach(category => {
                const count = category.records.length;

                const card = createElement("button", "business-category-card");
                card.type = "button";
                card.setAttribute("aria-label", `Explore ${category.title}`);

                const imageContainer = createElement("div", "business-category-image");

                function showPlaceholder() {
                    imageContainer.replaceChildren();
                    imageContainer.classList.add("education-category-placeholder");
                    imageContainer.setAttribute("aria-hidden", "true");
                    imageContainer.textContent = category.icon;
                }

                if (category.image) {
                    const img = document.createElement("img");
                    img.src = category.image;
                    img.alt = `${category.title} in Dalkhola`;
                    img.loading = "lazy";
                    img.decoding = "async";
                    img.onerror = showPlaceholder;
                    imageContainer.appendChild(img);
                } else {
                    showPlaceholder();
                }

                card.appendChild(imageContainer);

                const content = createElement("div", "business-category-content");
                content.appendChild(createElement("span", "business-category-name", category.title));
                content.appendChild(createElement("span", "business-category-description", category.description));
                content.appendChild(
                    createElement(
                        "span",
                        "business-category-count",
                        `${count} ${count === 1 ? "listing" : "listings"}`
                    )
                );
                content.appendChild(createElement("span", "business-category-arrow", "Explore →"));
                card.appendChild(content);

                card.addEventListener("click", () => openCategory(category));

                grid.appendChild(card);
            });

            container.replaceChildren(grid);
        }

        // Keep direct links like education.html#record-DLK-EDU-000004 working.
        function openCategoryFromHash() {
            if (!window.location.hash.startsWith("#record-")) {
                return;
            }

            const recordId = window.location.hash.slice("#record-".length);
            const category = categories.find(item =>
                item.records.some(record => record.id === recordId)
            );

            if (category) {
                openCategory(category);
            }
        }

        showCategories();
        openCategoryFromHash();

        return [];
    }



    function renderServices(data) {
        const services = data.services || {};

        return [
            createSection("Healthcare", services.healthcare || [], record => {
                const details = [
                    { label: "Facility Type", value: record.type },
                    { label: "Address", value: record.address },
                    { label: "District", value: record.district },
                    { label: "State", value: record.state },
                    { label: "PIN Code", value: record.pincode },
                    { label: "Description", value: record.description },
                    { label: "Rating", value: record.rating ? `${record.rating}/5` : null },
                    { label: "Reviews", value: record.reviewCount }
                ];

                // Nutritional Rehabilitation Centre
                if (record.facilities) {
                    record.facilities.forEach(facility => {
                        details.push(
                            { label: "Special Facility", value: facility.name },
                            { label: "Bed Capacity", value: facility.beds },
                            { label: "Purpose", value: facility.purpose },
                            { label: "Coverage", value: facility.coverage }
                        );
                    });
                }

                // Hospital development information
                if (record.development) {
                    details.push(
                        {
                            label: "Development Project",
                            value: record.development.name
                        },
                        {
                            label: "Project Status",
                            value: record.development.status
                        },
                        {
                            label: "Development Update",
                            value: record.development.update
                        }
                    );
                }

                // Visitor information
                if (record.visitorInformation) {
                    details.push(
                        {
                            label: "Contact",
                            value: record.visitorInformation.phone || "Not verified"
                        },
                        {
                            label: "OPD Timings",
                            value: record.visitorInformation.opdTimings || "Not verified"
                        },
                        {
                            label: "Emergency Services",
                            value: record.visitorInformation.emergencyAvailability
                        },
                        {
                            label: "Doctor Information",
                            value: record.visitorInformation.doctorRoster
                        }
                    );
                }

                if (record.mapUrl) {
                    details.push({
                        label: "Google Maps",
                        value: record.mapUrl
                    });
                }

                return createCard(
                    record,
                    record.name,
                    details.filter(item =>
                        item.value !== null && item.value !== undefined && item.value !== ""
                    )
                );
            }),

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

            if (moduleId === "education") {
                renderEducation(data);
                return;
            }

            const renderers = {
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
