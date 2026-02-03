import React, { useEffect, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { clearEsp32Cache } from "../../api/esp32Cache";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { getEsp32Files } from "../../api/esp32Cache";
import { extractDateFromFilename } from "../../utils/fileDate";
import { RootStackParamList } from "../../navigation/AppNavigator";

export default function FilesByDate() {
  // ✅ Properly typed route
  const route =
    useRoute<RouteProp<RootStackParamList, "FilesByDate">>();

  // ✅ Properly typed navigation
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const { date } = route.params;

  const [files, setFiles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    React.useCallback(() => {
      clearEsp32Cache();
      setLoading(true);
      loadFiles();
    }, [date])
  );

  const loadFiles = async () => {
    try {
      const allFiles = await getEsp32Files();
      const filtered = allFiles.filter(
        f => extractDateFromFilename(f) === date
      );
      setFiles(filtered);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    try {
      setRefreshing(true);
      await loadFiles();
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) {
    return <ActivityIndicator style={{ marginTop: 40 }} />;
  }

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <Text style={{ fontWeight: "700", marginBottom: 10 }}>
        Matches on {date}
      </Text>

      <FlatList
        data={files}
        keyExtractor={(item) => item}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={{
              padding: 12,
              borderBottomWidth: 1,
              borderColor: "#e5e7eb",
            }}
            onPress={() =>
              navigation.navigate("ImportFromESP32", {
                file: item,
              })
            }
          >
            <Text>{item}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}
