(function () {
  "use strict";

  function fitImageFrame(img) {
    const frame = img.closest(".image-frame");
    if (!frame) return;

    function applyImageSize() {
      if (!img.naturalWidth || !img.naturalHeight) return;

      // Let the frame follow the image's natural proportions.
      frame.style.height = "auto";
      frame.style.aspectRatio = "auto";

      img.style.display = "block";
      img.style.width = "100%";
      img.style.height = "auto";
      img.style.maxWidth = "100%";
      img.style.maxHeight = "none";
      img.style.objectFit = "contain";
    }

    if (img.complete) {
      applyImageSize();
    } else {
      img.addEventListener("load", applyImageSize, { once: true });
    }
  }

  function initialiseImageFrames() {
    document.querySelectorAll(".image-frame img").forEach(fitImageFrame);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialiseImageFrames);
  } else {
    initialiseImageFrames();
  }
})();
