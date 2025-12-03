import PhotoSwipeLightbox from "./photoswipe/photoswipe-lightbox.esm.js";
import PhotoSwipe from "./photoswipe/photoswipe.esm.js";
import PhotoSwipeDynamicCaption from "./photoswipe/photoswipe-dynamic-caption-plugin.esm.min.js";
import * as params from "@params";

const gallery = document.getElementById("gallery");

if (gallery) {

  const lightbox = new PhotoSwipeLightbox({
    gallery,
    children: ".gallery-item",
    showHideAnimationType: "zoom",
    bgOpacity: 1,
    pswpModule: PhotoSwipe,
    imageClickAction: "close",
    closeTitle: params.closeTitle,
    zoomTitle: params.zoomTitle,
    arrowPrevTitle: params.arrowPrevTitle,
    arrowNextTitle: params.arrowNextTitle,
    errorMsg: params.errorMsg,

    // NEW: customize slide rendering
    getSlideContent: (element) => {
      const type = element.dataset.pswpType || "image";

      if (type === "video") {
        const videoSrc = element.href;
        return {
          type: "html",
          html: `
            <div class="pswp__video-wrapper">
              <iframe 
                src="${videoSrc}" 
                frameborder="0" 
                allowfullscreen
                allow="autoplay; fullscreen"
                class="pswp__video-iframe"
              ></iframe>
            </div>`,
          element
        };
      } else {
        return {
          type: "image",
          src: element.href,
          width: element.dataset.width || 800,
          height: element.dataset.height || 600,
          element
        };
      }
    }
  });

  // Update hash on slide change
  lightbox.on("change", () => {
    const target = lightbox.pswp.currSlide?.data?.element?.dataset?.pswpTarget;
    history.replaceState("", document.title, "#" + target);
  });

  // Reset hash on close
  lightbox.on("close", () => {
    history.replaceState("", document.title, window.location.pathname);
  });

  // Dynamic captions
  new PhotoSwipeDynamicCaption(lightbox, {
    mobileLayoutBreakpoint: 700,
    type: "auto",
    mobileCaptionOverlapRatio: 1,
  });

  lightbox.init();

  // Open from hash if present
  if (window.location.hash.substring(1).length > 1) {
    const target = window.location.hash.substring(1);
    const items = gallery.querySelectorAll("a");
    for (let i = 0; i < items.length; i++) {
      if (items[i].dataset["pswpTarget"] === target) {
        lightbox.loadAndOpen(i, { gallery });
        break;
      }
    }
  }
}
