import { useAuth, useUser } from '@clerk/clerk-expo';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApi } from '@/api/useApi';
import type { Me } from '@/api/client';
import { Button, Card, StatPill, Subtitle, Title } from '@/components/ui';
import { colors, radius, spacing } from '@/theme/theme';

export default function Profile() {
  const api = useApi();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useUser();
  const { signOut } = useAuth();
  const [me, setMe] = useState<Me | null>(null);

  useFocusEffect(
    useCallback(() => {
      api
        .me()
        .then(setMe)
        .catch((e) => console.warn('profile failed', e));
    }, [api]),
  );

  async function onSignOut() {
    await signOut();
    router.replace('/(auth)/sign-in');
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.md }]}
    >
      <View style={styles.header}>
        {user?.imageUrl ? (
          <Image source={{ uri: user.imageUrl }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Text style={styles.avatarInitial}>
              {(me?.username ?? 'A').charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        <Title>{me?.username ?? 'athlete'}</Title>
        <Subtitle>Level {me?.level ?? 1}</Subtitle>
      </View>

      <View style={styles.stats}>
        <StatPill label="🔥 Streak" value={me?.streak ?? 0} />
        <StatPill label="Best streak" value={me?.bestStreak ?? 0} />
      </View>
      <View style={styles.stats}>
        <StatPill label="Total reps" value={me?.totalReps ?? 0} />
        <StatPill label="XP" value={me?.xp ?? 0} />
      </View>

      <Card style={{ gap: spacing.sm }}>
        <Text style={styles.label}>BADGES</Text>
        {me?.badges?.length ? (
          <View style={styles.badges}>
            {me.badges.map((b) => (
              <Text key={b} style={styles.badge}>
                {b}
              </Text>
            ))}
          </View>
        ) : (
          <Subtitle>No badges yet — keep clashing to earn them!</Subtitle>
        )}
      </Card>

      <Button title="Sign out" variant="danger" onPress={onSignOut} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  header: { alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm },
  avatar: { width: 88, height: 88, borderRadius: radius.pill, marginBottom: spacing.sm },
  avatarFallback: { backgroundColor: colors.primaryDim, alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { color: colors.text, fontSize: 36, fontWeight: '900' },
  stats: { flexDirection: 'row', gap: spacing.sm },
  label: { color: colors.accent, fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  badge: {
    color: colors.gold,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.pill,
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    overflow: 'hidden',
  },
});
