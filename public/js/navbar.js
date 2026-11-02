document.addEventListener("DOMContentLoaded", () => {
  const currentPath = window.location.pathname.split("/").pop() || "index.html";

  const navbarHTML = `
    <nav class="navbar">
      <div class="logo"><a href="index.html">📍 Dalkhola Portal</a></div>
      <ul class="nav-links">
        <li><a href="index.html" class="${currentPath === 'index.html' ? 'active' : ''}">Home</a></li>
        <li><a href="business.html" class="${currentPath === 'business.html' ? 'active' : ''}">Business</a></li>
        <li><a href="education.html" class="${currentPath === 'education.html' ? 'active' : ''}">Education</a></li>
        <li><a href="services.html" class="${currentPath === 'services.html' ? 'active' : ''}">Services</a></li>
        <li><a href="transport.html" class="${currentPath === 'transport.html' ? 'active' : ''}">Transport</a></li>
      </ul>
    </nav>
  `;

  document.getElementById("header-container").innerHTML = navbarHTML;

  const footerHTML = `
    <footer>
      <p>© 2026 Dalkhola City Portal • Powered by GitHub Actions & Pages</p>
    </footer>
  `;
  document.getElementById("footer-container").innerHTML = footerHTML;
});
