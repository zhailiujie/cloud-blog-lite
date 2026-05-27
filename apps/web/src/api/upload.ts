import { http, type ApiResponse } from "./http";

const MAX_IMAGE_SIZE = 1 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/x-icon",
]);



export interface UploadResult {
  key: string;
  url: string;
}

export async function uploadFile(file: File) {
  if (file.size > MAX_IMAGE_SIZE) {
    throw new Error("图片大小不能超过 1MB");
  }

  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    throw new Error("仅支持 JPG、PNG、WebP、GIF、ICO 图片");
  }

  const form = new FormData();
  form.append("file", file);
  const response = await http.post<ApiResponse<UploadResult>>(
    "/admin/upload",
    form,
  );
  return response.data.data;
}
