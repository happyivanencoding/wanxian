# 万仙之一 · 浮生问道

Independent Chinese single-player cultivation life simulator. This repository is not 一方洞天 or 修仙宗门.

## Authority and workflow
- Read README.md and docs/DESIGN.md before material gameplay changes.
- Source in src/game is authoritative for implemented rules; do not infer features from aspirational prose.
- Keep simulation deterministic: seeded random state lives in Game; never call Math.random inside a running simulation.
- UI components must call engine actions instead of mutating simulation state directly.
- All advertised buttons must work; unfinished functionality should not be presented as complete.
- Core play is offline after local assets load, no external API or account required.
- This is a pre-release prototype: the current save schema is authoritative. Breaking gameplay changes may bump the save version and storage key; do not add migration code, legacy adapters, or old-save compatibility tests. A new release may start a new life. Always validate imports against the current schema before replacing active data.
- Keep local ports consistent: http://localhost:5188. Do not add startup services or deploy a public website without authorization.
- The sole GitHub repository for this game is https://github.com/happyivanencoding/wanxian (remote origin, branch main). The user authorized uploading this game's future verified development changes to this repository. After a meaningful change passes required tests, commit and push it to this origin; report its commit SHA and distinguish Git publishing from website deployment. Never force-push or overwrite remote changes blindly. Never publish secrets, save files or dependencies. Keep generated builds out of main; the authorized gh-pages release branch contains only the built static site.

## Public release
- Public publishing was explicitly authorized on 2026-10-30. Use the existing repository's gh-pages branch and tools/publish-pages.ps1; verify the actual public site after deployment. Keep the optional StartLux helper local; the Pages build has no model backend and makes no API requests. Do not add unrelated VPS services, tunnels or startup agents.

## Validation
Run npm run build and npm test after engine/UI changes. Run npm run test:browser with the app running for material interaction changes. Tests should cover time/event boundaries, costs, breakthrough/death, persistence and visible responsive behavior.

## Handoff
Update docs/DESIGN.md and README.md when implemented behavior changes. Record meaningful changes and current tested state in C:\dev\ProjectMemory\Projects\wanxian-life, then refresh that project. Do not manually edit generated memory indexes. Publish verified changes to happyivanencoding/wanxian per the user's standing instruction, while distinguishing local implementation, tests, Git commit/push, website deployment and human acceptance.
