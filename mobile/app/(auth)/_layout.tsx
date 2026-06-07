import { useAuth } from '@clerk/expo';
import { Redirect, Stack } from 'expo-router';

// Signed-in users should never see the auth stack.
export default function AuthLayout() {
  const { isSignedIn } = useAuth();
  if (isSignedIn) return <Redirect href="/(tabs)/home" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
