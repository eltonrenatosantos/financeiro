import 'package:flutter/material.dart';

import '../../conversation/presentation/conversation_shell.dart';
import '../../../widgets/voice_input_button.dart';

class HomePage extends StatelessWidget {
  const HomePage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: const [
              SizedBox(height: 24),
              Text(
                'Financeiro Voice',
                style: TextStyle(fontSize: 28, fontWeight: FontWeight.w700),
              ),
              SizedBox(height: 12),
              Text(
                'Base inicial focada em conversa por voz. Toque permanece como fallback.',
              ),
              SizedBox(height: 32),
              Expanded(child: ConversationShell()),
              SizedBox(height: 20),
              Center(child: VoiceInputButton()),
            ],
          ),
        ),
      ),
    );
  }
}
