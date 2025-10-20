export interface Todo {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface TodoInput {
  title: string;
  description: string;
}

export type UploadStatus = 'idle' | 'uploading' | 'success' | 'error';

export interface UploadResult {
  status: UploadStatus;
  message?: string;
  todoId?: string;
}
