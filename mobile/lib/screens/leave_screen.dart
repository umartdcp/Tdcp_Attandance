import 'package:flutter/material.dart';

class LeaveScreen extends StatelessWidget {
  const LeaveScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Leave')),
      body: const Padding(
        padding: EdgeInsets.all(16),
        child: Text(
          'Leave balance, apply, and request status use resort-scoped leave_requests tables via the shared API. '
          'Mobile check-in remains disabled until Head Office enables it in system settings.',
        ),
      ),
    );
  }
}
