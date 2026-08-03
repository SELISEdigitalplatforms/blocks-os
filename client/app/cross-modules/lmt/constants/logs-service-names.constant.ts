export type LmtLogCollections = {
  api: string;
  worker: string;
};

export const getLmtLogCollections = (serviceSlug: string): LmtLogCollections => ({
  api: `blocks-${serviceSlug}`,
  worker: `blocks-${serviceSlug}-worker`,
});
