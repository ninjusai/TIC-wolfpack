# BookingTimes JavaScript Capability Research

**Agent:** Scout | **Date:** 2026-04-02 | **Status:** Complete

---

## Executive Summary

**JavaScript IS supported on BookingTimes, through multiple pathways.** The platform provides explicit mechanisms for adding custom code including JavaScript to pages. However, the WYSIWYG content editor (TinyMCE) likely strips `<script>` tags from pasted content due to built-in XSS sanitization. The key finding is that BookingTimes has a **separate `<head>` code injection feature** and supports JavaScript in forms and dynamic features.

---

## 1. Can Custom JavaScript Be Added?

### YES -- Through Multiple Pathways

#### Pathway A: `<head>` Code Injection (Confirmed)
- BookingTimes release notes confirm: **"Website editors can now add directly to the `<head>` tag"** under **Setup > Analytics & Tracking** menu
- This is the most reliable pathway for adding custom JavaScript
- Custom code in `<head>`, footer, and top bar is automatically stripped from sensitive pages (login, intake forms, payment pages) for security compliance

#### Pathway B: Custom HTML Forms with JavaScript (Confirmed)
- Official docs at `support.bookingtimes.com/docs/creating-html-forms` document creating forms with JavaScript
- The docs state: **"you must use the basic HTML form structure, add a couple of class names, as well as a special bit of JavaScript which makes the submit button work"**
- This confirms JavaScript execution is expected and supported in content areas

#### Pathway C: Dynamic Shopping Cart (Confirmed)
- Release notes state: **"Shopping cart items can now be added dynamically without leaving the page"** and explicitly note **"technical knowledge of Javascript is required to use it"**
- This is a platform-level feature that relies on JavaScript being available

#### Pathway D: WYSIWYG Code View Editor (Uncertain -- Needs Testing)
- The platform uses **TinyMCE** as its WYSIWYG editor
- TinyMCE 6+ uses **DOMPurify** to sanitize content, which **strips `<script>` tags by default**
- However, BookingTimes may have configured TinyMCE with `extended_valid_elements` to allow scripts, or disabled sanitization via `xss_sanitization: false`
- **This is the pathway used by the Content Emulator project (paste into code view) and needs human testing to confirm**

### Content Security Policy (CSP)
- **No CSP headers detected** on metrodriving.com.au (server returns only `Server: awselb/2.0`)
- **No CSP meta tags** found in page source on either test site
- This means **inline scripts are NOT blocked by CSP** if they survive the editor

### Inline Event Handlers
- Live BookingTimes sites contain `onclick` handlers (for `__doPostBack()` ASP.NET postbacks)
- This confirms inline event handlers are **not stripped at the server/rendering level**
- Whether they survive the TinyMCE paste is a separate question (DOMPurify may strip them)

---

## 2. What JavaScript Already Runs on BookingTimes Sites?

### Platform JavaScript (Present on All Sites)

| Script | Source | Purpose |
|--------|--------|---------|
| **jQuery** | Platform-bundled | DOM manipulation, available via `$()` |
| **ASP.NET AJAX** | Platform | `Sys.WebForms.PageRequestManager`, `__doPostBack()` |
| **Platform Core** | BookingTimes | Timezone detection, error logging, dark mode |
| **Form Validation** | Platform | `validateSubscription()`, `isValidEmail()`, `subscribe()` |

### Third-Party Scripts (Added by Site Owners)

**metrodriving.com.au:**
- Google Analytics (UA + GA4: `G-FZK3RM449E`)
- Google Tag Manager (`AW-944717608`)
- Facebook Pixel (`2675467276176588`)
- Facebook SDK (`1243492865763283`)

**racsom.com.au:**
- Google Analytics (GA4: `G-KF9M3LS7DJ`)
- Facebook Pixel (`1727802530776200`)
- Facebook SDK (v3.0)
- Clicky Analytics (`101172463`)

### Key Implication
The presence of Google Analytics, Facebook Pixel, and other third-party scripts on live sites **proves that custom JavaScript execution is fully functional** on BookingTimes pages. These scripts were clearly added by site owners via the `<head>` code injection feature.

---

## 3. Documented Restrictions

### What We Know
1. **Custom code is stripped from sensitive pages**: Login, intake forms, and payment pages do not render custom `<head>`, footer, or top bar code (security/privacy measure since Dec 2025 release)
2. **TinyMCE sanitization**: The editor likely strips `<script>` tags when pasting into the code view. This is TinyMCE's default behavior, not a BookingTimes-specific restriction
3. **No documented whitelist/blacklist**: BookingTimes docs do not explicitly list which HTML tags are allowed or blocked in the content editor

### What We Don't Know (Gaps)
1. Whether BookingTimes has customized TinyMCE to allow `<script>` tags (would require `extended_valid_elements: "script[src|async|defer|type]"`)
2. Whether there's server-side sanitization after TinyMCE (a second layer that might strip scripts even if TinyMCE allows them)
3. Whether inline event handlers (`onclick`, `onmouseover`) survive the TinyMCE paste

---

## 4. Practical Scope for Interactivity

### If Scripts Work in Code View (Best Case)

