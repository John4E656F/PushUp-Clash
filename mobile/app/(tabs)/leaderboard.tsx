import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApi } from '@/api/useApi';
import type { LeaderboardEntry } from '@/api/client';
import { Subtitle, Title } from '@/components/ui';
import { colors, radius, spacing } from '@/theme/theme';

export default function Leaderboard() {
  const api = useApi();
  const insets = useSafeAreaInsets();
  const [rows, setRows] = useState<LeaderboardEntry[]>([]);

  useFocusEffect(
    useCallback(() => {
      api
        .leaderboard()
        .then((r) => setRows(r.leaderboard))
        .catch((e) => console.warn('leaderboard failed', e));
    }, [api]),
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.md }]}>
      <Title>🏆 Leaderboard</Title>
      <Subtitle>Top athletes by XP</Subtitle>

      <FlatList
        style={{ marginTop: spacing.md }}
        data={rows}
        keyExtractor={(item) => `${item.rank}-${item.username}`}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        ListEmptyComponent={<Subtitle>No athletes yet. Be the first!</Subtitle>}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={[styles.rank, rankColor(item.rank)]}>#{item.rank}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{item.username || 'athlete'}</Text>
              <Text style={styles.meta}>
                Lv {item.level} · 🔥 {item.streak} · {item.totalReps} reps
              </Text>
            </View>
            <Text style={styles.xp}>{item.xp} XP</Text>
          </View>
        )}
      />
    </View>
  );
}

function rankColor(rank: number) {
  if (rank === 1) return { color: colors.gold };
  if (rank === 2) return { color: colors.silver };
  if (rank === 3) return { color: colors.bronze };
  return { color: colors.textDim };
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rank: { fontSize: 18, fontWeight: '900', width: 44 },
  name: { color: colors.text, fontSize: 16, fontWeight: '700' },
  meta: { color: colors.textDim, fontSize: 12, marginTop: 2 },
  xp: { color: colors.accent, fontWeight: '800' },
});
