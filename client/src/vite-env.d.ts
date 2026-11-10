/// <reference types="vite/client" />
/// <reference types="@iwsdk/vite-plugin-dev/client" />

interface ImportMetaEnv {
  /** Only TT_PUBLIC_ variables reach the client. Never put a key behind this prefix. */
  readonly TT_PUBLIC_BACKEND_URL?: string;
}
