import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { TouchableOpacity, Platform, UIManager } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from './src/styles/theme';

import StationListScreen from './src/screens/StationListScreen';
import StationDetailScreen from './src/screens/StationDetailScreen';
import OverviewScreen from './src/screens/OverviewScreen';
import MenuScreen from './src/screens/MenuScreen';
import StaffLoginScreen from './src/screens/StaffLoginScreen';
import StaffDashboardScreen from './src/screens/StaffDashboardScreen';
import AdminLoginScreen from './src/screens/AdminLoginScreen';
import AdminDashboardScreen from './src/screens/admin/AdminDashboardScreen';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <StatusBar style="light" />
        <Stack.Navigator
          screenOptions={{
            headerStyle: { backgroundColor: colors.primary },
            headerTintColor: '#fff',
            headerTitleStyle: { fontWeight: '700', fontSize: 18 },
            headerShadowVisible: false,
            animation: 'slide_from_right',
          }}
        >
          <Stack.Screen name="StationList" component={StationListScreen} options={({ navigation }) => ({
            title: '⛽ PumpFinder',
            headerTitleStyle: { fontWeight: '800', fontSize: 20, color: '#fff' },
            headerRight: () => (
              <TouchableOpacity onPress={() => navigation.navigate('Menu')} style={{ padding: 6 }}>
                <Ionicons name="menu" size={26} color={colors.onPrimary} />
              </TouchableOpacity>
            ),
          })} />
          <Stack.Screen name="StationDetail" component={StationDetailScreen} options={{ title: '📋 รายละเอียดปั๊ม' }} />
          <Stack.Screen name="Overview" component={OverviewScreen} options={{ title: '📊 ภาพรวมประเทศ' }} />
          <Stack.Screen name="Menu" component={MenuScreen} options={{ title: '☰ เมนู' }} />
          <Stack.Screen name="StaffLogin" component={StaffLoginScreen} options={{ title: '👤 พนักงาน', headerStyle: { backgroundColor: colors.staffGreen || '#15803d' } }} />
          <Stack.Screen name="StaffDashboard" component={StaffDashboardScreen} options={({ navigation }) => ({
            title: '📋 จัดการน้ำมัน',
            headerStyle: { backgroundColor: colors.staffGreen || '#15803d' },
            headerRight: () => (
              <TouchableOpacity onPress={() => {
                const { Alert: RNAlert } = require('react-native');
                const { storage } = require('./src/utils/storage');
                RNAlert.alert('ออกจากระบบ', 'คุณต้องการออกจากระบบใช่ไหม?', [
                  { text: 'ยกเลิก', style: 'cancel' },
                  { text: 'ออกจากระบบ', style: 'destructive', onPress: () => storage.remove('staff').then(() => navigation.replace('StaffLogin')) },
                ]);
              }} style={{ padding: 6 }}>
                <Ionicons name="log-out-outline" size={22} color={colors.onPrimary} />
              </TouchableOpacity>
            ),
          })} />
          <Stack.Screen name="AdminLogin" component={AdminLoginScreen} options={{ title: '🛡️ ผู้ดูแลระบบ', headerStyle: { backgroundColor: colors.admin || '#4338ca' } }} />
          <Stack.Screen name="AdminDashboard" component={AdminDashboardScreen} options={{ headerShown: false }} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
