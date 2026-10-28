
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { randomUUID } from 'expo-crypto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import CargaImagenes from '@/components/multimedia/CargaImagenes';
import ConfirmarEliminacion from '@/components/ConfirmarEliminacion';
import { useAuth } from '@/providers/auth-provider';
import type { FotoLocal } from '@/services/imagenes';
import { convertirPrecio, descartarIntento, eliminarPublicacion, listarCategorias, listarPublicaciones, publicarConFotos, validarPublicacion, type Publicacion, type Categoria } from '@/services/publicaciones';
import { BottomTabInset } from '@/constants/theme';

type Intento = { id: string; titulo: string; descripcion: string; fotos: FotoLocal[]; categoriaId: number; precio: number };

export default function PublicarScreen() {
  const { session } = useAuth();
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [categoriaId, setCategoriaId] = useState(0);
  const [errorCategorias, setErrorCategorias] = useState('');
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [precioTexto, setPrecioTexto] = useState('');
  const [fotos, setFotos] = useState<FotoLocal[]>([]);
  const [ocupado, setOcupado] = useState(false);
  const [preparando, setPreparando] = useState(false);
  const [listo, setListo] = useState(false);
  const [intento, setIntento] = useState<Intento | null>(null);
  const [mensaje, setMensaje] = useState('');
  const [progreso, setProgreso] = useState('');
  const [publicaciones, setPublicaciones] = useState<Publicacion[]>([]);
  const [errorLista, setErrorLista] = useState('');
  const [publicacionPendiente, setPublicacionPendiente] = useState<Publicacion | null>(null);
  const [eliminando, setEliminando] = useState(false);

  const mutex = useRef(false);
  const mutexEliminar = useRef(false);
  const clave = `workeando.multimedia.v2.${session?.user.id}`;
  const bloqueado = ocupado || !!intento || !listo;

  async function actualizarLista() {
    try {
      setPublicaciones(await listarPublicaciones());
      setErrorLista('');
    } catch (e) {
      setErrorLista(e instanceof Error ? e.message : 'No se pudo cargar la lista.');
    }
  }

  async function actualizarCategorias() {
    try {
      setCategorias(await listarCategorias());
      setErrorCategorias('');
    } catch (e) {
      setErrorCategorias(e instanceof Error ? e.message : 'No se pudieron cargar las categorías.');
    }
  }

  useEffect(() => {
    let activo = true;
    setListo(false);
    setIntento(null);
    setFotos([]);
    setTitulo('');
    setDescripcion('');
    setCategoriaId(0);
    setPrecioTexto('');

    AsyncStorage.getItem(clave)
      .then((valor) => {
        if (!activo || !valor) return;
        const anterior = JSON.parse(valor) as Intento;
        if (!anterior.id || !Array.isArray(anterior.fotos)) {
          throw new Error('Intento local no válido.');
        }
        setIntento(anterior);
        setTitulo(anterior.titulo);
        setDescripcion(anterior.descripcion);
        setFotos(anterior.fotos);
        setCategoriaId(anterior.categoriaId);
        setPrecioTexto(anterior.precio == null ? '' : String(anterior.precio));
        setMensaje(
          anterior.precio == null
            ? 'Este intento anterior no tiene precio. Pulsa Descartar intento pendiente y después completa el precio.'
            : 'Hay un intento pendiente. Reintentar recupera los archivos ya subidos. Puedes descartarlo si todavía no se creó la publicación.'
        );
      })
      .catch(() => {
        if (activo) setMensaje('No se pudo recuperar el intento local.');
      })
      .finally(() => {
        if (activo) setListo(true);
      });

    void actualizarLista();
    void actualizarCategorias();

    return () => {
      activo = false;
    };
  }, [clave]);

  async function enviar() {
    if (mutex.current || preparando || !listo) return;

    mutex.current = true;
    setOcupado(true);
    setMensaje('');

    try {
      const precio = convertirPrecio(precioTexto);
      validarPublicacion(titulo, descripcion, fotos, categoriaId, precio);

      const actual = intento ?? {
        id: randomUUID(),
        titulo,
        descripcion,
        fotos,
        categoriaId,
        precio,
      };

      await AsyncStorage.setItem(clave, JSON.stringify(actual));
      setIntento(actual);

      await publicarConFotos(
        actual.id,
        actual.titulo,
        actual.descripcion,
        actual.fotos,
        actual.categoriaId,
        actual.precio,
        setProgreso
      );

      await AsyncStorage.removeItem(clave);
      setIntento(null);
      setFotos([]);
      setTitulo('');
      setDescripcion('');
      setCategoriaId(0);
      setPrecioTexto('');
      setMensaje('Publicación y fotografías guardadas. Su visibilidad depende de la moderación del equipo.');

      await actualizarLista();
    } catch (e) {
      setMensaje(e instanceof Error ? e.message : 'No se pudo publicar.');
    } finally {
      mutex.current = false;
      setOcupado(false);
      setProgreso('');
    }
  }

  async function descartar() {
    if (!intento || mutex.current) return;

    mutex.current = true;
    setOcupado(true);

    try {
      await descartarIntento(intento.id, intento.fotos);
      await AsyncStorage.removeItem(clave);
      setIntento(null);
      setMensaje('Intento descartado. Puedes modificar las fotos y volver a publicar.');
    } catch (e) {
      setMensaje(e instanceof Error ? e.message : 'No se pudo descartar.');
    } finally {
      mutex.current = false;
      setOcupado(false);
    }
  }

  async function confirmarEliminacion() {
    console.log('CONFIRMAR ELIMINACIÓN');
  
    if (!publicacionPendiente || mutexEliminar.current) {
      console.log('Sin publicación seleccionada o petición bloqueada');
      return;
    }
  
    mutexEliminar.current = true;
    setEliminando(true);
  
    try {
      console.log('ID:', publicacionPendiente.id);
  
      await eliminarPublicacion(publicacionPendiente.id);
  
      console.log('PUBLICACIÓN ELIMINADA');
      setPublicaciones(actuales =>
        actuales.filter(p => p.id !== publicacionPendiente.id)
      );
      setPublicacionPendiente(null);
      setMensaje('Publicación eliminada correctamente.');
    } catch (e) {
      console.error('ERROR AL ELIMINAR:', e);
      setMensaje(e instanceof Error ? e.message : 'No se pudo eliminar.');
    } finally {
      mutexEliminar.current = false;
      setEliminando(false);
    }
  }

  return (
    <SafeAreaView style={s.screen}>
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <Text style={s.title}>Nueva publicación</Text>
        <Text style={s.help}>
          Comparte fotografías de tu servicio. Las imágenes subidas tendrán URL pública; no incluyas identificaciones ni documentos privados.
        </Text>

        <Text style={s.label}>Categoría obligatoria</Text>
        {!!errorCategorias && <Text style={s.message}>{errorCategorias}</Text>}
        {!categorias.length && !errorCategorias && (
          <Text style={s.help}>No hay categorías disponibles. Consulta al responsable del catálogo.</Text>
        )}

        {!bloqueado && (
          <Pressable accessibilityRole="button" onPress={actualizarCategorias} style={s.secondary}>
            <Text>Actualizar categorías</Text>
          </Pressable>
        )}

        <View style={s.categories}>
          {categorias.map(c => (
            <Pressable
              key={c.id}
              accessibilityRole="radio"
              accessibilityState={{ checked: categoriaId === c.id, disabled: bloqueado }}
              disabled={bloqueado}
              onPress={() => setCategoriaId(c.id)}
              style={[s.category, categoriaId === c.id && s.categoryActive]}
            >
              <Text style={categoriaId === c.id ? s.buttonText : undefined}>{c.nombre}</Text>
            </Pressable>
          ))}
        </View>

        {!!intento && (
          <Text style={s.help}>
            Categoría del intento: {categorias.find(c => c.id === categoriaId)?.nombre ?? categoriaId}
          </Text>
        )}

        <Text style={s.label}>Título</Text>
        <TextInput
          accessibilityLabel="Título de la publicación"
          style={s.input}
          editable={!bloqueado}
          value={titulo}
          onChangeText={setTitulo}
          maxLength={100}
          placeholder="Ej. Servicio de carpintería"
        />

        <Text style={s.label}>Precio por día (MXN)</Text>
        <TextInput
          accessibilityLabel="Precio por día en pesos"
          style={s.input}
          editable={!bloqueado}
          value={precioTexto}
          onChangeText={setPrecioTexto}
          keyboardType="decimal-pad"
          maxLength={16}
          placeholder="Ej. 350.00"
        />

        <Text style={s.help}>
          Mayor a cero. Se conserva la unidad por día configurada en tu base de datos.
        </Text>

        <Text style={s.label}>Descripción (mínimo 20 caracteres)</Text>
        <TextInput
          accessibilityLabel="Descripción de la publicación"
          style={[s.input, s.area]}
          editable={!bloqueado}
          value={descripcion}
          onChangeText={setDescripcion}
          maxLength={2000}
          multiline
          placeholder="Describe tu trabajo"
        />

        <CargaImagenes
          value={fotos}
          onChange={setFotos}
          disabled={bloqueado}
          onBusyChange={setPreparando}
        />

        {!!mensaje && <Text accessibilityRole="alert" style={s.message}>{mensaje}</Text>}

        {ocupado && (
          <View>
            <ActivityIndicator />
            <Text>{progreso || 'Procesando…'}</Text>
          </View>
        )}

        <Pressable
          accessibilityRole="button"
          disabled={ocupado || preparando || !listo}
          onPress={enviar}
          style={[s.button, (ocupado || preparando || !listo) && s.disabled]}
        >
          <Text style={s.buttonText}>
            {intento ? 'Reintentar / comprobar publicación' : 'Publicar fotografías'}
          </Text>
        </Pressable>

        {!!intento && (
          <Pressable
            accessibilityRole="button"
            disabled={ocupado}
            onPress={descartar}
            style={s.secondary}
          >
            <Text>Descartar intento pendiente</Text>
          </Pressable>
        )}

        <Text style={s.heading}>Mis publicaciones recientes</Text>

        {!!errorLista && <Text style={s.message}>{errorLista}</Text>}

        <Pressable accessibilityRole="button" onPress={actualizarLista} style={s.secondary}>
          <Text>Actualizar lista</Text>
        </Pressable>

        {!publicaciones.length && !errorLista && (
          <Text style={s.help}>Tus publicaciones aparecerán aquí después de guardarlas.</Text>
        )}

        {publicaciones.map(p => (
          <View key={p.id} style={s.saved}>
            <Text style={s.heading}>{p.titulo}</Text>
            <Text>{p.descripcion}</Text>
            <Text style={s.help}>Moderación: {p.estado_moderacion ?? 'Sin estado'}</Text>

            <ScrollView horizontal>
              {p.imagenes.map(foto => (
                <Image
                  key={foto.id}
                  source={{ uri: foto.url }}
                  accessibilityLabel={`Foto ${foto.orden ?? 1} de ${p.titulo}`}
                  style={s.thumb}
                />
              ))}
            </ScrollView>

            <Text selectable style={s.help}>ID: {p.id}</Text>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Eliminar publicación ${p.titulo}`}
              disabled={eliminando || ocupado}
              onPress={() => setPublicacionPendiente(p)}
              style={[s.deleteButton, (eliminando || ocupado) && s.disabled]}
            >
              <Text style={s.buttonText}>Eliminar publicación</Text>
            </Pressable>
          </View>
        ))}
      </ScrollView>

      <ConfirmarEliminacion
        visible={!!publicacionPendiente}
        cargando={eliminando}
        onCancelar={() => {
          if (!mutexEliminar.current) setPublicacionPendiente(null);
        }}
        onConfirmar={confirmarEliminacion}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  categories: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  category: { padding: 12, backgroundColor: '#E5EAF7', borderRadius: 10 },
  categoryActive: { backgroundColor: '#4169E1' },
  screen: { flex: 1, backgroundColor: '#F6F8FE' },
  content: { width: '100%', maxWidth: 760, alignSelf: 'center', padding: 22, paddingTop: 80, paddingBottom: BottomTabInset + 30, gap: 14 },
  title: { fontSize: 28, fontWeight: '800', color: '#233565' },
  heading: { fontSize: 18, fontWeight: '700', color: '#233565' },
  help: { color: '#596780', fontSize: 13, lineHeight: 20 },
  label: { fontWeight: '700', color: '#233565' },
  input: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D5DDF0', borderRadius: 12, padding: 14, color: '#172442' },
  area: { minHeight: 100, textAlignVertical: 'top' },
  message: { padding: 12, backgroundColor: '#E9EEFF', color: '#233565', borderRadius: 10 },
  button: { backgroundColor: '#4169E1', padding: 17, borderRadius: 12 },
  buttonText: { color: '#FFFFFF', textAlign: 'center', fontWeight: '700' },
  secondary: { padding: 14, backgroundColor: '#E5EAF7', borderRadius: 12, alignItems: 'center' },
  deleteButton: { backgroundColor: '#D92D20', padding: 14, borderRadius: 12 },
  disabled: { opacity: 0.4 },
  saved: { backgroundColor: '#FFFFFF', padding: 16, borderRadius: 14, gap: 10 },
  thumb: { width: 130, height: 110, borderRadius: 10, marginRight: 10 },
});
