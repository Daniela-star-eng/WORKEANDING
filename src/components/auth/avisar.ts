// src/components/auth/avisar.ts — Alerta simple que también funciona en web
import { Alert, Platform } from 'react-native';

export function avisar(titulo: string, mensaje: string) {
  if (Platform.OS === 'web') {
    // Alert.alert no hace nada en react-native-web
    globalThis.alert?.(`${titulo}\n\n${mensaje}`);
    return;
  }
  Alert.alert(titulo, mensaje);
}
