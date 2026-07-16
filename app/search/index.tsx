import { useEffect, useState } from 'react';
import { FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Search, X, Clock } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '@/theme/ThemeContext';
import { fontFamily, fontSize, radius, spacing } from '@/theme/tokens';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { FoodCard } from '@/components/shared/FoodCard';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/States';
import { searchMeals } from '@/features/menu/api/meals.api';
import { STORAGE_KEYS } from '@/constants';
import { useDebounce } from '@/hooks/useDebounce';

export default function SearchScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [recent, setRecent] = useState<string[]>([]);
  const debouncedQuery = useDebounce(query, 400);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEYS.RECENT_SEARCHES).then((v) => {
      if (v) setRecent(JSON.parse(v) as string[]);
    });
  }, []);

  const saveSearch = (q: string) => {
    const updated = [q, ...recent.filter((r) => r !== q)].slice(0, 10);
    setRecent(updated);
    AsyncStorage.setItem(STORAGE_KEYS.RECENT_SEARCHES, JSON.stringify(updated));
  };

  const results = useQuery({
    queryKey: ['search', debouncedQuery],
    queryFn: () => searchMeals(debouncedQuery),
    enabled: debouncedQuery.trim().length >= 2,
  });

  const handleSelect = (q: string) => { setQuery(q); saveSearch(q); };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Search input header */}
      <ScreenHeader showBack showThemeToggle={false} />
      <View style={{ paddingHorizontal: spacing.md, paddingBottom: spacing.md }}>
        <View style={{ flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: colors.input, borderRadius: radius['2xl'], paddingHorizontal: spacing.md, borderWidth: 1.5, borderColor: colors.border, gap: spacing.sm }}>
          <Search size={18} color={colors.mutedForeground} />
          <TextInput
            autoFocus
            value={query}
            onChangeText={setQuery}
            placeholder="ابحث عن أكلة..."
            placeholderTextColor={colors.mutedForeground}
            textAlign="right"
            style={{ flex: 1, fontFamily: fontFamily.regular, fontSize: fontSize.md, color: colors.foreground, paddingVertical: 13 }}
            onSubmitEditing={() => { if (query.trim()) saveSearch(query.trim()); }}
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery('')}>
              <X size={18} color={colors.mutedForeground} />
            </Pressable>
          )}
        </View>
      </View>

      {query.trim().length < 2 ? (
        <View style={{ padding: spacing.md }}>
          {recent.length > 0 && (
            <>
              <Text style={{ fontFamily: fontFamily.bold, fontSize: fontSize.lg, color: colors.foreground, textAlign: 'right', marginBottom: spacing.sm }}>
                عمليات البحث الأخيرة
              </Text>
              {recent.map((r) => (
                <Pressable key={r} onPress={() => handleSelect(r)}
                  style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.sm, paddingVertical: 10, borderBottomWidth: 1, borderColor: colors.borderLight }}>
                  <Clock size={16} color={colors.mutedForeground} />
                  <Text style={{ fontFamily: fontFamily.regular, fontSize: fontSize.md, color: colors.foreground }}>{r}</Text>
                </Pressable>
              ))}
            </>
          )}
        </View>
      ) : results.isLoading ? (
        <FlatList numColumns={2} data={Array.from({ length: 4 })} keyExtractor={(_, i) => String(i)}
          contentContainerStyle={{ paddingHorizontal: spacing.sm }}
          renderItem={() => <View style={{ flex: 1 }}><SkeletonCard /></View>} />
      ) : results.data?.length === 0 ? (
        <EmptyState emoji="🔍" title="لا توجد نتائج" description={`لم نجد أي أكلة باسم "${query}"`} />
      ) : (
        <FlatList
          data={results.data}
          keyExtractor={(m) => m.id}
          numColumns={2}
          contentContainerStyle={{ paddingHorizontal: spacing.sm, paddingBottom: 80 }}
          ListHeaderComponent={
            <Text style={{ fontFamily: fontFamily.regular, fontSize: fontSize.sm, color: colors.mutedForeground, padding: spacing.sm, textAlign: 'right' }}>
              {results.data?.length} نتيجة لـ "{debouncedQuery}"
            </Text>
          }
          renderItem={({ item }) => <FoodCard meal={item} />}
        />
      )}
    </View>
  );
}
