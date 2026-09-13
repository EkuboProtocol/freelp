# UX verification

Skills installed for this revision: Anthropic frontend-design and webapp-testing. Review also used Vercel Web Interface Guidelines and React performance guidance. The visual brief remains monochrome, unbranded, and based on system fonts.

Local Lighthouse baseline: mobile performance 98, accessibility 95, best practices 96, SEO 82. After fixes: mobile 97/100/100/100; desktop 100/100/100/100. The v0.1.1 CI release scored mobile 96/100/100/100 and desktop 100/100/100/100. Scores measure these audit categories, not an overall UX certification, and performance can vary between machines.

Axe reports zero violations for WCAG A/AA checks through 2.2 and applicable best practices across Positions, Create, Settings, Deploy, Terms, About, and the token dialog at 390px and 1440px. No horizontal overflow was found. The populated position-management UI is also checked within each real local-chain transaction lifecycle.

Changes include visible current navigation, a working keyboard skip link, labeled dialogs, minimum button targets, reduced-motion support, sufficient secondary-text contrast, copyable launch commands, explicit setup actions, readable token symbols with full-address tooltips, independent per-chain portfolio responses, and a keyboard/touch control for exploring the liquidity graph. Position actions wait for fresh on-chain state after transactions, preventing a second action from using the pre-transaction position snapshot.

Manual browser checks cover keyboard navigation, dialog opening/Escape/focus return, and mobile rendering. Browser tests exercise token imports, independent network settings, informational terms without transaction gating, browser contract/fetcher deployment, pool discovery and liquidity display, and complete native/ERC20/nonstandard-token LP lifecycles.

CI retains raw accessibility and Lighthouse JSON reports with each release. It requires zero accessibility violations and no overflow, with Lighthouse thresholds of performance 90, accessibility 100, best practices 95, and SEO 90. These checks are complemented by functional tests; there is no invented aggregate UX score.

Web Interface Guidelines findings resolved in this revision:

- src/styles.css: network overview subtitle contrast; touch targets; reduced motion; numeric alignment.
- src/App.tsx: skip link, active navigation, and executable distribution guidance. IPFS preview links are supplied by CI, outside the app.
- src/CurrencySelect.tsx: explicit dialog name and search-field metadata.
- src/PositionsPage.tsx: setup/empty-state actions, readable pairs, and stale-state action gating.
- src/LiquidityChart.tsx and src/RangeFields.tsx: cancellable pointer selection and keyboard-editable range bounds.
- index.html: missing description and favicon; public/robots.txt avoids invalid SPA fallback responses.
