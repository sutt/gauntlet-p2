import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  Timestamp,
  QuerySnapshot,
  DocumentData,
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import { Todo, TodoInput, UploadResult } from '@/types/todo';

const COLLECTION_NAME = 'sample_todos';

/**
 * Convert Firestore timestamp to Date
 */
const timestampToDate = (timestamp: any): Date => {
  if (timestamp?.toDate) {
    return timestamp.toDate();
  }
  return new Date();
};

/**
 * Convert Firestore document to Todo object
 */
const convertDocToTodo = (doc: any): Todo => {
  const data = doc.data();
  return {
    id: doc.id,
    title: data.title,
    description: data.description,
    completed: data.completed || false,
    createdAt: timestampToDate(data.createdAt),
    updatedAt: timestampToDate(data.updatedAt),
  };
};

/**
 * Create a new todo in Firestore
 */
export const createTodo = async (todoInput: TodoInput): Promise<UploadResult> => {
  try {
    const now = Timestamp.now();
    const docRef = await addDoc(collection(db, COLLECTION_NAME), {
      title: todoInput.title,
      description: todoInput.description,
      completed: false,
      createdAt: now,
      updatedAt: now,
    });

    return {
      status: 'success',
      message: 'Todo created successfully',
      todoId: docRef.id,
    };
  } catch (error) {
    console.error('Error creating todo:', error);
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to create todo',
    };
  }
};

/**
 * Get all todos from Firestore
 */
export const getTodos = async (): Promise<Todo[]> => {
  try {
    const q = query(collection(db, COLLECTION_NAME), orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map(convertDocToTodo);
  } catch (error) {
    console.error('Error getting todos:', error);
    return [];
  }
};

/**
 * Subscribe to real-time updates for todos
 */
export const subscribeTodos = (
  callback: (todos: Todo[]) => void,
  onError?: (error: Error) => void
): (() => void) => {
  try {
    const q = query(collection(db, COLLECTION_NAME), orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(
      q,
      (querySnapshot) => {
        const todos = querySnapshot.docs.map(convertDocToTodo);
        callback(todos);
      },
      (error) => {
        console.error('Error in todos subscription:', error);
        if (onError) {
          onError(error);
        }
      }
    );

    return unsubscribe;
  } catch (error) {
    console.error('Error setting up subscription:', error);
    if (onError && error instanceof Error) {
      onError(error);
    }
    return () => {};
  }
};

/**
 * Update a todo's completed status
 */
export const updateTodoStatus = async (
  todoId: string,
  completed: boolean
): Promise<UploadResult> => {
  try {
    const todoRef = doc(db, COLLECTION_NAME, todoId);
    await updateDoc(todoRef, {
      completed,
      updatedAt: Timestamp.now(),
    });

    return {
      status: 'success',
      message: 'Todo updated successfully',
      todoId,
    };
  } catch (error) {
    console.error('Error updating todo:', error);
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to update todo',
    };
  }
};

/**
 * Delete a todo from Firestore
 */
export const deleteTodo = async (todoId: string): Promise<UploadResult> => {
  try {
    await deleteDoc(doc(db, COLLECTION_NAME, todoId));

    return {
      status: 'success',
      message: 'Todo deleted successfully',
      todoId,
    };
  } catch (error) {
    console.error('Error deleting todo:', error);
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to delete todo',
    };
  }
};
