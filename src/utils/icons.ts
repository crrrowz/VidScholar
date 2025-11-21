// utils/icons.ts

export function addMaterialIconsSupport(): void {
  if (document.querySelector('link[href*="Material+Icons"]')) {
    return;
  }

  const style = document.createElement('style');
  style.textContent = `
    .material-icons {
      font-family: 'Material Icons';
      font-size: 24px;
      line-height: 1;
      display: inline-block;
      vertical-align: middle;
    }
  `;
  document.head.appendChild(style);

  const link = document.createElement('link');
  link.href = 'https://fonts.googleapis.com/icon?family=Material+Icons';
  link.rel = 'stylesheet';
  document.head.appendChild(link);
}