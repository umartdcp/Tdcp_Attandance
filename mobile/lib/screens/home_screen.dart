import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import 'attendance_screen.dart';
import 'leave_screen.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final user = auth.user ?? {};

    return Scaffold(
      appBar: AppBar(
        title: const Text('TDCP Attendance'),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: () => auth.logout(),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    user['username']?.toString() ?? 'Employee',
                    style: const TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(user['roleName']?.toString() ?? ''),
                  Text(user['email']?.toString() ?? ''),
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),
          ListTile(
            leading: const Icon(Icons.calendar_month),
            title: const Text('Attendance'),
            subtitle: const Text('Calendar & history'),
            onTap: () => Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const AttendanceScreen()),
            ),
          ),
          ListTile(
            leading: const Icon(Icons.beach_access),
            title: const Text('Leave'),
            subtitle: const Text('Balance & applications'),
            onTap: () => Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const LeaveScreen()),
            ),
          ),
          const ListTile(
            leading: Icon(Icons.phone_android),
            title: Text('Mobile check-in'),
            subtitle: Text('Disabled by default — requires HO HR authorization'),
          ),
        ],
      ),
    );
  }
}
