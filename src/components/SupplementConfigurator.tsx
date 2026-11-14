import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../context/ThemeContext';
import { SupplementDosingMode, SupplementItem } from '../types/workout';
import {
  createCustomSupplement,
  formatSupplementDose,
} from '../data/supplements';
import { triggerImpactHaptic, triggerSelectionHaptic } from '../services/haptics';

interface SupplementConfiguratorProps {
  supplements: SupplementItem[];
  weightKg?: number;
  onChange: (next: SupplementItem[]) => void;
  compact?: boolean;
}

const MODE_LABELS: Array<{ value: SupplementDosingMode; label: string }> = [
  { value: 'recommended', label: 'Zalecane' },
  { value: 'per_kg', label: 'Wg masy' },
  { value: 'fixed', label: 'Własna' },
];

const PER_KG_PRESETS = [0.03, 0.05, 0.08, 0.1];

export const SupplementConfigurator: React.FC<SupplementConfiguratorProps> = ({
  supplements,
  weightKg,
  onChange,
  compact = false,
}) => {
  const { theme } = useAppTheme();

  const [expandedId, setExpandedId] = useState<string | null>(
    compact ? null : supplements.find((s) => s.enabled)?.id || null
  );
  const [showAddCustom, setShowAddCustom] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customMode, setCustomMode] = useState<SupplementDosingMode>('fixed');
  const [customFixedDose, setCustomFixedDose] = useState('');
  const [customPerKg, setCustomPerKg] = useState('0.05');

  const handleToggleItem = (id: string) => {
    triggerSelectionHaptic();
    const target = supplements.find((s) => s.id === id);
    const nextEnabled = target ? !target.enabled : true;

    onChange(
      supplements.map((item) => (item.id === id ? { ...item, enabled: nextEnabled } : item))
    );

    if (nextEnabled) {
      setExpandedId(id);
    } else if (expandedId === id) {
      setExpandedId(null);
    }
  };

  const handleUpdateItem = (id: string, patch: Partial<SupplementItem>) => {
    onChange(supplements.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const handleDeleteCustom = (id: string) => {
    triggerImpactHaptic('light');
    onChange(supplements.filter((item) => item.id !== id));
    if (expandedId === id) setExpandedId(null);
  };

  const handleCreateCustom = () => {
    const cleanName = customName.trim();
    if (!cleanName) return;

    const parsedPerKg = parseFloat(customPerKg.replace(',', '.'));
    const created = createCustomSupplement({
      name: cleanName,
      dosingMode: customMode,
      fixedAmountText: customFixedDose.trim() || undefined,
      perKgGrams: !isNaN(parsedPerKg) && parsedPerKg > 0 ? parsedPerKg : 0.05,
    });

    triggerImpactHaptic('medium');
    onChange([...supplements, created]);
    setExpandedId(created.id);
    setCustomName('');
    setCustomFixedDose('');
    setShowAddCustom(false);
  };

  return (
    <View style={styles.container}>
      {supplements.map((item) => {
        const isExpanded = item.enabled && expandedId === item.id;
        const doseLabel = formatSupplementDose(item, weightKg);

        return (
          <View
            key={item.id}
            style={[
              styles.card,
              {
                backgroundColor: item.enabled ? theme.card : theme.bg,
                borderColor: item.enabled ? theme.text : theme.border,
              },
            ]}
          >
            <View style={styles.rowHeader}>
              <TouchableOpacity
                style={styles.checkArea}
                onPress={() => handleToggleItem(item.id)}
                activeOpacity={0.75}
              >
                <View
                  style={[
                    styles.checkbox,
                    {
                      backgroundColor: item.enabled ? theme.primary : 'transparent',
                      borderColor: item.enabled ? theme.primary : theme.textMuted,
                    },
                  ]}
                >
                  {item.enabled && <Ionicons name="checkmark" size={14} color={theme.primaryText} />}
                </View>

                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={styles.titleLine}>
                    <Text style={[styles.nameText, { color: theme.text }]} numberOfLines={1}>
                      {item.name}
                    </Text>
                    {item.isCustom && (
                      <View style={[styles.customPill, { backgroundColor: theme.bgTertiary }]}>
                        <Text style={[styles.customPillText, { color: theme.textMuted }]}>
                          WŁASNY
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text
                    style={[
                      styles.dosePreview,
                      { color: item.enabled ? theme.textSecondary : theme.textMuted },
                    ]}
                    numberOfLines={1}
                  >
                    {item.enabled ? `Dawka: ${doseLabel}` : item.recommendedText}
                  </Text>
                </View>
              </TouchableOpacity>

              <View style={styles.rightBtns}>
                {item.enabled && (
                  <TouchableOpacity
                    style={[styles.editPill, { backgroundColor: theme.bgSecondary, borderColor: theme.border }]}
                    onPress={() => {
                      triggerSelectionHaptic();
                      setExpandedId(isExpanded ? null : item.id);
                    }}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.editPillText, { color: theme.text }]}>
                      {isExpanded ? 'Zwiń' : 'Dawka'}
                    </Text>
                    <Ionicons
                      name={isExpanded ? 'chevron-up' : 'chevron-down'}
                      size={12}
                      color={theme.textSecondary}
                    />
                  </TouchableOpacity>
                )}

                {item.isCustom && (
                  <TouchableOpacity
                    style={[styles.deleteBtn, { backgroundColor: theme.bgSecondary }]}
                    onPress={() => handleDeleteCustom(item.id)}
                  >
                    <Ionicons name="trash-outline" size={14} color={theme.textMuted} />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Expanded Dosing Config */}
            {isExpanded && (
              <View style={[styles.dosingDrawer, { borderTopColor: theme.hairline }]}>
                <Text style={[styles.dosingKicker, { color: theme.textMuted }]}>
                  SPOSÓB DAWKOWANIA
                </Text>

                <View style={styles.modeRow}>
                  {MODE_LABELS.map((mode) => {
                    const selected = item.dosingMode === mode.value;
                    return (
                      <TouchableOpacity
                        key={mode.value}
                        style={[
                          styles.modeBtn,
                          {
                            backgroundColor: selected ? theme.primary : theme.bgSecondary,
                            borderColor: selected ? theme.primary : theme.border,
                          },
                        ]}
                        onPress={() => {
                          triggerSelectionHaptic();
                          handleUpdateItem(item.id, { dosingMode: mode.value });
                        }}
                        activeOpacity={0.75}
                      >
                        <Text
                          style={[
                            styles.modeBtnText,
                            { color: selected ? theme.primaryText : theme.text },
                          ]}
                          numberOfLines={1}
                        >
                          {mode.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {item.dosingMode === 'per_kg' && (
                  <View style={styles.perKgBox}>
                    <Text style={[styles.hintLabel, { color: theme.textSecondary }]}>
                      Ilość gramów na kilogram masy ciała:
                    </Text>
                    <View style={styles.presetRow}>
                      {PER_KG_PRESETS.map((val) => {
                        const active = Math.abs((item.perKgGrams || 0.05) - val) < 0.005;
                        return (
                          <TouchableOpacity
                            key={val}
                            style={[
                              styles.presetChip,
                              {
                                backgroundColor: active ? theme.primary : theme.bgSecondary,
                                borderColor: active ? theme.primary : theme.border,
                              },
                            ]}
                            onPress={() => {
                              triggerSelectionHaptic();
                              handleUpdateItem(item.id, { perKgGrams: val });
                            }}
                          >
                            <Text
                              style={[
                                styles.presetChipText,
                                { color: active ? theme.primaryText : theme.text },
                              ]}
                            >
                              {val} g/kg
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                    <Text style={[styles.liveCalcNote, { color: theme.text }]}>
                      Dla Twojej wagi:{' '}
                      <Text style={{ fontWeight: '800' }}>{formatSupplementDose(item, weightKg)}</Text>
                    </Text>
                  </View>
                )}

                {item.dosingMode === 'fixed' && (
                  <View style={styles.fixedBox}>
                    <TextInput
                      style={[
                        styles.input,
                        { backgroundColor: theme.bgSecondary, borderColor: theme.border, color: theme.text },
                      ]}
                      value={item.fixedAmountText || ''}
                      onChangeText={(txt) => handleUpdateItem(item.id, { fixedAmountText: txt })}
                      placeholder="np. 4 g, 2000 IU, 1 miarka"
                      placeholderTextColor={theme.textMuted}
                    />
                  </View>
                )}

                {item.dosingMode === 'recommended' && (
                  <Text style={[styles.hintLabel, { color: theme.textSecondary, marginTop: 4 }]}>
                    Wytyczna: {item.recommendedText}
                  </Text>
                )}
              </View>
            )}
          </View>
        );
      })}

      {/* Add Custom Supplement */}
      {showAddCustom ? (
        <View
          style={[
            styles.addCustomBox,
            { backgroundColor: theme.bgSecondary, borderColor: theme.borderDark },
          ]}
        >
          <Text style={[styles.dosingKicker, { color: theme.textMuted }]}>NOWY WŁASNY SUPLEMENT</Text>
          <TextInput
            style={[
              styles.input,
              { backgroundColor: theme.card, borderColor: theme.border, color: theme.text },
            ]}
            value={customName}
            onChangeText={setCustomName}
            placeholder="Nazwa (np. Ashwagandha, Beta-alanina, Cynk)"
            placeholderTextColor={theme.textMuted}
          />

          <View style={styles.modeRow}>
            {MODE_LABELS.map((mode) => {
              const selected = customMode === mode.value;
              return (
                <TouchableOpacity
                  key={mode.value}
                  style={[
                    styles.modeBtn,
                    {
                      backgroundColor: selected ? theme.primary : theme.card,
                      borderColor: selected ? theme.primary : theme.border,
                    },
                  ]}
                  onPress={() => {
                    triggerSelectionHaptic();
                    setCustomMode(mode.value);
                  }}
                >
                  <Text
                    style={[
                      styles.modeBtnText,
                      { color: selected ? theme.primaryText : theme.text },
                    ]}
                  >
                    {mode.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {customMode === 'fixed' && (
            <TextInput
              style={[
                styles.input,
                { backgroundColor: theme.card, borderColor: theme.border, color: theme.text, marginTop: 8 },
              ]}
              value={customFixedDose}
              onChangeText={setCustomFixedDose}
              placeholder="Ile przyjmujesz? (np. 3 g, 500 mg, 1 kaps.)"
              placeholderTextColor={theme.textMuted}
            />
          )}

          {customMode === 'per_kg' && (
            <TextInput
              style={[
                styles.input,
                { backgroundColor: theme.card, borderColor: theme.border, color: theme.text, marginTop: 8 },
              ]}
              value={customPerKg}
              onChangeText={setCustomPerKg}
              keyboardType="decimal-pad"
              placeholder="Dawka g / kg m.c. (np. 0.05)"
              placeholderTextColor={theme.textMuted}
            />
          )}

          <View style={styles.customActionsRow}>
            <TouchableOpacity
              style={[styles.cancelCustomBtn, { borderColor: theme.border, backgroundColor: theme.card }]}
              onPress={() => setShowAddCustom(false)}
            >
              <Text style={[styles.cancelCustomText, { color: theme.textMuted }]}>Anuluj</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveCustomBtn, { backgroundColor: theme.primary }]}
              onPress={handleCreateCustom}
              disabled={!customName.trim()}
            >
              <Text style={[styles.saveCustomText, { color: theme.primaryText }]}>Dodaj suplement</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity
          style={[
            styles.addCustomTrigger,
            { borderColor: theme.borderDark, backgroundColor: theme.bgSecondary },
          ]}
          onPress={() => {
            triggerSelectionHaptic();
            setShowAddCustom(true);
          }}
          activeOpacity={0.75}
        >
          <Ionicons name="add-circle-outline" size={17} color={theme.text} />
          <Text style={[styles.addCustomText, { color: theme.text }]}>Dodaj własny suplement</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  card: {
    borderRadius: 15,
    borderWidth: 1,
    overflow: 'hidden',
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 11,
    paddingHorizontal: 12,
    gap: 10,
  },
  checkArea: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  titleLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  nameText: {
    fontSize: 14,
    fontWeight: '700',
    flexShrink: 1,
  },
  customPill: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  customPillText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  dosePreview: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  rightBtns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  editPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  editPillText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  deleteBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dosingDrawer: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  dosingKicker: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  modeRow: {
    flexDirection: 'row',
    gap: 7,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 9,
    borderWidth: 1,
    alignItems: 'center',
  },
  modeBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  perKgBox: {
    marginTop: 10,
    gap: 7,
  },
  hintLabel: {
    fontSize: 12,
    lineHeight: 17,
  },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  presetChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  presetChipText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  liveCalcNote: {
    fontSize: 12,
    marginTop: 2,
  },
  fixedBox: {
    marginTop: 8,
  },
  input: {
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 13.5,
    fontWeight: '600',
  },
  addCustomBox: {
    padding: 13,
    borderRadius: 15,
    borderWidth: 1,
  },
  customActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 10,
  },
  cancelCustomBtn: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 9,
    borderWidth: 1,
  },
  cancelCustomText: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  saveCustomBtn: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 9,
  },
  saveCustomText: {
    fontSize: 12.5,
    fontWeight: '800',
  },
  addCustomTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  addCustomText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
