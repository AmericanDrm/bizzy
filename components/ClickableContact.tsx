import React from 'react';
import { Text, TouchableOpacity, StyleSheet, Linking, Platform, View, Alert } from 'react-native';
import { Phone, Mail, MapPin, MessageCircle } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { makePhoneCall, sendSMS, sendEmail, formatPhoneNumber } from '@/lib/utilities';

interface ClickableContactProps {
  type: 'phone' | 'email' | 'address';
  value: string;
  style?: any;
  iconSize?: number;
  showSmsButton?: boolean;
  shortAddress?: boolean;
  onBizzySms?: () => void;
  onBizzyEmail?: () => void;
}

function getShortAddress(address: string): string {
  const parts = address.split(',').map(p => p.trim()).filter(Boolean);
  if (parts.length >= 3) {
    return `${parts[0]}, ${parts[1]}`;
  }
  if (parts.length === 2) {
    return `${parts[0]}, ${parts[1]}`;
  }
  return parts[0] || address;
}

export default function ClickableContact({
  type,
  value,
  style,
  iconSize = 16,
  showSmsButton = true,
  shortAddress = false,
  onBizzySms,
  onBizzyEmail,
}: ClickableContactProps) {
  const { colors } = useTheme();

  const handlePress = async () => {
    if (type === 'phone') {
      if (onBizzySms) {
        Alert.alert(
          formatPhoneNumber(value),
          undefined,
          [
            {
              text: 'Call',
              onPress: () => makePhoneCall(value),
            },
            {
              text: 'Text (Native)',
              onPress: () => sendSMS(value),
            },
            {
              text: 'Text via Bizzy',
              onPress: onBizzySms,
            },
            {
              text: 'Cancel',
              style: 'cancel',
            },
          ]
        );
      } else {
        Alert.alert(
          formatPhoneNumber(value),
          undefined,
          [
            {
              text: 'Call',
              onPress: () => makePhoneCall(value),
            },
            {
              text: 'Text (Native)',
              onPress: () => sendSMS(value),
            },
            {
              text: 'Cancel',
              style: 'cancel',
            },
          ]
        );
      }
    } else if (type === 'email') {
      if (onBizzyEmail) {
        Alert.alert(
          value,
          undefined,
          [
            {
              text: 'Open Mail App',
              onPress: () => sendEmail(value),
            },
            {
              text: 'Send via Bizzy',
              onPress: onBizzyEmail,
            },
            {
              text: 'Cancel',
              style: 'cancel',
            },
          ]
        );
      } else {
        await sendEmail(value);
      }
    } else if (type === 'address') {
      const encodedAddress = encodeURIComponent(value);
      const url = Platform.OS === 'ios'
        ? `maps://app?q=${encodedAddress}`
        : `geo:0,0?q=${encodedAddress}`;

      try {
        const supported = await Linking.canOpenURL(url);
        if (supported) {
          await Linking.openURL(url);
        }
      } catch (error) {
        console.error('Failed to open maps:', error);
      }
    }
  };

  const handleSms = async () => {
    if (onBizzySms) {
      Alert.alert(
        'Send Text',
        undefined,
        [
          {
            text: 'Text (Native)',
            onPress: () => sendSMS(value),
          },
          {
            text: 'Text via Bizzy',
            onPress: onBizzySms,
          },
          {
            text: 'Cancel',
            style: 'cancel',
          },
        ]
      );
    } else {
      await sendSMS(value);
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'phone':
        return <Phone size={iconSize} color={colors.primary} />;
      case 'email':
        return <Mail size={iconSize} color={colors.primary} />;
      case 'address':
        return <MapPin size={iconSize} color={colors.primary} />;
    }
  };

  const displayValue = type === 'phone'
    ? formatPhoneNumber(value)
    : (type === 'address' && shortAddress)
      ? getShortAddress(value)
      : value;

  return (
    <View style={[styles.wrapper, style]}>
      <TouchableOpacity
        style={styles.container}
        onPress={handlePress}
        activeOpacity={0.7}
      >
        {getIcon()}
        <Text style={[styles.text, { color: colors.primary }]} numberOfLines={1}>
          {displayValue}
        </Text>
      </TouchableOpacity>
      {type === 'phone' && showSmsButton && (
        <TouchableOpacity
          style={[styles.smsButton, { backgroundColor: colors.primaryLight }]}
          onPress={handleSms}
          activeOpacity={0.7}
        >
          <MessageCircle size={14} color={colors.primary} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
  },
  container: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minWidth: 0,
  },
  text: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
  smsButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
