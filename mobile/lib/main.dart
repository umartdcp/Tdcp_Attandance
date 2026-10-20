import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'core/api_client.dart';
import 'core/theme.dart';
import 'providers/auth_provider.dart';
import 'screens/login_screen.dart';
import 'screens/home_screen.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const TdcpAttendanceApp());
}

class TdcpAttendanceApp extends StatelessWidget {
  const TdcpAttendanceApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        Provider(create: (_) => ApiClient()),
        ChangeNotifierProvider(
          create: (ctx) => AuthProvider(ctx.read<ApiClient>())..bootstrap(),
        ),
      ],
      child: MaterialApp(
        title: 'TDCP Attendance',
        debugShowCheckedModeBanner: false,
        theme: TdcpTheme.light,
        home: Consumer<AuthProvider>(
          builder: (context, auth, _) {
            if (auth.loading) {
              return const Scaffold(
                body: Center(child: CircularProgressIndicator()),
              );
            }
            return auth.isAuthenticated
                ? const HomeScreen()
                : const LoginScreen();
          },
        ),
      ),
    );
  }
}
