import { Request, Response } from 'express';

import { hocuspocusServer } from '@/servers';
import { logger } from '@/utils';

type DocumentVersionBoundaryRequestQuery = {
  room?: string;
};

const VERSION_BOUNDARY_MESSAGE = JSON.stringify({
  type: 'document-version-boundary',
});

export const documentVersionBoundaryHandler = (
  req: Request<object, object, object, DocumentVersionBoundaryRequestQuery>,
  res: Response,
) => {
  const room = req.query.room;

  if (!room) {
    res.status(400).json({ error: 'Room name not provided' });
    return;
  }

  const document = hocuspocusServer.hocuspocus.documents.get(room);

  if (document) {
    document.broadcastStateless(VERSION_BOUNDARY_MESSAGE);
  }

  logger('Document version boundary broadcast for room:', room);
  res.status(200).json({ message: 'Document version boundary broadcast' });
};
