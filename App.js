import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
const obd2 = require('react-native-obd2');

export default function App() {
  obd2.ready();
  return (
    <View style={styles.container}>
      <Text>Open up App.js to start working on your app!</Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
