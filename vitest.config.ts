import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    // 실제 사용 환경(한국 PC)과 같은 시간대로 고정한다. 그래야 UTC로 날짜를 만들면
    // 오전 9시 전에 하루가 밀리는 버그를 테스트에서 실제로 재현할 수 있다.
    env: { TZ: 'Asia/Seoul' },
  },
});
