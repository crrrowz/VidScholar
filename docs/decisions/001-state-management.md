# ADR 001: Centralized State Management

**Status:** Accepted  
**Date:** 2024-01-15  
**Deciders:** Development Team

## Context

The original architecture scattered state across multiple components, leading to:
- Difficult state synchronization
- Props drilling through multiple levels
- Hard-to-debug state mutations
- No ability to undo/redo actions
- Challenging to implement features like auto-save

## Decision

We implemented a centralized Redux-like state management system with:

1. **Single Store** (`src/state/Store.ts`)
   - Immutable state updates
   - Subscription-based reactivity
   - Built-in undo/redo with history
   - Type-safe state access

2. **Action Creators** (`src/state/actions.ts`)
   - Pure functions for state updates
   - Batch update support
   - Async action support with middleware

3. **State Structure**
```typescript
interface AppState {
  notes: Note[];
  templates: string[];
  currentTheme: Theme;
  selectedNote: Note | null;
  // ... other state
}
```

## Consequences

### Positive
- **Predictable State Flow**: All state changes go through actions
- **Time-Travel Debugging**: Undo/redo built-in
- **Easier Testing**: Pure functions, easy to mock
- **Performance**: Batch updates prevent unnecessary re-renders
- **Developer Experience**: Clear data flow, easier onboarding

### Negative
- **Initial Complexity**: Learning curve for team members
- **Boilerplate**: Action creators add some code overhead
- **Migration**: Existing components need refactoring

### Neutral
- **Bundle Size**: +5KB for state management (~minimal impact)

## Implementation Notes

### Usage Example
```typescript
import { getStore } from '@/state/Store';
import { actions } from '@/state/actions';

// Get state
const state = getStore().getState();

// Update state
actions.addNote(newNote);
actions.updateNote(noteId, { text: 'Updated' });

// Subscribe to changes
const unsubscribe = getStore().subscribe((state) => {
  console.log('State changed:', state);
});
```

### Migration Path
1. ✅ Create Store and actions
2. ✅ Migrate content.ts to use Store
3. ⏳ Refactor components to use Store (Phase 2)
4. ⏳ Remove local state management (Phase 2)

## References
- [Redux Pattern](https://redux.js.org/understanding/thinking-in-redux/three-principles)
- [Immutable Updates](https://redux.js.org/usage/structuring-reducers/immutable-update-patterns)
- Original issue: #45