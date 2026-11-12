/// <reference types="vite/client" />

import type { ReeGoApi } from "../electron/preload";

declare global {
  interface Window {
    reeGo: ReeGoApi;
  }
}

export {};
