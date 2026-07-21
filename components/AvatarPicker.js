import React from 'react';
import { View, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { AVATARS } from '../lib/avatars';
import { colors } from '../theme';

const AVATAR_SIZE = 64;
const ROWS = [AVATARS.slice(0, 4), AVATARS.slice(4, 8)];

export default function AvatarPicker({ selected, onSelect }) {
  return (
    <View>
      {ROWS.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.row}>
          {row.map((source, colIndex) => {
            const avatarId = rowIndex * 4 + colIndex + 1;
            const isSelected = selected === avatarId;
            return (
              <TouchableOpacity key={avatarId} onPress={() => onSelect(avatarId)}>
                <View style={[styles.swatch, isSelected && styles.swatchSelected]}>
                  <Image source={source} style={styles.image} />
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12,
  },
  swatch: {
    width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2,
    borderWidth: 2, borderColor: colors.border,
    overflow: 'hidden',
  },
  swatchSelected: {
    borderColor: colors.accentCoral, borderWidth: 3,
  },
  image: { width: '100%', height: '100%' },
});
