/**
 * Date Formatting Utilities for Chat Application
 * Milestone 5: "Last Message Preview"
 */

/**
 * Format a date for message timestamps
 * Returns:
 * - Same day: "3:45 PM"
 * - Yesterday: "Yesterday"
 * - Older: "Dec 15"
 */
export const formatMessageTime = (date: Date): string => {
  const now = new Date();
  const messageDate = new Date(date);

  // Check if same day
  const isToday =
    now.getDate() === messageDate.getDate() &&
    now.getMonth() === messageDate.getMonth() &&
    now.getFullYear() === messageDate.getFullYear();

  if (isToday) {
    // Return time only: "3:45 PM"
    return messageDate.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }

  // Check if yesterday
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday =
    yesterday.getDate() === messageDate.getDate() &&
    yesterday.getMonth() === messageDate.getMonth() &&
    yesterday.getFullYear() === messageDate.getFullYear();

  if (isYesterday) {
    return 'Yesterday';
  }

  // Check if this year
  const isThisYear = now.getFullYear() === messageDate.getFullYear();

  if (isThisYear) {
    // Return month and day: "Dec 15"
    return messageDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  }

  // Different year: "Dec 15, 2023"
  return messageDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

/**
 * Format a date for relative time display in chat list
 * Returns:
 * - Same day: "2m ago", "5h ago"
 * - Yesterday: "Yesterday"
 * - Older: "Dec 15"
 */
export const formatRelativeTime = (date: Date): string => {
  const now = new Date();
  const messageDate = new Date(date);
  const diffMs = now.getTime() - messageDate.getTime();
  const diffMinutes = Math.floor(diffMs / 1000 / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  // Less than 1 minute
  if (diffMinutes < 1) {
    return 'Just now';
  }

  // Less than 1 hour: show minutes
  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }

  // Less than 24 hours: show hours
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  // Yesterday
  if (diffDays === 1) {
    return 'Yesterday';
  }

  // Within a week: show days
  if (diffDays < 7) {
    return `${diffDays}d ago`;
  }

  // Older: use formatMessageTime logic
  return formatMessageTime(date);
};

/**
 * Format full message timestamp with date and time
 * Returns: "Dec 15, 2023, 3:45 PM"
 */
export const formatFullTimestamp = (date: Date): string => {
  const messageDate = new Date(date);
  return messageDate.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

/**
 * Get date divider text for grouping messages
 * Returns: "Today", "Yesterday", or "Dec 15, 2023"
 */
export const getDateDividerText = (date: Date): string => {
  const now = new Date();
  const messageDate = new Date(date);

  // Check if same day
  const isToday =
    now.getDate() === messageDate.getDate() &&
    now.getMonth() === messageDate.getMonth() &&
    now.getFullYear() === messageDate.getFullYear();

  if (isToday) {
    return 'Today';
  }

  // Check if yesterday
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday =
    yesterday.getDate() === messageDate.getDate() &&
    yesterday.getMonth() === messageDate.getMonth() &&
    yesterday.getFullYear() === messageDate.getFullYear();

  if (isYesterday) {
    return 'Yesterday';
  }

  // Return full date
  return messageDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};
