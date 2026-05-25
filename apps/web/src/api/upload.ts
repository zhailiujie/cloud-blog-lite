import { http } from "./http";

const MAX_IMAGE_SIZE = 1 * 1024 * 1024;

interface ApiResponse<T> {
  code: number;
  message: string;
  data: T | null;
}

export interface UploadResult {
  key: string;
  url: string;
}

export async function uploadFile(file: File) {
  if (file.size > MAX_IMAGE_SIZE) {
    throw new Error("图片大小不能超过 1MB");
  }

  const form = new FormData();
  form.append("file", file);
  const response = await http.post<ApiResponse<UploadResult>>(
    "/admin/upload",
    form,
  );
  return response.data.data;
}
