document.addEventListener("DOMContentLoaded", () => {
  if (!window.featuredImages) return;

  Object.keys(window.featuredImages).forEach(pageId => {
    const images = window.featuredImages[pageId];
    if (!images || images.length < 2) return;

    const el = document.getElementById("featured-" + pageId);
    if (!el) return;

    let i = 0;
    el.style.backgroundImage = `url(${images[0]})`;

    setInterval(() => {
      i = (i + 1) % images.length;

      el.style.opacity = 0;

      setTimeout(() => {
        el.style.backgroundImage = `url(${images[i]})`;
        el.style.opacity = 1;
      }, 800);
    }, 10000);
  });
});
