import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  FlatList,
  Image,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import Svg, { Defs, Path, Pattern, RadialGradient, Rect, Stop } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import {
  AudioModule,
  AudioQuality,
  IOSOutputFormat,
  RecordingOptions,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
} from 'expo-audio';
import { File, Paths } from 'expo-file-system';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { useKeyboardHeight } from '../hooks/useKeyboardHeight';
import {
  ChatMessage,
  ChatMessagePayload,
  ChatMessageType,
  FriendProfileSummary,
} from '../types/workout';
import {
  deleteChatMessage,
  editChatMessage,
  fetchChatMessages,
  reactToChatMessage,
  saveSharedChatTheme,
  sendChatMessage,
} from '../services/social';
import { triggerNotificationHaptic, triggerSelectionHaptic } from '../services/haptics';
import { base64ToBytes, bytesToBase64 } from '../utils/e2ee';
import { UserAvatarBadge } from './UserAvatarBadge';
import { MinimalistBackdrop } from './MinimalistBackdrop';
import { FriendProfileModal } from './FriendProfileModal';

type ChatThemeId = 'monochrome' | 'emerald' | 'royal' | 'ocean' | 'gold' | 'crimson';
type ChatWallpaperId = 'none' | 'topography' | 'carbon_hex' | 'aurora' | 'custom';

interface ChatAppearance {
  themeId: ChatThemeId;
  wallpaperId: ChatWallpaperId;
  customUri?: string | null;
}

const CHAT_APPEARANCE_KEY_PREFIX = '@iron_routine:chat_appearance_v1_';

const CHAT_THEMES: Array<{
  id: ChatThemeId;
  label: string;
  accent: string;
  outgoingDark: string;
  outgoingLight: string;
  outgoingTextDark: string;
  outgoingTextLight: string;
}> = [
  {
    id: 'monochrome',
    label: 'Mono',
    accent: '#94A3B8',
    outgoingDark: '#F4F4F5',
    outgoingLight: '#18181B',
    outgoingTextDark: '#09090B',
    outgoingTextLight: '#FFFFFF',
  },
  {
    id: 'emerald',
    label: 'Szmaragd',
    accent: '#10B981',
    outgoingDark: '#059669',
    outgoingLight: '#059669',
    outgoingTextDark: '#FFFFFF',
    outgoingTextLight: '#FFFFFF',
  },
  {
    id: 'royal',
    label: 'Fiolet',
    accent: '#A855F7',
    outgoingDark: '#7C3AED',
    outgoingLight: '#7C3AED',
    outgoingTextDark: '#FFFFFF',
    outgoingTextLight: '#FFFFFF',
  },
  {
    id: 'ocean',
    label: 'Błękit',
    accent: '#38BDF8',
    outgoingDark: '#0284C7',
    outgoingLight: '#0284C7',
    outgoingTextDark: '#FFFFFF',
    outgoingTextLight: '#FFFFFF',
  },
  {
    id: 'gold',
    label: 'Złoto',
    accent: '#F59E0B',
    outgoingDark: '#F59E0B',
    outgoingLight: '#D97706',
    outgoingTextDark: '#09090B',
    outgoingTextLight: '#FFFFFF',
  },
  {
    id: 'crimson',
    label: 'Ogień',
    accent: '#EF4444',
    outgoingDark: '#DC2626',
    outgoingLight: '#DC2626',
    outgoingTextDark: '#FFFFFF',
    outgoingTextLight: '#FFFFFF',
  },
];

const CHAT_WALLPAPERS: Array<{ id: ChatWallpaperId; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { id: 'none', label: 'Czyste', icon: 'layers-outline' },
  { id: 'topography', label: 'Fale', icon: 'pulse-outline' },
  { id: 'carbon_hex', label: 'Karbon', icon: 'grid-outline' },
  { id: 'aurora', label: 'Poświata', icon: 'sparkles-outline' },
];

const ChatWallpaperLayer: React.FC<{
  appearance: ChatAppearance;
  accentColor: string;
  isDark: boolean;
}> = React.memo(({ appearance, accentColor, isDark }) => {
  const uid = useId().replace(/:/g, '_');
  // Higher contrast strokes and radiant glows in light mode so wallpapers look crisp on white
  const strokeCol = isDark ? 'rgba(255,255,255,0.11)' : 'rgba(15,23,42,0.17)';

  if (appearance.wallpaperId === 'custom' && appearance.customUri) {
    return (
      <View style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }]}>
        <Image
          source={{ uri: appearance.customUri }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        />
        <View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: isDark ? 'rgba(5,6,10,0.48)' : 'rgba(255,255,255,0.18)' },
          ]}
        />
      </View>
    );
  }

  if (appearance.wallpaperId === 'none') {
    return (
      <MinimalistBackdrop
        variant="diagonal"
        accentColor={accentColor}
        secondaryColor={accentColor}
        showCornerGlows={appearance.themeId !== 'monochrome'}
      />
    );
  }

  return (
    <View style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }]}>
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id={`wp_glow_a_${uid}`} cx="86%" cy="10%" r="68%">
            <Stop offset="0%" stopColor={accentColor} stopOpacity={isDark ? 0.3 : 0.34} />
            <Stop offset="100%" stopColor={accentColor} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id={`wp_glow_b_${uid}`} cx="14%" cy="90%" r="64%">
            <Stop offset="0%" stopColor={accentColor} stopOpacity={isDark ? 0.22 : 0.26} />
            <Stop offset="100%" stopColor={accentColor} stopOpacity={0} />
          </RadialGradient>

          {appearance.wallpaperId === 'topography' && (
            <Pattern id={`wp_topo_${uid}`} width={140} height={140} patternUnits="userSpaceOnUse">
              <Path
                d="M 0 36 Q 35 12 70 36 T 140 36 M 0 88 Q 35 64 70 88 T 140 88"
                fill="none"
                stroke={strokeCol}
                strokeWidth={1.35}
              />
              <Path
                d="M 0 116 Q 35 138 70 116 T 140 116"
                fill="none"
                stroke={strokeCol}
                strokeWidth={0.95}
                strokeDasharray="4 6"
              />
            </Pattern>
          )}

          {appearance.wallpaperId === 'carbon_hex' && (
            <Pattern id={`wp_hex_${uid}`} width={40} height={40} patternUnits="userSpaceOnUse">
              <Path
                d="M 20 2 L 38 11 L 38 29 L 20 38 L 2 29 L 2 11 Z"
                fill="none"
                stroke={strokeCol}
                strokeWidth={1.15}
              />
            </Pattern>
          )}
        </Defs>

        {!isDark && (
          <Rect x={0} y={0} width="100%" height="100%" fill={accentColor} fillOpacity={0.075} />
        )}
        {appearance.wallpaperId === 'topography' && (
          <Rect x={0} y={0} width="100%" height="100%" fill={`url(#wp_topo_${uid})`} />
        )}
        {appearance.wallpaperId === 'carbon_hex' && (
          <Rect x={0} y={0} width="100%" height="100%" fill={`url(#wp_hex_${uid})`} />
        )}
        <Rect x={0} y={0} width="100%" height="100%" fill={`url(#wp_glow_a_${uid})`} />
        <Rect x={0} y={0} width="100%" height="100%" fill={`url(#wp_glow_b_${uid})`} />
      </Svg>
    </View>
  );
});

interface FriendChatModalProps {
  visible: boolean;
  friend: FriendProfileSummary | null;
  myProfile: FriendProfileSummary | null;
  myUserId: string;
  onClose: () => void;
  onOpenProfile?: (friend: FriendProfileSummary) => void;
  onSendKudos?: (friend: FriendProfileSummary) => Promise<void> | void;
  onRemoveFriend?: (friend: FriendProfileSummary) => Promise<void> | void;
  onMessagesChanged?: () => void;
}

const MESSENGER_REACTIONS = ['❤️', '🔥', '💪', '😂', '👏', '🏆'];
const MAX_VOICE_SECONDS = 30;
const WAVEFORM_BAR_COUNT = 22;
const LIVE_BAR_COUNT = 18;
const DEFAULT_WAVEFORM = [
  0.32, 0.54, 0.78, 0.45, 0.88, 0.62, 0.39, 0.84, 0.72, 0.5, 0.92,
  0.66, 0.42, 0.79, 0.58, 0.44, 0.69, 0.82, 0.53, 0.74, 0.48, 0.35,
];

