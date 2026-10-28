// src/components/publicaciones/MisPublicaciones.tsx — Lista corta de las publicaciones del prestador
// Cada fila abre /publicacion/<id>/editar (Sprint 5).

import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { colors, styles as base } from '@/components/auth/styles';
import { listarPublicaciones, type Publicacion } from '@/services/publicaciones';

export default function MisPublicaciones() {
  const router = useRouter();
  const [publicaciones, setPublicaciones] = useState<Publicacion[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Se recarga cada vez que se vuelve a la pantalla (p. ej. después de editar fotos)
  useFocusEffect(
    useCallback(() => {
      let activo = true;
      listarPublicaciones({ mias: true, limite: 20 }).then((r) => {
        if (!activo) return;
        if (r.error) setError(r.error.mensaje);
        else {
          setError(null);
          setPublicaciones(r.data.data);
        }
      });
      return () => {
        activo = false;
      };
    }, [])
  );

  if (error) return <Text style={base.errorText}>{error}</Text>;
  if (!publicaciones) return <ActivityIndicator color={colors.primary} />;
  if (publicaciones.length === 0) return null;

  return (
    <View style={estilos.lista}>
      <Text style={base.label}>MIS PUBLICACIONES</Text>
      {publicaciones.map((p) => (
        <TouchableOpacity
          key={p.id}
          style={estilos.fila}
          onPress={() => router.push({ pathname: '/publicacion/[id]/editar', params: { id: p.id } })}
          accessibilityRole="button"
          accessibilityLabel={`Editar ${p.titulo}`}>
          {p.imagenes[0] ? (
            <Image source={{ uri: p.imagenes[0].url }} style={estilos.miniatura} contentFit="cover" />
          ) : (
            <View style={estilos.miniatura} />
          )}
          <View style={estilos.textos}>
            <Text style={estilos.titulo} numberOfLines={1}>
              {p.titulo}
            </Text>
            <Text style={estilos.detalle}>
              {p.imagenes.length} {p.imagenes.length === 1 ? 'foto' : 'fotos'}
              {p.estado_moderacion === 'PENDIENTE' ? ' · En revisión' : ''}
            </Text>
          </View>
          <Ionicons name="create-outline" size={20} color={colors.primary} />
        </TouchableOpacity>
      ))}
    </View>
  );
}

const estilos = StyleSheet.create({
  lista: { alignSelf: 'stretch', gap: 8 },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  miniatura: { width: 48, height: 48, borderRadius: 10, backgroundColor: colors.primarySoft },
  textos: { flex: 1 },
  titulo: { fontSize: 15, fontWeight: '700', color: colors.title },
  detalle: { fontSize: 12, color: colors.text, marginTop: 2 },
});