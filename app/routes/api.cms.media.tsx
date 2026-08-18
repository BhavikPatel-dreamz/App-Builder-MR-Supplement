import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

import {
  createStagedUpload,
  finalizeUpload,
  listImages,
  uploadImage,
  type UploadContentType,
} from "../lib/shopify-files.server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);

  const url = new URL(request.url);
  const page = Number(url.searchParams.get("page") || "1");
  const perPage = Number(url.searchParams.get("perPage") || "20");
  const search = url.searchParams.get("q") || "";

  try {
    const result = await listImages(admin, session.shop, {
      page: Number.isFinite(page) && page > 0 ? page : 1,
      perPage: Number.isFinite(perPage) && perPage > 0 ? perPage : 20,
      search,
    });

    return Response.json(result);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to load media library." },
      { status: 500 },
    );
  }
};

const ALLOWED_CONTENT_TYPES: UploadContentType[] = ["VIDEO", "FILE", "IMAGE"];

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);

  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const step = new URL(request.url).searchParams.get("step");

  // Step 1: hand the browser a staged target so it can upload the file directly
  // to Shopify storage, bypassing the Vercel 4.5 MB request-body limit.
  if (step === "stage") {
    try {
      const body = await request.json();
      const filename = String(body?.filename || "").trim();
      if (!filename) {
        return Response.json({ error: "A filename is required." }, { status: 400 });
      }
      const info = await createStagedUpload(admin, {
        filename,
        mimeType: body?.mimeType ? String(body.mimeType) : undefined,
        fileSize: Number(body?.fileSize) || undefined,
      });
      return Response.json(info);
    } catch (error) {
      return Response.json(
        { error: error instanceof Error ? error.message : "Failed to prepare upload." },
        { status: 500 },
      );
    }
  }

  // Step 3: register the already-uploaded file with Shopify and return its url.
  if (step === "finalize") {
    try {
      const body = await request.json();
      const resourceUrl = String(body?.resourceUrl || "").trim();
      const contentType = String(body?.contentType || "") as UploadContentType;
      if (!resourceUrl || !ALLOWED_CONTENT_TYPES.includes(contentType)) {
        return Response.json(
          { error: "resourceUrl and a valid contentType are required." },
          { status: 400 },
        );
      }
      const item = await finalizeUpload(admin, session.shop, {
        resourceUrl,
        filename: String(body?.filename || "upload"),
        contentType,
      });
      return Response.json(item, { status: 201 });
    } catch (error) {
      return Response.json(
        { error: error instanceof Error ? error.message : "Failed to finalize upload." },
        { status: 500 },
      );
    }
  }

  // Legacy path: raw file POST (small files only; hits the Vercel body limit).
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return Response.json({ error: "A file upload is required." }, { status: 400 });
  }

  try {
    const item = await uploadImage(admin, session.shop, file);
    return Response.json(item, { status: 201 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to upload media." },
      { status: 500 },
    );
  }
};
