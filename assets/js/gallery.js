import justifiedLayout from "./justified-layout.js";
import * as params from "@params";

const galleries = document.querySelectorAll(".gallery-grid");

// Expose the page width so galleries rendered inside the prose column can break
// out to full width. It is measured from <main>, i.e. exactly the width the
// top-level gallery section spans, so every gallery gets the identical
// container width. Re-measured before each layout pass, which also covers the
// scrollbar appearing once the galleries expand.
function updatePageWidth() {
  const ref = document.querySelector("main") || document.documentElement;
  document.documentElement.style.setProperty("--page-width", ref.getBoundingClientRect().width + "px");
}

function getTargetRowHeight() {
  const width = window.innerWidth;
  if (width < 480) return 120; // phones
  if (width < 768) return 180; // small tablets
  return params.targetRowHeight || 288;
}

// Largest height a row may be stretched to in order to span the full width.
// Galleries with too few images to fill a row stop here and fall back to the
// plain target height instead of being blown up to banner size.
//
// On narrow screens a row spanning the full width is the natural look even when
// it holds a single image, so the limit only applies from the desktop
// breakpoint upwards, where a stretched row is what turns into a banner.
// Returning undefined leaves the layout's own default (1.5x the target) in place.
function getMaxRowHeight() {
  return window.innerWidth < 768 ? Infinity : undefined;
}

galleries.forEach((gallery) => {
  let containerWidth = 0;
  const items = gallery.querySelectorAll(".gallery-item");

  const aspectRatios = Array.from(items).map((item) => {
    const img = item.querySelector("img");
    img.style.width = "100%";
    img.style.height = "auto";
    return parseFloat(img.getAttribute("width")) / parseFloat(img.getAttribute("height"));
  });

  function updateGallery() {
    updatePageWidth();
    if (containerWidth === gallery.getBoundingClientRect().width) return;
    containerWidth = gallery.getBoundingClientRect().width;

    const targetRowHeight = getTargetRowHeight();
    const layout = justifiedLayout(aspectRatios, {
      rowWidth: containerWidth,
      spacing: Number.isInteger(params.boxSpacing) ? params.boxSpacing : 8,
      rowHeight: targetRowHeight,
      maxRowHeight: getMaxRowHeight(),
    });

    items.forEach((item, i) => {
      const { width, height, top, left } = layout.boxes[i];
      item.style.position = "absolute";
      item.style.width = width + "px";
      item.style.height = height + "px";
      item.style.top = top + "px";
      item.style.left = left + "px";
      item.style.overflow = "hidden";
    });

    gallery.style.position = "relative";
    gallery.style.height = layout.containerHeight + "px";
    gallery.style.visibility = "";
  }

  window.addEventListener("resize", updateGallery);
  window.addEventListener("orientationchange", updateGallery);

  // Call twice to adjust for scrollbars appearing after first call
  updateGallery();
  updateGallery();
});
