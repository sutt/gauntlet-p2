import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Todo, TodoInput, UploadResult } from '@/types/todo';
import { createTodo, subscribeTodos, updateTodoStatus, deleteTodo } from '@/services/firestore';

export default function TodosScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  // Todos state
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);

  // Upload status state
  const [uploadStatus, setUploadStatus] = useState<UploadResult>({
    status: 'idle',
  });

  // Subscribe to real-time updates
  useEffect(() => {
    const unsubscribe = subscribeTodos(
      (updatedTodos) => {
        setTodos(updatedTodos);
        setLoading(false);
      },
      (error) => {
        console.error('Subscription error:', error);
        setLoading(false);
        Alert.alert('Error', 'Failed to load todos. Please check your Firebase configuration.');
      }
    );

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, []);

  const handleCreateTodo = async () => {
    if (!title.trim()) {
      Alert.alert('Validation Error', 'Please enter a title for the todo');
      return;
    }

    // Set uploading status
    setUploadStatus({ status: 'uploading' });

    const todoInput: TodoInput = {
      title: title.trim(),
      description: description.trim(),
    };

    const result = await createTodo(todoInput);
    setUploadStatus(result);

    if (result.status === 'success') {
      // Clear form
      setTitle('');
      setDescription('');

      // Clear success message after 3 seconds
      setTimeout(() => {
        setUploadStatus({ status: 'idle' });
      }, 3000);
    }
  };

  const handleToggleTodo = async (todoId: string, completed: boolean) => {
    await updateTodoStatus(todoId, !completed);
  };

  const handleDeleteTodo = async (todoId: string, todoTitle: string) => {
    Alert.alert('Delete Todo', `Are you sure you want to delete "${todoTitle}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteTodo(todoId);
        },
      },
    ]);
  };

  const getStatusColor = () => {
    switch (uploadStatus.status) {
      case 'uploading':
        return colors.tint;
      case 'success':
        return '#4CAF50';
      case 'error':
        return '#F44336';
      default:
        return colors.text;
    }
  };

  const getStatusMessage = () => {
    switch (uploadStatus.status) {
      case 'uploading':
        return 'Creating todo...';
      case 'success':
        return `✓ ${uploadStatus.message}`;
      case 'error':
        return `✗ ${uploadStatus.message}`;
      default:
        return '';
    }
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      <ThemedView style={styles.content}>
        <ThemedText type="title" style={styles.header}>
          Firebase Todos
        </ThemedText>

        {/* Todo Creation Form */}
        <ThemedView style={[styles.formContainer, { backgroundColor: colors.background }]}>
          <ThemedText type="subtitle" style={styles.formTitle}>
            Create New Todo
          </ThemedText>

          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: colorScheme === 'dark' ? '#1E1E1E' : '#F5F5F5',
                color: colors.text,
                borderColor: colors.tint,
              },
            ]}
            placeholder="Title"
            placeholderTextColor={colors.text + '80'}
            value={title}
            onChangeText={setTitle}
          />

          <TextInput
            style={[
              styles.input,
              styles.textArea,
              {
                backgroundColor: colorScheme === 'dark' ? '#1E1E1E' : '#F5F5F5',
                color: colors.text,
                borderColor: colors.tint,
              },
            ]}
            placeholder="Description"
            placeholderTextColor={colors.text + '80'}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
          />

          <TouchableOpacity
            style={[
              styles.submitButton,
              { backgroundColor: colors.tint },
              uploadStatus.status === 'uploading' && styles.submitButtonDisabled,
            ]}
            onPress={handleCreateTodo}
            disabled={uploadStatus.status === 'uploading'}>
            {uploadStatus.status === 'uploading' ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <ThemedText style={styles.submitButtonText}>Create Todo</ThemedText>
            )}
          </TouchableOpacity>

          {/* Upload Status Section */}
          {uploadStatus.status !== 'idle' && (
            <ThemedView
              style={[
                styles.statusContainer,
                {
                  backgroundColor: colorScheme === 'dark' ? '#1E1E1E' : '#F5F5F5',
                  borderColor: getStatusColor(),
                },
              ]}>
              <ThemedText style={[styles.statusText, { color: getStatusColor() }]}>
                {getStatusMessage()}
              </ThemedText>
            </ThemedView>
          )}
        </ThemedView>

        {/* Todos List */}
        <ThemedView style={styles.todosContainer}>
          <ThemedText type="subtitle" style={styles.todosTitle}>
            Your Todos ({todos.length})
          </ThemedText>

          {loading ? (
            <ThemedView style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.tint} />
              <ThemedText style={styles.loadingText}>Loading todos...</ThemedText>
            </ThemedView>
          ) : todos.length === 0 ? (
            <ThemedView style={styles.emptyContainer}>
              <ThemedText style={styles.emptyText}>No todos yet. Create one above!</ThemedText>
            </ThemedView>
          ) : (
            todos.map((todo) => (
              <ThemedView
                key={todo.id}
                style={[
                  styles.todoItem,
                  {
                    backgroundColor: colorScheme === 'dark' ? '#1E1E1E' : '#F5F5F5',
                    borderLeftColor: todo.completed ? '#4CAF50' : colors.tint,
                  },
                ]}>
                <TouchableOpacity
                  style={styles.todoContent}
                  onPress={() => handleToggleTodo(todo.id, todo.completed)}>
                  <ThemedView style={styles.todoHeader}>
                    <ThemedText
                      type="defaultSemiBold"
                      style={[
                        styles.todoTitle,
                        todo.completed && styles.todoTitleCompleted,
                      ]}>
                      {todo.title}
                    </ThemedText>
                    <ThemedText
                      style={[
                        styles.todoStatus,
                        { color: todo.completed ? '#4CAF50' : colors.tint },
                      ]}>
                      {todo.completed ? '✓' : '○'}
                    </ThemedText>
                  </ThemedView>
                  {todo.description && (
                    <ThemedText
                      style={[
                        styles.todoDescription,
                        todo.completed && styles.todoDescriptionCompleted,
                      ]}>
                      {todo.description}
                    </ThemedText>
                  )}
                  <ThemedText style={styles.todoDate}>
                    {todo.createdAt.toLocaleDateString()} {todo.createdAt.toLocaleTimeString()}
                  </ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => handleDeleteTodo(todo.id, todo.title)}>
                  <ThemedText style={styles.deleteButtonText}>Delete</ThemedText>
                </TouchableOpacity>
              </ThemedView>
            ))
          )}
        </ThemedView>
      </ThemedView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingTop: 60,
  },
  header: {
    marginBottom: 24,
  },
  formContainer: {
    marginBottom: 32,
    padding: 16,
    borderRadius: 12,
  },
  formTitle: {
    marginBottom: 16,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    fontSize: 16,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  submitButton: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 16,
  },
  statusContainer: {
    marginTop: 16,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusText: {
    textAlign: 'center',
    fontWeight: '500',
  },
  todosContainer: {
    marginBottom: 32,
  },
  todosTitle: {
    marginBottom: 16,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    textAlign: 'center',
    opacity: 0.6,
  },
  todoItem: {
    marginBottom: 12,
    borderRadius: 8,
    padding: 16,
    borderLeftWidth: 4,
  },
  todoContent: {
    flex: 1,
  },
  todoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  todoTitle: {
    flex: 1,
    fontSize: 16,
  },
  todoTitleCompleted: {
    textDecorationLine: 'line-through',
    opacity: 0.6,
  },
  todoStatus: {
    fontSize: 20,
    marginLeft: 8,
  },
  todoDescription: {
    marginBottom: 8,
    opacity: 0.8,
  },
  todoDescriptionCompleted: {
    textDecorationLine: 'line-through',
    opacity: 0.5,
  },
  todoDate: {
    fontSize: 12,
    opacity: 0.5,
  },
  deleteButton: {
    marginTop: 8,
    padding: 8,
    alignItems: 'center',
  },
  deleteButtonText: {
    color: '#F44336',
    fontWeight: '500',
  },
});
