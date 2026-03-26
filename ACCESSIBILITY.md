# Accessibility Guidelines - Smart Waste Management System

## Overview

This document outlines accessibility standards and best practices for the Smart Waste Management System frontend application to ensure inclusivity for all users, including those with disabilities.

## WCAG 2.1 Compliance Target

We aim to meet **WCAG 2.1 Level AA** standards as the baseline for accessibility.

## Key Accessibility Features Implemented

### 1. Keyboard Navigation
- ✅ All interactive elements are keyboard accessible
- ✅ Tab order follows logical visual flow
- ✅ No keyboard traps
- ✅ Focus indicators are clearly visible
- ✅ Shortcut keys documented

**Implementation:**
```tsx
// Good: Button is keyboard accessible
<Button onClick={handleClick}>Click Me</Button>

// Good: Links are semantic
<a href="/bins">Manage Bins</a>

// Avoid: DIV with click handler (not keyboard accessible)
<div onClick={handleClick}>Click Me</div>
```

### 2. Screen Reader Support
- ✅ Semantic HTML elements used
- ✅ ARIA labels for non-semantic elements
- ✅ Form labels properly associated with inputs
- ✅ Dynamic content announcements

**Implementation:**
```tsx
// Good: Semantic heading
<h1>Bin Management</h1>

// Good: Proper form labeling
<label htmlFor="bin-id">Bin ID</label>
<input id="bin-id" type="text" />

// Good: ARIA labels for icon buttons
<Button aria-label="Delete bin" icon={<Trash2 />} />

// Good: Live region for dynamic updates
<div role="status" aria-live="polite" aria-atomic="true">
  {statusMessage}
</div>
```

### 3. Color Contrast
- ✅ Minimum contrast ratio of 4.5:1 for normal text
- ✅ Minimum contrast ratio of 3:1 for large text
- ✅ Color is not the only means of conveying information

**Status Colors with Alternative Indicators:**
```tsx
// Avoid: Using color alone
<Badge className="bg-red-500">Critical</Badge>

// Good: Color + text + icon
<Badge className="bg-red-500 flex items-center gap-2">
  <AlertTriangle className="h-4 w-4" />
  Critical
</Badge>
```

### 4. Alt Text for Images
- ✅ All images have descriptive alt text
- ✅ Decorative images have empty alt text
- ✅ Charts and graphs have text alternatives

**Implementation:**
```tsx
// Good: Descriptive alt text
<img src="/bin-status.png" alt="Waste bin fill level indicator showing 65%" />

// Good: Decorative image with empty alt
<img src="/decorative-line.png" alt="" />

// Good: Chart with description
<Chart data={data} >
  <figcaption>
    Our waste collection data shows an average fill rate of 45% across all bins.
  </figcaption>
</Chart>
```

### 5. Form Accessibility
- ✅ All form fields have associated labels
- ✅ Required fields are marked
- ✅ Error messages are clear and linked to fields
- ✅ Form instructions are provided

**Implementation:**
```tsx
<form>
  <div className="space-y-4">
    <div>
      <label htmlFor="email" className="block text-sm font-medium">
        Email Address <span className="text-red-500" aria-label="required">*</span>
      </label>
      <input
        id="email"
        type="email"
        aria-required="true"
        aria-describedby="email-error"
      />
      {error && (
        <p id="email-error" className="text-red-600 text-sm mt-1">
          {error}
        </p>
      )}
    </div>
  </div>
</form>
```

### 6. Motion & Animation
- ✅ Animations respect prefers-reduced-motion
- ✅ Animations are not essential for understanding
- ✅ Auto-playing content can be paused

**Implementation:**
```tsx
import { useReducedMotion } from 'framer-motion'

export function AnimatedCard() {
  const shouldReduceMotion = useReducedMotion()
  
  return (
    <motion.div
      animate={{ opacity: 1 }}
      transition={{
        duration: shouldReduceMotion ? 0 : 0.3
      }}
    >
      Content
    </motion.div>
  )
}
```

### 7. Text Sizing & Spacing
- ✅ Minimum font size of 16px for body text
- ✅ Line height of at least 1.5 for normal text
- ✅ Letter spacing of at least 0.12em
- ✅ Paragraph spacing of at least 2em

**CSS:**
```css
body {
  font-size: 16px;
  line-height: 1.5;
  letter-spacing: 0.02em;
}

p {
  margin-bottom: 1.5em;
}
```

### 8. Focus Management
- ✅ Focus is restored properly after modal closes
- ✅ Focus is moved to most important content on navigation
- ✅ Skip links provided for main content

