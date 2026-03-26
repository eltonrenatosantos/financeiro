import 'package:flutter_test/flutter_test.dart';
import 'package:financeiro_voice_mobile/core/config/app.dart';

void main() {
  testWidgets('renders initial app shell', (tester) async {
    await tester.pumpWidget(const FinanceiroVoiceApp());

    expect(find.text('Financeiro Voice'), findsOneWidget);
    expect(find.text('Iniciar voz'), findsOneWidget);
  });
}

