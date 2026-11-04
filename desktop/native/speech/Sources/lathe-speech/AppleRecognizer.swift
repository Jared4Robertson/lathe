// macOS's own recognizer, SpeechAnalyzer and SpeechTranscriber (macOS 26 and later): the helper's fallback when the
// Parakeet model cannot be fetched or loaded, and `--engine apple`. It segments the speech itself: each segment's
// guesses come as volatile lines, then its settled words as one final line.
import AVFoundation
import Foundation
import Speech

@available(macOS 26, *)
final class AppleRecognizer: Recognizer {
  let analyzer: SpeechAnalyzer
  let transcriber: SpeechTranscriber
  let target: AVAudioFormat
  let input: AsyncStream<AnalyzerInput>.Continuation
  let stream: AsyncStream<AnalyzerInput>
  var converter: AVAudioConverter?
  var results: Task<Void, Never>?

  private init(analyzer: SpeechAnalyzer, transcriber: SpeechTranscriber, target: AVAudioFormat) {
    self.analyzer = analyzer
    self.transcriber = transcriber
    self.target = target
    let made = AsyncStream<AnalyzerInput>.makeStream()
    stream = made.stream
    input = made.continuation
  }

  /// The recognizer, its on-device model installed (fetched once from Apple when missing: the model, never audio).
  static func start() async -> AppleRecognizer {
    let locale = await SpeechTranscriber.supportedLocale(equivalentTo: Locale.current) ?? Locale(identifier: "en-US")
    let transcriber = SpeechTranscriber(locale: locale, transcriptionOptions: [], reportingOptions: [.volatileResults], attributeOptions: [.audioTimeRange])
    do {
      if let request = try await AssetInventory.assetInstallationRequest(supporting: [transcriber]) {
        emit(["type": "preparing"])
        try await request.downloadAndInstall()
      }
    } catch {
      fail("The on-device speech model is not available: \(error.localizedDescription)")
    }
    let analyzer = SpeechAnalyzer(modules: [transcriber])
    guard let format = await SpeechAnalyzer.bestAvailableAudioFormat(compatibleWith: [transcriber]) else { fail("No audio format suits the speech model.") }
    let recognizer = AppleRecognizer(analyzer: analyzer, transcriber: transcriber, target: format)
    recognizer.results = recognizer.report()
    do { try await analyzer.start(inputSequence: recognizer.stream) } catch { fail("Speech recognition could not start: \(error.localizedDescription)") }
    return recognizer
  }

  private func report() -> Task<Void, Never> {
    Task { [transcriber] in
      do {
        for try await result in transcriber.results {
          if result.isFinal {
            var words: [[String: Any]] = []
            for run in result.text.runs {
              let text = String(result.text[run.range].characters).trimmingCharacters(in: .whitespaces)
              guard !text.isEmpty, let range = run.audioTimeRange else { continue }
              words.append(["text": text, "start": rounded(range.start.seconds), "end": rounded(range.end.seconds)])
            }
            if !words.isEmpty { emit(["type": "final", "words": words]) }
          } else {
            let text = String(result.text.characters).trimmingCharacters(in: .whitespaces)
            let start = result.text.runs.first?.audioTimeRange?.start.seconds ?? result.range.start.seconds
            emit(["type": "volatile", "text": text, "start": rounded(start)])
          }
        }
      } catch {
        emit(["type": "error", "message": "Speech recognition stopped: \(error.localizedDescription)"])
      }
    }
  }

  /// Converts heard audio to the model's format and hands it on.
  func hear(_ buffer: AVAudioPCMBuffer) {
    if converter == nil || converter?.inputFormat != buffer.format { converter = AVAudioConverter(from: buffer.format, to: target) }
    guard let converter else { return }
    let capacity = AVAudioFrameCount(Double(buffer.frameLength) * target.sampleRate / buffer.format.sampleRate) + 1024
    guard let out = AVAudioPCMBuffer(pcmFormat: target, frameCapacity: capacity) else { return }
    var given = false
    var error: NSError?
    converter.convert(to: out, error: &error) { _, status in
      if given { status.pointee = .noDataNow; return nil }
      given = true
      status.pointee = .haveData
      return buffer
    }
    if error == nil && out.frameLength > 0 { input.yield(AnalyzerInput(buffer: out)) }
  }

  /// It segments the speech itself, so the voice's stops are only for the chat.
  func quiet(at: Double) {}

  func finish() async {
    input.finish()
    try? await analyzer.finalizeAndFinishThroughEndOfInput()
    await results?.value
  }
}
