// Fails if a fresh build differs from the index (staged or committed) dist/,
// including new untracked files. Stage the rebuilt dist/ and this passes pre-commit.
import { execSync } from 'node:child_process';

const run = (cmd) => execSync(cmd).toString();
const changed = run('git diff --name-status -- dist');
const untracked = run('git ls-files --others --exclude-standard -- dist');
if (changed || untracked) {
  console.error(`dist/ is out of sync with the build:\n${changed}${untracked}`);
  process.exit(1);
}
