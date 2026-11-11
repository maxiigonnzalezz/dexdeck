// Tipos compartidos por la interfaz de DexDeck.

export type ThemeName = 'light' | 'dark' | 'glass';

export type SystemInfo = {
  os: string;
  osName: string;
  architecture: string;
};

export type InstallationInfo = {
  kind: 'windowsNsis' | 'appImage' | 'deb' | 'debNoPackageManager' | 'unsupported';
  canUpdate: boolean;
  canUninstall: boolean;
  message: string;
};

export type AppUpdateState =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'installing'
  | 'current'
  | 'manual'
  | 'error';

export type ExecutableMetadata = {
  name: string;
  version: string | null;
  companyName: string | null;
  description: string | null;
};
