import { useUser } from '@clerk/expo';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApi } from '@/api/useApi';
import type { Challenge, Me } from '@/api/client';
import { Button, Card, StatPill, Subtitle, Title } from '@/components/ui';
import { colors, spacing } from '@/theme/theme';

export default function Home() {
  const api = useApi();
  const { user } = useUser();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [me, setMe] = useState<Me | null>(null);
  const [challenge, setChallenge] = useState<{ challenge: Challenge; completed: boolean } | null>(
    null,
  );
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      // Make sure the backend has a profile row, then pull stats + challenge.
      await api.syncUser({
        username: user?.username ?? user?.firstName ?? 'athlete',
        email: user?.primaryEmailAddress?.emailAddress ?? '',
        avatarUrl: user?.imageUrl ?? '',
      });
      const [meRes, challengeRes] = await Promise.all([api.me(), api.todayChallenge()]);
      setMe(meRes);
      setChallenge(challengeRes);
    } catch (e) {
      // In the scaffold we surface errors via console; add a toast later.
      console.warn('home load failed', e);
    }
  }, [api, user]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const xpToNext = me ? Math.max(0, nextLevelXp(me.level) - me.xp) : 0;

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.md }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      <Title>Hey {me?.username ?? 'athlete'} 👋</Title>
      <Subtitle>Level {me?.level ?? 1} · {xpToNext} XP to next level</Subtitle>

      <View style={styles.stats}>
        <StatPill label="🔥 Streak" value={me?.streak ?? 0} />
        <StatPill label="Total reps" value={me?.totalReps ?? 0} />
        <StatPill label="XP" value={me?.xp ?? 0} />
      </View>

      <Card style={{ gap: spacing.sm }}>
        <Text style={styles.cardLabel}>TODAY'S CHALLENGE</Text>
        {challenge ? (
          <>
            <Title style={{ fontSize: 36 }}>{challenge.challenge.targetReps} pushups</Title>
            <Subtitle>
              {challenge.completed
                ? '✅ Done for today — streak secured!'
                : `Reward: +${challenge.challenge.xpReward} XP`}
            </Subtitle>
          </>
        ) : (
          <Subtitle>Loading…</Subtitle>
        )}
        {!challenge?.completed && (
          <Button title="Start challenge" onPress={() => router.push('/(tabs)/workout')} />
        )}
      </Card>

      <Card style={{ gap: spacing.sm }}>
        <Text style={styles.cardLabel}>FREESTYLE</Text>
        <Subtitle>Just want to grind reps? Fire up the counter.</Subtitle>
        <Button title="Free workout 💪" variant="ghost" onPress={() => router.push('/(tabs)/workout')} />
      </Card>
    </ScrollView>
  );
}

// Mirror of backend gamify.NextLevelXP so the UI can show progress offline.
function nextLevelXp(level: number): number {
  return (100 * (level + 1) * level) / 2;
}

const styles = StyleSheet.create({
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  stats: { flexDirection: 'row', gap: spacing.sm },
  cardLabel: { color: colors.accent, fontSize: 12, fontWeight: '800', letterSpacing: 1 },
});
