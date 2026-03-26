import 'package:flutter/material.dart';

class ConversationShell extends StatelessWidget {
  const ConversationShell({super.key});

  @override
  Widget build(BuildContext context) {
    final items = <String>[
      'Voce: gastei 38 no almoco',
      'Sistema: entendido. Vou estruturar isso como despesa.',
      'Voce: paguei a escola',
      'Sistema: placeholder para pedido de confirmacao e contexto.',
    ];

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
      ),
      child: ListView.separated(
        itemCount: items.length,
        separatorBuilder: (_, __) => const SizedBox(height: 12),
        itemBuilder: (context, index) => Text(items[index]),
      ),
    );
  }
}

