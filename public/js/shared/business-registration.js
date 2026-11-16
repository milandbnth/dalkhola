
document.addEventListener("DOMContentLoaded", () => {
  const modal = document.getElementById("business-modal");

  const openButtons = document.querySelectorAll(
    "[data-open-business-form]"
  );

  const closeBtn = document.getElementById("close-business-form");
  const overlay = document.getElementById("close-business-overlay");
  const form = document.getElementById("business-registration-form");

  if (!modal || !openButtons.length || !closeBtn || !form) return;

  // IMPORTANT: Replace with your deployed Apps Script URL.
  const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyQRiK6f8uwjJdFrdVUmolJoDAewAUCO9p6NUKadCkpr0tpXMXQnKZVTzmVgKIfy6OV/exec";

  function openModal() {
    modal.classList.add("active");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("business-modal-open");
    document.getElementById("business-name").focus();
  }

  function closeModal() {
    modal.classList.remove("active");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("business-modal-open");
  }



  // Activate both registration buttons
  document.querySelectorAll("[data-open-business-form]")
    .forEach(button => {
      button.addEventListener("click", openModal);
    });

  closeBtn.addEventListener("click", closeModal);

  if (overlay) {
    overlay.addEventListener("click", closeModal);
  }




  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && modal.classList.contains("active")) {
      closeModal();
    }
  });

  // Hidden iframe for cross-origin form submission
  const iframe = document.createElement("iframe");
  iframe.name = "business-registration-frame";
  iframe.style.display = "none";
  iframe.title = "Registration submission";
  document.body.appendChild(iframe);

  let submitting = false;
  let waitingForResponse = false;

  iframe.addEventListener("load", () => {
    if (!waitingForResponse) return;

    waitingForResponse = false;
    submitting = false;

    const status = document.getElementById("business-form-status");
    const submitBtn = form.querySelector('[type="submit"]');

    if (status) {
      status.textContent =
        "Your registration has been submitted. Thank you for registering with Dalkhola Online!";

      status.style.color = "#16804a";
    }
    submitBtn.disabled = false;
    submitBtn.textContent = "Submit Business Registration ↗";

    form.reset();
  });

  form.addEventListener("submit", event => {
    event.preventDefault();

    if (submitting) return;

    if (SCRIPT_URL.includes("PASTE_YOUR")) {
      alert("Please configure the Google Apps Script URL first.");
      return;
    }

    const status = document.getElementById("business-form-status");
    const submitBtn = form.querySelector('[type="submit"]');

    const payload = Object.fromEntries(
      new FormData(form).entries()
    );

    submitting = true;

    if (status) {
      status.textContent = "Submitting your registration...";
      status.style.color = "#946200";
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Submitting...";

    const hiddenForm = document.createElement("form");
    hiddenForm.method = "POST";
    hiddenForm.action = SCRIPT_URL;
    hiddenForm.target = iframe.name;
    hiddenForm.style.display = "none";

    const input = document.createElement("input");
    input.type = "hidden";
    input.name = "payload";
    input.value = JSON.stringify(payload);

    hiddenForm.appendChild(input);
    document.body.appendChild(hiddenForm);

    waitingForResponse = true;

    try {
      hiddenForm.submit();
    } catch (error) {
      waitingForResponse = false;
      submitting = false;
      submitBtn.disabled = false;
      submitBtn.textContent = "Submit Business Registration ↗";
      status.textContent = "Submission failed. Please try again.";
      status.style.color = "#b42318";
    }

    setTimeout(() => hiddenForm.remove(), 1000);
  });
});
