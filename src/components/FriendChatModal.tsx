import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  FlatList,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
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
      return `${m.id}:${m.text.length}:${m.payload?.durationSec ?? 0}:${rx}`;
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

  useEffect(() => {
    if (!animateOnMount) return;
    Animated.spring(anim, {
      toValue: 1,
      friction: 7.5,
      tension: 115,
      useNativeDriver: true,
    }).start();
  }, [anim, animateOnMount]);

  if (!animateOnMount) {
    return <>{children}</>;
  }

  return (
    <Animated.View
      style={{
        opacity: anim.interpolate({
          inputRange: [0, 0.35, 1],
          outputRange: [0, 0.85, 1],
        }),
        transform: [
          {
            translateY: anim.interpolate({
              inputRange: [0, 1],
              outputRange: [22, 0],
            }),
          },
          {
            translateX: anim.interpolate({
              inputRange: [0, 1],
              outputRange: [isMine ? 16 : -16, 0],
            }),
          },
          {
            scale: anim.interpolate({
              inputRange: [0, 1],
              outputRange: [0.88, 1],
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

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [inputText, setInputText] = useState('');
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showInChatProfile, setShowInChatProfile] = useState(false);
  const [showThemeSheet, setShowThemeSheet] = useState(false);
  const [previewPhotoUri, setPreviewPhotoUri] = useState<string | null>(null);
  const [appearance, setAppearance] = useState<ChatAppearance>({
    themeId: 'monochrome',
    wallpaperId: 'none',
    customUri: null,
  });
  const [reactionTargetMsg, setReactionTargetMsg] = useState<ChatMessage | null>(null);
  const [holdHintVisible, setHoldHintVisible] = useState(false);

  const attachAnim = useRef(new Animated.Value(0)).current;
  const reactionDockAnim = useRef(new Animated.Value(0)).current;

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
      const isInitialForFriend = hasLoadedFriendRef.current !== friend.userId;
      if (!silent && isInitialForFriend) {
        setIsLoading(true);
      }
      const res = await fetchChatMessages(friend.userId);
      if (res.ok) {
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
            AsyncStorage.setItem(
              `${CHAT_APPEARANCE_KEY_PREFIX}${friend.userId}`,
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
          hasLoadedFriendRef.current = friend.userId;
          lastSignatureRef.current = sig;
          setMessages(nextList);
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
    if (!visible || !friend) {
      hasLoadedFriendRef.current = null;
      lastSignatureRef.current = '';
      knownMessageIdsRef.current.clear();
      animatedIdsRef.current.clear();
      setMessages([]);
      setReactionTargetMsg(null);
      setShowAttachMenu(false);
      setShowInChatProfile(false);
      setShowThemeSheet(false);
      setPreviewPhotoUri(null);
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
          return;
        }
        try {
          const parsed = JSON.parse(raw);
          setAppearance({
            themeId: parsed.themeId || 'monochrome',
            wallpaperId: parsed.wallpaperId || 'none',
            customUri: parsed.customUri || null,
          });
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
    if (!reactionTargetMsg) {
      reactionDockAnim.setValue(0);
      return;
    }
    Animated.spring(reactionDockAnim, {
      toValue: 1,
      friction: 7,
      tension: 130,
      useNativeDriver: true,
    }).start();
  }, [reactionTargetMsg, reactionDockAnim]);

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
        Alert.alert(t('e2eeBadgeLabel'), t('e2eeMissingRecipientKey'));
        return;
      }

      triggerSelectionHaptic();
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

      setIsSending(true);
      try {
        const res = await sendChatMessage({
          friendId: friend.userId,
          recipientPublicKey: friend.e2eePublicKey,
          type: customType,
          text: text || t('voiceMsgLabel'),
          payload,
        });
        if (res.ok && res.message) {
          knownMessageIdsRef.current.add(res.message.id);
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
          Alert.alert(t('errorTitle'), res.error || t('socialRequestFailedError'));
        }
      } finally {
        setIsSending(false);
      }
    },
    [friend, inputText, isSending, myUserId, onMessagesChanged, scrollToLatest, t]
  );

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
      triggerSelectionHaptic();
      setReactionTargetMsg(null);

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

  const persistAppearance = useCallback(
    (next: ChatAppearance) => {
      setAppearance(next);
      if (friend?.userId) {
        AsyncStorage.setItem(`${CHAT_APPEARANCE_KEY_PREFIX}${friend.userId}`, JSON.stringify(next)).catch(
          () => {}
        );
        void saveSharedChatTheme(friend.userId, next);
      }
    },
    [friend?.userId]
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
    if (!friend || msg.id.startsWith('local_')) return;
    triggerNotificationHaptic('warning');
    setReactionTargetMsg(null);
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

  const handleBubblePress = (item: ChatMessage) => {
    if (showAttachMenu) setShowAttachMenu(false);
    if (item.id.startsWith('local_')) return;
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
      if (messages[i].senderId === myUserId) return i;
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
            <TouchableOpacity
              activeOpacity={0.86}
              delayLongPress={250}
              onLongPress={() => {
                if (isPendingLocal) return;
                triggerNotificationHaptic('success');
                setReactionTargetMsg(item);
              }}
              onPress={() => handleBubblePress(item)}
              style={[
                styles.bubble,
                bubbleRadii,
                {
                  backgroundColor: bubbleBg,
                  borderColor: bubbleBorderColor,
                  opacity: isPendingLocal ? 0.88 : 1,
                },
                !isMine && styles.incomingShadow,
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
                  onPress={() =>
                    setPreviewPhotoUri(
                      `data:${item.payload?.imageMime || 'image/jpeg'};base64,${item.payload?.imageBase64}`
                    )
                  }
                  onLongPress={() => {
                    if (isPendingLocal) return;
                    triggerNotificationHaptic('success');
                    setReactionTargetMsg(item);
                  }}
                >
                  <Image
                    source={{
                      uri: `data:${item.payload.imageMime || 'image/jpeg'};base64,${item.payload.imageBase64}`,
                    }}
                    style={{
                      width: 210,
                      height:
                        item.payload.imageWidth && item.payload.imageHeight
                          ? Math.max(
                              120,
                              Math.min(280, Math.round(210 * (item.payload.imageHeight / item.payload.imageWidth)))
                            )
                          : 210,
                      borderRadius: 15,
                    }}
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
                <Text style={[styles.msgText, { color: bubbleTextColor }]}>{item.text}</Text>
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

            {isLatestOutgoing && (
              <View style={styles.deliveryStatusRow}>
                {isPendingLocal ? (
                  <>
                    <ActivityIndicator size={9} color={theme.textMuted} />
                    <Text style={[styles.timeText, { color: theme.textMuted }]}>
                      {t('voiceSendingBadge')}
                    </Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="checkmark-done" size={12} color={theme.textSecondary} />
                    <Text style={[styles.timeText, { color: theme.textMuted }]}>
                      {t('voiceSentBadge')} · {formatClockTime(item.createdAt)}
                    </Text>
                  </>
                )}
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
              keyExtractor={(item) => item.id}
              renderItem={renderMessage}
              contentContainerStyle={styles.listContent}
              onContentSizeChange={() => {
                listRef.current?.scrollToEnd({ animated: false });
              }}
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
              <TouchableOpacity
                style={[styles.sendBtn, { backgroundColor: theme.primary }]}
                onPress={() => handleSend('text')}
                disabled={isSending}
                activeOpacity={0.82}
              >
                {isSending ? (
                  <ActivityIndicator size="small" color={theme.primaryText} />
                ) : (
                  <Ionicons name="arrow-up" size={19} color={theme.primaryText} />
                )}
              </TouchableOpacity>
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

        {/* Dedicated Animated Messenger Reaction Overlay */}
        <Modal
          visible={reactionTargetMsg !== null}
          transparent
          animationType="fade"
          onRequestClose={() => setReactionTargetMsg(null)}
        >
          <Pressable
            style={styles.reactionBackdrop}
            onPress={() => setReactionTargetMsg(null)}
          >
            {reactionTargetMsg && (
              <Animated.View
                style={[
                  styles.reactionOverlayCard,
                  {
                    opacity: reactionDockAnim,
                    transform: [
                      {
                        scale: reactionDockAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.84, 1],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <View
                  style={[
                    styles.reactionDock,
                    {
                      backgroundColor: theme.isDark ? '#18181D' : '#FFFFFF',
                      borderColor: theme.border,
                    },
                  ]}
                >
                  {MESSENGER_REACTIONS.map((em) => {
                    const alreadyReacted = Boolean(
                      reactionTargetMsg.reactions?.[em]?.includes(myUserId)
                    );
                    return (
                      <TouchableOpacity
                        key={em}
                        onPress={() => handleReact(reactionTargetMsg.id, em)}
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
                </View>

                <View
                  style={[
                    styles.reactionPreviewBubble,
                    {
                      backgroundColor:
                        reactionTargetMsg.senderId === myUserId
                          ? theme.isDark
                            ? '#F4F4F5'
                            : '#18181B'
                          : theme.isDark
                          ? '#141418'
                          : '#FFFFFF',
                      borderColor: theme.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.reactionPreviewText,
                      {
                        color:
                          reactionTargetMsg.senderId === myUserId
                            ? theme.isDark
                              ? '#09090B'
                              : '#FFFFFF'
                            : theme.text,
                      },
                    ]}
                    numberOfLines={3}
                  >
                    {reactionTargetMsg.text}
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.deleteMsgBtn}
                  onPress={() => handleDeleteMessage(reactionTargetMsg)}
                  activeOpacity={0.82}
                >
                  <Ionicons name="trash-outline" size={16} color="#FCA5A5" />
                  <Text style={styles.deleteMsgBtnText}>{t('chatDeleteMsgBtn')}</Text>
                </TouchableOpacity>
              </Animated.View>
            )}
          </Pressable>
        </Modal>

        {/* Fullscreen Photo Preview Lightbox */}
        <Modal
          visible={previewPhotoUri !== null}
          transparent
          animationType="fade"
          onRequestClose={() => setPreviewPhotoUri(null)}
        >
          <View style={styles.photoLightboxRoot}>
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={() => setPreviewPhotoUri(null)}
            />
            {previewPhotoUri && (
              <Image
                source={{ uri: previewPhotoUri }}
                style={styles.photoLightboxImg}
                resizeMode="contain"
              />
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
              onPress={() => setShowThemeSheet(false)}
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
                  onPress={() => setShowThemeSheet(false)}
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
    backgroundColor: 'rgba(0,0,0,0.52)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  reactionOverlayCard: {
    alignItems: 'center',
    gap: 12,
    maxWidth: 330,
    width: '100%',
  },
  reactionDock: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  reactionDockBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reactionDockEmoji: {
    fontSize: 24,
  },
  reactionPreviewBubble: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 18,
    borderWidth: 1,
    maxWidth: '90%',
  },
  reactionPreviewText: {
    fontSize: 14.5,
    fontWeight: '600',
    textAlign: 'center',
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
  deleteMsgBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 999,
    backgroundColor: 'rgba(127, 29, 29, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.5)',
  },
  deleteMsgBtnText: {
    color: '#FEE2E2',
    fontSize: 13.5,
    fontWeight: '800',
  },
  photoLightboxRoot: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.94)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  photoLightboxImg: {
    width: '100%',
    height: '82%',
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