**Implementation:**
```tsx
// Good: Dialog with focus management
export function Modal() {
  const [open, setOpen] = useState(false)
  const initialFocusRef = useRef(null)
  
  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      initialFocus={initialFocusRef}
    >
      <input ref={initialFocusRef} />
    </Dialog>
  )
}
```

### 9. Language & Structure
- ✅ Page language is specified
- ✅ Content is well-structured with headings
- ✅ Complex language is avoided
- ✅ Acronyms are defined on first use

**HTML:**
```html
<html lang="en">
  <head>...</head>
  <body>
    <h1>Main Page Title</h1>
    <h2>Section Heading</h2>
    <p>Content...</p>
  </body>
</html>
```

### 10. Responsive Design
- ✅ Content reflows without horizontal scrolling
- ✅ Touch targets are at least 44x44 CSS pixels
- ✅ Text can be zoomed to 200% without loss of functionality

**CSS:**
```css
button, a {
  min-width: 44px;
  min-height: 44px;
  padding: 0.75rem 1rem;
}

input {
  font-size: 16px; /* Prevents zoom on iOS */
}
```

## Automated Accessibility Testing

### Jest Testing Example
```typescript
import { axe, toHaveNoViolations } from 'jest-axe'
import { render } from '@testing-library/react'

expect.extend(toHaveNoViolations)

describe('Accessibility', () => {
  test('BinManagement has no accessibility violations', async () => {
    const { container } = render(<BinManagementIntegrated />)
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })
})
```

### Manual Testing Checklist
- [ ] Test with screen reader (NVDA, JAWS, VoiceOver)
- [ ] Navigate using keyboard only
- [ ] Test with browser zoom at 200%
- [ ] Test with Windows High Contrast mode
- [ ] Test color contrast with online tools
- [ ] Test with reduced motion enabled
- [ ] Test on mobile devices with screen reader

## Tools & Resources

### Testing Tools
- [axe DevTools](https://www.deque.com/axe/devtools/)
- [WAVE Browser Extension](https://wave.webaim.org/extension/)
- [Lighthouse](https://developers.google.com/web/tools/lighthouse)
- [Jest-axe](https://github.com/nickcolley/jest-axe)

### Screen Readers
- NVDA (Windows, Free)
- JAWS (Windows, Paid)
- VoiceOver (macOS/iOS, Built-in)
- TalkBack (Android, Built-in)

### Color Contrast Tools
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [Color Oracle](https://colororacle.org/) - Colorblindness simulator

### Learning Resources
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [WAI-ARIA Practices](https://www.w3.org/WAI/ARIA/apg/)
- [WebAIM Tutorials](https://webaim.org/)

## Component-Specific Guidelines

### Navigation & Menus
```tsx
// Good: Proper ARIA for navigation
<nav aria-label="Main navigation">
  <ul role="menubar">
    <li role="presentation">
      <a href="/bins" role="menuitem">Bins</a>
    </li>
  </ul>
</nav>
```

### Data Tables
```tsx
// Good: Accessible table structure
<table>
  <caption>Bin Status Overview</caption>
  <thead>
    <tr>
      <th scope="col">Bin ID</th>
      <th scope="col">Location</th>
      <th scope="col">Fill Level</th>
    </tr>
  </thead>
  <tbody>
    {/* Content */}
  </tbody>
</table>
```

### Modals & Dialogs
```tsx
// Good: Accessible dialog
<dialog
  role="dialog"
  aria-labelledby="dialog-title"
  aria-describedby="dialog-description"
>
  <h2 id="dialog-title">Confirm Action</h2>
  <p id="dialog-description">Are you sure?</p>
  <button>Cancel</button>
  <button>Confirm</button>
</dialog>
```

## Accessibility Checklist for New Features

Before deploying new features, ensure:

- [ ] WCAG 2.1 Level AA compliance verified
- [ ] Keyboard navigation tested
- [ ] Screen reader tested with NVDA/JAWS/VoiceOver
- [ ] Color contrast verified (4.5:1 for normal text)
- [ ] Focus management implemented
- [ ] Alt text provided for images
- [ ] Form labels properly associated
- [ ] Automated accessibility tests passing
- [ ] No keyboard traps present
- [ ] Touch targets are >= 44x44px
- [ ] Animation respects prefers-reduced-motion
- [ ] Documentation updated

## Accessibility Support

For accessibility issues or feedback:
1. Create an issue with the `accessibility` label
2. Include the failure mode (e.g., "Cannot navigate with keyboard")
3. Include the affected component/page
4. Provide browser and assistive technology information

---

**Last Updated:** March 2, 2026
**Version:** 1.0
**Target:** WCAG 2.1 Level AA
