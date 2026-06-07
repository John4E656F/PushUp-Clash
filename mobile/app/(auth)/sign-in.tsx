import { useSignIn } from '@clerk/expo/legacy';
import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Button, Screen, Subtitle, Title } from '@/components/ui';
import { colors, radius, spacing } from '@/theme/theme';

export default function SignIn() {
  const { signIn, setActive, isLoaded } = useSignIn();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSignIn() {
    if (!isLoaded) return;
    setLoading(true);
    setError(null);
    try {
      const attempt = await signIn.create({ identifier: email, password });
      if (attempt.status === 'complete') {
        await setActive({ session: attempt.createdSessionId });
        router.replace('/(tabs)/home');
      } else {
        setError('Additional verification required.');
      }
    } catch (e: any) {
      setError(e?.errors?.[0]?.message ?? 'Sign in failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen style={styles.container}>
      <View style={styles.header}>
        <Title>PushupClash 💪</Title>
        <Subtitle>Drop in. Count reps. Climb the ranks.</Subtitle>
      </View>

      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor={colors.textDim}
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor={colors.textDim}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      {error && <Text style={styles.error}>{error}</Text>}

      <Button title="Sign in" onPress={onSignIn} loading={loading} />

      <View style={styles.footer}>
        <Subtitle>New here? </Subtitle>
        <Link href="/(auth)/sign-up" style={styles.link}>
          Create an account
        </Link>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { justifyContent: 'center', gap: spacing.md },
  header: { marginBottom: spacing.lg, gap: spacing.xs },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    color: colors.text,
    fontSize: 16,
  },
  error: { color: colors.danger },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.md },
  link: { color: colors.primary, fontWeight: '700' },
});
