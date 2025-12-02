# Security Policy

## Supported Versions

We release patches for security vulnerabilities. Which versions are eligible for receiving such patches depends on the CVSS v3.0 Rating:

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

Please report (suspected) security vulnerabilities to **[security@yourdomain.com]** or through GitHub Security Advisories.

You will receive a response within 48 hours. If the issue is confirmed, we will release a patch as soon as possible depending on complexity but historically within a few days.

## Security Best Practices

When using StressMaster:

1. **Never commit API keys or secrets** - Use environment variables or config files excluded from version control
2. **Validate all inputs** - The tool validates inputs, but be cautious with user-provided commands
3. **Keep dependencies updated** - Run `npm audit` regularly
4. **Use secure AI providers** - Ensure your AI provider API keys are kept secure
5. **Review generated K6 scripts** - Before executing, review generated scripts for safety

## Known Security Considerations

- File resolution searches project directory - ensure sensitive files are not in project root
- AI provider API keys should be stored securely (environment variables, not in code)
- Generated K6 scripts execute with system permissions - review before running

