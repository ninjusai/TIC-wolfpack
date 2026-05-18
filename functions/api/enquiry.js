export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json();
    const { type, name, email, phone, message, turnstileToken, ...extra } = body;

    // Validate required fields
    const errors = [];
    if (!name) errors.push('name is required');
    if (!email) errors.push('email is required');
    if (!message) errors.push('message is required');
    if (!turnstileToken) errors.push('CAPTCHA verification is required');
    if (!type || !['general', 'acquisition', 'service', 'media'].includes(type)) {
      errors.push('Invalid form type');
    }

    if (errors.length > 0) {
      return new Response(JSON.stringify({ success: false, error: 'Validation failed', details: errors }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Verify Turnstile token
    const turnstileResponse = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret: env.TURNSTILE_SECRET_KEY,
        response: turnstileToken,
        remoteip: request.headers.get('CF-Connecting-IP')
      })
    });

    const turnstileResult = await turnstileResponse.json();
    if (!turnstileResult.success) {
      return new Response(JSON.stringify({ success: false, error: 'CAPTCHA verification failed. Please try again.' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Determine recipient
    const recipients = {
      general: env.RECIPIENT_GENERAL,
      acquisition: env.RECIPIENT_ACQUISITION,
      service: env.RECIPIENT_SERVICE,
      media: env.RECIPIENT_MEDIA
    };
    const recipient = recipients[type] || env.RECIPIENT_GENERAL;

    // Build email subject and body
    const typeLabels = {
      general: 'General Enquiry',
      acquisition: 'Acquisition Enquiry',
      service: 'Service Enquiry',
      media: 'Media / Partnership Enquiry'
    };

    const subject = `${typeLabels[type]}: ${name}`;

    let htmlBody = `<h2>${typeLabels[type]}</h2>`;
    htmlBody += `<p><strong>Name:</strong> ${escapeHtml(name)}</p>`;
    htmlBody += `<p><strong>Email:</strong> ${escapeHtml(email)}</p>`;
    if (phone) htmlBody += `<p><strong>Phone:</strong> ${escapeHtml(phone)}</p>`;

    // Type-specific fields
    if (type === 'acquisition') {
      if (extra.business_name) htmlBody += `<p><strong>Business:</strong> ${escapeHtml(extra.business_name)}</p>`;
      if (extra.region) htmlBody += `<p><strong>Region:</strong> ${escapeHtml(extra.region)}</p>`;
    } else if (type === 'service') {
      if (extra.brand) htmlBody += `<p><strong>Brand:</strong> ${escapeHtml(extra.brand)}</p>`;
      if (extra.service_interest) {
        const serviceInterestLabels = {
          'industry-services': 'Industry services or Driving Instructor Car Hire',
          'agencies': 'Agencies and organisations',
          'instructor': 'Instructor opportunities',
          'other': 'Other'
        };
        const label = serviceInterestLabels[extra.service_interest] || extra.service_interest;
        htmlBody += `<p><strong>Service interest:</strong> ${escapeHtml(label)}</p>`;
      }
    } else if (type === 'media') {
      if (extra.organisation) htmlBody += `<p><strong>Organisation:</strong> ${escapeHtml(extra.organisation)}</p>`;
    }

    htmlBody += `<p><strong>Message:</strong></p><p>${escapeHtml(message)}</p>`;
    htmlBody += `<hr><p><small>Submitted via TIC Group Website at ${new Date().toISOString()}</small></p>`;

    // Send via Resend
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'TIC Group Website <noreply@theinstructorcollege.com.au>',
        to: [recipient],
        reply_to: email,
        subject: subject,
        html: htmlBody
      })
    });

    if (!resendResponse.ok) {
      const resendError = await resendResponse.text();
      console.error('Resend API error:', resendError);
      return new Response(JSON.stringify({ success: false, error: 'Failed to send enquiry. Please try again later.' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ success: true, message: 'Your enquiry has been submitted. We will be in touch shortly.' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error('Form submission error:', err);
    return new Response(JSON.stringify({ success: false, error: 'An unexpected error occurred. Please try again.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
