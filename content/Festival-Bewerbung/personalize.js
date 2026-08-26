(function () {
  const festival = new URLSearchParams(window.location.search)
    .get("festival")
    ?.trim();
  if (!festival) return;

  document.querySelectorAll("[data-template]").forEach((el) => {
    el.textContent = el.dataset.template.replaceAll("{name}", () => festival);
  });
})();
