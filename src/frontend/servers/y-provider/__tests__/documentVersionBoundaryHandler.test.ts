import request from 'supertest';
import { v4 as uuid } from 'uuid';
import { describe, expect, test, vi } from 'vitest';

vi.mock('../src/env', async (importOriginal) => ({
  ...(await importOriginal()),
  COLLABORATION_SERVER_ORIGIN: 'http://localhost:3000',
  COLLABORATION_SERVER_SECRET: 'test-secret-api-key',
}));

import { hocuspocusServer, initApp } from '@/servers';

const endpoint = '/collaboration/api/document-version-boundary/';

describe('Document version boundary', () => {
  test('rejects requests without a room', async () => {
    const response = await request(initApp())
      .post(endpoint)
      .set('Authorization', 'test-secret-api-key');

    expect(response.status).toBe(400);
    expect(response.body).toStrictEqual({ error: 'Room name not provided' });
  });

  test('broadcasts the boundary to every connection in the room', async () => {
    const room = uuid();
    const document = await hocuspocusServer.hocuspocus.createDocument(
      room,
      {},
      uuid(),
      { isAuthenticated: true, readOnly: false },
      {},
    );
    const broadcast = vi.spyOn(document, 'broadcastStateless');

    const response = await request(initApp())
      .post(`${endpoint}?room=${room}`)
      .set('Authorization', 'test-secret-api-key');

    expect(response.status).toBe(200);
    expect(broadcast).toHaveBeenCalledWith(
      JSON.stringify({ type: 'document-version-boundary' }),
    );
  });
});