Full JavaScript interactivity is possible:
- jQuery is already loaded -- use `$(document).ready()` patterns
- DOM manipulation, animations, event handling
- Dynamic content loading (AJAX/fetch)
- Interactive elements (accordions, tabs, sliders, carousels)
- Form validation and enhancement
- CSS class toggling for complex interactions
- Local storage for state persistence

### If Scripts Are Blocked in Code View (Likely for `<script>` tags)

**Alternative: `<head>` Injection + CSS Classes**
The recommended hybrid approach:
1. Add JavaScript via **Setup > Analytics & Tracking > `<head>` tag** (confirmed working pathway)
2. In the WYSIWYG content, use HTML with **CSS classes and data attributes** that the `<head>` JavaScript hooks into
3. This separates concerns: JS lives in `<head>`, HTML structure lives in content editor

**CSS-Only Alternatives (No JS Required)**
These work regardless of JavaScript capability:
- **CSS animations**: `@keyframes`, `transition`, `transform` (platform already uses these)
- **`:hover` effects**: Color changes, scaling, shadows, reveals
- **`:focus-within`**: Form interaction styling
- **Checkbox hack**: Toggle visibility without JS (using `<input type="checkbox">` + `<label>` + `~` combinator)
- **`:target` selector**: Anchor-based tab/accordion switching
- **`<details>`/`<summary>`**: Native HTML accordion (no CSS hack needed)
- **CSS Grid/Flexbox**: Responsive layouts
- **CSS custom properties**: Theming and dynamic values
- **`scroll-snap`**: Carousel-like scrolling
- **Media queries**: Responsive behavior

**Third-Party Embeds via Iframes**
- No evidence that iframes are blocked
- Could embed external widgets, maps, videos, forms
- Would need testing to confirm iframe survival through the editor

---

## 5. Recommended Testing Protocol

The human should test these scenarios in their BookingTimes editor:

### Test 1: Script Tag in Code View
```html
<script>document.getElementById('bt-test-1').textContent = 'JS WORKS';</script>
<div id="bt-test-1">JS NOT WORKING</div>
```
**Expected outcome**: If text changes to "JS WORKS", scripts survive the paste.

### Test 2: Inline Event Handler
```html
<button onclick="this.textContent='CLICKED'">Click to Test</button>
```
**Expected outcome**: If clicking changes the text, inline handlers survive.

### Test 3: jQuery Availability
```html
<script>$(document).ready(function(){$('#bt-test-3').text('jQuery WORKS');});</script>
<div id="bt-test-3">jQuery NOT WORKING</div>
```

### Test 4: `<head>` Injection
Add via **Setup > Analytics & Tracking**:
```html
<script>
document.addEventListener('DOMContentLoaded', function() {
  var el = document.querySelector('.bt-js-test');
  if (el) el.style.backgroundColor = 'green';
});
</script>
```
Then add to page content via editor:
```html
<div class="bt-js-test" style="padding:20px;background:red;color:white;">
  If this is GREEN, head injection works with content classes
</div>
```

### Test 5: CSS-Only Animation
```html
<style>
.bt-pulse { animation: bt-pulse 2s infinite; }
@keyframes bt-pulse { 0%,100% { opacity:1; } 50% { opacity:0.5; } }
</style>
<div class="bt-pulse" style="padding:20px;background:#007bff;color:white;text-align:center;">
  This should be pulsing if CSS animations work
</div>
```

---

## 6. Architecture Recommendation for Content Emulator V2.1

Based on this research, the Content Emulator should be designed with a **tiered interactivity model**:

### Tier 1: CSS-Only (Guaranteed to Work)
- Animations, transitions, hover effects
- Responsive layouts
- `<details>`/`<summary>` accordions
- Checkbox hacks for toggles

### Tier 2: `<head>` JavaScript + Content HTML (High Confidence)
- JavaScript added via Setup > Analytics & Tracking
- Content HTML uses classes/data-attributes as hooks
- Separation of JS and HTML editing contexts

### Tier 3: Inline JavaScript in Content (Needs Testing)
- `<script>` tags in code view paste
- Inline event handlers
- May or may not work depending on TinyMCE config

**Recommendation**: Build Tier 1 as the baseline, design for Tier 2 as the primary interactive model, and treat Tier 3 as a bonus if testing confirms it works.

---

## Sources

- [BookingTimes: Adding HTML](https://support.bookingtimes.com/docs/adding-html-1)
- [BookingTimes: Creating HTML Forms](https://support.bookingtimes.com/docs/creating-html-forms)
- [BookingTimes: Adding CSS](https://support.bookingtimes.com/docs/adding-css-1)
- [BookingTimes: Latest Release Notes](https://support.bookingtimes.com/docs/latest-release)
- [BookingTimes: Website Design Overview](https://support.bookingtimes.com/docs/website-design-overview-1)
- [BookingTimes: Web Designer](https://support.bookingtimes.com/docs/web-designer)
- [BookingTimes: How to Edit Your Website](https://support.bookingtimes.com/docs/how-to-edit-your-website-using-the-website-editor)
- [TinyMCE: Content Filtering Options](https://www.tiny.cloud/docs/tinymce/latest/content-filtering/)
- [TinyMCE: Security Guide](https://www.tiny.cloud/docs/tinymce/latest/security/)
- [TinyMCE: CSP Guide](https://www.tiny.cloud/docs/tinymce/latest/tinymce-and-csp/)
- Live site analysis: metrodriving.com.au, racsom.com.au
