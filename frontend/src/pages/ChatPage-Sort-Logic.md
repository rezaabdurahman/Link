# ChatPage Sort Control Logic

## Overview
The ChatPage component supports 4 different sorting options for the chat list, controlled by the `RankToggle` component.

## Sort Options

### 1. **Priority** (Default)
- **Logic**: Sorts chats by their `priority` number (ascending order)
- **Meaning**: Lower priority number = higher importance (priority 1 is highest)
- **Use Case**: Shows most important conversations first based on conversation priority
- **Tie-breaker**: None explicitly defined (maintains original order for same priority)

### 2. **Time** (Recent)
- **Logic**: Sorts by `lastMessage.timestamp` (descending order)
- **Meaning**: Most recent messages appear first
- **Use Case**: See latest activity and ongoing conversations
- **Tie-breaker**: None explicitly defined (maintains original order for same timestamp)

### 3. **Unread**
- **Logic**: Sorts by `unreadCount` (descending order)
- **Meaning**: Conversations with most unread messages appear first
- **Use Case**: Prioritize conversations that need attention
- **Tie-breaker**: None explicitly defined (maintains original order for same unread count)

### 4. **Discover**
- **Logic**: 
  - **Filter**: Only shows conversations where `isFriend` is `false`
  - **Sort**: By most recent message timestamp (descending)
- **Meaning**: Shows only non-friend conversations, sorted by recency
- **Use Case**: Discover new people and potential connections
- **Tie-breaker**: None explicitly defined

## Default Settings
- **Initial Sort**: `'priority'` (set on component mount)
- **State Management**: Stored in `sortBy` state variable
- **Type**: `SortOption = 'priority' | 'time' | 'unread' | 'discover'`

## Implementation Details
- **Filter Logic**: Applied in `combinedList` useMemo hook (lines 163-194)
- **Sort Logic**: Applied in `sortedChats` computed value (lines 196-210)
- **State**: Managed by `sortBy` state and `setSortBy` handler
- **UI Component**: `RankToggle` component handles user interaction

## Code Location
- **Main Logic**: `frontend/src/pages/ChatPage.tsx` lines 196-210
- **UI Component**: `frontend/src/components/RankToggle.tsx`
- **Type Definition**: `type SortOption` on line 19 of ChatPage.tsx
