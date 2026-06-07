import { useAuth } from '@clerk/expo';
import { Redirect, Tabs } from 'expo-router';
import { Text } from 'react-native';
import { colors } from '@/theme/theme';

// Simple emoji tab icons keep the scaffold dependency-light; swap for an icon
// set (e.g. @expo/vector-icons) when polishing.
function Icon({ emoji, focused }: { emoji: string; focused: boolean }) {
  return <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>{emoji}</Text>;
}

export default function TabsLayout() {
  const { isSignedIn } = useAuth();
  if (!isSignedIn) return <Redirect href="/(auth)/sign-in" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textDim,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{ title: 'Home', tabBarIcon: ({ focused }) => <Icon emoji="🏠" focused={focused} /> }}
      />
      <Tabs.Screen
        name="leaderboard"
        options={{
          title: 'Ranks',
          tabBarIcon: ({ focused }) => <Icon emoji="🏆" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="workout"
        options={{
          title: 'Clash',
          tabBarIcon: ({ focused }) => <Icon emoji="💪" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="battles"
        options={{
          title: 'Battles',
          tabBarIcon: ({ focused }) => <Icon emoji="⚔️" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ focused }) => <Icon emoji="👤" focused={focused} />,
        }}
      />
    </Tabs>
  );
}
