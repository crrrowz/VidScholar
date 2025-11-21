// src/utils/activeInputTracker.ts

let activeInput: HTMLTextAreaElement | HTMLInputElement | null = null;
let lastActiveInput: HTMLTextAreaElement | HTMLInputElement | null = null;

export function setActiveInput(inputElement: HTMLTextAreaElement | HTMLInputElement | null): void {
  activeInput = inputElement;
  if (inputElement !== null) {
    lastActiveInput = inputElement;
  }
}

export function getActiveInput(): HTMLTextAreaElement | HTMLInputElement | null {
  return activeInput;
}

export function getLastActiveInput(): HTMLTextAreaElement | HTMLInputElement | null {
  return lastActiveInput;
}