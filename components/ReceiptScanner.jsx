import { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, Image
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { GEMINI_API_KEY } from '../lib/config';

export default function ReceiptScanner({ onReceiptScanned }) {
  const [loading, setLoading] = useState(false);
  const [image, setImage] = useState(null);

  async function pickImage() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your photo library');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled) {
      setImage(result.assets[0]);
      await scanReceipt(result.assets[0]);
    }
  }

  async function takePhoto() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your camera');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled) {
      setImage(result.assets[0]);
      await scanReceipt(result.assets[0]);
    }
  }

  async function scanReceipt(imageAsset) {
    setLoading(true);
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [
                {
                  text: `Analyze this receipt image and extract the following information. 
                  Respond ONLY with a JSON object, no markdown, no backticks, just raw JSON:
                  {
                    "amount": <total amount as number>,
                    "description": "<store name or main item>",
                    "category": "<one of: Gas, Indian Grocery, Walmart, Restaurant, T-Mobile, Rent, WiFi/Internet, Utilities, Medical, Entertainment, Travel, Others>",
                    "date": "<date in YYYY-MM-DD format or today if not found>"
                  }`
                },
                {
                  inline_data: {
                    mime_type: 'image/jpeg',
                    data: imageAsset.base64
                  }
                }
              ]
            }]
          })
        }
      );
      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error('No response from AI');
      const clean = text.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(clean);
      onReceiptScanned(parsed);
    } catch (err) {
      console.error('Receipt scan error:', err);
      Alert.alert('Error', 'Could not read receipt. Please try again or enter manually.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      {image && (
        <Image
          source={{ uri: image.uri }}
          style={styles.preview}
          resizeMode="cover"
        />
      )}

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color="#4f46e5" />
          <Text style={styles.loadingText}>Reading receipt...</Text>
        </View>
      ) : (
        <View style={styles.buttons}>
          <TouchableOpacity style={styles.btn} onPress={takePhoto}>
            <Text style={styles.btnIcon}>📷</Text>
            <Text style={styles.btnText}>Take Photo</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btn} onPress={pickImage}>
            <Text style={styles.btnIcon}>🖼️</Text>
            <Text style={styles.btnText}>From Gallery</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 16 },
  preview: { width: '100%', height: 200, borderRadius: 12, marginBottom: 12 },
  loadingBox: { alignItems: 'center', padding: 24, backgroundColor: '#fff', borderRadius: 12 },
  loadingText: { marginTop: 12, color: '#666', fontSize: 14 },
  buttons: { flexDirection: 'row', gap: 12 },
  btn: {
    flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 16,
    alignItems: 'center', borderWidth: 1, borderColor: '#e0e0e0'
  },
  btnIcon: { fontSize: 28, marginBottom: 8 },
  btnText: { fontSize: 13, color: '#444', fontWeight: '600' }
});