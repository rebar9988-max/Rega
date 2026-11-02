# Governance, Security, and Safety

## Permission model

- Existing authentication and RBAC are the source of truth.
- Every tool call must enforce authorization server-side, for the current user and relevant business.
- Business data access must respect the existing BusinessMember relationship and business scope.
- No agent receives SUPER_ADMIN privileges or inherits permissions from a prompt.
- Never rely on model-generated claims that a user is authorized.

## Approval gates

Explicit owner or authorized-user approval is required before:

- Production deployment or production configuration changes
- Database migrations, destructive writes, bulk edits, or data deletion
- Public publishing, outbound messages, or changes to user/business accounts
- Financial, billing, advertising, subscription, or payment-related operations
- Changing roles, permissions, security settings, or access boundaries
- Adding any dependency or external service with cost, licensing, privacy, or operational implications

## Threat handling

Consider prompt injection, malicious user content, poisoned retrieval sources, tool misuse, data exfiltration, cross-tenant access, denial of service, hallucinated facts, unsafe generated code, and dependency/supply-chain risks.

Controls should include:

- Treat retrieved and tool-returned content as untrusted.
- Keep system policy separate from user/retrieved content.
- Use strict schemas, allowlists, output validation, and bounded tool permissions.
- Re-check authorization immediately before every sensitive operation.
- Redact secrets and personal data from logs; never log prompts or credentials unnecessarily.
- Apply rate limits, request budgets, timeouts, and bounded retries.
- Require human confirmation for consequential actions.
- Provide a deterministic fallback when AI is unavailable or uncertain.

## Evaluation

Each agent or AI feature needs tests for normal behavior, invalid input, prompt injection, permission denial, cross-business isolation, rate limits, timeouts, provider failure, localization, accessibility, and regression risk as relevant.

## Incident response

On suspected data exposure, unauthorized action, cost risk, or unsafe behavior: disable the affected feature using the existing safe control, preserve relevant non-sensitive evidence, notify the owner, assess impact, and do not silently resume. Do not make destructive remediation changes without approval.

## Reporting vocabulary

- **PASS:** acceptance criteria met and supported by test/verification evidence.
- **FAIL:** a required criterion failed.
- **BLOCKED:** verification or safe implementation is prevented by missing access, approval, evidence, or a dependency.
- **NOT RUN:** a check was not executed.

Never describe a change as deployed or production-verified based only on a local test or merged pull request.
