import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  FlatList,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
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
  useAudioRecorderState,
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
  fetchChatMessages,
  reactToChatMessage,
  sendChatMessage,
} from '../services/social';
import { triggerNotificationHaptic, triggerSelectionHaptic } from '../services/haptics';
import { base64ToBytes, bytesToBase64 } from '../utils/e2ee';
import { UserAvatarBadge } from './UserAvatarBadge';
import { MinimalistBackdrop } from './MinimalistBackdrop';

interface FriendChatModalProps {
  visible: boolean;
  friend: FriendProfileSummary | null;
  myProfile: FriendProfileSummary | null;
  myUserId: string;
  onClose: () => void;
  onOpenProfile: (friend: FriendProfileSummary) => void;
  onMessagesChanged?: () => void;
}

const QUICK_REACTIONS = ['🔥', '💪', '⚡', '👏', '🏆'];
const MAX_VOICE_SECONDS = 45;
const WAVEFORM_BAR_COUNT = 18;
const DEFAULT_WAVEFORM = [
  0.34, 0.56, 0.78, 0.48, 0.9, 0.64, 0.42, 0.85, 0.72,
  0.52, 0.92, 0.68, 0.44, 0.8, 0.6, 0.46, 0.7, 0.38,
];

const VOICE_RECORDING_OPTIONS: RecordingOptions = {
  extension: '.m4a',
  sampleRate: 22050,
  numberOfChannels: 1,
  bitRate: 24000,
  isMeteringEnabled: true,
  android: {
    extension: '.m4a',
    outputFormat: 'mpeg4',
    audioEncoder: 'aac',
  },
  ios: {
    outputFormat: IOSOutputFormat.MPEG4AAC,
    audioQuality: AudioQuality.LOW,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: {
    mimeType: 'audio/webm',
    bitsPerSecond: 24000,
  },
};

function formatClockTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
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
    out.push(Number(Math.min(1, Math.max(0.18, samples[idx])).toFixed(2)));
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
      tension: 110,
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
  isEncrypted?: boolean;
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
    const safeName = `ir_voice_${messageId.replace(/[^a-zA-Z0-9_-]/g, '_')}.${ext}`;

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
    updateInterval: 90,
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
      // Ignore Web / unsupported audio mode switches
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

  const buttonBg = isMine
    ? 'rgba(255,255,255,0.22)'
    : theme.isDark
    ? 'rgba(10,132,255,0.18)'
    : 'rgba(10,132,255,0.12)';
  const buttonIconColor = isMine ? '#FFFFFF' : '#0A84FF';
  const activeBarColor = isMine ? '#FFFFFF' : '#0A84FF';
  const idleBarColor = isMine
    ? 'rgba(255,255,255,0.34)'
    : theme.isDark
    ? 'rgba(255,255,255,0.2)'
    : 'rgba(15,23,42,0.16)';
  const timerColor = isMine ? 'rgba(255,255,255,0.9)' : theme.textSecondary;

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
            size={17}
            color={buttonIconColor}
            style={!status.playing ? { marginLeft: 2 } : undefined}
          />
        )}
      </TouchableOpacity>

      <View style={styles.voiceWaveBlock}>
        <View style={styles.voiceBarsRow}>
          {bars.map((amp, idx) => {
            const barPct = (idx + 0.5) / bars.length;
            const filled = status.playing || status.currentTime > 0 ? barPct <= progressRatio : false;
            return (
              <View
                key={idx}
                style={[
                  styles.voiceBar,
                  {
                    height: Math.round(7 + amp * 19),
                    backgroundColor: filled ? activeBarColor : idleBarColor,
                  },
                ]}
              />
            );
          })}
        </View>

        <View style={styles.voiceMetaRow}>
          <Text style={[styles.voiceTimerText, { color: timerColor }]}>
            {status.playing || status.currentTime > 0.2
              ? `${formatDurationSec(status.currentTime)} / ${formatDurationSec(totalSec)}`
              : formatDurationSec(totalSec)}
          </Text>
          <View style={styles.voiceLockPill}>
            <Ionicons
              name="lock-closed"
              size={9}
              color={isMine ? 'rgba(255,255,255,0.72)' : '#10B981'}
            />
            <Text
              style={[
                styles.voiceHintTag,
                { color: isMine ? 'rgba(255,255,255,0.72)' : theme.textMuted },
              ]}
              numberOfLines={1}
            >
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
  onMessagesChanged,
}) => {
  const { theme } = useAppTheme();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const keyboardHeight = useKeyboardHeight();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [inputText, setInputText] = useState('');
  const [reactionTargetId, setReactionTargetId] = useState<string | null>(null);

  // Voice recording state
  const recorder = useAudioRecorder(VOICE_RECORDING_OPTIONS);
  const recorderState = useAudioRecorderState(recorder, 120);
  const [isRecordingMode, setIsRecordingMode] = useState(false);
  const [isSendingVoice, setIsSendingVoice] = useState(false);
  const [recordingSec, setRecordingSec] = useState(0);
  const [liveWaveSamples, setLiveWaveSamples] = useState<number[]>(() =>
    new Array(14).fill(0.24)
  );
  const recordedLevelsRef = useRef<number[]>([]);
  const recPulseAnim = useRef(new Animated.Value(0)).current;
  const micIdleAnim = useRef(new Animated.Value(0)).current;

  const listRef = useRef<FlatList<ChatMessage>>(null);
  const hasLoadedFriendRef = useRef<string | null>(null);
  const knownMessageIdsRef = useRef<Set<string>>(new Set());
  const animatedIdsRef = useRef<Set<string>>(new Set());
  const lastSignatureRef = useRef<string>('');
  const clientMsgSeqRef = useRef<number>(0);

  const loadMessages = useCallback(
    async (silent = false) => {
      if (!friend) return;
      const isInitialForFriend = hasLoadedFriendRef.current !== friend.userId;
      if (!silent && isInitialForFriend) {
        setIsLoading(true);
      }
      const res = await fetchChatMessages(friend.userId);
      if (res.ok) {
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
            // Preserve local pending items not yet superseded
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
      setReactionTargetId(null);
      setInputText('');
      setIsRecordingMode(false);
      return;
    }
    void loadMessages(false);
    const interval = setInterval(() => {
      void loadMessages(true);
    }, 4500);
    return () => clearInterval(interval);
  }, [visible, friend?.userId, loadMessages]);

  // Recording pulse animation + metering sampler
  useEffect(() => {
    if (!isRecordingMode) {
      recPulseAnim.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(recPulseAnim, {
          toValue: 1,
          duration: 550,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(recPulseAnim, {
          toValue: 0,
          duration: 550,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [isRecordingMode, recPulseAnim]);

  useEffect(() => {
    if (!isRecordingMode) return;
    const elapsedSec = Math.floor((recorderState.durationMillis || 0) / 1000);
    setRecordingSec(elapsedSec);

    const db = typeof recorderState.metering === 'number' ? recorderState.metering : -32;
    // Map -55dB..0dB cleanly to 0.16..1.0
    const normalized = Math.min(1, Math.max(0.16, (db + 55) / 55));
    const jitter = normalized < 0.22 ? 0.2 + ((Date.now() % 17) / 100) : normalized;
    recordedLevelsRef.current.push(jitter);
    setLiveWaveSamples((prev) => [...prev.slice(1), jitter]);
  }, [isRecordingMode, recorderState.durationMillis, recorderState.metering]);

  // Subtle breathing affordance on mic icon
  useEffect(() => {
    if (!visible || inputText.trim().length > 0 || isRecordingMode) {
      micIdleAnim.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(micIdleAnim, {
          toValue: 1,
          duration: 1400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(micIdleAnim, {
          toValue: 0,
          duration: 1400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [visible, inputText, isRecordingMode, micIdleAnim]);

  const scrollToLatest = useCallback(() => {
    setTimeout(() => {
      listRef.current?.scrollToEnd({ animated: true });
    }, 60);
  }, []);

  const handleSend = async (
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
  };

  const handleStartRecording = async () => {
    if (!friend) return;
    if (!friend.e2eePublicKey) {
      Alert.alert(t('e2eeBadgeLabel'), t('e2eeMissingRecipientKey'));
      return;
    }
    triggerSelectionHaptic();
    try {
      const perm = await AudioModule.requestRecordingPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(t('errorTitle'), t('voiceMicDeniedBody'));
        return;
      }
      await setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: true,
      });
      recordedLevelsRef.current = [];
      setLiveWaveSamples(new Array(14).fill(0.24));
      setRecordingSec(0);
      await recorder.prepareToRecordAsync();
      recorder.record();
      setIsRecordingMode(true);
    } catch (e: any) {
      Alert.alert(t('errorTitle'), e?.message || t('voiceMicDeniedBody'));
      setIsRecordingMode(false);
    }
  };

  const handleCancelRecording = async () => {
    triggerSelectionHaptic();
    setIsRecordingMode(false);
    try {
      await recorder.stop();
    } catch {
      // Ignore if already stopped
    }
    try {
      await setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: false,
      });
    } catch {
      // Ignore Web / unsupported audio mode switches
    }
  };

  const handleSendVoiceNote = useCallback(async () => {
    if (!friend || isSendingVoice) return;
    if (!friend.e2eePublicKey) {
      Alert.alert(t('e2eeBadgeLabel'), t('e2eeMissingRecipientKey'));
      return;
    }

    setIsSendingVoice(true);
    const finalDuration = Math.max(1, Math.round((recorderState.durationMillis || recordingSec * 1000) / 1000));
    const collectedWave = downsampleWaveform(recordedLevelsRef.current);

    try {
      await recorder.stop();
      await setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: false,
      }).catch(() => {});

      const recordedUri = recorder.uri;
      setIsRecordingMode(false);

      if (!recordedUri) {
        Alert.alert(t('errorTitle'), t('socialRequestFailedError'));
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
  }, [friend, isSendingVoice, recorder, recorderState.durationMillis, recordingSec, t]);

  // Auto-finish if max duration reached
  useEffect(() => {
    if (isRecordingMode && recordingSec >= MAX_VOICE_SECONDS && !isSendingVoice) {
      void handleSendVoiceNote();
    }
  }, [isRecordingMode, recordingSec, isSendingVoice, handleSendVoiceNote]);

  // Ensure recording stops if modal closes unexpectedly
  useEffect(() => {
    if (!visible && isRecordingMode) {
      void handleCancelRecording();
    }
  }, [visible, isRecordingMode]);

  const handleQuickShareWorkout = () => {
    if (!myProfile) return;
    const msg = `${myProfile.displayName} · ${t('workoutsCountLabel', { count: myProfile.totalWorkouts })} (${myProfile.totalSets} ${t('friendsSetsCountShort')})`;
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
      subtitle: `${t('friendsBalanceLabel')} ${myProfile.balanceScorePct}% · ${t('workoutsCountLabel', { count: myProfile.totalWorkouts })}`,
      rank: myProfile.overallRank,
    });
  };

  const handleQuickCheer = () => {
    void handleSend('cheer', t('friendsChatQuickKudos'), { emoji: '🔥' });
  };

  const handleReact = async (messageId: string, emoji: string) => {
    if (!friend || messageId.startsWith('local_')) return;
    triggerSelectionHaptic();
    setReactionTargetId(null);
    const updated = await reactToChatMessage(friend.userId, messageId, emoji);
    if (updated) {
      setMessages((prev) => {
        const next = prev.map((m) => (m.id === messageId ? updated : m));
        lastSignatureRef.current = buildMessagesSignature(next);
        return next;
      });
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
    const samePrev = prev?.senderId === item.senderId;
    const sameNext = next?.senderId === item.senderId;

    const showFriendAvatar = !isMine && !sameNext;
    const showSenderTimeMeta = !sameNext || index === messages.length - 1;
    const isLatestOutgoing = isMine && index === lastOutgoingIdx;
    const isPendingLocal = item.id.startsWith('local_');
    const shouldAnimateEntry = animatedIdsRef.current.has(item.id);

    const reactionsList = Object.entries(item.reactions || {}).filter(
      ([, users]) => Array.isArray(users) && users.length > 0
    );

    // Messenger-style grouped bubble corner radii
    const bubbleRadii = isMine
      ? {
          borderTopLeftRadius: 20,
          borderBottomLeftRadius: 20,
          borderTopRightRadius: samePrev ? 6 : 20,
          borderBottomRightRadius: sameNext ? 6 : 20,
        }
      : {
          borderTopRightRadius: 20,
          borderBottomRightRadius: 20,
          borderTopLeftRadius: samePrev ? 6 : 20,
          borderBottomLeftRadius: sameNext ? 6 : 20,
        };

    const incomingBg = theme.isDark ? '#1E232D' : '#FFFFFF';
    const incomingBorder = theme.isDark ? 'rgba(255,255,255,0.09)' : 'rgba(15,23,42,0.08)';
    const bubbleBg = item.decryptFailed
      ? theme.isDark
        ? 'rgba(239,68,68,0.14)'
        : 'rgba(239,68,68,0.09)'
      : isMine
      ? '#0A84FF'
      : incomingBg;
    const bubbleBorderColor = item.decryptFailed
      ? 'rgba(239,68,68,0.38)'
      : isMine
      ? 'rgba(255,255,255,0.16)'
      : incomingBorder;
    const bubbleTextColor = item.decryptFailed
      ? theme.textMuted
      : isMine
      ? '#FFFFFF'
      : theme.text;

    const showReactionTray = reactionTargetId === item.id;

    return (
      <AnimatedMessageRow animateOnMount={shouldAnimateEntry} isMine={isMine}>
        <View
          style={[
            styles.msgRow,
            isMine ? styles.msgRowMine : styles.msgRowTheirs,
            { marginBottom: sameNext ? 3 : 12 },
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
            {showReactionTray && (
              <View
                style={[
                  styles.reactionTray,
                  {
                    backgroundColor: theme.isDark ? '#252B36' : '#FFFFFF',
                    borderColor: theme.border,
                    alignSelf: isMine ? 'flex-end' : 'flex-start',
                  },
                ]}
              >
                {QUICK_REACTIONS.map((em) => (
                  <TouchableOpacity
                    key={em}
                    style={styles.reactionPickBtn}
                    onPress={() => handleReact(item.id, em)}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.reactionPickText}>{em}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <TouchableOpacity
              activeOpacity={0.86}
              onLongPress={() => {
                if (isPendingLocal) return;
                triggerSelectionHaptic();
                setReactionTargetId((prevId) => (prevId === item.id ? null : item.id));
              }}
              onPress={() => {
                if (reactionTargetId) {
                  setReactionTargetId(null);
                }
              }}
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
              ) : item.type === 'voice' ? (
                <VoiceNoteBubble
                  messageId={item.id}
                  audioBase64={item.payload?.audioBase64}
                  audioMime={item.payload?.audioMime}
                  durationSec={item.payload?.durationSec}
                  waveform={item.payload?.waveform}
                  isMine={isMine}
                  isEncrypted={item.isEncrypted}
                />
              ) : item.type === 'workout_share' || item.type === 'rank_card' ? (
                <View style={styles.richCard}>
                  <View style={styles.richHeader}>
                    <View
                      style={[
                        styles.richBadgeIcon,
                        {
                          backgroundColor: isMine
                            ? 'rgba(255,255,255,0.22)'
                            : `${theme.primary}18`,
                        },
                      ]}
                    >
                      <Ionicons
                        name={item.type === 'workout_share' ? 'barbell' : 'ribbon'}
                        size={15}
                        color={isMine ? '#FFFFFF' : theme.primary}
                      />
                    </View>
                    <Text style={[styles.richTitle, { color: bubbleTextColor }]}>
                      {item.payload?.title || item.text}
                    </Text>
                  </View>
                  {item.payload?.subtitle ? (
                    <Text
                      style={[
                        styles.richSub,
                        {
                          color: isMine
                            ? 'rgba(255,255,255,0.86)'
                            : theme.textSecondary,
                        },
                      ]}
                    >
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
            </TouchableOpacity>

            {(reactionsList.length > 0 || showSenderTimeMeta || isLatestOutgoing) && (
              <View
                style={[
                  styles.msgFooter,
                  isMine ? styles.msgFooterMine : styles.msgFooterTheirs,
                ]}
              >
                {reactionsList.length > 0 && (
                  <View
                    style={[
                      styles.reactionsRow,
                      {
                        backgroundColor: theme.isDark ? '#252B36' : '#FFFFFF',
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

                {isLatestOutgoing ? (
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
                        <Ionicons name="checkmark-done" size={12} color="#0A84FF" />
                        <Text style={[styles.timeText, { color: theme.textMuted }]}>
                          {t('voiceSentBadge')} · {formatClockTime(item.createdAt)}
                        </Text>
                      </>
                    )}
                  </View>
                ) : showSenderTimeMeta ? (
                  <Text style={[styles.timeText, { color: theme.textMuted }]}>
                    {formatClockTime(item.createdAt)}
                  </Text>
                ) : null}
              </View>
            )}
          </View>
        </View>
      </AnimatedMessageRow>
    );
  };

  if (!friend) return null;

  const canTypeSend = inputText.trim().length > 0 && !isSending;

  const innerContent = (
    <View style={[styles.screen, { backgroundColor: theme.bg }]}>
      <MinimalistBackdrop
        variant="diagonal"
        accentColor="#0A84FF"
        secondaryColor="#10B981"
      />

      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: Math.max(insets.top + 8, 18),
            borderBottomColor: theme.border,
            backgroundColor: theme.isDark
              ? 'rgba(15, 17, 23, 0.88)'
              : 'rgba(248, 250, 252, 0.9)',
          },
        ]}
      >
        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: theme.bgSecondary }]}
          onPress={onClose}
          activeOpacity={0.78}
        >
          <Ionicons name="chevron-back" size={20} color={theme.text} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.headerFriendBtn}
          onPress={() => onOpenProfile(friend)}
          activeOpacity={0.78}
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
              <View style={styles.e2eeHeaderPill}>
                <Ionicons name="lock-closed" size={10} color="#10B981" />
                <Text style={styles.e2eeHeaderText}>E2EE</Text>
              </View>
            </View>
            <Text style={[styles.headerSub, { color: theme.textMuted }]} numberOfLines={1}>
              @{friend.nickname} · {t('friendsRankByTier')} {friend.overallRank}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
        </TouchableOpacity>
      </View>

      {/* Quick Share Strip */}
      <View
        style={[
          styles.quickStrip,
          {
            borderBottomColor: theme.border,
            backgroundColor: theme.isDark
              ? 'rgba(15, 17, 23, 0.7)'
              : 'rgba(248, 250, 252, 0.78)',
          },
        ]}
      >
        <TouchableOpacity
          style={[styles.quickChip, { backgroundColor: `${theme.primary}15`, borderColor: `${theme.primary}38` }]}
          onPress={handleQuickShareWorkout}
          activeOpacity={0.8}
        >
          <Ionicons name="barbell-outline" size={13} color={theme.primary} />
          <Text style={[styles.quickChipText, { color: theme.primary }]}>
            {t('friendsChatShareWorkout')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.quickChip, { backgroundColor: '#8B5CF618', borderColor: '#8B5CF638' }]}
          onPress={handleQuickShareRank}
          activeOpacity={0.8}
        >
          <Ionicons name="ribbon-outline" size={13} color="#A78BFA" />
          <Text style={[styles.quickChipText, { color: '#A78BFA' }]}>
            {t('friendsChatShareRank')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.quickChip, { backgroundColor: '#F59E0B18', borderColor: '#F59E0B38' }]}
          onPress={handleQuickCheer}
          activeOpacity={0.8}
        >
          <Text style={styles.quickEmoji}>🔥</Text>
          <Text style={[styles.quickChipText, { color: '#F59E0B' }]}>
            {t('friendsKudosBtn')}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Message List */}
      <View style={styles.messagesWrap}>
        {isLoading ? (
          <View style={styles.centerEmpty}>
            <ActivityIndicator color="#0A84FF" size="large" />
          </View>
        ) : messages.length === 0 ? (
          <View style={styles.centerEmpty}>
            <UserAvatarBadge
              avatarUrl={friend.avatarUrl}
              displayName={friend.displayName}
              avatarColor={friend.avatarColor}
              rank={friend.overallRank || 'F'}
              size={64}
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

      {/* Messenger Composer / Voice Recorder */}
      <View
        style={[
          styles.composerBar,
          {
            borderTopColor: theme.border,
            backgroundColor: theme.isDark
              ? 'rgba(15, 17, 23, 0.94)'
              : 'rgba(255, 255, 255, 0.96)',
            paddingBottom:
              keyboardHeight > 0
                ? keyboardHeight + 10
                : Math.max(insets.bottom + 10, 18),
          },
        ]}
      >
        {isRecordingMode ? (
          <View
            style={[
              styles.recordingPill,
              {
                backgroundColor: theme.isDark ? '#271419' : '#FFF1F2',
                borderColor: 'rgba(239,68,68,0.45)',
              },
            ]}
          >
            <TouchableOpacity
              style={styles.recCancelBtn}
              onPress={handleCancelRecording}
              disabled={isSendingVoice}
              activeOpacity={0.75}
            >
              <Ionicons name="trash-outline" size={19} color="#EF4444" />
            </TouchableOpacity>

            <View style={styles.recStatusWrap}>
              <Animated.View
                style={[
                  styles.recDot,
                  {
                    opacity: recPulseAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.35, 1],
                    }),
                    transform: [
                      {
                        scale: recPulseAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.85, 1.2],
                        }),
                      },
                    ],
                  },
                ]}
              />
              <Text style={[styles.recTimerText, { color: '#EF4444' }]}>
                {formatDurationSec(recordingSec)}
              </Text>
              <View style={styles.liveWaveRow}>
                {liveWaveSamples.map((amp, idx) => (
                  <View
                    key={idx}
                    style={[
                      styles.liveWaveBar,
                      {
                        height: Math.round(6 + amp * 16),
                        backgroundColor: '#EF4444',
                      },
                    ]}
                  />
                ))}
              </View>
            </View>

            <TouchableOpacity
              style={[styles.sendBtn, { backgroundColor: '#0A84FF' }]}
              onPress={handleSendVoiceNote}
              disabled={isSendingVoice}
              activeOpacity={0.82}
            >
              {isSendingVoice ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Ionicons name="arrow-up" size={19} color="#FFFFFF" />
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.composerRow}>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: theme.bgSecondary,
                  color: theme.text,
                  borderColor: theme.border,
                },
              ]}
              placeholder={t('friendsChatPlaceholder')}
              placeholderTextColor={theme.textMuted}
              value={inputText}
              onChangeText={setInputText}
              multiline
              maxLength={800}
              onFocus={scrollToLatest}
            />

            {canTypeSend ? (
              <TouchableOpacity
                style={[styles.sendBtn, { backgroundColor: '#0A84FF' }]}
                onPress={() => handleSend('text')}
                disabled={isSending}
                activeOpacity={0.82}
              >
                {isSending ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Ionicons name="arrow-up" size={19} color="#FFFFFF" />
                )}
              </TouchableOpacity>
            ) : (
              <Animated.View
                style={{
                  transform: [
                    {
                      scale: micIdleAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1, 1.06],
                      }),
                    },
                  ],
                }}
              >
                <TouchableOpacity
                  style={[
                    styles.sendBtn,
                    {
                      backgroundColor: '#0A84FF',
                    },
                  ]}
                  onPress={handleStartRecording}
                  disabled={isSending || isSendingVoice}
                  activeOpacity={0.82}
                >
                  <Ionicons name="mic" size={19} color="#FFFFFF" />
                </TouchableOpacity>
              </Animated.View>
            )}
          </View>
        )}
      </View>
    </View>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      {innerContent}
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
    paddingBottom: 10,
    borderBottomWidth: 1,
  },
  backBtn: {
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
    backgroundColor: 'rgba(16, 185, 129, 0.14)',
  },
  e2eeHeaderText: {
    color: '#10B981',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  headerSub: {
    fontSize: 11.5,
    fontWeight: '600',
    marginTop: 1,
  },
  quickStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  quickChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5.5,
    borderRadius: 999,
    borderWidth: 1,
  },
  quickChipText: {
    fontSize: 11.5,
    fontWeight: '800',
  },
  quickEmoji: {
    fontSize: 12,
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
    fontSize: 17,
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
    fontSize: 14.5,
    fontWeight: '500',
    lineHeight: 20,
  },
  cheerBubbleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cheerEmoji: {
    fontSize: 18,
  },
  richCard: {
    gap: 5,
    minWidth: 170,
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
    minWidth: 204,
    paddingVertical: 2,
  },
  voicePlayBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
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
  msgFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  msgFooterMine: {
    justifyContent: 'flex-end',
  },
  msgFooterTheirs: {
    justifyContent: 'flex-start',
  },
  deliveryStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeText: {
    fontSize: 10.5,
    fontWeight: '600',
  },
  reactionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
  },
  reactionPill: {
    paddingHorizontal: 3,
    paddingVertical: 1,
  },
  reactionPillText: {
    fontSize: 12,
  },
  reactionTray: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    marginBottom: 6,
  },
  reactionPickBtn: {
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  reactionPickText: {
    fontSize: 17,
  },
  composerBar: {
    paddingHorizontal: 12,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  composerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  input: {
    flex: 1,
    minHeight: 42,
    maxHeight: 112,
    borderRadius: 21,
    borderWidth: 1,
    paddingHorizontal: 15,
    paddingVertical: 10,
    fontSize: 14.5,
    fontWeight: '500',
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  recCancelBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239,68,68,0.14)',
  },
  recStatusWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  recDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: '#EF4444',
  },
  recTimerText: {
    fontSize: 13.5,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    minWidth: 38,
  },
  liveWaveRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 3,
    height: 24,
  },
  liveWaveBar: {
    width: 3,
    borderRadius: 1.5,
    opacity: 0.85,
  },
});
