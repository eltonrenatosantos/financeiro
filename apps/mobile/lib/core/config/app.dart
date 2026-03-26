import 'package:flutter/material.dart';

import '../../features/home/presentation/home_page.dart';

class FinanceiroVoiceApp extends StatelessWidget {
  const FinanceiroVoiceApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Financeiro Voice',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF0D9488)),
        scaffoldBackgroundColor: const Color(0xFFF4F7F5),
        useMaterial3: true,
      ),
      home: const HomePage(),
    );
  }
}

