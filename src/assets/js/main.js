// Mobile navigation toggle
document.addEventListener('DOMContentLoaded', () => {
  const navToggle = document.querySelector('.nav-toggle');
  const primaryNav = document.querySelector('#primary-nav');

  if (navToggle && primaryNav) {
    navToggle.addEventListener('click', () => {
      const isOpen = navToggle.getAttribute('aria-expanded') === 'true';
      navToggle.setAttribute('aria-expanded', !isOpen);
      primaryNav.classList.toggle('is-open');
    });
  }

  // Form handling
  document.querySelectorAll('form[data-enquiry-form]').forEach(form => {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const submitBtn = form.querySelector('button[type="submit"]');
      const formMessage = form.querySelector('.form-message');

      // Clear previous errors
      form.querySelectorAll('.form-field__error').forEach(el => el.textContent = '');
      if (formMessage) formMessage.textContent = '';

      // Basic client-side validation
      let valid = true;
      form.querySelectorAll('[required]').forEach(field => {
        if (!field.value.trim()) {
          valid = false;
          const error = field.parentElement.querySelector('.form-field__error');
          if (error) error.textContent = `${field.labels[0]?.textContent?.replace(' *', '') || 'This field'} is required`;
        }
      });

      // Email validation
      const emailField = form.querySelector('input[type="email"]');
      if (emailField && emailField.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailField.value)) {
        valid = false;
        const error = emailField.parentElement.querySelector('.form-field__error');
        if (error) error.textContent = 'Please enter a valid email address';
      }

      // Check Turnstile token
      const turnstileInput = form.querySelector('[name="cf-turnstile-response"]');
      if (!turnstileInput || !turnstileInput.value) {
        valid = false;
        if (formMessage) formMessage.textContent = 'Please complete the verification challenge.';
      }

      if (!valid) return;

      // Submit
      submitBtn.disabled = true;
      submitBtn.textContent = 'Sending...';

      const formData = new FormData(form);
      const data = Object.fromEntries(formData.entries());
      data.turnstileToken = data['cf-turnstile-response'];
      delete data['cf-turnstile-response'];

      try {
        const response = await fetch('/api/enquiry', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });

        const result = await response.json();

        if (result.success) {
          form.innerHTML = '<div class="form-success"><h3>Thank you</h3><p>' + result.message + '</p></div>';
        } else {
          if (formMessage) formMessage.textContent = result.error || 'Something went wrong. Please try again.';
          if (result.details) {
            result.details.forEach(detail => {
              const fieldName = detail.split(' ')[0];
              const field = form.querySelector(`[name="${fieldName}"]`);
              if (field) {
                const error = field.parentElement.querySelector('.form-field__error');
                if (error) error.textContent = detail;
              }
            });
          }
          submitBtn.disabled = false;
          submitBtn.textContent = 'Send Enquiry';
        }
      } catch (err) {
        if (formMessage) formMessage.textContent = 'Network error. Please try again.';
        submitBtn.disabled = false;
        submitBtn.textContent = 'Send Enquiry';
      }
    });
  });
});

// Turnstile callback
function onTurnstileSuccess(token) {
  // Token is automatically placed in the form by Turnstile
}
