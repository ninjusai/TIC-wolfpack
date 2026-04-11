// FAQ accordion — close other items when one opens (optional exclusive mode)
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.faq-accordion').forEach(accordion => {
    accordion.querySelectorAll('details').forEach(detail => {
      detail.addEventListener('toggle', () => {
        if (detail.open) {
          accordion.querySelectorAll('details').forEach(other => {
            if (other !== detail) other.removeAttribute('open');
          });
        }
      });
    });
  });
});
