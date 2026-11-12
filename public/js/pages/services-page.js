
/**
 * Dalkhola Online — Services Page
 * Renders manual civic services and expandable automated directories.
 * Compatible with static GitHub Pages hosting.
 */
(() => {
  "use strict";

  const DATA_URL = "/data/modules/services.json";
  const main = document.querySelector("main.wrap");

  if (!main) return;

  const create = (tag, className, text) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined && text !== null) {
      element.textContent = String(text);
    }
    return element;
  };

  const addField = (card, label, value) => {
    if (!value) return;
    const p = create("p");
    const strong = create("strong", "", `${label}: `);
    p.append(strong, document.createTextNode(String(value)));
    card.appendChild(p);
  };

  const addLink = (card, label, url) => {
    if (!url) return;

    try {
      const parsed = new URL(url, window.location.origin);
      if (!["http:", "https:", "tel:"].includes(parsed.protocol)) return;

      const link = create("a", "go", label);
      link.href = parsed.href;

      if (parsed.protocol !== "tel:") {
        link.target = "_blank";
        link.rel = "noopener noreferrer";
      }

      card.appendChild(link);
    } catch {
      // Ignore invalid URLs.
    }
  };

  const addImage = (card, url, alt) => {
    if (!url || typeof url !== "string") return;

    try {
      const parsed = new URL(url, window.location.origin);
      if (!["http:", "https:"].includes(parsed.protocol)) return;

      const image = create("img", "snap-img");
      image.src = parsed.href;
      image.alt = alt || "Service image";
      image.loading = "lazy";
      image.referrerPolicy = "no-referrer";
      card.appendChild(image);
    } catch {
      // Ignore invalid image URLs.
    }
  };

  const createSection = (title, description, id) => {
    const section = create("section", "block");
    const header = create("div", "sec-head");
    const heading = create("div");

    heading.append(
      create("h2", "", title),
      create("p", "", description)
    );

    header.appendChild(heading);

    const container = create("div", "bento");
    container.id = id;

    section.append(header, container);
    return { section, container };
  };

  const createManualCard = (record, size = "s1") => {
    const card = create("article", `snap ${size}`);
    if (record.id) card.id = `record-${record.id}`;

    addImage(card, record.image, record.name);

    if (record.badge) {
      card.appendChild(create("span", "badge-pill", record.badge));
    }

    card.appendChild(create("h3", "", record.name || "Service"));

    if (record.type) {
      card.appendChild(create("p", "", record.type));
    }

    if (record.address) addField(card, "Address", record.address);
    if (record.pin_code) addField(card, "PIN", record.pin_code);
    if (record.postal_division) {
      addField(card, "Postal Division", record.postal_division);
    }
    if (record.timing) addField(card, "Timing", record.timing);

    if (Array.isArray(record.departments) && record.departments.length) {
      addField(card, "Departments", record.departments.join(", "));
    }

    if (Array.isArray(record.services) && record.services.length) {
      addField(card, "Services", record.services.join(", "));
    }

    if (record.contact) {
      card.appendChild(create("p", "go", record.contact));
    }

    return card;
  };


  const createHealthcareCard = (records) => {
    const card = create("article", "snap s1 healthcare-combined");

    const addHeading = (parent, title) => {
      parent.appendChild(create("h4", "healthcare-section-title", title));
    };

    const addList = (parent, title, items, formatter) => {
      if (!Array.isArray(items) || !items.length) return;

      addHeading(parent, title);

      const list = create("ul", "healthcare-info-list");

      items.forEach((item) => {
        const text = formatter(item);
        if (text) list.appendChild(create("li", "", text));
      });

      if (list.children.length) parent.appendChild(list);
    };

    card.appendChild(create("h3", "", "Healthcare & Hospital"));

    records.forEach((record) => {
      const facility = create("div", "healthcare-facility");

      if (record.id) {
        facility.dataset.recordId = record.id;
      }

      addImage(facility, record.image, record.name);

      facility.appendChild(
        create("h3", "", record.name || "Healthcare facility")
      );

      if (record.subTitle) {
        facility.appendChild(create("p", "healthcare-subtitle", record.subTitle));
      }

      if (record.type) addField(facility, "Facility type", record.type);
      if (record.address) addField(facility, "Address", record.address);
      if (record.district) addField(facility, "District", record.district);
      if (record.block) addField(facility, "Block", record.block);
      if (record.state) addField(facility, "State", record.state);
      if (record.pincode) addField(facility, "PIN code", record.pincode);
      if (record.country) addField(facility, "Country", record.country);

      if (record.description) {
        addHeading(facility, "About the Hospital");
        facility.appendChild(
          create("p", "healthcare-description", record.description)
        );
      }

      // Healthcare services
      addList(
        facility,
        "Healthcare Services",
        record.services,
        (service) => {
          if (typeof service === "string") return service;

          return [
            service.name,
            service.status
          ].filter(Boolean).join(" — ");
        }
      );

      // Special facilities, including the NRC
      if (Array.isArray(record.facilities) && record.facilities.length) {
        addHeading(facility, "Special Facilities");

        record.facilities.forEach((item) => {
          const block = create("div", "healthcare-special-facility");

          block.appendChild(
            create("h5", "", item.name || "Facility")
          );

          addField(block, "Beds", item.beds);
          addField(block, "Purpose", item.purpose);
          addField(block, "Coverage", item.coverage);
          addField(block, "Status", item.status);

          facility.appendChild(block);
        });
      }

      // Historical capacity — kept separate from current NRC beds
      if (record.historicalCapacity) {
        addHeading(facility, "Historical Capacity");
        addField(
          facility,
          "Historically reported beds",
          record.historicalCapacity.reportedBeds
        );
        addField(
          facility,
          "Source note",
          record.historicalCapacity.sourceNote
        );
      }

      // Proposed development
      if (record.development) {
        addHeading(facility, "Hospital Development");

        addField(facility, "Project", record.development.name);
        addField(facility, "Status", record.development.status);
        addField(facility, "Site", record.development.site);
        addField(facility, "Work", record.development.work);
        addField(
          facility,
          "Tender award date",
          record.development.tenderAwardDate
        );
      }

      // Visitor information
      if (record.visitorInformation) {
        addHeading(facility, "Visitor Information");

        const visitor = record.visitorInformation;

        const visitorFields = [
          ["Phone", visitor.phone],
          ["Email", visitor.email],
          ["OPD timings", visitor.opdTimings],
          ["Emergency availability", visitor.emergencyAvailability],
          ["Ambulance availability", visitor.ambulanceAvailability],
          ["Doctor roster", visitor.doctorRoster],
          ["Diagnostic services", visitor.diagnosticServices]
        ];

        visitorFields.forEach(([label, value]) => {
          addField(facility, label, value || "Not verified");
        });
      }

      // Location and map
      if (record.location) {
        addHeading(facility, "Location");

        addField(facility, "Latitude", record.location.latitude);
        addField(facility, "Longitude", record.location.longitude);

        addLink(
          facility,
          "View Hospital on Google Maps",
          record.location.mapUrl
        );
      }

      // Research and verification details
      if (record.dataVerification) {
        addHeading(facility, "Information Verification");

        addField(
          facility,
          "Last researched",
          record.dataVerification.lastResearched
        );

        addList(
          facility,
          "Sources checked",
          record.dataVerification.verifiedSources,
          (source) => source
        );

        addList(
          facility,
          "Information awaiting verification",
          record.dataVerification.pendingVerification,
          (item) => item
        );
      }

      if (record.id) {
        addField(facility, "Record ID", record.id);
      }

      card.appendChild(facility);
    });

    return card;
  };


  const createAutomatedCard = (record, index, category) => {
    const card = create("article", "snap s2");

    const name = record.title || record.name || "Unnamed listing";
    const subtitle = record.subTitle;

    const stableId = record.id || record.placeId;
    if (stableId) {
      card.id = `auto-${category}-${String(stableId).replace(/[^a-zA-Z0-9_-]/g, "-")}`;
    } else {
      card.id = `auto-${category}-${index}`;
    }

    addImage(card, record.imageUrl || record.image, name);

    card.appendChild(create("h3", "", name));

    if (subtitle) {
      card.appendChild(create("p", "", subtitle));
    }

    if (record.categoryName) {
      card.appendChild(create("span", "badge-pill", record.categoryName));
    }

    addField(card, "Address", record.address);
    addField(card, "Phone", record.phone);
    addField(card, "Rating", record.totalScore);
    addField(card, "Reviews", record.reviewsCount);
    addField(card, "Price", record.price);
    addField(card, "Branch", record.branch);
    addField(card, "IFSC", record.ifsc);

    if (Array.isArray(record.services) && record.services.length) {
      addField(card, "Services", record.services.join(", "));
    }

    if (Array.isArray(record.openingHours) && record.openingHours.length) {
      const hours = record.openingHours
        .map((entry) => `${entry.day}: ${entry.hours}`)
        .join(" | ");
      addField(card, "Opening hours", hours);
    }

    if (record.permanentlyClosed === true) {
      card.appendChild(create("p", "service-status", "Permanently closed"));
    } else if (record.temporarilyClosed === true) {
      card.appendChild(create("p", "service-status", "Temporarily closed"));
    }

    addLink(card, "Call", record.phone ? `tel:${record.phone.replace(/[^\d+]/g, "")}` : null);
    addLink(card, "Website", record.website);
    addLink(card, "View on Google Maps", record.url);

    return card;
  };

  const renderManualSections = (data) => {
    const healthcare = createSection(
      "Health Care & Hospitals",
      "Healthcare facilities serving Dalkhola.",
      "healthcare-container"
    );

    if (Array.isArray(data.healthcare) && data.healthcare.length) {
      healthcare.container.appendChild(createHealthcareCard(data.healthcare));
    }

    const municipality = createSection(
      "Dalkhola Municipality",
      "Local urban governance and civic administration.",
      "municipality-container"
    );


    const municipalityCard = create("article", "snap s1 municipality-embedded-card");

    municipalityCard.appendChild(
      create("h3", "", "Dalkhola Municipality")
    );

    municipalityCard.appendChild(
      create("p", "", "Complete municipality profile, civic services, infrastructure and contact information.")
    );



    const municipalityFrame = document.createElement("iframe");

    municipalityFrame.src = "/municipality.html";
    municipalityFrame.title = "Dalkhola Municipality information";
    municipalityFrame.className = "municipality-iframe";
    municipalityFrame.loading = "lazy";
    municipalityFrame.setAttribute("scrolling", "yes");

    municipalityCard.appendChild(municipalityFrame);
    municipality.container.appendChild(municipalityCard);



    const police = createSection(
      "Dalkhola Police Station",
      "Police assistance and public safety information.",
      "police-container"
    );

    const policeCard = create("article", "snap s1");
    policeCard.appendChild(create("h3", "", "Dalkhola Police Station"));
    policeCard.appendChild(
      create(
        "p",
        "",
        "Contact number, verified address and operating details will be added after confirmation from an official source."
      )
    );
    police.container.appendChild(policeCard);

    const postOffice = createSection(
      "Post Office (India Post)",
      "Postal services and facilities in Dalkhola.",
      "postoffice-container"
    );

    (data.post_office || []).forEach((record) => {
      postOffice.container.appendChild(createManualCard(record));
    });

    main.append(
      healthcare.section,
      municipality.section,
      police.section,
      postOffice.section
    );
  };

  const renderAutomatedCategory = (title, key, records) => {
    const section = create("section", "block automated-directory");
    const details = create("details", "service-accordion");
    const summary = create("summary", "service-accordion-summary");

    const label = create("span", "", title);
    const count = create("span", "service-count", `${records.length} listings`);

    summary.append(label, count);

    const content = create("div", "bento service-accordion-content");

    records.forEach((record, index) => {
      content.appendChild(createAutomatedCard(record, index, key));
    });

    if (!records.length) {
      content.appendChild(create("p", "", "No listings available yet."));
    }

    details.append(summary, content);
    section.appendChild(details);
    return section;
  };

  const renderAutomatedSections = (data) => {
    const banking = [
      ...(Array.isArray(data.curated_banking) ? data.curated_banking : []),
      ...(Array.isArray(data.banking) ? data.banking : [])
    ];

    const categories = [
      ["Banking & Financial Services", "banking", banking],
      ["Hotels & Lodging", "hotels", data.hotels || []],
      ["Diagnostic Centres & Clinics", "diagnostics", data.diagnostics || []],
      ["Pharmacies", "pharmacies", data.pharmacies || []]
    ];

    categories.forEach(([title, key, records]) => {
      const safeRecords = Array.isArray(records) ? records : [];
      main.appendChild(renderAutomatedCategory(title, key, safeRecords));
    });
  };

  const showError = () => {
    const message = create(
      "p",
      "services-error",
      "Services information could not be loaded. Please try again later."
    );
    main.appendChild(message);
  };

  fetch(DATA_URL)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Services data request failed: ${response.status}`);
      }
      return response.json();
    })
    .then((data) => {
      renderManualSections(data);
      renderAutomatedSections(data);

      const timestamp = data.metadata?.last_updated;
      if (timestamp) {
        const footer = create("p", "last-updated");
        footer.id = "last-updated";
        const date = new Date(timestamp);

        footer.textContent = Number.isNaN(date.getTime())
          ? ""
          : `Last refreshed: ${date.toLocaleString()}`;

        if (footer.textContent) main.appendChild(footer);
      }
    })
    .catch((error) => {
      console.error("Services page error:", error);
      showError();
    });
})();
