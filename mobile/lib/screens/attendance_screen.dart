import 'package:flutter/material.dart';

class AttendanceScreen extends StatelessWidget {
  const AttendanceScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('My Attendance')),
      body: const Padding(
        padding: EdgeInsets.all(16),
        child: Text(
          'Attendance calendar and history load from the same /api/v1 report and employee endpoints as the web app. '
          'Wire employee-scoped attendance history once the employee JWT is linked to an employees row.',
        ),
      ),
    );
  }
}
