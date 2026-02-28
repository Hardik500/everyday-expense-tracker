import { beforeAll, afterEach, afterAll } from '@playwright/test';
import { worker } from './browser';

beforeAll(async () => {
  await worker.start({
    onUnhandledRequest: 'bypass',
    serviceWorker: {
      url: '/mockServiceWorker.js',
    },
  });
});

afterEach(async () => {
  worker.resetHandlers();
});

afterAll(async () => {
  await worker.stop();
});
