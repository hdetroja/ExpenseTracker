import { Tabs } from 'expo-router';
import { Text } from 'react-native';

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: '#4f46e5',
      tabBarInactiveTintColor: '#999',
      tabBarStyle: {
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderTopColor: '#e0e0e0',
        paddingBottom: 5,
        height: 60
      }
    }}>
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: () => <Text style={{ fontSize: 18 }}>🏠</Text>
        }}
      />
      <Tabs.Screen
        name="add"
        options={{
          title: 'Add',
          tabBarIcon: () => <Text style={{ fontSize: 18 }}>➕</Text>
        }}
      />
      <Tabs.Screen
        name="transactions"
        options={{
          title: 'Transactions',
          tabBarIcon: () => <Text style={{ fontSize: 18 }}>📋</Text>
        }}
      />
      <Tabs.Screen
        name="fixed"
        options={{
          title: 'Fixed',
          tabBarIcon: () => <Text style={{ fontSize: 18 }}>🔁</Text>
        }}
      />
      <Tabs.Screen
        name="reports"
        options={{
          title: 'Reports',
          tabBarIcon: () => <Text style={{ fontSize: 18 }}>📊</Text>
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: () => <Text style={{ fontSize: 18 }}>⚙️</Text>
        }}
      />

      {/* Hide these from tab bar */}
      <Tabs.Screen name="profile" options={{ href: null }} />
      <Tabs.Screen name="index" options={{ href: null }} />
      <Tabs.Screen name="shopping" options={{ href: null }} />
      <Tabs.Screen name="travel" options={{ href: null }} />
      <Tabs.Screen name="onetime" options={{ href: null }} />
    </Tabs>
  );
}