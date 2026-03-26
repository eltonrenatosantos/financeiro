class ConversationStateModel {
  const ConversationStateModel({
    required this.currentTranscript,
    required this.isListening,
  });

  final String currentTranscript;
  final bool isListening;
}

