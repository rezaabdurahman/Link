interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_API_URL?: string;
  readonly VITE_APP_MODE?: string;
  readonly VITE_ENABLE_MOCKING?: string;
  readonly VITE_SENTRY_DSN?: string;
  readonly VITE_SENTRY_ENVIRONMENT?: string;
  readonly VITE_APP_VERSION?: string;
  readonly VITE_METRICS_EXPORT_URL?: string;
  readonly VITE_METRICS_EXPORT_INTERVAL?: string;
  readonly VITE_ENABLE_PERFORMANCE_TRACKING?: string;
  readonly VITE_ENABLE_ERROR_TRACKING?: string;
  readonly VITE_ENABLE_USER_JOURNEY_TRACKING?: string;
  readonly DEV: boolean;
  readonly PROD: boolean;
  readonly MODE: string;
  readonly NODE_ENV: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
