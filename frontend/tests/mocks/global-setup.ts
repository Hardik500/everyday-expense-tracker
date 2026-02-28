import { setupWorker } from 'msw/node';
import { handlers } from './mocks/handlers';

const worker = setupWorker(...handlers);

export default async () => {
  await worker.start({
    onUnhandledRequest: 'bypass',
  });
};
