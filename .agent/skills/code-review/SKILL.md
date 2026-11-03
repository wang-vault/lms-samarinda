---
name: code-review
description: Comprehensive guidelines for code reviews. Covers TypeScript strictness, React 19 / Next.js patterns, security vulnerabilities, performance anti-patterns, and severity triage.
---

# Code Review & Quality Assurance Skill

Standard operating procedure for performing rigorous, production-grade code reviews.

## 1. Review Checklist & Pillars

### A. Correctness & Logic
- [ ] Does the implementation actually solve the requirement without edge-case regressions?
- [ ] Are null/undefined scenarios, empty arrays, and failed promise rejections handled?
- [ ] Are boundaries, type promotions, and mathematical operations exact?

### B. Security & Authorization
- [ ] **Auth Enforcement**: Every sensitive route, Server Action, and Route Handler must verify session authentication AND user role permissions.
- [ ] **SQL Injection / Injection Attacks**: Are query builders (e.g. Drizzle) or parameterized queries used exclusively? No raw string concatenation in SQL.
- [ ] **XSS Protection**: Is user input escaped properly? Avoid `dangerouslySetInnerHTML` unless explicitly sanitized.
- [ ] **Secrets Leaks**: Verify no API keys, private tokens, or database connection strings are exposed in client-side code or git commits.

### C. Performance & Resource Management
- [ ] Are heavy loops or redundant database queries avoided (e.g., N+1 query problem)?
- [ ] Are DB queries running in parallel via `Promise.all` where independent?
- [ ] Are expensive client components avoiding unnecessary re-renders?

### D. TypeScript & Typing Standards
- [ ] No unwarranted `any` types. Use explicit interfaces, generics, or `unknown` with type guards.
- [ ] Shared database models and API contracts must use shared TypeScript types.

## 2. Severity Triage Labels

When providing feedback or reviewing pull requests:
- **[P0 - Blocker]**: Critical bug, security vulnerability, broken build, or data loss risk. Must fix before merge.
- **[P1 - Major]**: Inefficient query, missing authorization check, or significant edge case failure.
- **[P2 - Minor]**: Code style deviation, missing comment for complex logic, or optimization opportunity.
- **[P3 - Nitpick]**: Purely aesthetic suggestion or minor naming preference. Optional to address.
