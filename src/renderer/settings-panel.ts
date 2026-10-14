// 설정 (S-04) 임시 구현: PC 켜질 때 자동 실행. 디자인·앱 정보·창 안내는 6단계.
import { MESSAGES } from './messages';

export interface SettingsPanelElements {
  title: HTMLElement;
  autoLaunchCheckbox: HTMLInputElement;
  autoLaunchLabel: HTMLElement;
}

export function setupSettingsPanel(elements: SettingsPanelElements): void {
  const { title, autoLaunchCheckbox, autoLaunchLabel } = elements;
  title.textContent = MESSAGES.settingsTitle;
  autoLaunchLabel.textContent = MESSAGES.autoLaunch;

  void window.api.getSettings().then((settings) => {
    autoLaunchCheckbox.checked = settings.autoLaunch;
  });
  autoLaunchCheckbox.addEventListener('change', () =>
    window.api.setAutoLaunch(autoLaunchCheckbox.checked),
  );
}
