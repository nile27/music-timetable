// SettingsStore: userData/settings.json 읽기·쓰기.
import { readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { AppSettings } from '../shared/types';
import { createDefaultSettings, parseSettings } from './settings-rules';

export class SettingsStore {
  private settings: AppSettings = createDefaultSettings();
  /** 저장을 순서대로 하나씩 처리한다 (볼륨을 빠르게 바꿀 때 이전 저장이 나중 저장을 덮지 않게). */
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(private readonly filePath: string) {}

  async load(): Promise<void> {
    let raw: unknown;
    try {
      raw = JSON.parse(await readFile(this.filePath, 'utf8'));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        // 처음 설치: 기본 시간표로 바로 동작하도록 기본값을 파일로 만들어 둔다 (FR-33).
        console.info(`[settings] 설정 파일이 없어 기본값으로 만듭니다: ${this.filePath}`);
        await this.save({});
        return;
      }
      console.warn('[settings] 설정 파일이 깨져서 기본값으로 시작합니다', error);
      raw = null;
    }

    const { settings, fixedFields } = parseSettings(raw);
    this.settings = settings;
    if (fixedFields.length > 0) {
      console.warn(`[settings] 기본값으로 바꾼 항목: ${fixedFields.join(', ')}`);
      await this.save({});
    }
  }

  get(): AppSettings {
    return this.settings;
  }

  /** 메모리 값은 바로 바꾸고, 파일 쓰기는 순서대로 처리한다. 쓰기 실패해도 앱은 계속 동작한다. */
  save(patch: Partial<Omit<AppSettings, 'version'>>): Promise<void> {
    this.settings = { ...this.settings, ...patch };
    const snapshot = JSON.stringify(this.settings, null, 2);
    this.writeQueue = this.writeQueue
      .then(() => this.writeAtomically(snapshot))
      .catch((error: unknown) => console.warn('[settings] 설정을 저장하지 못했습니다', error));
    return this.writeQueue;
  }

  /** 임시 파일에 다 쓴 뒤 이름을 바꾼다. 쓰는 도중 꺼져도 settings.json이 반쯤 쓰인 채로 남지 않는다. */
  private async writeAtomically(content: string): Promise<void> {
    const tempPath = path.join(path.dirname(this.filePath), `.${path.basename(this.filePath)}.tmp`);
    await writeFile(tempPath, content, 'utf8');
    await rename(tempPath, this.filePath);
  }
}
