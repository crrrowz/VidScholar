// components/ui/Button.ts

export function createDivButton(
  icon: string | null,
  text: string | null,
  onClick: (e: MouseEvent) => void,
  id?: string,
  variant: 'default' | 'primary' | 'success' | 'danger' | 'ghost' = 'default'
): HTMLDivElement {
  const button = document.createElement("div");
  button.className = `btn btn--${variant}`; 
  button.setAttribute('role', 'button');
  button.tabIndex = 0;

  if (id) {
    button.id = id;
  }
  
  if (icon) {
    const iconSpan = document.createElement("span");
    iconSpan.className = "material-icons";
    iconSpan.textContent = icon;
    button.appendChild(iconSpan);
  }

  if (text) {
    const textSpan = document.createElement("span");
    textSpan.textContent = text;
    if (icon) {
      textSpan.style.marginLeft = '8px';
    }
    button.appendChild(textSpan);
  }

  button.addEventListener("click", onClick);
  button.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      onClick(e as any);
    }
  });
  
  return button;
}

export function createButton(
  icon: string | null,
  text: string | null,
  onClick: (e: MouseEvent) => void,
  id?: string,
  variant: 'default' | 'primary' | 'success' | 'danger' | 'ghost' = 'default'
): HTMLButtonElement {
  const button = document.createElement("button");
  button.className = `btn btn--${variant}`; 

  if (id) {
    button.id = id;
  }
  
  if (icon) {
    const iconSpan = document.createElement("span");
    iconSpan.className = "material-icons";
    iconSpan.textContent = icon;
    button.appendChild(iconSpan);
  }

  if (text) {
    const textSpan = document.createElement("span");
    textSpan.textContent = text;
    if (icon) {
      textSpan.style.marginLeft = '8px';
    }
    button.appendChild(textSpan);
  }

  button.addEventListener("click", onClick);
  
  return button;
}
