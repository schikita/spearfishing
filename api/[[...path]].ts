let backend: Promise<{ app: import('express').Express; ready: Promise<void> }> | null = null;

function getBackend() {
  if (!backend) backend = import('../backend/dist/index.js');
  return backend;
}

export default async function handler(
  req: import('http').IncomingMessage,
  res: import('http').ServerResponse
) {
  const { app, ready } = await getBackend();
  await ready;
  return new Promise<void>((resolve, reject) => {
    app(req, res);
    res.once('finish', resolve);
    res.once('close', resolve);
    res.once('error', reject);
  });
}
