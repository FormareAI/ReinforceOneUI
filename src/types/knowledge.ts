export interface KnowledgeFile {
  key: string;
  type: 'file' | 'directory';
  size: number;
  last_modified: number;
  etag: string;
}

export interface KnowledgeFileListResponse {
  success: boolean;
  message?: string;
  data?: {
    files: KnowledgeFile[];
    directories: KnowledgeFile[];
  };
}

export interface KnowledgeFileContentResponse {
  success: boolean;
  message?: string;
  data?: {
    content: string;
  };
}

export interface KnowledgeDownloadResponse {
  success: boolean;
  message?: string;
  data?: {
    download_url: string;
  };
}

