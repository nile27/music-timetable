// 설정 (S-04, Figma 9:2): 자동 실행, 앱 정보, 창 안내. 별도 종료 버튼은 두지 않는다 (FR-34).
import { createToggle, el, isToggleOn, setToggle } from './dom';
import { MESSAGES } from './messages';

export function setupSettingsPanel(container: HTMLElement): void {
  const autoLaunchToggle = createToggle(MESSAGES.autoLaunch);
  const versionValue = el('span', 'info-value');
  const holidayValue = el('span', 'info-value');

  container.replaceChildren(
    el('h1', 'page-title', MESSAGES.settingsTitle),
    el(
      'div',
      'settings-card',
      el(
        'div',
        'settings-item',
        el(
          'div',
          '',
          el('p', 'settings-item-title', MESSAGES.autoLaunch),
          el('p', 'settings-item-desc', MESSAGES.autoLaunchDesc),
        ),
        autoLaunchToggle,
      ),
      el('div', 'settings-divider'),
      el(
        'div',
        'app-info',
        el('p', 'settings-item-title', MESSAGES.appInfoTitle),
        el(
          'div',
          'info-rows',
          el('p', 'info-row', el('span', 'info-key', MESSAGES.appVersion), versionValue),
          el('p', 'info-row', el('span', 'info-key', MESSAGES.holidayInfo), holidayValue),
        ),
      ),
    ),
    el('p', 'window-guide', MESSAGES.windowGuide),
  );

  autoLaunchToggle.addEventListener('click', () => {
    const isEnabled = !isToggleOn(autoLaunchToggle);
    setToggle(autoLaunchToggle, isEnabled);
    window.api.setAutoLaunch(isEnabled);
  });

  void window.api
    .getSettings()
    .then((settings) => setToggle(autoLaunchToggle, settings.autoLaunch));
  void window.api.getAppInfo().then((info) => {
    versionValue.textContent = info.version;
    holidayValue.textContent = MESSAGES.holidayUntil(info.holidayLastYear);
  });
}
