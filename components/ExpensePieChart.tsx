import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import Svg, { G, Path, Circle, Text as SvgText } from 'react-native-svg';
import { formatCurrency } from '@/lib/financeService';

interface Slice {
  category: string;
  amount: number;
  color: string;
  percentage: number;
  startAngle: number;
  endAngle: number;
}

interface ExpensePieChartProps {
  expensesByCategory: { [category: string]: number };
  totalExpenses: number;
  colors: any;
  onCategoryPress: (category: string) => void;
}

const CHART_COLORS = [
  '#1B4D6E',
  '#2E7D52',
  '#C05621',
  '#B7791F',
  '#2C7A7B',
  '#C53030',
  '#6B5E31',
  '#285E61',
  '#702459',
  '#553C9A',
];

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

function buildArcPath(cx: number, cy: number, r: number, start: number, end: number): string {
  const s = polarToCartesian(cx, cy, r, start);
  const e = polarToCartesian(cx, cy, r, end);
  const large = end - start > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y} Z`;
}

export default function ExpensePieChart({
  expensesByCategory,
  totalExpenses,
  colors,
  onCategoryPress,
}: ExpensePieChartProps) {
  const [activeSlice, setActiveSlice] = useState<string | null>(null);

  const entries = Object.entries(expensesByCategory)
    .filter(([, v]) => v > 0)
    .sort(([, a], [, b]) => b - a);

  if (entries.length === 0 || totalExpenses === 0) {
    return (
      <View style={[styles.empty, { backgroundColor: colors.inputBackground }]}>
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No expense data</Text>
      </View>
    );
  }

  const slices: Slice[] = [];
  let angle = 0;
  entries.forEach(([category, amount], i) => {
    const pct = (amount / totalExpenses) * 100;
    const sweep = (amount / totalExpenses) * 360;
    slices.push({
      category,
      amount,
      color: CHART_COLORS[i % CHART_COLORS.length],
      percentage: pct,
      startAngle: angle,
      endAngle: angle + sweep,
    });
    angle += sweep;
  });

  const SIZE = 200;
  const CX = SIZE / 2;
  const CY = SIZE / 2;
  const R = 80;
  const INNER_R = 45;

  return (
    <View style={styles.wrapper}>
      <View style={styles.chartRow}>
        <View style={styles.svgContainer}>
          <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
            <G>
              {slices.map((slice) => {
                const isActive = activeSlice === slice.category;
                const offset = isActive ? 8 : 0;
                const midAngle = (slice.startAngle + slice.endAngle) / 2;
                const rad = ((midAngle - 90) * Math.PI) / 180;
                const dx = offset * Math.cos(rad);
                const dy = offset * Math.sin(rad);
                return (
                  <G key={slice.category} transform={`translate(${dx},${dy})`}>
                    <Path
                      d={buildArcPath(CX, CY, R, slice.startAngle, slice.endAngle)}
                      fill={slice.color}
                      opacity={activeSlice && !isActive ? 0.45 : 1}
                      onPress={() => {
                        setActiveSlice(activeSlice === slice.category ? null : slice.category);
                        onCategoryPress(slice.category);
                      }}
                    />
                  </G>
                );
              })}
              <Circle cx={CX} cy={CY} r={INNER_R} fill={colors.cardBackground} />
              {activeSlice ? (
                <>
                  <SvgText
                    x={CX}
                    y={CY - 8}
                    textAnchor="middle"
                    fontSize="11"
                    fontWeight="700"
                    fill={colors.text}
                  >
                    {activeSlice.length > 10 ? activeSlice.slice(0, 10) + '…' : activeSlice}
                  </SvgText>
                  <SvgText
                    x={CX}
                    y={CY + 8}
                    textAnchor="middle"
                    fontSize="10"
                    fill={colors.textSecondary}
                  >
                    {slices.find(s => s.category === activeSlice)?.percentage.toFixed(1)}%
                  </SvgText>
                </>
              ) : (
                <>
                  <SvgText
                    x={CX}
                    y={CY - 6}
                    textAnchor="middle"
                    fontSize="10"
                    fill={colors.textSecondary}
                    fontWeight="600"
                  >
                    Total
                  </SvgText>
                  <SvgText
                    x={CX}
                    y={CY + 10}
                    textAnchor="middle"
                    fontSize="11"
                    fontWeight="700"
                    fill={colors.text}
                  >
                    {formatCurrency(totalExpenses)}
                  </SvgText>
                </>
              )}
            </G>
          </Svg>
        </View>

        <View style={styles.legend}>
          {slices.slice(0, 6).map((slice) => (
            <TouchableOpacity
              key={slice.category}
              style={styles.legendItem}
              onPress={() => {
                setActiveSlice(activeSlice === slice.category ? null : slice.category);
                onCategoryPress(slice.category);
              }}
              activeOpacity={0.7}
            >
              <View style={[styles.legendDot, { backgroundColor: slice.color }]} />
              <View style={styles.legendText}>
                <Text
                  style={[styles.legendCategory, { color: colors.text }]}
                  numberOfLines={1}
                >
                  {slice.category}
                </Text>
                <Text style={[styles.legendAmount, { color: colors.textSecondary }]}>
                  {slice.percentage.toFixed(1)}% · {formatCurrency(slice.amount)}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
          {slices.length > 6 && (
            <Text style={[styles.moreText, { color: colors.textSecondary }]}>
              +{slices.length - 6} more
            </Text>
          )}
        </View>
      </View>

      <Text style={[styles.tapHint, { color: colors.textSecondary }]}>
        Tap a slice or category to view transactions
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: 4,
    paddingBottom: 8,
  },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  svgContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  legend: {
    flex: 1,
    gap: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    flexShrink: 0,
  },
  legendText: {
    flex: 1,
  },
  legendCategory: {
    fontSize: 12,
    fontWeight: '600',
  },
  legendAmount: {
    fontSize: 11,
  },
  empty: {
    height: 120,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 14,
  },
  tapHint: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: 8,
  },
  moreText: {
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: 2,
  },
});
