import React from 'react';
import Svg, { Path, Circle, Rect } from 'react-native-svg';

interface Props {
  color: string;
  size?: number;
}

export default function HRTabIcon({ color, size = 32 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      {/* Primary person */}
      <Circle cx="13" cy="10" r="4" fill={color} />
      <Path
        d="M4 26c0-4.418 4.029-8 9-8s9 3.582 9 8"
        stroke={color}
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      {/* Secondary person (smaller, behind) */}
      <Circle cx="23" cy="12" r="3" fill={color} opacity="0.55" />
      <Path
        d="M18 26c0-3.314 2.686-6 6-6"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.55"
      />
      {/* Small dollar badge */}
      <Circle cx="24" cy="23" r="5" fill={color} />
      <Path
        d="M24 20.5v.5M24 25v.5M22.5 22.5c0-.828.672-1.5 1.5-1.5s1.5.672 1.5 1.5-.672 1.5-1.5 1.5-1.5.672-1.5 1.5.672 1.5 1.5 1.5 1.5-.672 1.5-1.5"
        stroke="#fff"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </Svg>
  );
}
