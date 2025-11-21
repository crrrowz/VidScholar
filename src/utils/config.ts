// utils/config.ts
import type { Config } from '../types';
import configData from '../config/config.json';

class ConfigLoader {
  private static instance: ConfigLoader;
  private config: Config;

  private constructor() {
    this.config = configData as Config;
  }

  public static getInstance(): ConfigLoader {
    if (!ConfigLoader.instance) {
      ConfigLoader.instance = new ConfigLoader();
    }
    return ConfigLoader.instance;
  }

  public getConfig(): Config {
    return this.config;
  }

  public getProjectInfo() {
    return this.config.project;
  }

  public getIcons() {
    return this.config.icons;
  }

  public getTheme(theme: 'light' | 'dark') {
    return this.config.theme[theme];
  }

  public getTwitterColor() {
    return this.config.theme.twitter;
  }

  public getStorageConfig() {
    return this.config.storage;
  }

  public getPresets() {
    return this.config.presets;
  }

  public getPreset(presetNumber: number) {
    return this.config.presets[presetNumber.toString()];
  }

  public getUIConfig() {
    return this.config.ui;
  }

  public getHashtag() {
    return this.config.project.hashtag;
  }
}

export const config = ConfigLoader.getInstance();
export default config;