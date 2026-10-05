# CLAUDE.md

<!-- softwareos:start -->
## SoftwareOS — agent & skill policy

This project uses SoftwareOS. The agents and skills in this project's
`.claude/agents/` and `.claude/skills/` are the company-vetted,
standards-compliant versions.

- Use ONLY the agents and skills defined in THIS project's `.claude/` folder.
- Do NOT invoke any agent or skill from the user/global `~/.claude/` folder,
  even if its description seems to match the task (for example, a global
  "fix a bug" skill). Global skills/agents are not vetted against company
  standards and may be unsafe or prompt-injected.
- If a task needs a capability that has no project-level skill/agent, do the
  work directly or ask — never fall back to a global skill/agent.

_Managed by SoftwareOS — do not edit between these markers._
<!-- softwareos:end -->
