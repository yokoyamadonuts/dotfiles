# Remotion コンポーネントテンプレート

## 目次

- [テーマ設定](#テーマ設定)
- [HookScene](#hookscene)
- [ProblemScene](#problemscene)
- [DemoScene](#demoscene)
- [CtaScene](#ctascene)

## テーマ設定

```typescript
// remotion/styles/theme.ts
export const VIDEO_CONFIG = {
  width: 1920,
  height: 1080,
  fps: 30,
  durationInFrames: 450, // 15秒
} as const;

export const GRADIENTS = {
  primary: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  hero: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
  dark: 'linear-gradient(135deg, #0c0c1d 0%, #1a1a2e 100%)',
  ai: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
} as const;

export const SPRINGS = {
  bouncy: { damping: 12, mass: 0.5, stiffness: 100 },
  smooth: { damping: 20, mass: 1, stiffness: 80 },
  gentle: { damping: 30, mass: 1, stiffness: 60 },
  snappy: { damping: 15, mass: 0.4, stiffness: 200 },
} as const;
```

## HookScene

```tsx
// remotion/components/HookScene.tsx
import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { GRADIENTS, SPRINGS } from '../styles/theme';

type Props = {
  title: string;
  gradient?: keyof typeof GRADIENTS;
};

export const HookScene: React.FC<Props> = ({
  title,
  gradient = 'primary',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const scale = spring({ frame, fps, config: SPRINGS.bouncy });
  const opacity = spring({ frame, fps, config: SPRINGS.smooth });

  return (
    <AbsoluteFill
      style={{
        background: GRADIENTS[gradient],
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <h1
        style={{
          color: '#fff',
          fontSize: 72,
          fontWeight: 'bold',
          transform: `scale(${scale})`,
          opacity,
        }}
      >
        {title}
      </h1>
    </AbsoluteFill>
  );
};
```

## ProblemScene

```tsx
// remotion/components/ProblemScene.tsx
import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { SPRINGS } from '../styles/theme';

type Props = {
  text: string;
};

export const ProblemScene: React.FC<Props> = ({ text }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const translateY = spring({ frame, fps, config: SPRINGS.gentle, from: 40, to: 0 });
  const opacity = spring({ frame, fps, config: SPRINGS.smooth });

  return (
    <AbsoluteFill
      style={{
        background: '#0c0c1d',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <p
        style={{
          color: '#a0a0b0',
          fontSize: 48,
          transform: `translateY(${translateY}px)`,
          opacity,
          maxWidth: '70%',
          textAlign: 'center',
          lineHeight: 1.5,
        }}
      >
        {text}
      </p>
    </AbsoluteFill>
  );
};
```

## DemoScene

```tsx
// remotion/components/DemoScene.tsx
import { AbsoluteFill, OffthreadVideo, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { SPRINGS } from '../styles/theme';

type Props = {
  videoSrc: string;
  playbackRate?: number;
};

export const DemoScene: React.FC<Props> = ({
  videoSrc,
  playbackRate = 1,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const opacity = spring({ frame, fps, config: SPRINGS.smooth });

  return (
    <AbsoluteFill style={{ background: '#000' }}>
      <OffthreadVideo
        src={videoSrc}
        playbackRate={playbackRate}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          opacity,
        }}
      />
    </AbsoluteFill>
  );
};
```

## CtaScene

```tsx
// remotion/components/CtaScene.tsx
import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { GRADIENTS, SPRINGS } from '../styles/theme';

type Props = {
  text: string;
  url: string;
  gradient?: keyof typeof GRADIENTS;
};

export const CtaScene: React.FC<Props> = ({
  text,
  url,
  gradient = 'hero',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const scale = spring({ frame, fps, config: SPRINGS.snappy });
  const opacity = spring({ frame, fps, config: SPRINGS.smooth });

  return (
    <AbsoluteFill
      style={{
        background: GRADIENTS[gradient],
        justifyContent: 'center',
        alignItems: 'center',
        gap: 24,
        flexDirection: 'column',
      }}
    >
      <h2
        style={{
          color: '#fff',
          fontSize: 56,
          fontWeight: 'bold',
          transform: `scale(${scale})`,
          opacity,
        }}
      >
        {text}
      </h2>
      <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: 28, opacity }}>
        {url}
      </p>
    </AbsoluteFill>
  );
};
```
