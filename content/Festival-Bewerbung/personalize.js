(function () {
  const festival = new URLSearchParams(window.location.search)
    .get("festival")
    ?.trim();
  if (!festival) return;

  document.querySelectorAll("[data-template]").forEach((el) => {
    el.textContent = el.dataset.template.replaceAll("{name}", () => festival);
  });

  // Reveal the blocks written for this festival ({{< festival-only >}}).
  // Matching ignores case, spaces and hyphens, so "Open Ohr", "open ohr" and
  // "open-ohr" all address the same block.
  const norm = (s) => s.toLowerCase().trim().replace(/[\s-]+/g, "-");
  let revealed = false;
  document.querySelectorAll("[data-festival]").forEach((el) => {
    if (norm(el.dataset.festival) !== norm(festival)) return;
    el.hidden = false;
    revealed = true;
  });

  // gallery.js measures every .gallery-grid once on load and caches the
  // container width. Inside a block that was still hidden that width is 0, and
  // nothing would ever recompute it. It recomputes on resize, so ask for one.
  if (revealed) window.dispatchEvent(new Event("resize"));
})();
