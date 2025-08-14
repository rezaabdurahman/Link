# Component Development Checklist

## Overview
This checklist ensures all components meet our design system standards, accessibility requirements, and quality criteria before being merged.

## ✅ Design System Compliance

### Colors & Tokens
- [ ] Uses design system color tokens (no hardcoded hex values)
- [ ] Follows semantic color usage (semantic.success, semantic.danger, etc.)
- [ ] Uses surface.* tokens for backgrounds
- [ ] Uses text.* tokens for typography

### Spacing & Sizing
- [ ] Uses standardized size system (xs, sm, md, lg, xl)
- [ ] Uses Tailwind spacing scale (no arbitrary values)
- [ ] Follows consistent padding/margin patterns

### Typography
- [ ] Uses design system font scale
- [ ] Follows font weight hierarchy
- [ ] Uses appropriate line-height for readability

### Variants & States
- [ ] Implements consistent variant naming (primary, secondary, outline, ghost, danger)
- [ ] Has proper disabled state styling
- [ ] Includes loading state where applicable
- [ ] Handles error/success states appropriately

## ♿ Accessibility Requirements (WCAG 2.1 AA)

### Keyboard Navigation
- [ ] All interactive elements are keyboard accessible
- [ ] Focus indicators are clearly visible
- [ ] Tab order is logical and intuitive
- [ ] Supports arrow key navigation where appropriate (menus, tabs)

### Screen Reader Support
- [ ] Has appropriate ARIA labels and roles
- [ ] Uses semantic HTML elements where possible
- [ ] Provides context for state changes
- [ ] Includes screen reader-only text where helpful (`sr-only`)

### Color & Contrast
- [ ] All text meets WCAG AA contrast ratios (4.5:1 for normal text)
- [ ] Important information isn't conveyed by color alone
- [ ] Supports high contrast mode
- [ ] Color-blind friendly design

### Motion & Animation
- [ ] Respects `prefers-reduced-motion` setting
- [ ] Animations are not essential for functionality
- [ ] No flashing content above 3Hz
- [ ] Animation duration is reasonable (<0.5s for micro-interactions)

### Form Controls (if applicable)
- [ ] Has associated labels
- [ ] Includes helpful error messages
- [ ] Shows validation states clearly
- [ ] Supports autocomplete attributes

## 🧪 Testing Requirements

### Unit Tests
- [ ] Component renders without crashing
- [ ] All variants render correctly
- [ ] Props are handled appropriately
- [ ] Event handlers work as expected
- [ ] Error boundaries are tested

### Accessibility Tests
- [ ] Passes automated axe-core tests
- [ ] Manual keyboard navigation tested
- [ ] Screen reader tested (NVDA/VoiceOver)
- [ ] High contrast mode tested

### Visual Tests
- [ ] All variants documented in Storybook
- [ ] Responsive design tested
- [ ] Dark mode support (future)
- [ ] Browser compatibility verified

## 📖 Documentation Requirements

### Props Documentation
- [ ] All props documented with descriptions
- [ ] Default values specified
- [ ] Types clearly defined
- [ ] Examples provided for complex props

### Usage Examples
- [ ] Basic usage example
- [ ] Common patterns demonstrated
- [ ] Edge cases covered
- [ ] Integration examples

### Accessibility Notes
- [ ] Screen reader behavior documented
- [ ] Keyboard shortcuts listed
- [ ] ARIA attributes explained
- [ ] When to use vs alternatives

## 🏗️ Code Quality

### TypeScript
- [ ] Strict type checking enabled
- [ ] No `any` types used unnecessarily
- [ ] Props interface properly defined
- [ ] Generic types used appropriately

### Performance
- [ ] No unnecessary re-renders
- [ ] Memoization used where beneficial
- [ ] Lazy loading implemented if needed
- [ ] Bundle size impact considered

### Maintainability
- [ ] Code is self-documenting
- [ ] Complex logic is commented
- [ ] No duplication with existing components
- [ ] Follows established patterns

## 🔍 Review Process

### Self-Review Checklist
1. [ ] Run `npm run lint` - no errors
2. [ ] Run `npm run type-check` - no errors  
3. [ ] Run `npm run test` - all tests pass
4. [ ] Run `npm run audit:a11y` - no critical issues
5. [ ] Manual accessibility testing completed

### Peer Review Requirements
- [ ] Design system compliance verified
- [ ] Accessibility requirements met
- [ ] Code quality standards met
- [ ] Documentation is complete
- [ ] Tests provide adequate coverage

## 📋 Component Submission Template

When submitting a new component, include:

```markdown
## Component: [ComponentName]

### Design System Compliance
- [ ] Uses design system tokens
- [ ] Follows variant patterns
- [ ] Implements standard sizes

### Accessibility
- [ ] WCAG 2.1 AA compliant
- [ ] Keyboard accessible
- [ ] Screen reader friendly
- [ ] Reduced motion support

### Testing
- [ ] Unit tests written
- [ ] Accessibility tests pass
- [ ] Manual testing completed

### Documentation
- [ ] Props documented
- [ ] Usage examples provided
- [ ] Storybook stories added

### Notes
[Any special considerations or implementation notes]
```

## 🚀 Automation

### Pre-commit Hooks
- ESLint and Prettier formatting
- TypeScript type checking
- Basic test suite
- Automated accessibility scanning

### CI/CD Pipeline
- Full test suite
- Visual regression testing
- Accessibility audit
- Bundle size analysis

## 📚 Resources

### Tools
- [axe-core](https://github.com/dequelabs/axe-core) - Accessibility testing
- [Storybook](https://storybook.js.org/) - Component documentation
- [React Testing Library](https://testing-library.com/react) - Testing utilities

### Guidelines
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [Inclusive Components](https://inclusive-components.design/)
- [Accessibility Developer Guide](https://www.accessibility-developer-guide.com/)

---

**Remember:** This checklist ensures consistency, quality, and accessibility across all components. It's better to ship fewer, high-quality components than many inconsistent ones.
