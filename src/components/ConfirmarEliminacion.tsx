
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

type Props = {
  visible: boolean;
  cargando: boolean;
  onCancelar: () => void;
  onConfirmar: () => void;
};

export default function ConfirmarEliminacion({
  visible,
  cargando,
  onCancelar,
  onConfirmar,
}: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={cargando ? undefined : onCancelar}
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <Text style={styles.titulo}>Eliminar publicación</Text>

          <Text style={styles.mensaje}>
            ¿Estás seguro de que deseas eliminar esta publicación?
            Esta acción no se puede deshacer.
          </Text>

          <View style={styles.botones}>
            <Pressable
              disabled={cargando}
              onPress={onCancelar}
              style={[styles.boton, styles.cancelar, cargando && styles.deshabilitado]}
            >
              <Text style={styles.textoCancelar}>Cancelar</Text>
            </Pressable>

            <Pressable
              disabled={cargando}
              onPress={onConfirmar}
              style={[styles.boton, styles.eliminar, cargando && styles.deshabilitado]}
            >
              <Text style={styles.textoEliminar}>
                {cargando ? "Eliminando..." : "Eliminar"}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modal: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 24,
  },
  titulo: {
    fontSize: 20,
    fontWeight: "700",
    color: "#202020",
    marginBottom: 12,
  },
  mensaje: {
    fontSize: 15,
    lineHeight: 22,
    color: "#555555",
    marginBottom: 24,
  },
  botones: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
  },
  boton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: "center",
  },
  cancelar: {
    backgroundColor: "#EEEEEE",
  },
  eliminar: {
    backgroundColor: "#D92D20",
  },
  deshabilitado: {
    opacity: 0.5,
  },
  textoCancelar: {
    color: "#222222",
    fontWeight: "600",
  },
  textoEliminar: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
});
