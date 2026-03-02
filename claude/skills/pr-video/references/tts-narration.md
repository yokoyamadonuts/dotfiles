# TTS ナレーション統合

## 目次

- [概要](#概要)
- [方式比較](#方式比較)
- [Qwen3-TTS MCP Server セットアップ](#qwen3-tts-mcp-server-セットアップ)
- [NarrationScene コンポーネント](#narrationscene-コンポーネント)
- [ナレーション付きコンポジション例](#ナレーション付きコンポジション例)
- [TTS スクリプトテンプレート](#tts-スクリプトテンプレート)

## 概要

動画にAI生成ナレーションを追加する。ローカル実行（Qwen3-TTS + MLX）とクラウドTTSの2方式を選択可能。

**アーキテクチャ:**
- **音声生成エージェント**: TTS MCP Server 経由でシーンごとの音声を生成
- **動画編集エージェント**: Remotion で音声付き動画を合成
- 2エージェント分離で並列処理し効率化

## 方式比較

| 方式 | 利点 | 欠点 | 推奨用途 |
|------|------|------|---------|
| Qwen3-TTS (MLX) | 無料、ローカル、高速 | Apple Silicon 必須、日本語品質に課題 | プロトタイプ、英語コンテンツ |
| Google Cloud TTS | 高品質日本語 | 有料、API キー必要 | 本番動画 |
| Gemini TTS | 高品質、自然な音声 | API キー必要 | 高品質が必要な場合 |

## Qwen3-TTS MCP Server セットアップ

**前提:**
- Apple Silicon Mac（M1 以降）
- Python 3.10+、MLX フレームワーク

```bash
# MCP Server のセットアップ
git clone https://github.com/Mahiro-T/tts_mcp_server
cd tts_mcp_server
pip install -r requirements.txt

# モデルダウンロード（Hugging Face）
# Qwen3-TTS-12Hz-1.7B-CustomVoice-8bit
```

**MCP 設定（`mcp.json` に追加）:**

```json
{
  "mcpServers": {
    "tts": {
      "command": "python",
      "args": ["path/to/tts_mcp_server/server.py"],
      "env": {
        "MODEL_PATH": "path/to/Qwen3-TTS-12Hz-1.7B-CustomVoice-8bit"
      }
    }
  }
}
```

## NarrationScene コンポーネント

```tsx
// remotion/components/NarrationScene.tsx
import { AbsoluteFill, Audio, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { SPRINGS } from '../styles/theme';

type Props = {
  text: string;
  audioSrc?: string;
  background?: string;
};

export const NarrationScene: React.FC<Props> = ({
  text,
  audioSrc,
  background = '#0c0c1d',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const opacity = spring({ frame, fps, config: SPRINGS.smooth });

  return (
    <AbsoluteFill
      style={{
        background,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      {audioSrc && <Audio src={audioSrc} />}
      <p
        style={{
          color: '#e0e0e0',
          fontSize: 36,
          opacity,
          maxWidth: '80%',
          textAlign: 'center',
          lineHeight: 1.6,
        }}
      >
        {text}
      </p>
    </AbsoluteFill>
  );
};
```

## ナレーション付きコンポジション例

```tsx
// remotion/compositions/FeatureWithNarration.tsx
import { Composition, Sequence } from 'remotion';
import { VIDEO_CONFIG } from '../styles/theme';
import { HookScene } from '../components/HookScene';
import { NarrationScene } from '../components/NarrationScene';
import { DemoScene } from '../components/DemoScene';
import { CtaScene } from '../components/CtaScene';

// ナレーション付きは音声に合わせてフレーム数を調整
const SCENE_FRAMES = {
  hook: { from: 0, duration: 60 },
  narration: { from: 60, duration: 90 },    // 3秒: 課題説明ナレーション
  demo: { from: 150, duration: 210 },       // 7秒: デモ + 音声解説
  cta: { from: 360, duration: 90 },
} as const;

export const FeatureWithNarration: React.FC = () => (
  <>
    <Sequence {...SCENE_FRAMES.hook}>
      <HookScene title="レポート作成を、もっと速く。" />
    </Sequence>
    <Sequence {...SCENE_FRAMES.narration}>
      <NarrationScene
        text="従来のレポート作成は手作業で3時間。AIが自動化します。"
        audioSrc="http://localhost:3000/remotion/audio/narration-problem.wav"
      />
    </Sequence>
    <Sequence {...SCENE_FRAMES.demo}>
      <DemoScene videoSrc="http://localhost:3000/remotion/videos/feature.webm" />
    </Sequence>
    <Sequence {...SCENE_FRAMES.cta}>
      <CtaScene text="今すぐ試す →" url="https://example.com" />
    </Sequence>
  </>
);
```

## TTS スクリプトテンプレート

ナレーション台本をシーンごとに管理する：

```typescript
// scripts/generate-narration.ts
// TTS MCP Server または Cloud TTS API で音声ファイルを生成

interface NarrationScript {
  sceneId: string;
  text: string;
  outputPath: string;
  voice?: string;  // 話者指定（TTS プロバイダ依存）
}

const SCRIPTS: NarrationScript[] = [
  {
    sceneId: 'problem',
    text: '従来のレポート作成は、手作業で3時間かかっていました。',
    outputPath: 'public/remotion/audio/narration-problem.wav',
  },
  {
    sceneId: 'demo',
    text: 'AIが自動でデータを分析し、レポートを生成します。',
    outputPath: 'public/remotion/audio/narration-demo.wav',
  },
];

// MCP 経由で TTS を呼び出す場合:
// Claude Code から「ナレーション音声を生成して」で TTS MCP Server を使用
// 生成された .wav ファイルを public/remotion/audio/ に配置
```

### 日本語 TTS の注意点

- Qwen3-TTS は日本語で中国語風のイントネーションが出る場合がある
- 品質が重要な場合は Google Cloud TTS や Gemini TTS を検討
- シーン分割で音声を生成すると話者の一貫性が低下する → 可能な限り長い文章でまとめて生成
