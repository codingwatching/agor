# DELETE_ZONE.md

## Overview

Add zone deletion functionality to the board interface with a trash icon in the zone toolbar and a confirmation modal that handles associated session cleanup.

## User Story

As a board user, I want to delete zones I no longer need, with control over what happens to sessions pinned to that zone, so I can keep my board organized without accidentally losing session associations.

## Design

### UI Components

#### 1. Zone Toolbar Addition

**Location:** Zone toolbar (alongside color picker and settings icon)

**Component:** Trash icon button

- Position: Rightmost in toolbar (after settings icon)
- Icon: `DeleteOutlined` from `@ant-design/icons`
- Styling: Default to subtle gray, red on hover
- Behavior: Opens confirmation modal on click

#### 2. Confirmation Modal

**Trigger:** Click trash icon in zone toolbar

**Modal Structure:**

```
┌─────────────────────────────────────┐
│ Delete Zone                      × │
├─────────────────────────────────────┤
│                                     │
│ Are you sure you want to delete    │
│ this zone?                          │
│                                     │
│ This zone has X pinned session(s). │
│                                     │
│ ○ Unpin sessions (keep on board)   │
│ ● Delete pinned sessions too        │
│                                     │
│         [Cancel]  [Delete Zone]     │
└─────────────────────────────────────┘
```

**Modal Properties:**

- Title: "Delete Zone"
- Width: 480px
- Closable: Yes (X button)
- Footer: Custom with Cancel + Delete buttons

**Radio Options:**

1. **Unpin sessions (keep on board)** - Move sessions to default/unpinned state
2. **Delete pinned sessions too** - Remove sessions from board entirely

**Default Selection:** "Unpin sessions" (safer option)

**Conditional Display:**

- If zone has 0 pinned sessions: Hide radio options, show simplified text
- If zone has 1+ pinned sessions: Show count and radio options

### Data Flow

#### Backend Changes

**New Service Method:** `DELETE /boards/:boardId/zones/:zoneId`

**Request Body:**

```typescript
{
  deleteAssociatedSessions: boolean; // true = delete sessions, false = unpin
}
```

**Response:**

```typescript
{
  deletedZone: Zone
  affectedSessions: string[]  // session IDs that were unpinned or deleted
}
```

**Database Operations:**

1. Find all sessions with `zone_id` matching the deleted zone
2. If `deleteAssociatedSessions === true`:
   - Remove sessions from `board.sessions` array
   - Clear `position` and `zone_id` from session metadata
3. If `deleteAssociatedSessions === false`:
   - Update sessions: set `zone_id = null`, keep position
4. Remove zone from `board.zones` array
5. Broadcast board update via WebSocket

#### Frontend Changes

**State Updates:**

1. Remove zone from `board.zones`
2. Update affected sessions (remove or unpin)
3. WebSocket listener handles real-time sync for other users

**Optimistic Update:**

- Immediately update local board state
- Revert if API call fails
- Show error notification on failure

### Implementation Checklist

#### Backend (`apps/agor-daemon`)

- [ ] Add zone deletion validation (prevent deleting last zone?)
- [ ] Implement `DELETE /boards/:boardId/zones/:zoneId` endpoint
- [ ] Add logic for session cleanup (delete vs unpin)
- [ ] Broadcast board update via WebSocket
- [ ] Add error handling for non-existent zones

#### Frontend (`apps/agor-ui`)

**Components:**

- [ ] Add trash icon to `ZoneToolbar` component
- [ ] Create `DeleteZoneModal` component
  - [ ] Radio group for session handling options
  - [ ] Conditional rendering based on pinned session count
  - [ ] Form submission with selected option
- [ ] Wire up modal trigger in zone toolbar
- [ ] Handle optimistic updates in board state
- [ ] Add WebSocket listener for zone deletions

**Types:**

- [ ] Add `DeleteZoneRequest` type
- [ ] Add `DeleteZoneResponse` type

#### Testing

- [ ] Backend: Delete zone with no sessions
- [ ] Backend: Delete zone with sessions (unpin option)
- [ ] Backend: Delete zone with sessions (delete option)
- [ ] Frontend: Modal displays correct session count
- [ ] Frontend: Cancel closes modal without changes
- [ ] Frontend: Optimistic update + revert on error
- [ ] Multi-user: Real-time sync of zone deletion

### Edge Cases

1. **Last zone deletion:** Decide policy - prevent or allow?
2. **Concurrent deletion:** Handle WebSocket race conditions
3. **Session in deleted zone:** Ensure no orphaned references
4. **Undo functionality:** Future consideration (not in scope)

### UI/UX Considerations

**Confirmation Safety:**

- Destructive action uses red button
- Safer "unpin" option is default selection
- Modal requires explicit user choice

**Visual Feedback:**

- Loading state on Delete button during API call
- Success notification: "Zone deleted"
- Error notification: "Failed to delete zone: {reason}"

**Accessibility:**

- Modal keyboard navigation (Tab, Enter, Escape)
- ARIA labels for screen readers
- Focus trap within modal

## API Design

### Request

```http
DELETE /boards/:boardId/zones/:zoneId
Content-Type: application/json

{
  "deleteAssociatedSessions": false
}
```

### Response (Success)

```http
200 OK
Content-Type: application/json

{
  "deletedZone": {
    "zone_id": "01234567",
    "name": "Bugs",
    "color": "#ff4d4f"
  },
  "affectedSessions": ["01abc123", "01def456"]
}
```

### Response (Error)

```http
404 Not Found
{
  "error": "Zone not found"
}

400 Bad Request
{
  "error": "Cannot delete last zone"
}
```

## Future Enhancements

- **Undo deletion:** Add to action history with revert option
- **Bulk zone deletion:** Select multiple zones to delete
- **Archive instead of delete:** Soft delete with recovery option
- **Zone templates:** Save zone configurations for reuse

## Open Questions

1. Should we prevent deleting the last zone on a board?
2. Should there be a separate "archive" option vs permanent delete?
3. Do we want to track deletion in an audit log?
4. Should zone deletion require additional permissions (if we add role-based access)?

## References

- Zone data structure: `context/concepts/models.md`
- Board service: `apps/agor-daemon/src/services/boards.ts`
- Zone toolbar component: `apps/agor-ui/src/components/ZoneToolbar.tsx` (to be confirmed)
- Design system: `context/concepts/design.md`
