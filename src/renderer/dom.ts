// 화면 요소를 짧게 만들기 위한 도우미. 글자는 textContent로만 넣는다 (곡 제목 등 HTML로 해석되지 않게).

type Child = Node | string | null | undefined | false;

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className = '',
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (className) element.className = className;
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    element.append(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return element;
}

/** 켜기/끄기 토글 (디자인 60×34). 상태는 aria-checked로 보여주고 스타일도 그걸로 바꾼다. */
export function createToggle(label: string): HTMLButtonElement {
  const toggle = el('button', 'toggle', el('span', 'toggle-knob'));
  toggle.type = 'button';
  toggle.setAttribute('role', 'switch');
  toggle.setAttribute('aria-checked', 'false');
  toggle.setAttribute('aria-label', label);
  return toggle;
}

export function setToggle(toggle: HTMLButtonElement, isOn: boolean): void {
  toggle.setAttribute('aria-checked', String(isOn));
}

export function isToggleOn(toggle: HTMLButtonElement): boolean {
  return toggle.getAttribute('aria-checked') === 'true';
}
