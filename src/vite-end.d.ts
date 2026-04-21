/// <reference types="vite/client" />

declare module '*.md?raw' {
  const content: string
  export default content
}
declare const GITHUB_RUNTIME_PERMANENT_NAME: string
declare const BASE_KV_SERVICE_URL: string

interface ImportMetaEnv {
	readonly VITE_SUPABASE_URL: string
	readonly VITE_SUPABASE_ANON_KEY: string
	readonly VITE_AUTH_REDIRECT_URL?: string
}

interface ImportMeta {
	readonly env: ImportMetaEnv
}