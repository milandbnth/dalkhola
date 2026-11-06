// js/shared/header.js

document.addEventListener("DOMContentLoaded", () => {
  // Determine current filename to set active state dynamically
  const path = window.location.pathname;
  const currentPage = path.substring(path.lastIndexOf("/") + 1) || "index.html";

  // Use root-absolute paths so links and images work from any depth
  const navItems = [
    { name: "Home", href: "/index.html", key: "index.html" },
    { name: "Business", href: "/business.html", key: "business.html" },
    { name: "Education", href: "/education.html", key: "education.html" },
    { name: "Services", href: "/services.html", key: "services.html" },
    { name: "Transport", href: "/transport.html", key: "transport.html" }
  ];

  const navLinksHTML = navItems.map(item => {
    // Check if the current page matches the link
    const isActive = currentPage === item.key || (currentPage === "" && item.key === "index.html");
    const activeAttrs = isActive ? ' class="active" aria-current="page"' : '';
    return `<a href="${item.href}"${activeAttrs}>${item.name}</a>`;
  }).join("\n        ");

  const headerHTML = `
  <header class="nav">
    <div class="wrap">
      <a class="brand" href="/index.html">
        <span class="brand-logo-container">
          <img src="/images/dalkhola-online-logo.svg" alt="Dalkhola Online">
        </span>
      </a>

      <nav aria-label="Main navigation">
        ${navLinksHTML}
      </nav>
    </div>
  </header>
  `;

  // Inject header at the top of the body, or replace existing header element
  const existingHeader = document.querySelector("header.nav");
  if (existingHeader) {
    existingHeader.outerHTML = headerHTML;
  } else {
    document.body.insertAdjacentHTML("afterbegin", headerHTML);
  }
});