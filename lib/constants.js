import { Platform, StatusBar } from 'react-native';

export const TOP_MARGIN = Platform.OS === 'android' 
  ? (StatusBar.currentHeight || 24) + 16 
  : 60;