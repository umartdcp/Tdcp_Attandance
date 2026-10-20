import 'package:flutter/material.dart';

class TdcpTheme {
  static const navy = Color(0xFF0B1F3A);
  static const green = Color(0xFF1B5E3B);

  static ThemeData get light => ThemeData(
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(
          seedColor: navy,
          primary: navy,
          secondary: green,
        ),
        appBarTheme: const AppBarTheme(
          backgroundColor: navy,
          foregroundColor: Colors.white,
        ),
        elevatedButtonTheme: ElevatedButtonThemeData(
          style: ElevatedButton.styleFrom(
            backgroundColor: navy,
            foregroundColor: Colors.white,
          ),
        ),
      );
}
