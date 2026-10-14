# Security policy

## Supported deployment

The application is under active development. The repository does not currently define a supported production release channel or a guaranteed security-fix SLA. Deployments should track a reviewed, pinned revision and update dependencies and application code deliberately.

## Reporting a vulnerability

Do not report suspected vulnerabilities in a public issue, discussion, or pull request. Use GitHub's private vulnerability reporting or Security Advisories for this repository when available. Include:

- Affected revision, endpoint or feature, and deployment assumptions
- Steps to reproduce using a local or otherwise authorized environment
- The security impact and any practical mitigation
- Logs or proof-of-concept details with secrets, customer data, and personal information removed

Do not access, alter, or disclose another person's data while investigating. Do not include live credentials, tokens, production database exports, or exploitable payloads in public channels.

If private reporting is unavailable, contact the repository maintainers privately through an established channel before sharing technical details publicly.

## Security-sensitive changes

Authentication, permission checks, account status, warehouse scoping, file uploads, and inventory-changing operations are security boundaries. Changes in these areas should include authorization regression tests and should be reviewed alongside their API routes and middleware. See [the architecture guide](./docs/ARCHITECTURE.md) and [the API reference](./docs/API_REFERENCE.md).
