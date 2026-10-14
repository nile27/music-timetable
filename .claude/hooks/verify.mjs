// 응답을 끝내기 전 실행: src에 변경이 있으면 typecheck → lint → test.
// 실패하면 exit 2 → Claude가 멈추지 않고 오류를 고치게 된다.
import { readFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';

const input = JSON.parse(readFileSync(0, 'utf8') || '{}');
// 이미 이 훅 때문에 다시 작업 중이면 무한 반복을 막기 위해 통과시킨다.
if (input.stop_hook_active) process.exit(0);

const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const pkgPath = path.join(root, 'package.json');
if (!existsSync(pkgPath)) process.exit(0);

try {
  const changed = execSync('git status --porcelain -- src', { cwd: root, encoding: 'utf8' });
  if (!changed.trim()) process.exit(0);
} catch {
  /* git이 없으면 항상 검사 */
}

const scripts = JSON.parse(readFileSync(pkgPath, 'utf8')).scripts ?? {};
const failures = [];
for (const name of ['typecheck', 'lint', 'test']) {
  if (!scripts[name]) continue;
  try {
    execSync(`npm run ${name}`, { cwd: root, stdio: 'pipe', encoding: 'utf8' });
  } catch (e) {
    const out = `${e.stdout ?? ''}${e.stderr ?? ''}`.trim().split('\n').slice(-40).join('\n');
    failures.push(`## npm run ${name} 실패\n${out}`);
  }
}

if (failures.length) {
  console.error(`끝내기 전에 아래 오류를 고쳐주세요.\n\n${failures.join('\n\n')}`);
  process.exit(2);
}
process.exit(0);
