# Form Handling Specification

## Overview

All forms on the TIC Group website submit to a Cloudflare Pages Function that validates the request, verifies the Turnstile CAPTCHA token, and sends a notification email via the Resend API.

## Architecture

```
Browser Form Submit
  → POST /api/enquiry
  → Cloudflare Pages Function (/functions/api/enquiry.js)
  → Validate Turnstile token (Cloudflare server-side verification)
  → Send email via Resend API
  → Return JSON response
  → Frontend shows thank-you message
```

## Pages Function: `/functions/api/enquiry.js`

The function handles all form types via a single endpoint. The request body includes a `type` field that determines validation rules and the recipient email address.

### Environment Variables

| Variable | Description |
|---|---|
| `RESEND_API_KEY` | Resend API key for sending transactional email |
| `TURNSTILE_SECRET_KEY` | Cloudflare Turnstile secret key for server-side verification |
| `RECIPIENT_GENERAL` | Email address for general enquiries |
| `RECIPIENT_ACQUISITION` | Email address for acquisition enquiries |
| `RECIPIENT_SERVICE` | Email address for service/brand-specific enquiries |
| `RECIPIENT_MEDIA` | Email address for media and partnership enquiries |

All environment variables are configured in the Cloudflare Pages dashboard under Settings > Environment Variables.

## Form Types

### 1. General Enquiry

- **Purpose:** Catch-all contact form on the /contact/ page
- **Recipient:** `RECIPIENT_GENERAL`
- **Fields:** name, email, phone (optional), message, turnstile token

### 2. Acquisition Enquiry

- **Purpose:** Driving school owners interested in joining the TIC group
- **Recipient:** `RECIPIENT_ACQUISITION`
- **Fields:** name, email, phone, business name, location, message, turnstile token

### 3. Service Enquiry

- **Purpose:** Enquiries about a specific brand's services (linked from brand pages)
- **Recipient:** `RECIPIENT_SERVICE`
- **Fields:** name, email, phone (optional), brand (select), message, turnstile token

### 4. Media / Partnerships

- **Purpose:** Press, media, and partnership enquiries
- **Recipient:** `RECIPIENT_MEDIA`
- **Fields:** name, email, organisation, message, turnstile token

## Request / Response

### Request

```
POST /api/enquiry
Content-Type: application/json

{
  "type": "general" | "acquisition" | "service" | "media",
  "name": "string",
  "email": "string",
  "phone": "string (optional)",
  "message": "string",
  "turnstileToken": "string",
  ...additional fields per type
}
```

### Response — Success

```json
{
  "success": true,
  "message": "Your enquiry has been submitted. We will be in touch shortly."
}
```

### Response — Error

```json
{
  "success": false,
  "error": "Validation failed",
  "details": ["email is required", "message is required"]
}
```

### Response — Turnstile Failure

```json
{
  "success": false,
  "error": "CAPTCHA verification failed. Please try again."
}
```

## Processing Flow

1. Parse JSON body and extract `type` field.
2. Validate required fields for the given form type. Return 400 with field-level errors if validation fails.
3. Verify Turnstile token via `https://challenges.cloudflare.com/turnstile/v0/siteverify`. Return 403 if verification fails.
4. Look up recipient email from environment variable based on `type`.
5. Send email via Resend API (`POST https://api.resend.com/emails`) with:
   - `from`: configured sender address (e.g., `noreply@theinstructorcollege.com.au`)
   - `to`: recipient for the form type
   - `subject`: formatted subject line including form type and sender name
   - `html`: formatted email body with all submitted fields
6. Return JSON success response. Frontend replaces the form with a thank-you message.

## Frontend Behaviour

- Forms use standard `<form>` elements with client-side validation.
- On submit, JavaScript intercepts the event, serialises to JSON, and sends via `fetch()`.
- On success response, the form container is replaced with a thank-you message.
- On error response, field-level validation messages are displayed inline.
- The Turnstile widget is embedded in each form and its token is included automatically.
