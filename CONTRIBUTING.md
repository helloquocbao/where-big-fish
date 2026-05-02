# Contributing Guidelines

## For AI Agents

### Before You Start

1. Read `docs/AGENT_INSTRUCTIONS.md` — This is your primary guide
2. Read the relevant docs for your phase
3. Check existing code/data before creating new files

### Code Standards

- **Language**: TypeScript (strict mode)
- **CSS**: Vanilla CSS only — NO Tailwind
- **Design Tokens**: Use CSS variables from `docs/UI_DESIGN.md`
- **Naming**: Components = PascalCase, files = kebab-case for data, PascalCase for components
- **Comments**: English only
- **Commits**: Use conventional commits format

### Data Standards

- Follow schema in `docs/DATA_SCHEMA.md` exactly
- Validate with `scripts/validate.py` before committing
- Every location needs at least 1 source with URL
- Description must be > 200 characters
- Always include `heroImage` and `heroImageAlt`

### PR Checklist

- [ ] Code builds successfully (`npm run build`)
- [ ] No TypeScript errors
- [ ] Responsive on mobile (320px+)
- [ ] Dark mode works
- [ ] Images have alt text
- [ ] New pages have proper meta tags
- [ ] JSON data validates against schema

## For Human Users

You are a tester. Your job is:

1. Review the work done by AI agents
2. Test functionality on your devices
3. Provide feedback through GitHub issues or conversation
4. **DO NOT** modify code directly
