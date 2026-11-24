import {ArtworkPreview} from "@/src/hooks/useAlbumLibrary";
import {ActivityIndicator, Pressable, ScrollView, Text, View, StyleSheet} from "react-native";
import { Image as ExpoImage } from "expo-image";

type Props = {
  preview: ArtworkPreview | null;
  saving: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

function CoverPreview({label, url}: {label: string, url: string}) {
  return (
    <View style={styles.coverSection}>
      <Text style={styles.coverLabel}>{label}</Text>
      <View style={styles.imageFrame}>
        {url ? (
          <ExpoImage
            source={{uri: url}}
            cachePolicy="memory-disk"
            contentFit="cover"
            style={StyleSheet.absoluteFillObject}
          />
        ) : (
          <Text style={styles.missingImage}>No Artwork</Text>
        )}
      </View>
    </View>
  );
}

export default function ArtworkPreviewModal({
  preview,
  saving,
  onCancel,
  onConfirm,
}: Props) {
  if (!preview) return null;

  return (
    <View style={styles.scrim}>
      <View style={styles.dialog}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.heading}>Review artwork</Text>
          <Text style={styles.subtitle}>Check the artwork before replacing your album covers.</Text>
          <View style={styles.columns}>
            <View style={styles.column}>
              <Text style={styles.columnHeading}>Current</Text>
              <CoverPreview label="Front" url={preview.current.frontUrl}/>
              <CoverPreview label="Back" url={preview.current.backUrl}/>
            </View>
            <View style={styles.column}>
              <Text style={styles.columnHeading}>Proposed</Text>
              <CoverPreview label="Front" url={preview.proposed.frontUrl}/>
              <CoverPreview label="Back" url={preview.proposed.backUrl}/>
            </View>
          </View>

          <View style={styles.releaseInfo}>
            <Text style={styles.releaseLabel}>Matched Release</Text>
            <Text style={styles.releaseTitle}>{preview.releaseTitle}</Text>
            <Text style={styles.releaseFormat}>{preview.releaseFormat || "Format unknown"}</Text>
          </View>
        </ScrollView>

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Keep current artwork"
            disabled={saving}
            onPress={onCancel}
            style={[styles.action, styles.cancelButton, saving && styles.disabled]}
          >
            <Text style={styles.cancelText}>Keep Current</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Use new artwork"
            disabled={saving}
            onPress={onConfirm}
            style={[styles.action, styles.confirmButton, saving && styles.disabled]}
          >
            {saving ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.confirmText}>Use new Artwork</Text>
            )}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
    elevation: 1000,
    backgroundColor: "rgba(0,0,0,0.80)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  dialog: {
    width: "100%",
    maxWidth: 430,
    maxHeight: "95%",
    borderRadius: 20,
    backgroundColor: "#172235",
    borderWidth: 1,
    borderColor: "#39465B",
    overflow: "hidden",
  },
  scroll: { flexShrink: 1},
  content: { padding: 16, paddingBottom: 12},
  heading: { color: "#fff", fontSize: 20, fontWeight: "700" },
  subtitle: { color: "#CBD5E1", fontSize: 12, marginTop: 5, marginBottom: 18 },
  columns: { flexDirection: "row", gap: 12},
  column: { flex: 1, minWidth: 0, gap: 10},
  columnHeading: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 3,
  },
  coverSection: { gap: 5},
  coverLabel: { color: "#CBD5E1", fontSize: 12 },
  imageFrame: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#29364A",
    alignItems: "center",
    justifyContent: "center",
  },
  missingImage: { color: "#94A3B8", fontSize: 12 },
  releaseInfo: {
    marginTop: 18,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#263348",
    gap: 4,
  },
  releaseLabel: { color: "#94A3B8", fontSize: 11 },
  releaseTitle: { color: "#fff", fontWeight: "600", fontSize: 14 },
  releaseFormat: { color: "#CBD5E1", fontSize: 12 },
  actions: {
    flexDirection: "row",
    gap: 10,
    padding: 16,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#39465B",
  },
  action: {
    flex: 1,
    minHeight: 46,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  cancelButton: { backgroundColor: "#334155"},
  confirmButton: {backgroundColor: "#2563EB"},
  cancelText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  confirmText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  disabled: { opacity: 0.6},
});