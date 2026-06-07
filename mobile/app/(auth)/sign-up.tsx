import { useSignUp } from '@clerk/expo/legacy';
import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Button, Screen, Subtitle, Title } from '@/components/ui';
import { colors, radius, spacing } from '@/theme/theme';

export default function SignUp() {
  const { signUp, setActive, isLoaded } = useSignUp();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [pendingVerification, setPendingVerification] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSignUp() {
    if (!isLoaded) return;
    setLoading(true);
    setError(null);
    try {
      await signUp.create({ emailAddress: email, password });
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      setPendingVerification(true);
    } catch (e: any) {
      setError(e?.errors?.[0]?.message ?? 'Sign up failed');
    } finally {
      setLoading(false);
    }
  }

  async function onVerify() {
    if (!isLoaded) return;
    setLoading(true);
    setError(null);
    try {
      const attempt = await signUp.attemptEmailAddressVerification({ code });
      if (attempt.status === 'complete') {
        await setActive({ session: attempt.createdSessionId });
        router.replace('/(tabs)/home');
      } else {
        setError('Invalid code, try again.');
      }
    } catch (e: any) {
      setError(e?.errors?.[0]?.message ?? 'Verification failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen style={styles.container}>
      <View style={styles.header}>
        <Title>Join the clash</Title>
        <Subtitle>Create your account to start your streak.</Subtitle>
      </View>

      {!pendingVerification ? (
        <>
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
          <Button title="Sign up" onPress={onSignUp} loading={loading} />
          <View style={styles.footer}>
            <Subtitle>Already have an account? </Subtitle>
            <Link href="/(auth)/sign-in" style={styles.link}>
              Sign in
            </Link>
          </View>
        </>
      ) : (
        <>
          <Subtitle>We emailed you a 6-digit code.</Subtitle>
          <TextInput
            style={styles.input}
            placeholder="Verification code"
            placeholderTextColor={colors.textDim}
            keyboardType="number-pad"
            value={code}
            onChangeText={setCode}
          />
          {error && <Text style={styles.error}>{error}</Text>}
          <Button title="Verify" onPress={onVerify} loading={loading} />
        </>
      )}
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
