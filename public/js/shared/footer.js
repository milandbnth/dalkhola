// js/shared/footer.js

document.addEventListener("DOMContentLoaded", () => {
  const footerHTML = `
    <footer>
      <div class="wrap" style="display: flex; flex-direction: column; gap: 12px; align-items: center; text-align: center;">
        <div style="display: flex; gap: 20px; flex-wrap: wrap; justify-content: center; font-size: 14px;">
          <a href="../contact.html" style="color: inherit; text-decoration: none;">Contact Us</a>
          <a href="../terms.html" style="color: inherit; text-decoration: none;">Terms & Conditions</a>
          <a href="../privacy.html" style="color: inherit; text-decoration: none;">Privacy Policy</a>
        </div>
        <div>&copy; ${new Date().getFullYear()} Dalkhola City Portal. All dynamic datasets maintained via GitHub Actions.</div>
        <div style="font-size: 13px; opacity: 0.8;"></div>
      </div>
    </footer>
  `;

  document.body.insertAdjacentHTML('beforeend', footerHTML);
});