/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module '*.module.css' {
  const classes: { readonly [key: string]: string };
  export default classes;
}

interface Window {
  ym?: (id: number, action: string, ...args: unknown[]) => void;
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
}
