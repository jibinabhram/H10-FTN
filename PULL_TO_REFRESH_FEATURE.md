# Pull-to-Refresh Feature

## Overview
The app now supports **pull-to-refresh** functionality across key screens, allowing users to manually refresh data without needing the debug panel.

## How to Use
Simply **pull down** on any of the following screens to refresh:

### Screens with Pull-to-Refresh
1. **Players List Screen** - Refresh the list of players
2. **Zone Settings Screen** - Refresh heart rate zone defaults
3. **Manage Events Screen** - Refresh the list of events
4. **Player Edit Screen** - Refresh pod assignments and player data

## Technical Implementation

### Components Used
- **React Native**: `RefreshControl` (native component)
- **FlatList/ScrollView**: Both support the `refreshControl` prop

### Key Files Modified
- `src/screens/ClubAdmin/Players/PlayersListScreen.tsx`
- `src/screens/ClubAdmin/ZoneSettingsScreen.tsx`
- `src/screens/ClubAdmin/ManageEventsScreen.tsx`
- `src/screens/ClubAdmin/Players/PlayerEditScreen.tsx`

### Hook for Reusability
A custom hook `useRefreshControl` is available at `src/hooks/useRefreshControl.ts` for easily adding refresh functionality to other screens.

#### Usage Example
```typescript
import { useRefreshControl } from '../hooks/useRefreshControl';

const MyScreen = () => {
  const handleRefresh = async () => {
    // Your refresh logic here
    await loadData();
  };

  const { refreshing, onRefresh } = useRefreshControl(handleRefresh);

  return (
    <FlatList
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#2563EB"
        />
      }
      // ... rest of props
    />
  );
};
```

## Features
- **Visual Feedback**: Loading indicator shows while refreshing
- **Offline Support**: Gracefully handles offline scenarios
- **Error Handling**: Shows alerts only on actual errors, not offline status
- **Consistent Colors**: Uses theme-appropriate colors for refresh control

## Color Scheme
- **Players List**: Blue (#2563EB)
- **Zone Settings**: Blue (#2563EB)
- **Manage Events**: Green (#16a34a)
- **Player Edit**: Blue (#2563EB)
