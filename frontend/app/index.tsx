import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function Index() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Job Journey</Text>
      <Text style={styles.subtext}>Job Application Tracker</Text>
      <Text style={styles.info}>App is loading...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 8,
  },
  subtext: {
    fontSize: 18,
    color: '#FFF',
    marginBottom: 32,
  },
  info: {
    fontSize: 14,
    color: '#E5E7EB',
  },
});
