/// <reference types="vite/client" />
/// <reference types="@iwsdk/vite-plugin-dev/client" />

interface ImportMetaEnv {
  /** Only TT_PUBLIC_ variables reach the client. Never put a key behind this prefix. */
  readonly TT_PUBLIC_BACKEND_URL?: string;
  readonly TT_PUBLIC_BUILD_ID?: string;
  /** 'on' shows sign-in (the bookplate, the phone page) and gates the AI Storyteller on it. Off by default. */
  readonly TT_PUBLIC_ACCOUNTS?: string;
}
