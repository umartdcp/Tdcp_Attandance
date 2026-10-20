import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class ApiClient {
  /// Override via --dart-define=API_BASE_URL=https://host/api/v1
  static const String baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://10.0.2.2:4000/api/v1',
  );

  final _storage = const FlutterSecureStorage();

  Future<Map<String, dynamic>> post(
    String path,
    Map<String, dynamic> body, {
    bool auth = false,
  }) async {
    final headers = await _headers(auth);
    final res = await http.post(
      Uri.parse('$baseUrl$path'),
      headers: headers,
      body: jsonEncode(body),
    );
    return _decode(res);
  }

  Future<Map<String, dynamic>> get(String path, {bool auth = true}) async {
    final headers = await _headers(auth);
    final res = await http.get(Uri.parse('$baseUrl$path'), headers: headers);
    return _decode(res);
  }

  Future<Map<String, String>> _headers(bool auth) async {
    final headers = {'Content-Type': 'application/json'};
    if (auth) {
      final token = await _storage.read(key: 'access_token');
      if (token != null) headers['Authorization'] = 'Bearer $token';
    }
    return headers;
  }

  Map<String, dynamic> _decode(http.Response res) {
    final body = jsonDecode(res.body) as Map<String, dynamic>;
    if (res.statusCode >= 400 || body['success'] != true) {
      final message = body['error']?['message'] ?? 'Request failed';
      throw Exception(message);
    }
    return body;
  }

  Future<void> saveTokens(String access, String refresh) async {
    await _storage.write(key: 'access_token', value: access);
    await _storage.write(key: 'refresh_token', value: refresh);
  }

  Future<void> clearTokens() async {
    await _storage.delete(key: 'access_token');
    await _storage.delete(key: 'refresh_token');
  }
}
