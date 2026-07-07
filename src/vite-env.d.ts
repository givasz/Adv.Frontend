/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_USE_REAL_API?: string
  readonly VITE_OLLAMA_MODEL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
