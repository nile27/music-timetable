// 편집 직후 실행: Prettier 포맷 + 프로젝트 금지 규칙 검사.
// 위반이 있으면 exit 2 → stderr 내용이 Claude에게 전달되어 바로 고치게 된다.
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const input = JSON.parse(readFileSync(0, 'utf8') || '{}');
const filePath = input.tool_input?.file_path;
const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
if (!filePath || !existsSync(filePath)) process.exit(0);

const rel = path.relative(root, filePath).split(path.sep).join('/');
if (!rel.startsWith('src/')) process.exit(0);

// 1) 포맷 (Prettier가 설치돼 있을 때만)
const prettier = path.join(root, 'node_modules', '.bin', 'prettier');
if (/\.(ts|tsx|css|html|json)$/.test(rel) && existsSync(prettier)) {
  try {
    execFileSync(prettier, ['--write', filePath], { stdio: 'ignore' });
  } catch {
    /* 포맷 실패는 lint 단계에서 다시 잡힌다 */
  }
}

if (!/\.tsx?$/.test(rel)) process.exit(0);

// 2) 금지 규칙 검사 (주석은 제외하고 검사)
const code = readFileSync(filePath, 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|[^:])\/\/.*$/gm, '$1');

const rules = [
  [/\.toISOString\(/, 'toISOString() 금지: UTC라 한국 오전 9시 전 날짜가 밀립니다. src/shared 날짜 유틸을 쓰세요.'],
  [/nodeIntegration\s*:\s*true/, 'nodeIntegration: true 금지'],
  [/contextIsolation\s*:\s*false/, 'contextIsolation: false 금지'],
  [/sandbox\s*:\s*false/, 'sandbox: false 금지'],
  [/:\s*any\b|\bas any\b|<any>/, 'any 타입 금지: unknown으로 받고 검사하세요.'],
  [/ipc(Main|Renderer)\.(on|once|handle|invoke|send)\(\s*['"`]/, 'IPC 채널 문자열 직접 사용 금지: src/shared/ipc-channels.ts 상수를 쓰세요.'],
];
if (rel.startsWith('src/renderer/')) {
  rules.push([/\bipcRenderer\b/, 'renderer에서 ipcRenderer 사용 금지: window.api를 쓰세요.']);
  rules.push([/\b(file|f)\.path\b/, 'File.path는 Electron 32부터 제거됨: preload의 webUtils.getPathForFile을 쓰세요.']);
  if (!rel.endsWith('messages.ts')) {
    rules.push([/['"`][^'"`\n]*[가-힣][^'"`\n]*['"`]/, '한국어 문구 직접 사용 금지: src/renderer/messages.ts에 모으세요.']);
  }
}

const hits = rules.filter(([re]) => re.test(code)).map(([, msg]) => `- ${msg}`);
if (hits.length) {
  console.error(`[규칙 위반] ${rel}\n${hits.join('\n')}\n(CLAUDE.md 금지 사항 참고)`);
  process.exit(2);
}
process.exit(0);
