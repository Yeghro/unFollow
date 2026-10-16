// Fails if dist/ differs from what is committed, including new untracked files.
import { execSync } from 'node:child_process';

const out = execSync('git status --porcelain -- dist').toString();
if (out) {
  console.error(`dist/ is out of sync with the build:\n${out}`);
  process.exit(1);
}
