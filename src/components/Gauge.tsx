import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, Line, Text as SvgText } from 'react-native-svg';
export function Gauge({ label, value, max, unit }: { label: string; value?: number; max: number; unit: string }) {
  const point = (angle: number, radius: number) => ({ x: 150 + Math.cos(angle * Math.PI / 180) * radius, y: 150 + Math.sin(angle * Math.PI / 180) * radius });
  const tip = point(135 + Math.min(1, Math.max(0, (value ?? 0) / max)) * 270, 100);
  return <View style={styles.container}>
    <Svg viewBox="0 0 300 300" width="100%" height="100%">
      <Circle cx={150} cy={150} r={139} fill="#11120f" stroke="#34332b" strokeWidth={4} />
      {Array.from({ length: 41 }, (_, index) => {
        const angle = 135 + index / 40 * 270;
        const a = point(angle, index % 5 === 0 ? 108 : 118), b = point(angle, 127), text = point(angle, 90);
        return <React.Fragment key={index}>
          <Line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={index > 34 ? '#dc623c' : '#efb46a'} strokeWidth={index % 5 === 0 ? 3 : 1} />
          {index % 5 === 0 && <SvgText x={text.x} y={text.y + 5} fill="#efb46a" fontSize={15} textAnchor="middle">{Math.round(max * index / 40)}</SvgText>}
        </React.Fragment>;
      })}
      <SvgText x={150} y={100} fill="#a99d87" fontSize={14} textAnchor="middle">{label}</SvgText>
      {value !== undefined && <Line x1={150} y1={150} x2={tip.x} y2={tip.y} stroke="#ff8c38" strokeWidth={4} />}
      <Circle cx={150} cy={150} r={9} fill="#efb46a" />
      <SvgText x={150} y={213} fill="#ffb35a" fontSize={28} fontWeight="bold" textAnchor="middle">{value === undefined ? '—' : Math.round(value)}</SvgText>
      <SvgText x={150} y={235} fill="#a99d87" fontSize={13} textAnchor="middle">{unit}</SvgText>
    </Svg>
  </View>;
}
const styles = StyleSheet.create({ container: { flex: 1, aspectRatio: 1, maxHeight: 340 } });
