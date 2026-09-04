# Security hook playbook (copy to another repo)

Use this file to add the **same virus / malware scan flow** to a new project.
Do not reinvent it. Copy the files, then tune only the deploy/Vercel bits.

Working reference repos (latest hook):

- `dynamicdreamz-self`
- `oqtec-website-2025`
- `Donj-headless`

---

## What you get

| Layer | When it runs | Needs developer setup? |
| --- | --- | --- |
| Local pre-commit | Every `git commit` | Optional. Installed by `npm install` / `pnpm install` |
| Deploy GitHub Action | On `main` only, on the VPS before install | No — scan must pass or the rest is skipped |

Git **cannot** turn on local hooks from a clone/pull (that would be remote code execution).
That is why `prepare` writes `.git/hooks/pre-commit` after install, and why GitHub always scans.

---

## 1. Copy the hook

From a reference repo, copy:

```text
.githooks/pre-commit
```

Then:

```bash
chmod +x .githooks/pre-commit
bash .githooks/pre-commit --install
```

`--install` writes a small trampoline to `.git/hooks/pre-commit`.
Do **not** set `git config core.hooksPath`.
Do **not** overwrite Husky if the target repo already uses `.husky/` — call `.githooks/pre-commit` from Husky instead.

### What the hook does

- Indicator scan for known malware strings (NullReceiver / fake-font campaign)
- `polin-rider-scanner` (`npx` unless installed locally)
- **Fonts:** keep real WOFF/WOFF2/TTF/OTF. Remove a font-named file **only** if it is a JS/malware payload. Do not ignore `*.woff2` in `.gitignore`
- CI: `bash .githooks/pre-commit --ci` (scan only, no file deletes)

Bypass (local only):

```bash
SKIP_SECURITY_SCAN=1 git commit ...
SKIP_SCANNER=1 git commit ...          # skip npx scanner only
git commit --no-verify                 # skip all hooks
```

GitHub / Vercel ignore those bypasses.

---

## 2. Auto-install after clone (`package.json`)

Add these scripts (keep your existing `build` steps after the scan):

```json
{
  "scripts": {
    "security:scan": "bash .githooks/pre-commit --ci",
    "prepare": "git rev-parse --is-inside-work-tree >/dev/null 2>&1 && bash .githooks/pre-commit --install || true"
  }
}
```

New teammate:

```bash
git clone <repo>
npm install          # or: pnpm install
git commit ...       # scan runs automatically — no git config
```

If they commit **without** install, local hook will not run. Deploy still scans on `main`.

---

## 3. GitHub Action (deploy only)

Do **not** scan on every push or pull request. Run the scan in the **deploy** workflow on `main`, after code is synced to the server and **before** `pnpm install` / build.

See `.github/workflows/deploy.yml`.

---

## 4. Gate GitHub deploy (VPS / self-hosted)

Validate on GitHub first. Scan on the server after `git reset` / sync and **before** install/build.
If that fails, restore the previous commit and skip restart.

```yaml
      - name: Virus / malware scan (block server deploy if infected)
        id: malware_scan
        run: |
          set -euo pipefail
          cd "${{ env.VPS_APP_PATH }}"
          bash .githooks/pre-commit --ci

      - name: Restore previous release after failed scan
        if: ${{ failure() && steps.malware_scan.outcome == 'failure' && env.PREV_SHA != '' }}
        run: |
          set -euo pipefail
          cd "${{ env.VPS_APP_PATH }}"
          git reset --hard "${{ env.PREV_SHA }}"
```

Reference: `Donj-headless/.github/workflows/deploy.yml`

---

## 5. Gate Vercel (or any `npm run build` host)

Prefix the existing `build` script so a hosted build scans first:

```json
{
  "scripts": {
    "build": "bash -c 'if [ \"${VERCEL:-}\" = \"1\" ] || [ \"${GITHUB_ACTIONS:-}\" = \"true\" ]; then bash .githooks/pre-commit --ci; fi' && <your existing build>"
  }
}
```

If the scan fails, Vercel does not ship that commit.

Optional: Vercel Git settings → require a passing deploy/build check.

Amplify / other CI: run `bash .githooks/pre-commit --ci` in **preBuild**, before `npm ci` / `npm run build`.

---

## 6. Checklist for a new repo

- [ ] Copy `.githooks/pre-commit` and `chmod +x`
- [ ] Add `prepare` + `security:scan` in `package.json`
- [ ] Do **not** add a per-push / per-PR scan workflow
- [ ] Do **not** add `*.woff2` to `.gitignore`
- [ ] If the repo deploys from GitHub: scan on the VPS after sync, before install
- [ ] If the repo deploys on Vercel: scan inside `build` when `VERCEL=1`
- [ ] Run `bash .githooks/pre-commit --install`
- [ ] Verify: `bash .githooks/pre-commit --ci`
- [ ] Commit and push the hook + deploy workflow (not `.git/hooks/`)
- [ ] Protect `main`: require a pull request, block force pushes

---

## 7. Verify

```bash
bash .githooks/pre-commit --install
bash .githooks/pre-commit --ci
```

Expect: indicator scan passed, then scanner `safe=true` (vendor hits under `node_modules/` / `.next/` are ignored).

---

## Tune per project

Keep the hook and GitHub workflow the same.
Change only:

- Node version in the workflow if the app is not on 22
- Package manager (`npm` vs `pnpm`) — `prepare` still runs on install
- Deploy job names / server path
- Vercel vs Amplify vs VPS gating snippet
