import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  enabled: import.meta.env.PROD,
  integrations: [
    Sentry.browserTracingIntegration(),
  ],
  tracesSampleRate: 0.1,
  beforeSend(event) {
    if (event.request?.data) {
      event.request.data = "[scrubbed]";
    }
    if (event.breadcrumbs) {
      event.breadcrumbs = event.breadcrumbs.filter(
        (bc) => bc.category !== "ui.input"
      );
    }
    return event;
  },
  initialScope: {
    tags: { app: "proveit-student" },
  },
});