// High-definition wideband AAC voice profile (44.1 kHz / 96 kbps)
const VOICE_RECORDING_OPTIONS: RecordingOptions = {
  extension: '.m4a',
  sampleRate: 44100,
  numberOfChannels: 1,
  bitRate: 96000,
  isMeteringEnabled: true,
  android: {
    extension: '.m4a',
    outputFormat: 'mpeg4',
    audioEncoder: 'aac',
  },
  ios: {
    outputFormat: IOSOutputFormat.MPEG4AAC,
    audioQuality: AudioQuality.HIGH,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: {
    mimeType: 'audio/webm;codecs=opus',
    bitsPerSecond: 96000,
  },
};

function formatClockTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function formatTimeSeparator(iso: string, localeCode: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  const timeStr = formatClockTime(iso);
  if (sameDay) return timeStr;
  return `${d.toLocaleDateString(localeCode, { day: 'numeric', month: 'short' })} · ${timeStr}`;
}

function formatDurationSec(totalSec: number): string {
  const safe = Math.max(0, Math.round(totalSec));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

function downsampleWaveform(samples: number[], targetCount = WAVEFORM_BAR_COUNT): number[] {
  if (!samples.length) return DEFAULT_WAVEFORM;
  const out: number[] = [];
  for (let i = 0; i < targetCount; i++) {
    const idx = Math.min(samples.length - 1, Math.floor((i / targetCount) * samples.length));
    out.push(Number(Math.min(1, Math.max(0.16, samples[idx])).toFixed(2)));
  }
  return out;
}

function buildMessagesSignature(list: ChatMessage[]): string {
  return list
    .map((m) => {
      const rx = m.reactions ? JSON.stringify(m.reactions) : '';
      return `${m.id}:${m.text}:${m.editedAt ?? ''}:${m.payload?.durationSec ?? 0}:${rx}`;
    })
    .join('|');
}

interface AnimatedMessageRowProps {
  animateOnMount: boolean;
  isMine: boolean;
  children: React.ReactNode;
}

const AnimatedMessageRow: React.FC<AnimatedMessageRowProps> = ({
  animateOnMount,
  isMine,
  children,
}) => {
  const anim = useRef(new Animated.Value(animateOnMount ? 0 : 1)).current;
  const startedRef = useRef(false);

  useEffect(() => {
    if (!animateOnMount || startedRef.current) return;
    startedRef.current = true;
    Animated.spring(anim, {
      toValue: 1,
      friction: 7.2,
      tension: 135,
      useNativeDriver: true,
    }).start();
  }, [anim, animateOnMount]);

  return (
    <Animated.View
      style={{
        opacity: anim.interpolate({
          inputRange: [0, 0.25, 1],
          outputRange: [0, 0.9, 1],
        }),
        transform: [
          {
            translateY: anim.interpolate({
              inputRange: [0, 1],
              outputRange: [34, 0],
            }),
          },
          {
            translateX: anim.interpolate({
              inputRange: [0, 1],
              outputRange: [isMine ? 22 : -22, 0],
            }),
          },
          {
            scale: anim.interpolate({
              inputRange: [0, 0.8, 1],
              outputRange: [0.76, 1.02, 1],
            }),
          },
        ],
      }}
    >
      {children}
    </Animated.View>
  );
};

interface VoiceNoteBubbleProps {
  messageId: string;
  audioBase64?: string;
  audioMime?: string;
  durationSec?: number;
  waveform?: number[];
  isMine: boolean;
}

const VoiceNoteBubble: React.FC<VoiceNoteBubbleProps> = ({
  messageId,
  audioBase64,
  audioMime,
  durationSec = 0,
  waveform,
  isMine,
}) => {
  const { theme } = useAppTheme();
  const { t } = useLanguage();
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [isPreparing, setIsPreparing] = useState(false);

  const bars = useMemo(
    () => (waveform && waveform.length >= 8 ? downsampleWaveform(waveform) : DEFAULT_WAVEFORM),
    [waveform]
  );

  useEffect(() => {
    let cancelled = false;
    if (!audioBase64) {
      setAudioUri(null);
      return;
    }

    if (Platform.OS === 'web') {
      const mime = audioMime || 'audio/webm';
      setAudioUri(`data:${mime};base64,${audioBase64}`);
      return;
    }

    const ext = audioMime?.includes('webm') ? 'webm' : 'm4a';
    const safeName = `ir_voice_hq_${messageId.replace(/[^a-zA-Z0-9_-]/g, '_')}.${ext}`;

    setIsPreparing(true);
    (async () => {
      try {
        const cached = new File(Paths.cache, safeName);
        if (!cached.exists) {
          cached.create({ overwrite: true });
          const bytes = base64ToBytes(audioBase64);
          await cached.write(bytes);
        }
        if (!cancelled) {
          setAudioUri(cached.uri);
        }
      } catch {
        if (!cancelled) {
          setAudioUri(null);
        }
      } finally {
        if (!cancelled) {
          setIsPreparing(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [audioBase64, audioMime, messageId]);

  const player = useAudioPlayer(audioUri ? { uri: audioUri } : null, {
    updateInterval: 80,
  });
  const status = useAudioPlayerStatus(player);

  useEffect(() => {
    if (status.didJustFinish) {
      player.pause();
      void player.seekTo(0);
    }
  }, [player, status.didJustFinish]);

  const totalSec = status.duration > 0 ? status.duration : durationSec;
  const progressRatio =
    totalSec > 0 ? Math.min(1, Math.max(0, status.currentTime / totalSec)) : 0;

  const handleTogglePlay = async () => {
    if (!audioUri || isPreparing) return;
    triggerSelectionHaptic();
    try {
      await setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: false,
      });
    } catch {
      // Ignore web fallback
    }
    if (status.playing) {
      player.pause();
    } else {
      if (totalSec > 0 && status.currentTime >= totalSec - 0.15) {
        await player.seekTo(0);
      }
      player.play();
    }
  };

  const handleSeekBar = async (barIdx: number) => {
    if (!audioUri || totalSec <= 0) return;
    triggerSelectionHaptic();
    const ratio = (barIdx + 0.5) / bars.length;
    await player.seekTo(ratio * totalSec);
    if (!status.playing) {
      await setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: false,
      }).catch(() => {});
      player.play();
    }
  };

  const mineOnLight = isMine && !theme.isDark;
  const mineOnDark = isMine && theme.isDark;

  const buttonBg = mineOnDark
    ? 'rgba(0,0,0,0.12)'
    : mineOnLight
    ? 'rgba(255,255,255,0.18)'
    : theme.isDark
    ? 'rgba(255,255,255,0.12)'
    : 'rgba(0,0,0,0.08)';
  const buttonIconColor = isMine ? theme.primaryText : theme.text;
  const activeBarColor = isMine ? theme.primaryText : theme.text;
  const idleBarColor = mineOnDark
    ? 'rgba(0,0,0,0.24)'
    : mineOnLight
    ? 'rgba(255,255,255,0.34)'
    : theme.isDark
    ? 'rgba(255,255,255,0.24)'
    : 'rgba(0,0,0,0.2)';
  const metaTextColor = mineOnDark
    ? 'rgba(0,0,0,0.68)'
    : mineOnLight
    ? 'rgba(255,255,255,0.82)'
    : theme.textSecondary;

  return (
    <View style={styles.voiceWrap}>
      <TouchableOpacity
        style={[styles.voicePlayBtn, { backgroundColor: buttonBg }]}
        onPress={handleTogglePlay}
        disabled={!audioUri || isPreparing}
        activeOpacity={0.78}
      >
        {isPreparing ? (
          <ActivityIndicator size="small" color={buttonIconColor} />
        ) : (
          <Ionicons
            name={status.playing ? 'pause' : 'play'}
            size={18}
            color={buttonIconColor}
            style={!status.playing ? { marginLeft: 2 } : undefined}
          />
        )}
      </TouchableOpacity>

      <View style={styles.voiceWaveBlock}>
        <View style={styles.voiceBarsRow}>
          {bars.map((amp, idx) => {
            const barPct = (idx + 0.5) / bars.length;
            const filled =
              status.playing || status.currentTime > 0 ? barPct <= progressRatio : false;
            return (
              <TouchableOpacity
                key={idx}
                onPress={() => handleSeekBar(idx)}
                hitSlop={{ top: 6, bottom: 6, left: 1, right: 1 }}
                activeOpacity={0.7}
                style={styles.voiceBarTouch}
              >
                <View
                  style={[
                    styles.voiceBar,
                    {
                      height: Math.round(7 + amp * 20),
                      backgroundColor: filled ? activeBarColor : idleBarColor,
                    },
                  ]}
                />
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.voiceMetaRow}>
          <Text style={[styles.voiceTimerText, { color: metaTextColor }]}>
            {status.playing || status.currentTime > 0.2
              ? `${formatDurationSec(status.currentTime)} / ${formatDurationSec(totalSec)}`
              : formatDurationSec(totalSec)}
          </Text>
          <View style={styles.voiceLockPill}>
            <Ionicons name="lock-closed" size={9} color={metaTextColor} />
            <Text style={[styles.voiceHintTag, { color: metaTextColor }]} numberOfLines={1}>
              {t('voiceMsgLabel').replace('🎤 ', '')}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
};

export const FriendChatModal: React.FC<FriendChatModalProps> = ({
  visible,
  friend,
  myProfile,
  myUserId,
  onClose,
  onOpenProfile,
  onSendKudos,
  onRemoveFriend,
  onMessagesChanged,
}) => {
  const { theme } = useAppTheme();
  const { t, localeCode } = useLanguage();
  const insets = useSafeAreaInsets();
  const keyboardHeight = useKeyboardHeight();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [inputText, setInputText] = useState('');
  const [editingMsg, setEditingMsg] = useState<ChatMessage | null>(null);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showInChatProfile, setShowInChatProfile] = useState(false);
  const [showThemeSheet, setShowThemeSheet] = useState(false);
  const [previewPhotoUri, setPreviewPhotoUri] = useState<string | null>(null);
  const [appearance, setAppearance] = useState<ChatAppearance>({
    themeId: 'monochrome',
    wallpaperId: 'none',
    customUri: null,
  });
  const [reactionTarget, setReactionTarget] = useState<{
    message: ChatMessage;
    rect: { x: number; y: number; width: number; height: number };
  } | null>(null);
  const [holdHintVisible, setHoldHintVisible] = useState(false);

  const attachAnim = useRef(new Animated.Value(0)).current;
  const reactionDockAnim = useRef(new Animated.Value(0)).current;
  const sendLaunchAnim = useRef(new Animated.Value(1)).current;
  const inputRef = useRef<React.ComponentRef<typeof TextInput>>(null);
  const bubbleViewRefs = useRef<Record<string, React.ComponentRef<typeof View> | null>>({});
  const stableKeyByIdRef = useRef<Map<string, string>>(new Map());
  const themeNotifyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastAnnouncedAppearanceRef = useRef<string>('');
  const pendingThemeAnnounceRef = useRef<ChatAppearance | null>(null);

  // Voice recording + real-time metering state
  const recorder = useAudioRecorder(VOICE_RECORDING_OPTIONS);
  const [isRecordingMode, setIsRecordingMode] = useState(false);
  const [isSendingVoice, setIsSendingVoice] = useState(false);
  const [recordingSec, setRecordingSec] = useState(0);
  const [voiceIntensity, setVoiceIntensity] = useState(0.2);
  const [liveWaveSamples, setLiveWaveSamples] = useState<number[]>(() =>
    new Array(LIVE_BAR_COUNT).fill(0.18)
  );

  const hasMicPermRef = useRef<boolean>(false);
  const holdActiveRef = useRef<boolean>(false);
  const holdStartTsRef = useRef<number>(0);
  const isRecordingActiveRef = useRef<boolean>(false);
  const recordedLevelsRef = useRef<number[]>([]);
  const holdHintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recPulseAnim = useRef(new Animated.Value(0)).current;
  const lastBubbleTapRef = useRef<{ id: string; time: number } | null>(null);

  const listRef = useRef<FlatList<ChatMessage>>(null);
  const hasLoadedFriendRef = useRef<string | null>(null);
  const knownMessageIdsRef = useRef<Set<string>>(new Set());
  const animatedIdsRef = useRef<Set<string>>(new Set());
  const lastSignatureRef = useRef<string>('');
  const clientMsgSeqRef = useRef<number>(0);
  const mutationEpochRef = useRef<number>(0);
  const isSendingRef = useRef<boolean>(false);
  const prevMsgCountRef = useRef<number>(0);
  const [friendLastReadAt, setFriendLastReadAt] = useState<string | null>(null);
  const photoDragY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (previewPhotoUri) {
      photoDragY.setValue(0);
    }
  }, [photoDragY, previewPhotoUri]);

  const photoPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, g) =>
          Math.abs(g.dy) > 8 && Math.abs(g.dy) > Math.abs(g.dx) * 1.15,
        onPanResponderMove: (_, g) => {
          photoDragY.setValue(g.dy);
        },
        onPanResponderRelease: (_, g) => {
          if (Math.abs(g.dy) > 95 || g.vy > 0.65 || g.vy < -0.75) {
            triggerSelectionHaptic();
            Animated.timing(photoDragY, {
              toValue: g.dy < 0 ? -480 : 520,
              duration: 165,
              useNativeDriver: true,
            }).start(() => {
              setPreviewPhotoUri(null);
            });
          } else {
            Animated.spring(photoDragY, {
              toValue: 0,
              friction: 7,
              tension: 120,
              useNativeDriver: true,
            }).start();
          }
        },
        onPanResponderTerminate: () => {
          Animated.spring(photoDragY, {
            toValue: 0,
            friction: 7,
            tension: 120,
            useNativeDriver: true,
          }).start();
        },
      }),
    [photoDragY]
  );

  // Silently check microphone permission on chat open so hold-to-record starts instantly
  useEffect(() => {
    if (!visible) return;
    AudioModule.getRecordingPermissionsAsync()
      .then((perm) => {
        hasMicPermRef.current = Boolean(perm?.granted);
      })
      .catch(() => {});
  }, [visible]);

  const loadMessages = useCallback(
    async (silent = false) => {
      if (!friend) return;
      const targetFriendId = friend.userId;
      const isInitialForFriend = hasLoadedFriendRef.current !== targetFriendId;
      if (!isInitialForFriend && isSendingRef.current) {
        return;
      }
      const startEpoch = mutationEpochRef.current;

      if (!silent && isInitialForFriend) {
        setIsLoading(true);
      }
      const res = await fetchChatMessages(targetFriendId);
      if (res.ok) {
        // Discard stale background poll if a local send/edit/react/delete happened while GET was in flight
        if (!isInitialForFriend && (startEpoch !== mutationEpochRef.current || isSendingRef.current)) {
          return;
        }
        if (res.friendLastReadAt !== undefined) {
          setFriendLastReadAt(res.friendLastReadAt || null);
        }
        if (res.theme) {
          const remoteAppearance: ChatAppearance = {
            themeId: (res.theme.themeId as ChatThemeId) || 'monochrome',
            wallpaperId: (res.theme.wallpaperId as ChatWallpaperId) || 'none',
            customUri: res.theme.customUri || null,
          };
          setAppearance((prev) => {
            if (
              prev.themeId === remoteAppearance.themeId &&
              prev.wallpaperId === remoteAppearance.wallpaperId &&
              (prev.customUri || null) === (remoteAppearance.customUri || null)
            ) {
              return prev;
            }
            lastAnnouncedAppearanceRef.current = `${remoteAppearance.themeId}|${remoteAppearance.wallpaperId}|${remoteAppearance.customUri ? '1' : '0'}`;
            AsyncStorage.setItem(
              `${CHAT_APPEARANCE_KEY_PREFIX}${targetFriendId}`,
              JSON.stringify(remoteAppearance)
            ).catch(() => {});
            return remoteAppearance;
          });
        }
        const nextList = res.messages;
        const sig = buildMessagesSignature(nextList);
        if (isInitialForFriend) {
          knownMessageIdsRef.current = new Set(nextList.map((m) => m.id));
          animatedIdsRef.current.clear();
          hasLoadedFriendRef.current = targetFriendId;
          prevMsgCountRef.current = nextList.length;
          lastSignatureRef.current = sig;
          setMessages(nextList);
          setTimeout(() => {
            listRef.current?.scrollToEnd({ animated: false });
          }, 40);
        } else if (sig !== lastSignatureRef.current) {
          nextList.forEach((m) => {
            if (!knownMessageIdsRef.current.has(m.id)) {
              knownMessageIdsRef.current.add(m.id);
              animatedIdsRef.current.add(m.id);
            }
          });
          lastSignatureRef.current = sig;
          setMessages((prev) => {
            const pending = prev.filter((m) => m.id.startsWith('local_'));
            return [...nextList, ...pending];
          });
        }
      }
      if (!silent && isInitialForFriend) {
        setIsLoading(false);
      }
    },
    [friend]
  );

  useEffect(() => {
    if (messages.length > prevMsgCountRef.current) {
      scrollToLatest();
    }
    prevMsgCountRef.current = messages.length;
  }, [messages.length]);

  useEffect(() => {
    if (!visible || !friend) {
      hasLoadedFriendRef.current = null;
      lastSignatureRef.current = '';
      prevMsgCountRef.current = 0;
      isSendingRef.current = false;
      knownMessageIdsRef.current.clear();
      animatedIdsRef.current.clear();
      stableKeyByIdRef.current.clear();
      if (themeNotifyTimerRef.current) {
        clearTimeout(themeNotifyTimerRef.current);
        themeNotifyTimerRef.current = null;
      }
      pendingThemeAnnounceRef.current = null;
      lastAnnouncedAppearanceRef.current = '';
      setMessages([]);
      setReactionTarget(null);
      setEditingMsg(null);
      setShowAttachMenu(false);
      setShowInChatProfile(false);
      setShowThemeSheet(false);
      setPreviewPhotoUri(null);
      setFriendLastReadAt(null);
      setInputText('');
      setIsRecordingMode(false);
      holdActiveRef.current = false;
      isRecordingActiveRef.current = false;
      return;
    }
    AsyncStorage.getItem(`${CHAT_APPEARANCE_KEY_PREFIX}${friend.userId}`)
      .then((raw) => {
        if (!raw) {
          setAppearance({ themeId: 'monochrome', wallpaperId: 'none', customUri: null });
          lastAnnouncedAppearanceRef.current = 'monochrome|none';
          return;
        }
        try {
          const parsed = JSON.parse(raw);
          const loaded = {
            themeId: parsed.themeId || 'monochrome',
            wallpaperId: parsed.wallpaperId || 'none',
            customUri: parsed.customUri || null,
          };
          setAppearance(loaded);
          lastAnnouncedAppearanceRef.current = `${loaded.themeId}|${loaded.wallpaperId}|${loaded.customUri ? '1' : '0'}`;
        } catch {}
      })
      .catch(() => {});
    void loadMessages(false);
    const interval = setInterval(() => {
      void loadMessages(true);
    }, 2800);
    return () => clearInterval(interval);
  }, [visible, friend?.userId, loadMessages]);

  useEffect(() => {
    Animated.spring(attachAnim, {
      toValue: showAttachMenu ? 1 : 0,
      friction: 8,
      tension: 120,
      useNativeDriver: true,
    }).start();
  }, [showAttachMenu, attachAnim]);

  useEffect(() => {
    if (!reactionTarget) {
      reactionDockAnim.setValue(0);
      return;
    }
    Animated.spring(reactionDockAnim, {
      toValue: 1,
      friction: 7.2,
      tension: 150,
      useNativeDriver: true,
    }).start();
  }, [reactionTarget, reactionDockAnim]);

  // Continuous live recorder metering poll (80ms) while holding mic -> flows left-to-right
  useEffect(() => {
    if (!isRecordingMode) {
      recPulseAnim.setValue(0);
      setVoiceIntensity(0.2);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(recPulseAnim, {
          toValue: 1,
          duration: 460,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(recPulseAnim, {
          toValue: 0,
          duration: 460,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();

    const poll = setInterval(() => {
      try {
        const st = recorder.getStatus();
        const elapsedSec = Math.floor((st.durationMillis || 0) / 1000);
        setRecordingSec(elapsedSec);

        // Native iOS AVAudioRecorder returns dBFS in [-160 .. 0]; speech sits around [-42 .. -4]
        const rawDb = typeof st.metering === 'number' ? st.metering : -38;
        const clampedDb = Math.max(-50, Math.min(-2, rawDb));
        const normalized = Math.pow((clampedDb + 50) / 48, 0.85);
        const level = Math.min(1, Math.max(0.14, normalized));

        setVoiceIntensity(level);
        recordedLevelsRef.current.push(level);
        // Push newest sample to the LEFT (index 0) so waveform visibly flows left-to-right (→)
        setLiveWaveSamples((prev) => [level, ...prev.slice(0, LIVE_BAR_COUNT - 1)]);
      } catch {
        // Ignore transient status read
      }
    }, 80);

    return () => {
      loop.stop();
      clearInterval(poll);
    };
  }, [isRecordingMode, recPulseAnim, recorder]);

  const scrollToLatest = useCallback(() => {
    setTimeout(() => {
      listRef.current?.scrollToEnd({ animated: true });
    }, 60);
  }, []);

  const triggerSendButtonPulse = useCallback(() => {
    sendLaunchAnim.setValue(0.8);
    Animated.spring(sendLaunchAnim, {
      toValue: 1,
      friction: 5.5,
      tension: 180,
      useNativeDriver: true,
    }).start();
  }, [sendLaunchAnim]);

  const handleSend = useCallback(
    async (
      customType: ChatMessageType = 'text',
      customText?: string,
      payload?: ChatMessagePayload
    ) => {
      if (!friend || isSending) return;
      const text = (customText ?? inputText).trim();
      if (!text && customType === 'text') return;

      if (!friend.e2eePublicKey) {
        if (customType !== 'system') {
          Alert.alert(t('e2eeBadgeLabel'), t('e2eeMissingRecipientKey'));
        }
        return;
      }

      if (customType !== 'system') {
        triggerSelectionHaptic();
        triggerSendButtonPulse();
      }
      setShowAttachMenu(false);
      if (customType === 'text') {
        setInputText('');
      }

      clientMsgSeqRef.current += 1;
      const tempId = `local_${Date.now()}_${clientMsgSeqRef.current}`;
      const optimistic: ChatMessage = {
        id: tempId,
        senderId: myUserId,
        recipientId: friend.userId,
        type: customType,
        text: text || t('voiceMsgLabel'),
        payload,
        isEncrypted: true,
        createdAt: new Date().toISOString(),
        reactions: {},
      };
      knownMessageIdsRef.current.add(tempId);
      animatedIdsRef.current.add(tempId);

      setMessages((prev) => {
        const next = [...prev, optimistic];
        lastSignatureRef.current = buildMessagesSignature(next);
        return next;
      });
      scrollToLatest();

      mutationEpochRef.current += 1;
      isSendingRef.current = true;
      setIsSending(true);
      try {
        const res = await sendChatMessage({
          friendId: friend.userId,
          recipientPublicKey: friend.e2eePublicKey,
          type: customType,
          text: text || t('voiceMsgLabel'),
          payload,
          silent: customType === 'system',
        });
        mutationEpochRef.current += 1;
        if (res.ok && res.message) {
          knownMessageIdsRef.current.add(res.message.id);
          if (animatedIdsRef.current.has(tempId)) {
            animatedIdsRef.current.add(res.message.id);
          }
          // Preserve the optimistic key so React keeps the mounted animated row without a flicker
          stableKeyByIdRef.current.set(res.message.id, tempId);
          setMessages((prev) => {
            const next = prev.map((m) => (m.id === tempId ? res.message! : m));
            lastSignatureRef.current = buildMessagesSignature(next);
            return next;
          });
          onMessagesChanged?.();
        } else {
          setMessages((prev) => {
            const next = prev.filter((m) => m.id !== tempId);
            lastSignatureRef.current = buildMessagesSignature(next);
            return next;
          });
          if (customType === 'text' && !customText) {
            setInputText(text);
          }
          if (customType !== 'system') {
            Alert.alert(t('errorTitle'), res.error || t('socialRequestFailedError'));
          }
        }
      } finally {
        isSendingRef.current = false;
        setIsSending(false);
      }
    },
    [friend, inputText, isSending, myUserId, onMessagesChanged, scrollToLatest, t, triggerSendButtonPulse]
  );

  const handleStartEdit = useCallback(
    (msg: ChatMessage) => {
      if (msg.senderId !== myUserId || msg.type !== 'text' || msg.decryptFailed || msg.id.startsWith('local_')) {
        return;
      }
      triggerSelectionHaptic();
      setReactionTarget(null);
      setShowAttachMenu(false);
      setEditingMsg(msg);
      setInputText(msg.text);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 90);
    },
    [myUserId]
  );

  const handleCancelEdit = useCallback(() => {
    setEditingMsg(null);
    setInputText('');
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!friend || !editingMsg || isSending) return;
    const nextText = inputText.trim();
    if (!nextText) return;
    if (nextText === editingMsg.text.trim()) {
      setEditingMsg(null);
      setInputText('');
      return;
    }
    if (!friend.e2eePublicKey) {
      Alert.alert(t('e2eeBadgeLabel'), t('e2eeMissingRecipientKey'));
      return;
    }

    const target = editingMsg;
    const optimisticEditedAt = new Date().toISOString();
    triggerSelectionHaptic();
    triggerSendButtonPulse();
    setEditingMsg(null);
    setInputText('');

    setMessages((prev) => {
      const next = prev.map((m) =>
        m.id === target.id ? { ...m, text: nextText, editedAt: optimisticEditedAt } : m
      );
      lastSignatureRef.current = buildMessagesSignature(next);
      return next;
    });

    mutationEpochRef.current += 1;
    isSendingRef.current = true;
    setIsSending(true);
    try {
      const res = await editChatMessage({
        friendId: friend.userId,
        messageId: target.id,
        recipientPublicKey: friend.e2eePublicKey,
        text: nextText,
      });
      mutationEpochRef.current += 1;
      if (res.ok && res.message) {
        setMessages((prev) => {
          const next = prev.map((m) => (m.id === target.id ? res.message! : m));
          lastSignatureRef.current = buildMessagesSignature(next);
          return next;
        });
        onMessagesChanged?.();
      } else {
        setMessages((prev) => {
          const next = prev.map((m) => (m.id === target.id ? target : m));
          lastSignatureRef.current = buildMessagesSignature(next);
          return next;
        });
        Alert.alert(t('errorTitle'), res.error || t('socialRequestFailedError'));
      }
    } finally {
      isSendingRef.current = false;
      setIsSending(false);
    }
  }, [editingMsg, friend, inputText, isSending, onMessagesChanged, t, triggerSendButtonPulse]);

  const showQuickHoldHint = useCallback(() => {
    setHoldHintVisible(true);
    if (holdHintTimerRef.current) clearTimeout(holdHintTimerRef.current);
    holdHintTimerRef.current = setTimeout(() => {
      setHoldHintVisible(false);
    }, 2100);
  }, []);

  const handleCancelRecording = useCallback(async () => {
    isRecordingActiveRef.current = false;
    holdActiveRef.current = false;
    setIsRecordingMode(false);
    try {
      await recorder.stop();
    } catch {
      // Already stopped
    }
    try {
      await setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: false,
      });
    } catch {
      // Ignore web fallback
    }
  }, [recorder]);

  const handleSendVoiceNote = useCallback(async () => {
    if (!friend || isSendingVoice) return;
    if (!friend.e2eePublicKey) {
      await handleCancelRecording();
      Alert.alert(t('e2eeBadgeLabel'), t('e2eeMissingRecipientKey'));
      return;
    }

    setIsSendingVoice(true);
    isRecordingActiveRef.current = false;
    holdActiveRef.current = false;

    const statusBeforeStop = (() => {
      try {
        return recorder.getStatus();
      } catch {
        return null;
      }
    })();

    const finalDuration = Math.max(
      1,
      Math.round(((statusBeforeStop?.durationMillis || recordingSec * 1000)) / 1000)
    );
    const collectedWave = downsampleWaveform(recordedLevelsRef.current);

    try {
      await recorder.stop();
      // Switch audio session back to Playback so voice note plays via bottom speaker
      await setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: false,
      }).catch(() => {});

      const recordedUri = recorder.uri;
      setIsRecordingMode(false);

      if (!recordedUri) {
        return;
      }

      let audioBase64 = '';
      if (Platform.OS === 'web') {
        const resp = await fetch(recordedUri);
        const buf = await resp.arrayBuffer();
        audioBase64 = bytesToBase64(new Uint8Array(buf));
      } else {
        audioBase64 = await new File(recordedUri).base64();
      }

      const audioMime = Platform.OS === 'web' ? 'audio/webm' : 'audio/mp4';
      await handleSend('voice', t('voiceMsgLabel'), {
        audioBase64,
        audioMime,
        durationSec: finalDuration,
        waveform: collectedWave,
      });
    } catch (e: any) {
      setIsRecordingMode(false);
      Alert.alert(t('errorTitle'), e?.message || t('socialRequestFailedError'));
    } finally {
      setIsSendingVoice(false);
    }
  }, [friend, handleCancelRecording, handleSend, isSendingVoice, recorder, recordingSec, t]);

  const handleMicPressIn = async () => {
    if (!friend || isSending || isSendingVoice) return;
    if (!friend.e2eePublicKey) {
      Alert.alert(t('e2eeBadgeLabel'), t('e2eeMissingRecipientKey'));
      return;
    }

    setShowAttachMenu(false);
    holdActiveRef.current = true;
    holdStartTsRef.current = Date.now();
    triggerSelectionHaptic();

    if (!hasMicPermRef.current) {
      const perm = await AudioModule.requestRecordingPermissionsAsync();
      hasMicPermRef.current = Boolean(perm.granted);
      if (!perm.granted) {
        holdActiveRef.current = false;
        Alert.alert(t('errorTitle'), t('voiceMicDeniedBody'));
        return;
      }
      // After native permission modal dialog, user finger lifted; wait for next hold
      if (!holdActiveRef.current) {
        showQuickHoldHint();
        return;
      }
    }

    try {
      await setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: true,
      });
      await recorder.prepareToRecordAsync(VOICE_RECORDING_OPTIONS);
      if (!holdActiveRef.current) {
        await setAudioModeAsync({
          playsInSilentMode: true,
          allowsRecording: false,
        }).catch(() => {});
        return;
      }

      recordedLevelsRef.current = [];
      setLiveWaveSamples(new Array(LIVE_BAR_COUNT).fill(0.18));
      setRecordingSec(0);
      recorder.record();
      isRecordingActiveRef.current = true;
      setIsRecordingMode(true);
    } catch (e: any) {
      holdActiveRef.current = false;
      isRecordingActiveRef.current = false;
      setIsRecordingMode(false);
      Alert.alert(t('errorTitle'), e?.message || t('voiceMicDeniedBody'));
    }
  };

  const handleMicPressOut = () => {
    const heldMs = Date.now() - holdStartTsRef.current;
    holdActiveRef.current = false;

    if (!isRecordingActiveRef.current) {
      if (heldMs < 380) {
        showQuickHoldHint();
      }
      return;
    }

    if (heldMs < 420) {
      void handleCancelRecording();
      showQuickHoldHint();
      return;
    }

    void handleSendVoiceNote();
  };

  useEffect(() => {
    if (isRecordingMode && recordingSec >= MAX_VOICE_SECONDS && !isSendingVoice) {
      void handleSendVoiceNote();
    }
  }, [isRecordingMode, recordingSec, isSendingVoice, handleSendVoiceNote]);

  useEffect(() => {
    if (!visible && isRecordingMode) {
      void handleCancelRecording();
    }
  }, [visible, isRecordingMode, handleCancelRecording]);

  const handleQuickShareWorkout = () => {
    if (!myProfile) return;
    const msg = `${myProfile.displayName} · ${t('workoutsCountLabel', {
      count: myProfile.totalWorkouts,
    })} (${myProfile.totalSets} ${t('friendsSetsCountShort')})`;
    void handleSend('workout_share', msg, {
      title: t('friendsChatSharedWorkout'),
      subtitle: `${t('friendsStreakLabel')}: ${myProfile.streak} ${t('friendsDaysShort')}`,
      rank: myProfile.overallRank,
      sets: myProfile.totalSets,
      streak: myProfile.streak,
    });
  };

  const handleQuickShareRank = () => {
    if (!myProfile) return;
    const msg = `${t('friendsChatSharedRank')}: ${myProfile.overallRank} (${myProfile.overallProgressPct}%)`;
    void handleSend('rank_card', msg, {
      title: `${t('friendsRankByTier')} ${myProfile.overallRank}`,
      subtitle: `${t('friendsBalanceLabel')} ${myProfile.balanceScorePct}% · ${t(
        'workoutsCountLabel',
        { count: myProfile.totalWorkouts }
      )}`,
      rank: myProfile.overallRank,
    });
  };

  const handleReact = useCallback(
    async (messageId: string, emoji: string) => {
      if (!friend || messageId.startsWith('local_')) return;
      mutationEpochRef.current += 1;
      triggerSelectionHaptic();
      setReactionTarget(null);

      setMessages((prev) => {
        const next = prev.map((m) => {
          if (m.id !== messageId) return m;
          const nextReactions: Record<string, string[]> = { ...(m.reactions || {}) };
          const arr = Array.isArray(nextReactions[emoji]) ? [...nextReactions[emoji]] : [];
          const idx = arr.indexOf(myUserId);
          if (idx >= 0) {
            arr.splice(idx, 1);
          } else {
            arr.push(myUserId);
          }
          if (arr.length === 0) delete nextReactions[emoji];
          else nextReactions[emoji] = arr;
          return { ...m, reactions: nextReactions };
        });
        lastSignatureRef.current = buildMessagesSignature(next);
        return next;
      });

      const updated = await reactToChatMessage(friend.userId, messageId, emoji);
      mutationEpochRef.current += 1;
      if (updated) {
        setMessages((prev) => {
          const next = prev.map((m) => (m.id === messageId ? updated : m));
          lastSignatureRef.current = buildMessagesSignature(next);
          return next;
        });
      }
    },
    [friend, myUserId]
  );

  const activeChatTheme = useMemo(
    () => CHAT_THEMES.find((ct) => ct.id === appearance.themeId) || CHAT_THEMES[0],
    [appearance.themeId]
  );

  const describeAppearanceStyle = useCallback(
    (app: ChatAppearance): string => {
      const themeObj = CHAT_THEMES.find((ct) => ct.id === app.themeId);
      const wpObj = CHAT_WALLPAPERS.find((w) => w.id === app.wallpaperId);
      const parts: string[] = [];
      if (themeObj) parts.push(themeObj.label);
      if (app.wallpaperId === 'custom') {
        parts.push(t('chatCustomWallpaperName'));
      } else if (wpObj && wpObj.id !== 'none') {
        parts.push(wpObj.label);
      }
      return parts.join(' · ') || 'Mono';
    },
    [t]
  );

  const flushThemeAnnouncement = useCallback(() => {
    if (themeNotifyTimerRef.current) {
      clearTimeout(themeNotifyTimerRef.current);
      themeNotifyTimerRef.current = null;
    }
    const next = pendingThemeAnnounceRef.current;
    pendingThemeAnnounceRef.current = null;
    if (!next || !friend?.userId) return;

    const sig = `${next.themeId}|${next.wallpaperId}|${next.customUri ? '1' : '0'}`;
    if (sig === lastAnnouncedAppearanceRef.current) return;
    lastAnnouncedAppearanceRef.current = sig;

    const actorName =
      myProfile?.displayName ||
      (myProfile?.nickname ? `@${myProfile.nickname}` : 'Athlete');
    const styleName = describeAppearanceStyle(next);
    const systemText = t('chatThemeChangedSystem', {
      name: actorName,
      style: styleName,
    });

    void handleSend('system', systemText, {
      systemAction: 'theme_change',
      actorName,
      themeId: next.themeId,
      wallpaperId: next.wallpaperId,
    });
  }, [describeAppearanceStyle, friend?.userId, handleSend, myProfile, t]);

  const persistAppearance = useCallback(
    (next: ChatAppearance) => {
      setAppearance(next);
      if (friend?.userId) {
        AsyncStorage.setItem(`${CHAT_APPEARANCE_KEY_PREFIX}${friend.userId}`, JSON.stringify(next)).catch(
          () => {}
        );
        void saveSharedChatTheme(friend.userId, next);
        pendingThemeAnnounceRef.current = next;
        if (themeNotifyTimerRef.current) {
          clearTimeout(themeNotifyTimerRef.current);
        }
        themeNotifyTimerRef.current = setTimeout(() => {
          flushThemeAnnouncement();
        }, 950);
      }
    },
    [flushThemeAnnouncement, friend?.userId]
  );

  const handlePickCustomWallpaper = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) return;
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.9,
      });
      if (!res.canceled && res.assets && res.assets[0]?.uri) {
        const asset = res.assets[0];
        // Scale down any 4K wallpaper cleanly so both users can share it smoothly via DB
        const ctx = ImageManipulator.manipulate(asset.uri);
        if ((asset.width || 0) > 900) {
          ctx.resize({ width: 900 });
        }
        const rendered = await ctx.renderAsync();
        const saved = await rendered.saveAsync({
          format: SaveFormat.JPEG,
          compress: 0.56,
          base64: true,
        });
        const dataUri = saved.base64
          ? `data:image/jpeg;base64,${saved.base64}`
          : saved.uri;
        triggerSelectionHaptic();
        persistAppearance({
          ...appearance,
          wallpaperId: 'custom',
          customUri: dataUri,
        });
      }
    } catch {}
  };

  const handleSendGalleryPhoto = async () => {
    if (!friend || isSending) return;
    if (!friend.e2eePublicKey) {
      Alert.alert(t('e2eeBadgeLabel'), t('e2eeMissingRecipientKey'));
      return;
    }
    setShowAttachMenu(false);
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) return;
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.9,
      });
      if (res.canceled || !res.assets || !res.assets[0]?.uri) return;
      const asset = res.assets[0];

      // Always resize 4K / oversized photos down to max 1080px width & JPEG 0.62
      const ctx = ImageManipulator.manipulate(asset.uri);
      const maxDim = 1080;
      if ((asset.width || 0) >= (asset.height || 0) && (asset.width || 0) > maxDim) {
        ctx.resize({ width: maxDim });
      } else if ((asset.height || 0) > maxDim) {
        ctx.resize({ height: maxDim });
      }
      const rendered = await ctx.renderAsync();
      const saved = await rendered.saveAsync({
        format: SaveFormat.JPEG,
        compress: 0.62,
        base64: true,
      });
      if (!saved.base64) return;

      await handleSend('image', t('chatPhotoLabel'), {
        imageBase64: saved.base64,
        imageMime: 'image/jpeg',
        imageWidth: saved.width,
        imageHeight: saved.height,
      });
    } catch (e: any) {
      Alert.alert(t('errorTitle'), e?.message || t('socialRequestFailedError'));
    }
  };

  const handleDeleteMessage = async (msg: ChatMessage) => {
    if (!friend || msg.id.startsWith('local_') || msg.senderId !== myUserId) return;
    mutationEpochRef.current += 1;
    triggerNotificationHaptic('warning');
    setReactionTarget(null);
    if (editingMsg?.id === msg.id) {
      setEditingMsg(null);
      setInputText('');
    }
    setMessages((prev) => {
      const next = prev.filter((m) => m.id !== msg.id);
      lastSignatureRef.current = buildMessagesSignature(next);
      return next;
    });
    const ok = await deleteChatMessage(friend.userId, msg.id);
    if (ok) {
      onMessagesChanged?.();
    } else {
      void loadMessages(true);
    }
  };

  const openReactionMenu = useCallback(
    (item: ChatMessage) => {
      if (item.id.startsWith('local_') || item.type === 'system') return;
      triggerNotificationHaptic('success');
      const node = bubbleViewRefs.current[item.id];
      const isMineMsg = item.senderId === myUserId;
      if (node && typeof node.measureInWindow === 'function') {
        node.measureInWindow((x: number, y: number, width: number, height: number) => {
          if (width > 0 && height > 0) {
            setReactionTarget({ message: item, rect: { x, y, width, height } });
          } else {
            setReactionTarget({
              message: item,
              rect: {
                x: isMineMsg ? Math.max(40, screenWidth - 220) : 44,
                y: Math.round(screenHeight * 0.42),
                width: 170,
                height: 46,
              },
            });
          }
        });
      } else {
        setReactionTarget({
          message: item,
          rect: {
            x: isMineMsg ? Math.max(40, screenWidth - 220) : 44,
            y: Math.round(screenHeight * 0.42),
            width: 170,
            height: 46,
          },
        });
      }
    },
    [myUserId, screenHeight, screenWidth]
  );

  const handleBubblePress = (item: ChatMessage) => {
    if (showAttachMenu) setShowAttachMenu(false);
    if (item.id.startsWith('local_') || item.type === 'system') return;
    const now = Date.now();
    if (
      lastBubbleTapRef.current &&
      lastBubbleTapRef.current.id === item.id &&
      now - lastBubbleTapRef.current.time < 280
    ) {
      lastBubbleTapRef.current = null;
      void handleReact(item.id, '🔥');
    } else {
      lastBubbleTapRef.current = { id: item.id, time: now };
    }
  };

  const lastOutgoingIdx = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].senderId === myUserId && messages[i].type !== 'system') return i;
    }
    return -1;
  }, [messages, myUserId]);

  const renderMessage = ({ item, index }: { item: ChatMessage; index: number }) => {
    const isMine = item.senderId === myUserId;
    const prev = index > 0 ? messages[index - 1] : null;
    const next = index < messages.length - 1 ? messages[index + 1] : null;

    const prevTs = prev ? new Date(prev.createdAt).getTime() : 0;
    const curTs = new Date(item.createdAt).getTime();
    const showTimeGapHeader =
      index === 0 ||
      (!Number.isNaN(curTs) && !Number.isNaN(prevTs) && curTs - prevTs > 25 * 60 * 1000);

    const samePrev = !showTimeGapHeader && prev?.senderId === item.senderId;
    const nextTs = next ? new Date(next.createdAt).getTime() : 0;
    const nextHasGap =
      next && !Number.isNaN(nextTs) && !Number.isNaN(curTs) && nextTs - curTs > 25 * 60 * 1000;
    const sameNext = !nextHasGap && next?.senderId === item.senderId;

    const showFriendAvatar = !isMine && !sameNext;
    const isLatestOutgoing = isMine && index === lastOutgoingIdx;
    const isPendingLocal = item.id.startsWith('local_');
    const shouldAnimateEntry = animatedIdsRef.current.has(item.id);

    const reactionsList = Object.entries(item.reactions || {}).filter(
      ([, users]) => Array.isArray(users) && users.length > 0
    );

    const bubbleRadii = isMine
      ? {
          borderTopLeftRadius: 21,
          borderBottomLeftRadius: 21,
          borderTopRightRadius: samePrev ? 6 : 21,
          borderBottomRightRadius: sameNext ? 6 : 21,
        }
      : {
          borderTopRightRadius: 21,
          borderBottomRightRadius: 21,
          borderTopLeftRadius: samePrev ? 6 : 21,
          borderBottomLeftRadius: sameNext ? 6 : 21,
        };

    // Chat theme-aware editorial bubbles
    const outgoingBg = theme.isDark
      ? activeChatTheme.outgoingDark
      : activeChatTheme.outgoingLight;
    const incomingBg = theme.isDark ? '#141418' : '#FFFFFF';
    const incomingBorder = theme.isDark ? 'rgba(255,255,255,0.11)' : 'rgba(15,23,42,0.09)';

    const bubbleBg = item.decryptFailed
      ? theme.isDark
        ? 'rgba(239,68,68,0.14)'
        : 'rgba(239,68,68,0.09)'
      : isMine
      ? outgoingBg
      : incomingBg;
    const bubbleBorderColor = item.decryptFailed
      ? 'rgba(239,68,68,0.38)'
      : isMine
      ? theme.isDark
        ? 'rgba(255,255,255,0.22)'
        : 'rgba(0,0,0,0.08)'
      : incomingBorder;
    const bubbleTextColor = item.decryptFailed
      ? theme.textMuted
      : isMine
      ? theme.isDark
        ? activeChatTheme.outgoingTextDark
        : activeChatTheme.outgoingTextLight
      : theme.text;
    const subTextColor = isMine
      ? bubbleTextColor === '#09090B'
        ? 'rgba(9,9,11,0.7)'
        : 'rgba(255,255,255,0.78)'
      : theme.textSecondary;

    if (item.type === 'system') {
      const styleLabel =
        item.payload?.themeId || item.payload?.wallpaperId
          ? describeAppearanceStyle({
              themeId: (item.payload.themeId as ChatThemeId) || 'monochrome',
              wallpaperId: (item.payload.wallpaperId as ChatWallpaperId) || 'none',
            })
          : null;
      const localizedSystemText =
        item.payload?.systemAction === 'theme_change' && item.payload?.actorName && styleLabel
          ? t('chatThemeChangedSystem', {
              name: item.payload.actorName,
              style: styleLabel,
            })
          : item.text;

      return (
        <AnimatedMessageRow animateOnMount={shouldAnimateEntry} isMine={false}>
          {showTimeGapHeader && (
            <View style={styles.timeSeparatorWrap}>
              <View
                style={[
                  styles.timeSeparatorPill,
                  {
                    backgroundColor: theme.isDark
                      ? 'rgba(255,255,255,0.07)'
                      : 'rgba(15,23,42,0.05)',
                  },
                ]}
              >
                <Text style={[styles.timeSeparatorText, { color: theme.textMuted }]}>
                  {formatTimeSeparator(item.createdAt, localeCode)}
                </Text>
              </View>
            </View>
          )}
          <View style={styles.systemEventWrap}>
            <View
              style={[
                styles.systemEventPill,
                {
                  backgroundColor: theme.isDark
                    ? 'rgba(24,24,30,0.78)'
                    : 'rgba(255,255,255,0.82)',
                  borderColor: theme.hairline,
                },
              ]}
            >
              <Ionicons
                name="color-palette-outline"
                size={12.5}
                color={activeChatTheme.accent}
              />
              <Text style={[styles.systemEventText, { color: theme.textSecondary }]}>
                {localizedSystemText}
              </Text>
            </View>
          </View>
        </AnimatedMessageRow>
      );
    }

    const isImageBubble =
      item.type === 'image' && Boolean(item.payload?.imageBase64) && !item.decryptFailed;

    return (
      <AnimatedMessageRow animateOnMount={shouldAnimateEntry} isMine={isMine}>
        {showTimeGapHeader && (
          <View style={styles.timeSeparatorWrap}>
            <View
              style={[
                styles.timeSeparatorPill,
                {
                  backgroundColor: theme.isDark
                    ? 'rgba(255,255,255,0.07)'
                    : 'rgba(15,23,42,0.05)',
                },
              ]}
            >
              <Text style={[styles.timeSeparatorText, { color: theme.textMuted }]}>
                {formatTimeSeparator(item.createdAt, localeCode)}
              </Text>
            </View>
          </View>
        )}

        <View
          style={[
            styles.msgRow,
            isMine ? styles.msgRowMine : styles.msgRowTheirs,
            { marginBottom: reactionsList.length > 0 ? 15 : sameNext ? 3 : 10 },
          ]}
        >
          {!isMine && (
            <View style={styles.incomingAvatarCol}>
              {showFriendAvatar && friend ? (
                <UserAvatarBadge
                  avatarUrl={friend.avatarUrl}
                  displayName={friend.displayName}
                  avatarColor={friend.avatarColor}
                  rank={friend.overallRank || 'F'}
                  size={28}
                />
              ) : (
                <View style={styles.incomingAvatarSpacer} />
              )}
            </View>
          )}

          <View
            style={[
              styles.msgCol,
              isMine ? styles.msgColMine : styles.msgColTheirs,
            ]}
          >
            <View
              ref={(node) => {
                bubbleViewRefs.current[item.id] = node;
              }}
              collapsable={false}
            >
              <TouchableOpacity
                activeOpacity={0.86}
                delayLongPress={230}
                onLongPress={() => openReactionMenu(item)}
                onPress={() => handleBubblePress(item)}
                style={[
                  styles.bubble,
                  bubbleRadii,
                  isImageBubble
                    ? {
                        backgroundColor: 'transparent',
                        borderColor: 'transparent',
                        borderWidth: 0,
                        paddingHorizontal: 0,
                        paddingVertical: 0,
                        opacity: isPendingLocal ? 0.88 : 1,
                      }
                    : {
                        backgroundColor: bubbleBg,
                        borderColor: bubbleBorderColor,
                        opacity: isPendingLocal ? 0.88 : 1,
                      },
                  !isMine && !isImageBubble && styles.incomingShadow,
                ]}
              >
                {item.decryptFailed ? (
                  <View style={styles.decryptedErrorRow}>
                    <Ionicons name="lock-closed-outline" size={14} color="#F59E0B" />
                    <Text style={[styles.msgText, { color: bubbleTextColor, fontStyle: 'italic' }]}>
                      {t('e2eeKeyChangedPlaceholder')}
                    </Text>
                  </View>
                ) : item.type === 'image' && item.payload?.imageBase64 ? (
                  <TouchableOpacity
                    activeOpacity={0.9}
                    delayLongPress={230}
                    onPress={() =>
                      setPreviewPhotoUri(
                        `data:${item.payload?.imageMime || 'image/jpeg'};base64,${item.payload?.imageBase64}`
                      )
                    }
                    onLongPress={() => openReactionMenu(item)}
                  >
                    <Image
                      source={{
                        uri: `data:${item.payload.imageMime || 'image/jpeg'};base64,${item.payload.imageBase64}`,
                      }}
                      style={[
                        {
                          width: 224,
                          height:
                            item.payload.imageWidth && item.payload.imageHeight
                              ? Math.max(
                                  128,
                                  Math.min(300, Math.round(224 * (item.payload.imageHeight / item.payload.imageWidth)))
                                )
                              : 224,
                        },
                        bubbleRadii,
                      ]}
                      resizeMode="cover"
                    />
                  </TouchableOpacity>
                ) : item.type === 'voice' ? (
                  <VoiceNoteBubble
                    messageId={item.id}
                    audioBase64={item.payload?.audioBase64}
                    audioMime={item.payload?.audioMime}
                    durationSec={item.payload?.durationSec}
                    waveform={item.payload?.waveform}
                    isMine={isMine}
                  />
                ) : item.type === 'workout_share' || item.type === 'rank_card' ? (
                  <View style={styles.richCard}>
                    <View style={styles.richHeader}>
                      <View
                        style={[
                          styles.richBadgeIcon,
                          {
                            backgroundColor: isMine
                              ? theme.isDark
                                ? 'rgba(0,0,0,0.1)'
                                : 'rgba(255,255,255,0.16)'
                              : theme.bgSecondary,
                          },
                        ]}
                      >
                        <Ionicons
                          name={item.type === 'workout_share' ? 'barbell' : 'ribbon'}
                          size={15}
                          color={bubbleTextColor}
                        />
                      </View>
                      <Text style={[styles.richTitle, { color: bubbleTextColor }]}>
                        {item.payload?.title || item.text}
                      </Text>
                    </View>
                    {item.payload?.subtitle ? (
                      <Text style={[styles.richSub, { color: subTextColor }]}>
                        {item.payload.subtitle}
                      </Text>
                    ) : null}
                    {item.text && item.payload?.title !== item.text ? (
                      <Text style={[styles.richBody, { color: bubbleTextColor }]}>
                        {item.text}
                      </Text>
                    ) : null}
                  </View>
                ) : item.type === 'cheer' ? (
                  <View style={styles.cheerBubbleRow}>
                    <Text style={styles.cheerEmoji}>{item.payload?.emoji || '🔥'}</Text>
                    <Text style={[styles.msgText, { color: bubbleTextColor, fontWeight: '700' }]}>
                      {item.text}
                    </Text>
                  </View>
                ) : (
                  <View>
                    <Text style={[styles.msgText, { color: bubbleTextColor }]}>{item.text}</Text>
                    {Boolean(item.editedAt) && (
                      <Text
                        style={[
                          styles.editedBadgeText,
                          {
                            color: subTextColor,
                            alignSelf: isMine ? 'flex-end' : 'flex-start',
                          },
                        ]}
                      >
                        {t('chatEditedBadge')}
                      </Text>
                    )}
                  </View>
                )}

                {reactionsList.length > 0 && (
                  <View
                    style={[
                      styles.floatingReactionBadge,
                      isMine ? styles.floatingBadgeRight : styles.floatingBadgeLeft,
                      {
                        backgroundColor: theme.isDark ? '#202026' : '#FFFFFF',
                        borderColor: theme.border,
                      },
                    ]}
                  >
                    {reactionsList.map(([em, users]) => (
                      <TouchableOpacity
                        key={em}
                        onPress={() => handleReact(item.id, em)}
                        style={styles.reactionPill}
                        activeOpacity={0.75}
                      >
                        <Text style={styles.reactionPillText}>
                          {em}
                          {users.length > 1 ? ` ${users.length}` : ''}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </TouchableOpacity>
            </View>

            {isLatestOutgoing && (
              <View style={styles.deliveryStatusRow}>
                {isPendingLocal ? (
                  <>
                    <ActivityIndicator size={9} color={theme.textMuted} />
                    <Text style={[styles.timeText, { color: theme.textMuted }]}>
                      {t('voiceSendingBadge')}
                    </Text>
                  </>
                ) : (() => {
                  const seenMs = friendLastReadAt ? new Date(friendLastReadAt).getTime() : 0;
                  const msgMs = new Date(item.createdAt).getTime();
                  const isSeen = seenMs > 0 && !Number.isNaN(msgMs) && seenMs >= msgMs;
                  return isSeen ? (
                    <>
                      <Ionicons
                        name="checkmark-done"
                        size={13}
                        color={theme.isDark ? '#38BDF8' : '#0284C7'}
                      />
                      <Text
                        style={[
                          styles.timeText,
                          { color: theme.isDark ? '#38BDF8' : '#0284C7', fontWeight: '700' },
                        ]}
                      >
                        {t('chatSeenBadge')} · {formatClockTime(item.createdAt)}
                        {item.editedAt ? ` · ${t('chatEditedBadge')}` : ''}
                      </Text>
                      {friend && (
                        <View style={{ marginLeft: 2 }}>
                          <UserAvatarBadge
                            avatarUrl={friend.avatarUrl}
                            displayName={friend.displayName}
                            avatarColor={friend.avatarColor}
                            rank={friend.overallRank || 'F'}
                            size={14}
                          />
                        </View>
                      )}
                    </>
                  ) : (
                    <>
                      <Ionicons name="checkmark" size={12} color={theme.textSecondary} />
                      <Text style={[styles.timeText, { color: theme.textMuted }]}>
                        {t('voiceSentBadge')} · {formatClockTime(item.createdAt)}
                        {item.editedAt ? ` · ${t('chatEditedBadge')}` : ''}
                      </Text>
                    </>
                  );
                })()}
              </View>
            )}
          </View>
        </View>
      </AnimatedMessageRow>
    );
  };

  if (!friend) return null;

  const canTypeSend = inputText.trim().length > 0 && !isSending;

  const hasWallpaperSurface =
    appearance.wallpaperId !== 'none' || appearance.themeId !== 'monochrome';
  const chromeOverlayBg = hasWallpaperSurface
    ? theme.isDark
      ? 'rgba(8, 10, 14, 0.34)'
      : 'rgba(255, 255, 255, 0.34)'
    : theme.isDark
    ? 'rgba(10, 10, 12, 0.72)'
    : 'rgba(255, 255, 255, 0.78)';

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={[styles.screen, { backgroundColor: theme.bg }]}>
        <ChatWallpaperLayer
          appearance={appearance}
          accentColor={activeChatTheme.accent}
          isDark={theme.isDark}
        />

        {/* Full-bleed translucent header so wallpaper extends cleanly underneath */}
        <View
          style={[
            styles.header,
            {
              paddingTop: Math.max(insets.top + 8, 18),
              borderBottomColor: hasWallpaperSurface ? 'rgba(255,255,255,0.09)' : theme.hairline,
              backgroundColor: chromeOverlayBg,
            },
          ]}
        >
          <TouchableOpacity
            style={[
              styles.headerCircleBtn,
              {
                backgroundColor: theme.isDark
                  ? 'rgba(255,255,255,0.08)'
                  : 'rgba(0,0,0,0.06)',
              },
            ]}
            onPress={onClose}
            activeOpacity={0.78}
          >
            <Ionicons name="chevron-back" size={20} color={theme.text} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.headerFriendBtn}
            onPress={() => {
              triggerSelectionHaptic();
              setShowAttachMenu(false);
              setShowInChatProfile(true);
            }}
            activeOpacity={0.75}
          >
            <UserAvatarBadge
              avatarUrl={friend.avatarUrl}
              displayName={friend.displayName}
              avatarColor={friend.avatarColor}
              rank={friend.overallRank || 'F'}
              size={40}
              showRankDot
            />
            <View style={styles.headerMeta}>
              <View style={styles.headerNameRow}>
                <Text style={[styles.headerName, { color: theme.text }]} numberOfLines={1}>
                  {friend.displayName}
                </Text>
                <View
                  style={[
                    styles.e2eeHeaderPill,
                    {
                      backgroundColor: theme.isDark
                        ? 'rgba(255,255,255,0.09)'
                        : 'rgba(0,0,0,0.06)',
                    },
                  ]}
                >
                  <Ionicons name="lock-closed" size={9.5} color={theme.textSecondary} />
                  <Text style={[styles.e2eeHeaderText, { color: theme.textSecondary }]}>
                    E2EE
                  </Text>
                </View>
              </View>
              <Text style={[styles.headerSub, { color: theme.textMuted }]} numberOfLines={1}>
                @{friend.nickname} · {t('friendsRankByTier')} {friend.overallRank}
                {friend.statusNote ? ` · ${friend.statusNote}` : ''}
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.headerCircleBtn,
              {
                backgroundColor: theme.isDark
                  ? 'rgba(255,255,255,0.08)'
                  : 'rgba(0,0,0,0.06)',
              },
            ]}
            onPress={() => {
              triggerSelectionHaptic();
              setShowAttachMenu(false);
              setShowThemeSheet(true);
            }}
            activeOpacity={0.75}
          >
            <Ionicons
              name="color-palette-outline"
              size={18}
              color={appearance.themeId === 'monochrome' ? theme.text : activeChatTheme.accent}
            />
          </TouchableOpacity>
        </View>

        {/* Message List */}
        <View style={styles.messagesWrap}>
          {isLoading ? (
            <View style={styles.centerEmpty}>
              <ActivityIndicator color={theme.text} size="large" />
            </View>
          ) : messages.length === 0 ? (
            <View style={styles.centerEmpty}>
              <UserAvatarBadge
                avatarUrl={friend.avatarUrl}
                displayName={friend.displayName}
                avatarColor={friend.avatarColor}
                rank={friend.overallRank || 'F'}
                size={68}
                showRankDot
              />
              <Text style={[styles.emptyTitle, { color: theme.text }]}>
                {friend.displayName}
              </Text>
              <Text style={[styles.emptyText, { color: theme.textMuted }]}>
                {t('friendsChatEmpty')}
              </Text>
            </View>
          ) : (
            <FlatList
              ref={listRef}
              data={messages}
              keyExtractor={(item) => stableKeyByIdRef.current.get(item.id) || item.id}
              renderItem={renderMessage}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              keyboardDismissMode="interactive"
              keyboardShouldPersistTaps="handled"
            />
          )}
        </View>

        {/* Bottom Translucent Composer Dock + Floating "+" Attachments */}
        <View
          style={[
            styles.composerOuter,
            {
              borderTopColor: hasWallpaperSurface ? 'rgba(255,255,255,0.09)' : theme.hairline,
              backgroundColor: chromeOverlayBg,
              paddingBottom:
                keyboardHeight > 0
                  ? keyboardHeight + 10
                  : Math.max(insets.bottom + 10, 18),
            },
          ]}
        >
          {/* Active Editing Banner */}
          {editingMsg && !isRecordingMode && (
            <View
              style={[
                styles.editingBanner,
                {
                  backgroundColor: theme.isDark ? '#1A1A20' : '#F4F4F5',
                  borderColor: theme.border,
                },
              ]}
            >
              <View
                style={[
                  styles.editingAccentBar,
                  {
                    backgroundColor:
                      appearance.themeId === 'monochrome' ? theme.primary : activeChatTheme.accent,
                  },
                ]}
              />
              <Ionicons
                name="pencil"
                size={14}
                color={appearance.themeId === 'monochrome' ? theme.text : activeChatTheme.accent}
              />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  style={[
                    styles.editingBannerTitle,
                    {
                      color:
                        appearance.themeId === 'monochrome' ? theme.text : activeChatTheme.accent,
                    },
                  ]}
                >
                  {t('chatEditingBanner')}
                </Text>
                <Text style={[styles.editingBannerPreview, { color: theme.textSecondary }]} numberOfLines={1}>
                  {editingMsg.text}
                </Text>
              </View>
              <TouchableOpacity
                onPress={handleCancelEdit}
                style={[
                  styles.editingCancelBtn,
                  {
                    backgroundColor: theme.isDark
                      ? 'rgba(255,255,255,0.1)'
                      : 'rgba(0,0,0,0.07)',
                  },
                ]}
                activeOpacity={0.75}
              >
                <Ionicons name="close" size={14} color={theme.text} />
              </TouchableOpacity>
            </View>
          )}

          {/* Hold hint banner */}
          {holdHintVisible && !isRecordingMode && (
            <View
              style={[
                styles.holdHintPill,
                {
                  backgroundColor: theme.isDark ? '#1F1F24' : '#18181B',
                },
              ]}
            >
              <Ionicons name="mic" size={12} color="#FFFFFF" />
              <Text style={styles.holdHintText}>{t('voiceHoldHint')}</Text>
            </View>
          )}

          {/* Expanding "+" Attachments Tray (Workout Share + Rank Card ONLY) */}
          {showAttachMenu && !isRecordingMode && (
            <Animated.View
              style={[
                styles.attachTray,
                {
                  opacity: attachAnim,
                  transform: [
                    {
                      translateY: attachAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [12, 0],
                      }),
                    },
                  ],
                },
              ]}
            >
              <TouchableOpacity
                style={[
                  styles.attachChip,
                  {
                    backgroundColor: theme.isDark ? '#1C1C21' : '#F4F4F5',
                    borderColor: theme.border,
                  },
                ]}
                onPress={handleSendGalleryPhoto}
                activeOpacity={0.82}
              >
                <View style={[styles.attachIconCircle, { backgroundColor: theme.primary }]}>
                  <Ionicons name="image-outline" size={14} color={theme.primaryText} />
                </View>
                <Text style={[styles.attachChipText, { color: theme.text }]}>
                  {t('chatSharePhoto')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.attachChip,
                  {
                    backgroundColor: theme.isDark ? '#1C1C21' : '#F4F4F5',
                    borderColor: theme.border,
                  },
                ]}
                onPress={handleQuickShareWorkout}
                activeOpacity={0.82}
              >
                <View style={[styles.attachIconCircle, { backgroundColor: theme.primary }]}>
                  <Ionicons name="barbell-outline" size={14} color={theme.primaryText} />
                </View>
                <Text style={[styles.attachChipText, { color: theme.text }]}>
                  {t('friendsChatShareWorkout')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.attachChip,
                  {
                    backgroundColor: theme.isDark ? '#1C1C21' : '#F4F4F5',
                    borderColor: theme.border,
                  },
                ]}
                onPress={handleQuickShareRank}
                activeOpacity={0.82}
              >
                <View style={[styles.attachIconCircle, { backgroundColor: theme.primary }]}>
                  <Ionicons name="ribbon-outline" size={14} color={theme.primaryText} />
                </View>
                <Text style={[styles.attachChipText, { color: theme.text }]}>
                  {t('friendsChatShareRank')}
                </Text>
              </TouchableOpacity>
            </Animated.View>
          )}

          <View
            style={[
              styles.composerPill,
              {
                backgroundColor: isRecordingMode
                  ? theme.isDark
                    ? '#231316'
                    : '#FFF1F2'
                  : theme.isDark
                  ? '#18181C'
                  : '#F4F4F5',
                borderColor: isRecordingMode
                  ? 'rgba(239,68,68,0.45)'
                  : theme.border,
              },
            ]}
          >
            {isRecordingMode ? (
              <View style={styles.recordingStatusRow}>
                <Animated.View
                  style={[
                    styles.recPulseRing,
                    {
                      transform: [{ scale: 0.9 + voiceIntensity * 0.45 }],
                      opacity: recPulseAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.45, 1],
                      }),
                    },
                  ]}
                >
                  <View style={styles.recDotCore} />
                </Animated.View>

                <Text style={styles.recTimerText}>{formatDurationSec(recordingSec)}</Text>

                {/* Live Left-to-Right Equalizer Bars */}
                <View style={styles.liveWaveRow}>
                  {liveWaveSamples.map((amp, idx) => (
                    <View
                      key={idx}
                      style={[
                        styles.liveWaveBar,
                        {
                          height: Math.round(5 + amp * 20),
                          opacity: Math.max(0.32, 1 - idx * 0.036),
                          backgroundColor: '#EF4444',
                        },
                      ]}
                    />
                  ))}
                </View>

                <Text style={[styles.speakingHintLabel, { color: '#EF4444' }]} numberOfLines={1}>
                  {t('voiceSpeakingNow').split('.')[0]}
                </Text>
              </View>
            ) : (
              <>
                <TouchableOpacity
                  style={[
                    styles.attachPlusBtn,
                    {
                      backgroundColor: showAttachMenu
                        ? theme.primary
                        : theme.isDark
                        ? '#27272D'
                        : '#E4E4E7',
                    },
                  ]}
                  onPress={() => {
                    triggerSelectionHaptic();
                    setShowAttachMenu((v) => !v);
                  }}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={showAttachMenu ? 'close' : 'add'}
                    size={20}
                    color={showAttachMenu ? theme.primaryText : theme.text}
                  />
                </TouchableOpacity>

                <TextInput
                  ref={inputRef}
                  style={[styles.input, { color: theme.text }]}
                  placeholder={t('friendsChatPlaceholder')}
                  placeholderTextColor={theme.textMuted}
                  value={inputText}
                  onChangeText={(txt) => {
                    setInputText(txt);
                    if (showAttachMenu && txt.length > 0) setShowAttachMenu(false);
                  }}
                  multiline
                  maxLength={800}
                  onFocus={() => {
                    setShowAttachMenu(false);
                    scrollToLatest();
                  }}
                />
              </>
            )}

            {/* Right Action Button: NEVER unmounts when switching into hold-to-record */}
            {canTypeSend && !isRecordingMode ? (
              <Animated.View style={{ transform: [{ scale: sendLaunchAnim }] }}>
                <TouchableOpacity
                  style={[
                    styles.sendBtn,
                    {
                      backgroundColor: editingMsg
                        ? appearance.themeId === 'monochrome'
                          ? theme.primary
                          : activeChatTheme.accent
                        : theme.primary,
                    },
                  ]}
                  onPress={() => (editingMsg ? handleSaveEdit() : handleSend('text'))}
                  disabled={isSending}
                  activeOpacity={0.82}
                >
                  {isSending ? (
                    <ActivityIndicator size="small" color={theme.primaryText} />
                  ) : (
                    <Ionicons
                      name={editingMsg ? 'checkmark' : 'arrow-up'}
                      size={19}
                      color={theme.primaryText}
                    />
                  )}
                </TouchableOpacity>
              </Animated.View>
            ) : (
              <Pressable
                onPressIn={handleMicPressIn}
                onPressOut={handleMicPressOut}
                disabled={isSending || isSendingVoice}
                style={({ pressed }) => [
                  styles.sendBtn,
                  {
                    backgroundColor: isRecordingMode ? '#EF4444' : theme.primary,
                    transform: [
                      {
                        scale: isRecordingMode
                          ? 1.08 + voiceIntensity * 0.14
                          : pressed
                          ? 0.94
                          : 1,
                      },
                    ],
                  },
                ]}
              >
                {isSendingVoice ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Ionicons
                    name={isRecordingMode ? 'mic' : 'mic-outline'}
                    size={19}
                    color={isRecordingMode ? '#FFFFFF' : theme.primaryText}
                  />
                )}
              </Pressable>
            )}
          </View>
        </View>

        {/* Messenger-style Anchored Reaction Bar + Contextual Actions Overlay */}
        <Modal
          visible={reactionTarget !== null}
          transparent
          animationType="fade"
          onRequestClose={() => setReactionTarget(null)}
        >
          <Pressable
            style={styles.reactionBackdrop}
            onPress={() => setReactionTarget(null)}
          >
            {reactionTarget && (() => {
              const msg = reactionTarget.message;
              const rect = reactionTarget.rect;
              const isMineMsg = msg.senderId === myUserId;
              const canEditMsg =
                isMineMsg && msg.type === 'text' && !msg.decryptFailed && !msg.id.startsWith('local_');
              const canDeleteMsg = isMineMsg && !msg.id.startsWith('local_');
              const hasActions = canEditMsg || canDeleteMsg;

              const dockWidth = Math.min(296, screenWidth - 28);
              const dockHeight = 52;
              const actionCardHeight = !hasActions ? 0 : canEditMsg && canDeleteMsg ? 98 : 50;

              const bubbleTop = Math.max(
                insets.top + dockHeight + 18,
                Math.min(rect.y, screenHeight - insets.bottom - rect.height - actionCardHeight - 26)
              );
              const dockTop = bubbleTop - dockHeight - 10;
              const dockLeft = Math.max(
                14,
                Math.min(
                  screenWidth - dockWidth - 14,
                  isMineMsg ? rect.x + rect.width - dockWidth : rect.x
                )
              );
              const actionsTop = bubbleTop + rect.height + 10;
              const menuWidth = 204;
              const menuLeft = Math.max(
                14,
                Math.min(
                  screenWidth - menuWidth - 14,
                  isMineMsg ? rect.x + rect.width - menuWidth : rect.x
                )
              );

              const focusBg = isMineMsg
                ? theme.isDark
                  ? activeChatTheme.outgoingDark
                  : activeChatTheme.outgoingLight
                : theme.isDark
                ? '#141418'
                : '#FFFFFF';
              const focusTextColor = isMineMsg
                ? theme.isDark
                  ? activeChatTheme.outgoingTextDark
                  : activeChatTheme.outgoingTextLight
                : theme.text;
              const focusSubColor = isMineMsg
                ? focusTextColor === '#09090B'
                  ? 'rgba(9,9,11,0.7)'
                  : 'rgba(255,255,255,0.78)'
                : theme.textSecondary;

              return (
                <>
                  {/* Floating Emoji Bar anchored directly ABOVE the message */}
                  <Animated.View
                    style={[
                      styles.reactionDock,
                      {
                        position: 'absolute',
                        top: dockTop,
                        left: dockLeft,
                        width: dockWidth,
                        backgroundColor: theme.isDark ? '#18181D' : '#FFFFFF',
                        borderColor: theme.border,
                        opacity: reactionDockAnim,
                        transform: [
                          {
                            scale: reactionDockAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: [0.82, 1],
                            }),
                          },
                          {
                            translateY: reactionDockAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: [8, 0],
                            }),
                          },
                        ],
                      },
                    ]}
                  >
                    {MESSENGER_REACTIONS.map((em) => {
                      const alreadyReacted = Boolean(msg.reactions?.[em]?.includes(myUserId));
                      return (
                        <TouchableOpacity
                          key={em}
                          onPress={() => handleReact(msg.id, em)}
                          style={[
                            styles.reactionDockBtn,
                            alreadyReacted && {
                              backgroundColor: theme.isDark
                                ? 'rgba(255,255,255,0.16)'
                                : 'rgba(0,0,0,0.09)',
                            },
                          ]}
                          activeOpacity={0.72}
                        >
                          <Text style={styles.reactionDockEmoji}>{em}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </Animated.View>

                  {/* Highlighted Message Clone anchored in place */}
                  <Animated.View
                    pointerEvents="none"
                    style={[
                      styles.bubble,
                      {
                        position: 'absolute',
                        top: bubbleTop,
                        left: rect.x,
                        width: rect.width,
                        borderRadius: 21,
                        backgroundColor:
                          msg.type === 'image' && msg.payload?.imageBase64
                            ? 'transparent'
                            : focusBg,
                        borderColor:
                          msg.type === 'image' && msg.payload?.imageBase64
                            ? 'transparent'
                            : theme.isDark
                            ? 'rgba(255,255,255,0.22)'
                            : 'rgba(15,23,42,0.14)',
                        borderWidth: msg.type === 'image' && msg.payload?.imageBase64 ? 0 : 1,
                        paddingHorizontal: msg.type === 'image' && msg.payload?.imageBase64 ? 0 : 14,
                        paddingVertical: msg.type === 'image' && msg.payload?.imageBase64 ? 0 : 10,
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 10 },
                        shadowOpacity: 0.28,
                        shadowRadius: 20,
                        elevation: 12,
                        transform: [
                          {
                            scale: reactionDockAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: [0.98, 1.025],
                            }),
                          },
                        ],
                      },
                    ]}
                  >
                    {msg.type === 'image' && msg.payload?.imageBase64 ? (
                      <Image
                        source={{
                          uri: `data:${msg.payload.imageMime || 'image/jpeg'};base64,${msg.payload.imageBase64}`,
                        }}
                        style={{
                          width: 224,
                          height:
                            msg.payload.imageWidth && msg.payload.imageHeight
                              ? Math.max(
                                  128,
                                  Math.min(
                                    300,
                                    Math.round(224 * (msg.payload.imageHeight / msg.payload.imageWidth))
                                  )
                                )
                              : 224,
                          borderRadius: 21,
                        }}
                        resizeMode="cover"
                      />
                    ) : msg.type === 'voice' ? (
                      <View style={styles.cheerBubbleRow}>
                        <Ionicons name="mic" size={16} color={focusTextColor} />
                        <Text style={[styles.msgText, { color: focusTextColor, fontWeight: '700' }]}>
                          {formatDurationSec(msg.payload?.durationSec || 0)}
                        </Text>
                      </View>
                    ) : msg.type === 'workout_share' || msg.type === 'rank_card' ? (
                      <View style={styles.richCard}>
                        <Text style={[styles.richTitle, { color: focusTextColor }]}>
                          {msg.payload?.title || msg.text}
                        </Text>
                        {msg.payload?.subtitle ? (
                          <Text style={[styles.richSub, { color: focusSubColor }]}>
                            {msg.payload.subtitle}
                          </Text>
                        ) : null}
                      </View>
                    ) : (
                      <View>
                        <Text style={[styles.msgText, { color: focusTextColor }]} numberOfLines={6}>
                          {msg.text}
                        </Text>
                        {Boolean(msg.editedAt) && (
                          <Text
                            style={[
                              styles.editedBadgeText,
                              {
                                color: focusSubColor,
                                alignSelf: isMineMsg ? 'flex-end' : 'flex-start',
                              },
                            ]}
                          >
                            {t('chatEditedBadge')}
                          </Text>
                        )}
                      </View>
                    )}
                  </Animated.View>

                  {/* Contextual Actions Menu anchored directly BELOW own message */}
                  {hasActions && (
                    <Animated.View
                      style={[
                        styles.contextActionsCard,
                        {
                          position: 'absolute',
                          top: actionsTop,
                          left: menuLeft,
                          width: menuWidth,
                          backgroundColor: theme.isDark ? '#18181D' : '#FFFFFF',
                          borderColor: theme.border,
                          opacity: reactionDockAnim,
                          transform: [
                            {
                              translateY: reactionDockAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [-6, 0],
                              }),
                            },
                            {
                              scale: reactionDockAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [0.92, 1],
                              }),
                            },
                          ],
                        },
                      ]}
                    >
                      {canEditMsg && (
                        <TouchableOpacity
                          style={styles.contextActionRow}
                          onPress={() => handleStartEdit(msg)}
                          activeOpacity={0.76}
                        >
                          <Text style={[styles.contextActionText, { color: theme.text }]}>
                            {t('chatEditMsgBtn')}
                          </Text>
                          <Ionicons name="pencil-outline" size={16} color={theme.text} />
                        </TouchableOpacity>
                      )}
                      {canEditMsg && canDeleteMsg && (
                        <View
                          style={[
                            styles.contextActionDivider,
                            { backgroundColor: theme.hairline },
                          ]}
                        />
                      )}
                      {canDeleteMsg && (
                        <TouchableOpacity
                          style={styles.contextActionRow}
                          onPress={() => handleDeleteMessage(msg)}
                          activeOpacity={0.76}
                        >
                          <Text style={[styles.contextActionText, { color: '#EF4444' }]}>
                            {t('chatDeleteMsgBtn')}
                          </Text>
                          <Ionicons name="trash-outline" size={16} color="#EF4444" />
                        </TouchableOpacity>
                      )}
                    </Animated.View>
                  )}
                </>
              );
            })()}
          </Pressable>
        </Modal>

        {/* Fullscreen Photo Preview Lightbox (swipe down to minimize + translucent backdrop) */}
        <Modal
          visible={previewPhotoUri !== null}
          transparent
          animationType="fade"
          onRequestClose={() => setPreviewPhotoUri(null)}
        >
          <View style={styles.photoLightboxRoot}>
            <Animated.View
              style={[
                StyleSheet.absoluteFill,
                {
                  backgroundColor: '#000000',
                  opacity: photoDragY.interpolate({
                    inputRange: [-220, 0, 260],
                    outputRange: [0.22, 0.72, 0.12],
                    extrapolate: 'clamp',
                  }),
                },
              ]}
            />
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={() => setPreviewPhotoUri(null)}
            />
            {previewPhotoUri && (
              <Animated.View
                {...photoPanResponder.panHandlers}
                style={[
                  styles.photoLightboxSwipeWrap,
                  {
                    transform: [
                      { translateY: photoDragY },
                      {
                        scale: photoDragY.interpolate({
                          inputRange: [-260, 0, 260],
                          outputRange: [0.88, 1, 0.84],
                          extrapolate: 'clamp',
                        }),
                      },
                    ],
                  },
                ]}
              >
                <Image
                  source={{ uri: previewPhotoUri }}
                  style={styles.photoLightboxImg}
                  resizeMode="contain"
                />
              </Animated.View>
            )}
            <TouchableOpacity
              onPress={() => setPreviewPhotoUri(null)}
              style={[styles.photoLightboxClose, { top: Math.max(insets.top + 12, 24) }]}
              activeOpacity={0.8}
            >
              <Ionicons name="close" size={22} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </Modal>

        {/* Chat Theme & Wallpaper Overlay (stays cleanly inside chat) */}
        {showThemeSheet && (
          <View style={styles.themeOverlayRoot}>
            <Pressable
              style={styles.themeOverlayBackdrop}
              onPress={() => {
                setShowThemeSheet(false);
                flushThemeAnnouncement();
              }}
            />
            <View
              style={[
                styles.themeOverlaySheet,
                {
                  backgroundColor: theme.bg,
                  borderColor: theme.border,
                  paddingBottom: Math.max(insets.bottom + 14, 24),
                },
              ]}
            >
              <View style={styles.themeOverlayHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.themeOverlayTitle, { color: theme.text }]}>
                    {t('chatThemeTitle')}
                  </Text>
                  <Text style={{ fontSize: 11.5, fontWeight: '600', color: theme.textMuted, marginTop: 2 }}>
                    {t('chatThemeSharedNote')}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    setShowThemeSheet(false);
                    flushThemeAnnouncement();
                  }}
                  style={[styles.headerCircleBtn, { backgroundColor: theme.bgSecondary }]}
                  activeOpacity={0.75}
                >
                  <Ionicons name="close" size={18} color={theme.text} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 8 }}>
                <Text style={[styles.themeSectionLabel, { color: theme.textMuted }]}>
                  {t('chatThemeColorSection')}
                </Text>
                <View style={styles.themeSwatchGrid}>
                  {CHAT_THEMES.map((ct) => {
                    const selected = appearance.themeId === ct.id;
                    return (
                      <TouchableOpacity
                        key={ct.id}
                        style={[
                          styles.themeSwatchChip,
                          {
                            backgroundColor: theme.bgSecondary,
                            borderColor: selected ? ct.accent : theme.border,
                            borderWidth: selected ? 1.8 : StyleSheet.hairlineWidth,
                          },
                        ]}
                        onPress={() => {
                          triggerSelectionHaptic();
                          persistAppearance({ ...appearance, themeId: ct.id });
                        }}
                        activeOpacity={0.8}
                      >
                        <View style={[styles.themeSwatchDot, { backgroundColor: ct.accent }]} />
                        <Text style={[styles.themeSwatchText, { color: theme.text }]}>
                          {ct.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={[styles.themeSectionLabel, { color: theme.textMuted, marginTop: 18 }]}>
                  {t('chatThemeWallpaperSection')}
                </Text>
                <View style={styles.themeSwatchGrid}>
                  {CHAT_WALLPAPERS.map((wp) => {
                    const selected = appearance.wallpaperId === wp.id;
                    return (
                      <TouchableOpacity
                        key={wp.id}
                        style={[
                          styles.themeSwatchChip,
                          {
                            backgroundColor: theme.bgSecondary,
                            borderColor: selected ? activeChatTheme.accent : theme.border,
                            borderWidth: selected ? 1.8 : StyleSheet.hairlineWidth,
                          },
                        ]}
                        onPress={() => {
                          triggerSelectionHaptic();
                          persistAppearance({ ...appearance, wallpaperId: wp.id });
                        }}
                        activeOpacity={0.8}
                      >
                        <Ionicons
                          name={wp.icon}
                          size={15}
                          color={selected ? activeChatTheme.accent : theme.textSecondary}
                        />
                        <Text style={[styles.themeSwatchText, { color: theme.text }]}>
                          {wp.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}

                  <TouchableOpacity
                    style={[
                      styles.themeSwatchChip,
                      {
                        backgroundColor: theme.bgSecondary,
                        borderColor:
                          appearance.wallpaperId === 'custom' && appearance.customUri
                            ? activeChatTheme.accent
                            : theme.border,
                        borderWidth:
                          appearance.wallpaperId === 'custom' && appearance.customUri
                            ? 1.8
                            : StyleSheet.hairlineWidth,
                      },
                    ]}
                    onPress={handlePickCustomWallpaper}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="image-outline" size={15} color={activeChatTheme.accent} />
                    <Text style={[styles.themeSwatchText, { color: theme.text }]}>
                      {t('chatWallpaperPickBtn')}
                    </Text>
                  </TouchableOpacity>

                  {appearance.customUri && (
                    <TouchableOpacity
                      style={[
                        styles.themeSwatchChip,
                        {
                          backgroundColor: theme.bgSecondary,
                          borderColor: theme.border,
                        },
                      ]}
                      onPress={() => {
                        triggerSelectionHaptic();
                        persistAppearance({
                          ...appearance,
                          wallpaperId: 'none',
                          customUri: null,
                        });
                      }}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="trash-outline" size={15} color={theme.danger} />
                      <Text style={[styles.themeSwatchText, { color: theme.danger }]}>
                        {t('chatWallpaperResetBtn')}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </ScrollView>
            </View>
          </View>
        )}

        {/* In-Chat Friend Profile Overlay (never exits chat back to Friends tab) */}
        <FriendProfileModal
          visible={showInChatProfile}
          friend={friend}
          myProfile={myProfile}
          embeddedOverlay
          onClose={() => setShowInChatProfile(false)}
          onOpenChat={() => setShowInChatProfile(false)}
          onSendKudos={async (f) => {
            await onSendKudos?.(f);
          }}
          onRemoveFriend={async (f) => {
            setShowInChatProfile(false);
            await onRemoveFriend?.(f);
            onClose();
          }}
        />
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingBottom: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerCircleBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerFriendBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minWidth: 0,
  },
  headerMeta: {
    flex: 1,
    minWidth: 0,
  },
  headerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  headerName: {
    fontSize: 15.5,
    fontWeight: '800',
    flexShrink: 1,
  },
  e2eeHeaderPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
  },
  e2eeHeaderText: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  headerSub: {
    fontSize: 11.5,
    fontWeight: '600',
    marginTop: 1,
  },
  messagesWrap: {
    flex: 1,
  },
  centerEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginTop: 4,
  },
  emptyText: {
    fontSize: 13.5,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 20,
  },
  listContent: {
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  timeSeparatorWrap: {
    alignItems: 'center',
    marginVertical: 10,
  },
  timeSeparatorPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  timeSeparatorText: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  msgRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  msgRowMine: {
    justifyContent: 'flex-end',
  },
  msgRowTheirs: {
    justifyContent: 'flex-start',
  },
  incomingAvatarCol: {
    width: 34,
    alignItems: 'flex-start',
    justifyContent: 'flex-end',
    paddingBottom: 2,
  },
  incomingAvatarSpacer: {
    width: 28,
    height: 1,
  },
  msgCol: {
    maxWidth: '79%',
  },
  msgColMine: {
    alignItems: 'flex-end',
  },
  msgColTheirs: {
    alignItems: 'flex-start',
  },
  bubble: {
    position: 'relative',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
  },
  incomingShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  decryptedErrorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  msgText: {
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 20.5,
  },
  cheerBubbleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cheerEmoji: {
    fontSize: 19,
  },
  richCard: {
    gap: 5,
    minWidth: 175,
  },
  richHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  richBadgeIcon: {
    width: 26,
    height: 26,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  richTitle: {
    fontSize: 14,
    fontWeight: '800',
    flexShrink: 1,
  },
  richSub: {
    fontSize: 12,
    fontWeight: '600',
  },
  richBody: {
    fontSize: 13.5,
    fontWeight: '600',
    marginTop: 2,
  },
  voiceWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minWidth: 214,
    paddingVertical: 2,
  },
  voicePlayBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  voiceWaveBlock: {
    flex: 1,
    gap: 4,
  },
  voiceBarsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2.5,
    height: 28,
  },
  voiceBarTouch: {
    height: 28,
    justifyContent: 'center',
  },
  voiceBar: {
    width: 3,
    borderRadius: 2,
  },
  voiceMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  voiceTimerText: {
    fontSize: 11,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  voiceLockPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    flexShrink: 1,
  },
  voiceHintTag: {
    fontSize: 10,
    fontWeight: '600',
    flexShrink: 1,
  },
  floatingReactionBadge: {
    position: 'absolute',
    bottom: -13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.14,
    shadowRadius: 3,
    elevation: 2,
  },
  floatingBadgeRight: {
    right: 8,
  },
  floatingBadgeLeft: {
    left: 8,
  },
  reactionPill: {
    paddingHorizontal: 3,
    paddingVertical: 1,
  },
  reactionPillText: {
    fontSize: 12.5,
  },
  deliveryStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 5,
    marginRight: 4,
  },
  timeText: {
    fontSize: 10.5,
    fontWeight: '600',
  },
  composerOuter: {
    paddingHorizontal: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  holdHintPill: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 8,
  },
  holdHintText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  attachTray: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  attachChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 11,
    paddingVertical: 9,
    borderRadius: 16,
    borderWidth: 1,
  },
  attachIconCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachChipText: {
    fontSize: 12.5,
    fontWeight: '800',
    flexShrink: 1,
  },
  composerPill: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    borderRadius: 26,
    borderWidth: 1,
    paddingLeft: 6,
    paddingRight: 6,
    paddingVertical: 6,
  },
  attachPlusBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 1,
  },
  input: {
    flex: 1,
    minHeight: 36,
    maxHeight: 112,
    paddingVertical: 7,
    paddingHorizontal: 4,
    fontSize: 15,
    fontWeight: '500',
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordingStatusRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 8,
    minHeight: 38,
  },
  recPulseRing: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(239,68,68,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recDotCore: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: '#EF4444',
  },
  recTimerText: {
    color: '#EF4444',
    fontSize: 13.5,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    minWidth: 36,
  },
  liveWaveRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 3,
    height: 26,
    overflow: 'hidden',
  },
  liveWaveBar: {
    width: 3,
    borderRadius: 1.5,
  },
  speakingHintLabel: {
    fontSize: 11.5,
    fontWeight: '800',
    marginRight: 4,
  },
  reactionBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.48)',
  },
  systemEventWrap: {
    alignItems: 'center',
    marginVertical: 8,
    paddingHorizontal: 18,
  },
  systemEventPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  systemEventText: {
    fontSize: 11.5,
    fontWeight: '700',
    textAlign: 'center',
  },
  editedBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 3,
    opacity: 0.72,
  },
  editingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginBottom: 8,
  },
  editingAccentBar: {
    width: 3,
    height: 26,
    borderRadius: 2,
  },
  editingBannerTitle: {
    fontSize: 11.5,
    fontWeight: '800',
  },
  editingBannerPreview: {
    fontSize: 12,
    fontWeight: '500',
  },
  editingCancelBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contextActionsCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 18,
    elevation: 11,
  },
  contextActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  contextActionText: {
    fontSize: 14,
    fontWeight: '700',
  },
  contextActionDivider: {
    height: StyleSheet.hairlineWidth,
    width: '100%',
  },
  reactionDock: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  reactionDockBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reactionDockEmoji: {
    fontSize: 23,
  },
  themeOverlayRoot: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-end',
    zIndex: 70,
    elevation: 20,
  },
  themeOverlayBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.52)',
  },
  themeOverlaySheet: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderTopWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
    maxHeight: '62%',
  },
  themeOverlayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  themeOverlayTitle: {
    fontSize: 17,
    fontWeight: '900',
  },
  themeSectionLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  themeSwatchGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  themeSwatchChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 14,
  },
  themeSwatchDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  themeSwatchText: {
    fontSize: 13,
    fontWeight: '700',
  },
  photoLightboxRoot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  photoLightboxSwipeWrap: {
    width: '100%',
    height: '82%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoLightboxImg: {
    width: '100%',
    height: '100%',
  },
  photoLightboxClose: {
    position: 'absolute',
    right: 18,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
