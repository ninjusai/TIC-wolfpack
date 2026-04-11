/* ==========================================================================
   Scroll-triggered reveal animations — Intersection Observer
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target); // Only animate once
      }
    });
  }, observerOptions);

  // Observe all elements with data-animate attribute
  document.querySelectorAll('[data-animate]').forEach(el => {
    observer.observe(el);
  });

  // Staggered children — cards, grid items
  document.querySelectorAll('[data-stagger]').forEach(container => {
    const children = container.children;
    Array.from(children).forEach((child, index) => {
      child.style.transitionDelay = `${index * 120}ms`;
      child.setAttribute('data-animate', 'fade-up');
      observer.observe(child);
    });
  });
});
