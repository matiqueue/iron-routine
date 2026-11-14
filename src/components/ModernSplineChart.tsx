import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  PanResponder,
} from 'react-native';
import Svg, {
  Path,
  Defs,
  LinearGradient,
  Stop,
  Circle,
  Line,
} from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { useAppTheme } from '../context/ThemeContext';
import { WeightEntry } from '../types/workout';

interface ModernSplineChartProps {
  entries: WeightEntry[];
  timeframe?: '7d' | '30d' | 'all';
  onTimeframeChange?: (timeframe: '7d' | '30d' | 'all') => void;
  height?: number;
}

export const ModernSplineChart: React.FC<ModernSplineChartProps> = ({
  entries,
  timeframe = '7d',
  onTimeframeChange,
  height = 180,
}) => {
  const { theme, isDark } = useAppTheme();
  const [containerWidth, setContainerWidth] = useState(
    Dimensions.get('window').width - 48
  );
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  // Filter entries based on timeframe
  const filteredEntries = useMemo(() => {
    if (!entries || entries.length === 0) return [];
    if (timeframe === '7d') return entries.slice(-7);
    if (timeframe === '30d') return entries.slice(-30);
    return entries;
  }, [entries, timeframe]);

  // Compute min, max, span
  const { minVal, maxVal, dataPoints } = useMemo(() => {
    if (filteredEntries.length === 0) {
      return { minVal: 59, maxVal: 62, dataPoints: [] };
    }
    const weights = filteredEntries.map((e) => e.weight);
    let rawMin = Math.min(...weights);
    let rawMax = Math.max(...weights);
    if (rawMin === rawMax) {
      rawMin -= 0.5;
      rawMax += 0.5;
    }
    const padding = (rawMax - rawMin) * 0.18 || 0.4;
    const min = Math.max(0, Math.floor((rawMin - padding) * 10) / 10);
    const max = Math.ceil((rawMax + padding) * 10) / 10;
    return { minVal: min, maxVal: max, dataPoints: filteredEntries };
  }, [filteredEntries]);

  // Coordinates
  const chartPaddingTop = 26;
  const chartPaddingBottom = 32;
  const chartPaddingHorizontal = 24;
  const plotWidth = Math.max(10, containerWidth - chartPaddingHorizontal * 2);
  const plotHeight = Math.max(10, height - chartPaddingTop - chartPaddingBottom);

  const points = useMemo(() => {
    if (dataPoints.length === 0) return [];
    const span = maxVal - minVal || 1;
    const count = dataPoints.length;

    return dataPoints.map((item, idx) => {
      const x =
        count === 1
          ? chartPaddingHorizontal + plotWidth / 2
          : chartPaddingHorizontal + (idx / (count - 1)) * plotWidth;
      const normalizedY = (item.weight - minVal) / span;
      const y = chartPaddingTop + plotHeight * (1 - normalizedY);
      return { x, y, weight: item.weight, date: item.date };
    });
  }, [dataPoints, minVal, maxVal, plotWidth, plotHeight]);

  // Smooth Bezier Curve Path Generator (Catmull-Rom to Cubic Bezier)
  const { linePath, areaPath } = useMemo(() => {
    if (points.length === 0) return { linePath: '', areaPath: '' };
    if (points.length === 1) {
      const p = points[0];
      return {
        linePath: `M ${p.x - 20} ${p.y} L ${p.x + 20} ${p.y}`,
        areaPath: `M ${p.x - 20} ${height - chartPaddingBottom} L ${p.x - 20} ${p.y} L ${p.x + 20} ${p.y} L ${p.x + 20} ${height - chartPaddingBottom} Z`,
      };
    }

    let d = `M ${points[0].x} ${points[0].y}`;

    for (let i = 0; i < points.length - 1; i++) {
      const p0 = i > 0 ? points[i - 1] : points[i];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = i < points.length - 2 ? points[i + 2] : p2;

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;

      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }

    const first = points[0];
    const last = points[points.length - 1];
    const bottomY = height - chartPaddingBottom;
    const aD = `${d} L ${last.x.toFixed(1)} ${bottomY} L ${first.x.toFixed(1)} ${bottomY} Z`;

    return { linePath: d, areaPath: aD };
  }, [points, height]);

  // Touch Scrubber PanResponder
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (evt) => {
          const touchX = evt.nativeEvent.locationX;
          findClosestPoint(touchX);
        },
        onPanResponderMove: (evt) => {
          const touchX = evt.nativeEvent.locationX;
          findClosestPoint(touchX);
        },
        onPanResponderRelease: () => {
          // Keep active point or let it stay for inspection
        },
      }),
    [points]
  );

  const findClosestPoint = (touchX: number) => {
    if (points.length === 0) return;
    let closestIdx = 0;
    let minDiff = Infinity;
    points.forEach((p, idx) => {
      const diff = Math.abs(p.x - touchX);
      if (diff < minDiff) {
        minDiff = diff;
        closestIdx = idx;
      }
    });

    if (closestIdx !== selectedIndex) {
      setSelectedIndex(closestIdx);
      try {
        Haptics.selectionAsync();
      } catch {}
    }
  };

  const activeIdx =
    selectedIndex !== null && selectedIndex < points.length
      ? selectedIndex
      : points.length - 1;
  const activePoint = points[activeIdx];
  const activeEntry = dataPoints[activeIdx];

  // Grid line values
  const gridLevels = useMemo(() => {
    const span = maxVal - minVal;
    return [
      maxVal,
      Math.round(((maxVal + minVal) / 2) * 10) / 10,
      minVal,
    ];
  }, [minVal, maxVal]);

  return (
    <View
      style={styles.container}
      onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
    >
      {/* Top Header with Selected Value & Responsive Stacked/Full-Width Timeframe Segmented Bar */}
      <View style={styles.topHeader}>
        <View style={styles.valCol}>
          {activeEntry ? (
            <View style={styles.valRow}>
              <Text style={[styles.mainVal, { color: theme.text }]}>
                {activeEntry.weight} <Text style={styles.kgUnit}>kg</Text>
              </Text>
              <View style={[styles.dateBadge, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <Text style={[styles.dateBadgeText, { color: theme.textMuted }]}>
                  {activeEntry.date}
                </Text>
              </View>
            </View>
          ) : (
            <Text style={[styles.mainVal, { color: theme.text }]}>- kg</Text>
          )}
        </View>

        {onTimeframeChange && (
          <View style={[styles.timeframeRow, { backgroundColor: theme.card, borderColor: theme.border }]}>
            {(['7d', '30d', 'all'] as const).map((tf) => {
              const isActive = timeframe === tf;
              const label = tf === '7d' ? '7 DNI' : tf === '30d' ? '30 DNI' : 'WSZYSTKO';
              return (
                <TouchableOpacity
                  key={tf}
                  style={[
                    styles.tfBtn,
                    isActive && { backgroundColor: theme.text },
                  ]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setSelectedIndex(null);
                    onTimeframeChange(tf);
                  }}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.tfBtnText,
                      { color: isActive ? theme.bg : theme.textMuted },
                    ]}
                    numberOfLines={1}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>

      {/* SVG Canvas with Interactive Area */}
      <View style={{ height, width: '100%' }} {...panResponder.panHandlers}>
        <Svg width={containerWidth} height={height}>
          <Defs>
            <LinearGradient id="splineGradient" x1="0" y1="0" x2="0" y2="1">
              <Stop
                offset="0%"
                stopColor={isDark ? '#FFFFFF' : '#000000'}
                stopOpacity="0.22"
              />
              <Stop
                offset="60%"
                stopColor={isDark ? '#FFFFFF' : '#000000'}
                stopOpacity="0.06"
              />
              <Stop
                offset="100%"
                stopColor={isDark ? '#FFFFFF' : '#000000'}
                stopOpacity="0.0"
              />
            </LinearGradient>
          </Defs>

          {/* Horizontal grid lines */}
          {gridLevels.map((lvl, idx) => {
            const span = maxVal - minVal || 1;
            const norm = (lvl - minVal) / span;
            const y = chartPaddingTop + plotHeight * (1 - norm);
            return (
              <React.Fragment key={idx}>
                <Line
                  x1={chartPaddingHorizontal}
                  y1={y}
                  x2={containerWidth - chartPaddingHorizontal}
                  y2={y}
                  stroke={theme.border}
                  strokeWidth="1"
                  strokeDasharray="4 4"
                />
              </React.Fragment>
            );
          })}

          {/* Area fill */}
          {areaPath ? <Path d={areaPath} fill="url(#splineGradient)" /> : null}

          {/* Line stroke */}
          {linePath ? (
            <Path
              d={linePath}
              fill="none"
              stroke={theme.text}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null}

          {/* Active scrubber vertical guide line */}
          {activePoint ? (
            <Line
              x1={activePoint.x}
              y1={chartPaddingTop - 6}
              x2={activePoint.x}
              y2={height - chartPaddingBottom}
              stroke={theme.borderDark}
              strokeWidth="1.5"
              strokeDasharray="2 3"
            />
          ) : null}

          {/* Data point dots */}
          {points.map((p, idx) => {
            const isSelected = idx === activeIdx;
            return (
              <Circle
                key={idx}
                cx={p.x}
                cy={p.y}
                r={isSelected ? 5.5 : 3}
                fill={isSelected ? theme.text : theme.card}
                stroke={theme.text}
                strokeWidth={isSelected ? 2.5 : 1.5}
              />
            );
          })}
        </Svg>
      </View>

      {/* Date Labels Axis */}
      <View style={[styles.datesRow, { paddingHorizontal: chartPaddingHorizontal }]}>
        {points.map((p, idx) => {
          // Show up to 7 labels neatly spaced
          const showLabel =
            points.length <= 7 ||
            idx === 0 ||
            idx === points.length - 1 ||
            idx === Math.floor(points.length / 2);

          if (!showLabel) return <View key={idx} style={{ flex: 1 }} />;

          const isSelected = idx === activeIdx;
          const label = p.date.slice(5).replace('-', '/');

          return (
            <Text
              key={idx}
              style={[
                styles.dateAxisLabel,
                { color: isSelected ? theme.text : theme.textMuted },
                isSelected && { fontWeight: '800' },
              ]}
            >
              {label}
            </Text>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingVertical: 4,
  },
  topHeader: {
    flexDirection: 'column',
    gap: 10,
    paddingHorizontal: 2,
    marginBottom: 10,
  },
  valCol: {
    width: '100%',
  },
  valRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  mainVal: {
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  kgUnit: {
    fontSize: 14,
    fontWeight: '600',
  },
  dateBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  dateBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  timeframeRow: {
    flexDirection: 'row',
    width: '100%',
    padding: 3,
    borderRadius: 11,
    borderWidth: 1,
    gap: 4,
  },
  tfBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    paddingVertical: 6,
    borderRadius: 8,
  },
  tfBtnText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  datesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  dateAxisLabel: {
    fontSize: 10,
    fontWeight: '600',
  },
});
