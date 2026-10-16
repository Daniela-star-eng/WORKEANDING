import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { colors } from '@/components/auth/styles';

export default function AppTabs() {
  return (
    <NativeTabs
      backgroundColor={colors.white}
      indicatorColor={colors.primarySoft}
      labelStyle={{ selected: { color: colors.primary } }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Inicio</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={require('@/assets/images/tabIcons/home.png')}
          renderingMode="template"
        />
      </NativeTabs.Trigger>

      {/* Pantalla de edición de perfil: src/app/(tabs)/perfil.tsx */}
      <NativeTabs.Trigger name="perfil">
        <NativeTabs.Trigger.Label>Perfil</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={require('@/assets/images/tabIcons/explore.png')}
          renderingMode="template"
        />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
