import { createMediaRecord } from "./cms.server";
import {
  inferMimeTypeFromFilename,
  isAudioLikeMedia,
  isVideoLikeMedia,
  resolveUploadMimeType,
} from "./media-utils";

type ShopifyAdminClient = {
  graphql: (
    query: string,
    options?: { variables?: Record<string, unknown> },
  ) => Promise<Response>;
};

export type MediaItem = {
  id: string;
  url: string;
  alt?: string;
  title?: string;
  mimeType?: string;
  type?: "image" | "video" | "file";
  width?: number;
  height?: number;
};

type ListImagesInput = {
  page: number;
  perPage: number;
  search?: string;
};

type ListImagesResult = {
  items: MediaItem[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
};

function throwOnGraphqlErrors(
  json: { errors?: Array<{ message?: string }> },
  fallback: string,
) {
  const message = json.errors?.[0]?.message;
  if (message) {
    throw new Error(message);
  }
  if (json.errors?.length) {
    throw new Error(fallback);
  }
}

const LIST_FILES_QUERY = `#graphql
  query CmsListFiles($first: Int!, $after: String, $query: String) {
    files(
      first: $first
      after: $after
      query: $query
      sortKey: CREATED_AT
      reverse: true
    ) {
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        node {
          id
          alt
          ... on MediaImage {
            mimeType
            image {
              url
              altText
              width
              height
            }
          }
          ... on GenericFile {
            mimeType
            url
          }
          ... on Video {
            originalSource {
              url
              mimeType
            }
            sources {
              url
              mimeType
              format
            }
          }
        }
      }
    }
  }`;

const STAGED_UPLOADS_MUTATION = `#graphql
  mutation CmsStagedUploadsCreate($input: [StagedUploadInput!]!) {
    stagedUploadsCreate(input: $input) {
      stagedTargets {
        url
        resourceUrl
        parameters {
          name
          value
        }
      }
      userErrors {
        field
        message
      }
    }
  }`;

const FILE_CREATE_MUTATION = `#graphql
  mutation CmsFileCreate($files: [FileCreateInput!]!) {
    fileCreate(files: $files) {
      files {
        id
        alt
        fileStatus
        ... on MediaImage {
          image {
            url
            altText
          }
          mimeType
        }
        ... on GenericFile {
          url
          mimeType
        }
        ... on Video {
          originalSource {
            url
            mimeType
          }
          sources {
            url
            mimeType
            format
          }
        }
      }
      userErrors {
        field
        message
      }
    }
  }`;

// fileCreate returns as soon as the record exists — for an image that's before
// Shopify finishes processing it, so image.url is still null and fileStatus is
// UPLOADED, not READY. Re-fetch the node by id until the CDN url is populated.
const FILE_STATUS_QUERY = `#graphql
  query CmsFileStatus($id: ID!) {
    node(id: $id) {
      ... on File {
        id
        alt
        fileStatus
        ... on MediaImage {
          mimeType
          image {
            url
            altText
            width
            height
          }
        }
        ... on GenericFile {
          url
          mimeType
        }
        ... on Video {
          originalSource {
            url
            mimeType
          }
          sources {
            url
            mimeType
            format
          }
        }
      }
    }
  }`;

type VideoSourceNode = {
  url?: string | null;
  mimeType?: string | null;
  format?: string | null;
};

type FileNode = {
  id: string;
  alt?: string | null;
  fileStatus?: string | null;
  type?: string | null;
  mimeType?: string | null;
  image?: {
    url?: string | null;
    altText?: string | null;
    width?: number | null;
    height?: number | null;
  } | null;
  url?: string | null;
  originalSource?: VideoSourceNode | null;
  sources?: VideoSourceNode[] | null;
};

function pickVideoUrl(node: Pick<FileNode, "originalSource" | "sources">): string | null {
  const sources = node.sources ?? [];
  const mp4 = sources.find((source) =>
    (source.mimeType || "").toLowerCase().includes("video/mp4"),
  );
  if (mp4?.url) return mp4.url;
  if (sources[0]?.url) return sources[0].url;
  if (node.originalSource?.url) return node.originalSource.url;
  return null;
}

function pickVideoMimeType(
  node: Pick<FileNode, "originalSource" | "sources">,
): string | undefined {
  const sources = node.sources ?? [];
  const mp4 = sources.find((source) =>
    (source.mimeType || "").toLowerCase().includes("video/mp4"),
  );
  if (mp4?.mimeType) return mp4.mimeType;
  if (sources[0]?.mimeType) return sources[0].mimeType;
  if (node.originalSource?.mimeType) return node.originalSource.mimeType;
  return undefined;
}

function isVideoNode(node: FileNode): boolean {
  return Boolean(
    node.originalSource ||
      node.sources?.length ||
      pickVideoUrl(node) ||
      pickVideoMimeType(node),
  );
}

function toMediaItem(node: FileNode): MediaItem | null {
  const videoUrl = pickVideoUrl(node);
  const videoMime = pickVideoMimeType(node);
  const isVideo = isVideoNode(node);
  const url = node.image?.url || videoUrl || node.url;

  if (!url) {
    return null;
  }

  const resolvedMime =
    node.mimeType ||
    videoMime ||
    (isVideo ? "video/mp4" : undefined);

  return {
    id: node.id,
    url,
    alt: node.image?.altText || node.alt || undefined,
    title: node.alt || undefined,
    mimeType: resolvedMime,
    type: isVideo ? "video" : node.image?.url ? "image" : "file",
    width: node.image?.width ?? undefined,
    height: node.image?.height ?? undefined,
  };
}

export async function listImages(
  admin: ShopifyAdminClient,
  shop: string,
  { page, perPage, search = "" }: ListImagesInput,
): Promise<ListImagesResult> {
  const term = search.trim();
  const query = term ? `filename:*${term}*` : undefined;
  const targetIndex = (page - 1) * perPage;

  let after: string | undefined;
  let cursor = 0;
  const collected: MediaItem[] = [];
  let hasNextPage = true;

  while (hasNextPage && collected.length < targetIndex + perPage) {
    const response = await admin.graphql(LIST_FILES_QUERY, {
      variables: {
        first: Math.min(perPage, 50),
        after,
        query,
      },
    });

    const json = await response.json();
    throwOnGraphqlErrors(json, "Failed to load media library.");
    const connection = json.data?.files;

    if (!connection) {
      break;
    }

    for (const edge of connection.edges ?? []) {
      const item = toMediaItem(edge.node);
      if (!item) continue;

      if (cursor >= targetIndex && collected.length < perPage) {
        collected.push(item);
      }

      cursor += 1;
    }

    hasNextPage = connection.pageInfo?.hasNextPage ?? false;
    after = connection.pageInfo?.endCursor ?? undefined;

    if (!hasNextPage) {
      break;
    }
  }

  const total = cursor;
  const totalPages = Math.max(1, Math.ceil(total / perPage));

  return {
    items: collected,
    total,
    page,
    perPage,
    totalPages,
  };
}

async function pollFileUntilReady(
  admin: ShopifyAdminClient,
  id: string,
  {
    attempts = 15,
    delayMs = 700,
  }: { attempts?: number; delayMs?: number } = {},
): Promise<MediaItem | null> {
  for (let i = 0; i < attempts; i += 1) {
    const response = await admin.graphql(FILE_STATUS_QUERY, {
      variables: { id },
    });
    const json = await response.json();
    throwOnGraphqlErrors(json, "Failed to check uploaded file status.");
    const node = json.data?.node;

    if (node) {
      // FAILED — stop early; the CDN url will never appear.
      if (node.fileStatus === "FAILED") {
        return null;
      }

      const item = toMediaItem(node);
      if (item) {
        return item;
      }
    }

    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  return null;
}

async function uploadToStagedTarget(
  target: {
    url: string;
    parameters: Array<{ name: string; value: string }>;
  },
  file: File,
) {
  const formData = new FormData();

  for (const parameter of target.parameters) {
    formData.append(parameter.name, parameter.value);
  }

  formData.append("file", file);

  const uploadResponse = await fetch(target.url, {
    method: "POST",
    body: formData,
  });

  if (!uploadResponse.ok) {
    throw new Error(`Failed to upload file to Shopify storage (${uploadResponse.status}).`);
  }
}

export type StagedUploadTarget = {
  url: string;
  resourceUrl: string;
  parameters: Array<{ name: string; value: string }>;
};

export type UploadContentType = "VIDEO" | "FILE" | "IMAGE";

export type StagedUploadInfo = {
  target: StagedUploadTarget;
  contentType: UploadContentType;
};

// Step 1 of the direct upload: ask Shopify for a staged target the browser can
// POST the file to directly. The file never passes through our server, so the
// Vercel 4.5 MB request-body limit does not apply.
export async function createStagedUpload(
  admin: ShopifyAdminClient,
  input: { filename: string; mimeType?: string; fileSize?: number },
): Promise<StagedUploadInfo> {
  const mimeType =
    (input.mimeType || "").trim() ||
    inferMimeTypeFromFilename(input.filename) ||
    "application/octet-stream";
  const isVideo = isVideoLikeMedia({ type: mimeType, mimeType });
  const isAudio = isAudioLikeMedia({ type: mimeType, mimeType });
  const contentType: UploadContentType = isVideo
    ? "VIDEO"
    : isAudio
      ? "FILE"
      : "IMAGE";

  const stagedInput: Record<string, string> = {
    filename: input.filename,
    mimeType,
    resource: contentType,
    httpMethod: "POST",
  };
  // Shopify requires fileSize for VIDEO/FILE staged uploads.
  if ((isVideo || isAudio) && input.fileSize) {
    stagedInput.fileSize = String(input.fileSize);
  }

  const stagedResponse = await admin.graphql(STAGED_UPLOADS_MUTATION, {
    variables: { input: [stagedInput] },
  });

  const stagedJson = await stagedResponse.json();
  throwOnGraphqlErrors(stagedJson, "Failed to create staged upload target.");
  const stagedTarget = stagedJson.data?.stagedUploadsCreate?.stagedTargets?.[0];
  const stagedErrors = stagedJson.data?.stagedUploadsCreate?.userErrors ?? [];

  if (!stagedTarget?.url || stagedErrors.length > 0) {
    throw new Error(
      stagedErrors[0]?.message || "Failed to create staged upload target.",
    );
  }

  return { target: stagedTarget, contentType };
}

// Step 3 of the direct upload: after the browser has pushed the bytes to the
// staged target, register the file with Shopify and wait for the CDN url.
export async function finalizeUpload(
  admin: ShopifyAdminClient,
  shop: string,
  input: {
    resourceUrl: string;
    filename: string;
    contentType: UploadContentType;
  },
): Promise<MediaItem> {
  const createResponse = await admin.graphql(FILE_CREATE_MUTATION, {
    variables: {
      files: [
        {
          alt: input.filename,
          contentType: input.contentType,
          originalSource: input.resourceUrl,
        },
      ],
    },
  });

  const createJson = await createResponse.json();
  throwOnGraphqlErrors(createJson, "Failed to create Shopify file.");
  const createdFile = createJson.data?.fileCreate?.files?.[0];
  const createErrors = createJson.data?.fileCreate?.userErrors ?? [];

  if (!createdFile || createErrors.length > 0) {
    throw new Error(createErrors[0]?.message || "Failed to create Shopify file.");
  }

  const isSlowMedia =
    input.contentType === "VIDEO" || input.contentType === "FILE";

  // Processing is async — the url is usually absent on this first response.
  // Fall back to polling the node by id until the CDN url lands.
  const item =
    toMediaItem(createdFile) ??
    (await pollFileUntilReady(
      admin,
      createdFile.id,
      isSlowMedia ? { attempts: 45, delayMs: 1000 } : { attempts: 15, delayMs: 700 },
    ));

  if (!item) {
    throw new Error("Shopify file was created without a public URL.");
  }

  await createMediaRecord(shop, {
    shopifyFileId: item.id,
    url: item.url,
    alt: item.alt,
    title: item.title,
    mimeType: item.mimeType,
  });

  return item;
}

// Legacy server-side upload: file passes through this server. Kept for callers
// that still POST the raw file; subject to the Vercel 4.5 MB body limit. Prefer
// the direct browser upload (createStagedUpload + finalizeUpload).
export async function uploadImage(
  admin: ShopifyAdminClient,
  shop: string,
  file: File,
): Promise<MediaItem> {
  const mimeType = resolveUploadMimeType(file);
  const { target, contentType } = await createStagedUpload(admin, {
    filename: file.name,
    mimeType,
    fileSize: file.size,
  });

  await uploadToStagedTarget(target, file);

  return finalizeUpload(admin, shop, {
    resourceUrl: target.resourceUrl,
    filename: file.name,
    contentType,
  });
}
