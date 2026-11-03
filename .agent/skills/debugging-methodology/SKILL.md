---
name: debugging-methodology
description: Hypothesis-driven, systematic debugging workflow. Prevents trial-and-error noise and ensures fast, accurate root-cause isolation and permanent fixes.
---

# Systematic Debugging Methodology

A structured protocol for diagnosing and resolving software bugs, build failures, and runtime errors.

## Core Rule: "No Trial-and-Error Fixes"
Never make random code edits hoping something works. Always follow the 4-phase debugging cycle.

---

## The 4-Phase Debugging Protocol

### Phase 1: Reproduce & Capture
1. **Gather Evidence**: Collect exact error messages, HTTP status codes, terminal logs, and browser console stack traces.
2. **Isolate Environment**: Identify Node.js version, package versions, environment variables, and active flags.
3. **Establish Reproduction**: Verify whether the issue reproduces consistently on local development vs. production builds.

### Phase 2: Trace & Localize
1. **Inspect Stack Traces**: Trace backwards from the point of failure to the root entry point in project source code.
2. **Check Configuration Layer First**: Many modern framework bugs (especially Next.js / Tailwind v4) originate from configuration mismatches (`package.json`, `next.config.ts`, `postcss.config.mjs`) rather than component logic.
3. **Verify Data Boundaries**: Log or inspect data at network boundaries, database responses, and component prop passing.

### Phase 3: Form & Test Hypothesis
1. **State the Root Cause**: Articulate a single, falsifiable hypothesis (e.g., *"Tailwind classes fail to generate because Webpack mode lacks PostCSS processor"*).
2. **Targeted Test**: Test the hypothesis directly before changing business logic.

### Phase 4: Fix, Verify & Prevent Regression
1. **Apply Minimal Targeted Fix**: Address the root cause directly without unnecessary refactoring of adjacent code.
2. **Build Verification**: Run type checking (`tsc --noEmit`) and full production build (`npm run build`) to ensure clean compilation.
3. **Verify Solution**: Test both the fixed case and surrounding unaffected flows.
