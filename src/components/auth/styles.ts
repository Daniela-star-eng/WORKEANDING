// src/components/auth/styles.ts — Paleta y estilos de marca de Workeando
import { StyleSheet } from 'react-native';

export const colors = {
  background: '#F9F8F4',
  title: '#1B1642',
  text: '#6B6B7B',
  placeholder: '#A3A3B0',
  border: '#E7E5EE',
  white: '#FFFFFF',
  primary: '#6366F1',
  primarySoft: '#EEF0FF',
  link: '#5B5BE6',
  icon: '#2A2A3C',
  error: '#E5484D',
  success: '#1F9D55',
};

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  container: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 32,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },

  // Encabezado
  title: { fontSize: 28, fontWeight: '800', color: colors.title },
  subtitle: { fontSize: 15, color: colors.text, marginTop: 6, marginBottom: 24 },

  // Campos
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.title,
    marginBottom: 8,
    marginTop: 4,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 54,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    paddingHorizontal: 16,
  },
  inputWrapperError: { borderColor: colors.error },
  input: { flex: 1, fontSize: 15, color: colors.title },
  fieldSpacing: { marginBottom: 16 },
  errorText: { color: colors.error, fontSize: 12, marginTop: 6 },
  errorGeneral: {
    color: colors.error,
    textAlign: 'center',
    fontWeight: '500',
    marginBottom: 12,
  },
  successGeneral: {
    color: colors.success,
    textAlign: 'center',
    fontWeight: '500',
    marginBottom: 12,
  },

  // Enlace
  forgot: {
    alignSelf: 'flex-end',
    fontSize: 14,
    fontWeight: '600',
    color: colors.link,
    marginBottom: 24,
  },

  // Botones
  primaryButton: {
    height: 54,
    backgroundColor: colors.primary,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonDisabled: { opacity: 0.7 },
  primaryButtonText: { color: colors.white, fontSize: 15, fontWeight: '700' },
  secondaryButton: {
    height: 54,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: { color: colors.title, fontSize: 15, fontWeight: '700' },

  // Separador
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 24 },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: {
    marginHorizontal: 12,
    fontSize: 12,
    color: colors.text,
    letterSpacing: 0.5,
  },

  // Botones sociales
  socialRow: { flexDirection: 'row', gap: 12 },
  socialButton: {
    flex: 1,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
  },
  socialText: { fontSize: 14, fontWeight: '700', color: colors.title },

  // Pie
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 28,
  },
  footerText: { fontSize: 14, color: colors.text },
  footerLink: { fontSize: 14, fontWeight: '700', color: colors.link },
});
