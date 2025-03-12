/**
 * Format a timestamp into a readable time string with context
 * 
 * For today: "2:30 PM"
 * For yesterday: "Yesterday, 2:30 PM"
 * For this week: "Monday, 2:30 PM"
 * For older: "Mar 12, 2:30 PM"
 */
export function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  
  // Same day
  if (date >= today) {
    return timeStr;
  }
  
  // Yesterday
  if (date >= yesterday) {
    return `Yesterday, ${timeStr}`;
  }
  
  // Within the last 7 days
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 6);
  if (date >= weekAgo) {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return `${days[date.getDay()]}, ${timeStr}`;
  }
  
  // Earlier dates
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ', ' + timeStr;
}

/**
 * Format time to show how long ago a message was sent
 * e.g., "just now", "2m ago", "1h ago", "2d ago"
 */
export function formatTimeAgo(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  
  // Less than a minute
  if (diff < 60 * 1000) {
    return 'just now';
  }
  
  // Less than an hour
  if (diff < 60 * 60 * 1000) {
    const minutes = Math.floor(diff / (60 * 1000));
    return `${minutes}m ago`;
  }
  
  // Less than a day
  if (diff < 24 * 60 * 60 * 1000) {
    const hours = Math.floor(diff / (60 * 60 * 1000));
    return `${hours}h ago`;
  }
  
  // Less than a week
  if (diff < 7 * 24 * 60 * 60 * 1000) {
    const days = Math.floor(diff / (24 * 60 * 60 * 1000));
    return `${days}d ago`;
  }
  
  // Older than a week
  return formatTime(timestamp);
}
