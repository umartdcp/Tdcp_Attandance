import 'package:flutter/foundation.dart';
import '../core/api_client.dart';

class AuthProvider extends ChangeNotifier {
  AuthProvider(this._api);

  final ApiClient _api;
  bool loading = true;
  bool isAuthenticated = false;
  Map<String, dynamic>? user;
  String? error;

  Future<void> bootstrap() async {
    loading = true;
    notifyListeners();
    try {
      final res = await _api.get('/auth/me');
      user = (res['data'] as Map<String, dynamic>)['user'] as Map<String, dynamic>;
      isAuthenticated = true;
    } catch (_) {
      isAuthenticated = false;
      user = null;
    } finally {
      loading = false;
      notifyListeners();
    }
  }

  Future<bool> login(String username, String password) async {
    error = null;
    notifyListeners();
    try {
      final res = await _api.post('/auth/login', {
        'username': username,
        'password': password,
      });
      final data = res['data'] as Map<String, dynamic>;
      await _api.saveTokens(
        data['accessToken'] as String,
        data['refreshToken'] as String,
      );
      user = data['user'] as Map<String, dynamic>;
      isAuthenticated = true;
      notifyListeners();
      return true;
    } catch (e) {
      error = e.toString();
      notifyListeners();
      return false;
    }
  }

  Future<void> logout() async {
    try {
      await _api.post('/auth/logout', {});
    } catch (_) {}
    await _api.clearTokens();
    isAuthenticated = false;
    user = null;
    notifyListeners();
  }
}
