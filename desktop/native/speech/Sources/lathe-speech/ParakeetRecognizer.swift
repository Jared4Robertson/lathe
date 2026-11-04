// NVIDIA's Parakeet Unified 0.6B (English, with punctuation and capitals), run by FluidAudio with Core ML on the
// Mac's Neural Engine: the helper's recognizer. Its weights are fetched once from Hugging Face into
// ~/Library/Application Support/FluidAudio/Models (about 0.6 GB: the 640 ms streaming encoder, decoder and joint) and
// loaded from there after; audio never leaves the Mac.
//
// It is streamed with a 640 ms window (5.6 s heard before, 0.56 s new, 0.08 s ahead), so a word is decoded about
// two thirds of a second after it is said. The words decoded since the last settled ones are the guesses (volatile);
// at each stop of the voice (the voice activity's silence), once the decoder has caught up with it, the words before
// it are settled (final). RNN-T decoding never takes a word back, so the guesses only ever grow into the settled words.
import AVFoundation
import FluidAudio
import Foundation

enum Parakeet {
  /// The 640 ms streaming export: [70, 7, 1] encoder frames of 80 ms (left, chunk, right).
  static let config = UnifiedConfig(leftFrames: 70, chunkFrames: 7, rightFrames: 1)

  /// The model, fetched once when it is missing ("preparing" while it is), and loaded; nil when it cannot be.
  static func load() async -> StreamingUnifiedAsrManager? {
    let manager = StreamingUnifiedAsrManager(config: config)
    let told = Once()
    do {
      try await manager.loadModels(progressHandler: { _ in if told.first() { emit(["type": "preparing"]) } })
      return manager
    } catch {
      note("The Parakeet model could not be loaded: \(error.localizedDescription)")
      return nil
    }
  }
}

/// True the first time it is asked, from any thread.
final class Once: @unchecked Sendable {
  private let lock = NSLock()
  private var done = false
  func first() -> Bool {
    lock.lock(); defer { lock.unlock() }
    if done { return false }
    done = true
    return true
  }
}

final class ParakeetRecognizer: Recognizer, @unchecked Sendable {
  let manager: StreamingUnifiedAsrManager
  let input: AsyncStream<AVAudioPCMBuffer>.Continuation
  var work: Task<Void, Never>?
  private let lock = NSLock()
  /// The voice's stops not yet settled, in seconds of audio.
  private var quiets: [Double] = []

  /// A pause ends at a stop of the voice: a word that starts this soon after it was begun before it (the decoder can
  /// place a word's first piece a little late), and none can start sooner, as the voice activity needs a quarter
  /// second of quiet to call it a stop.
  static let settleSlack = 0.2
  /// How long a word may last past where its last piece begins.
  static let wordReach = 0.4

  init(manager: StreamingUnifiedAsrManager) {
    self.manager = manager
    let made = AsyncStream<AVAudioPCMBuffer>.makeStream()
    input = made.continuation
    work = Task { [self] in await self.decode(made.stream) }
  }

  /// Hands a copy of the heard audio to the decoder (the microphone reuses its buffers).
  func hear(_ buffer: AVAudioPCMBuffer) {
    if let copy = copied(buffer) { input.yield(copy) }
  }

  func quiet(at: Double) {
    lock.lock()
    quiets.append(at)
    lock.unlock()
  }

  func finish() async {
    input.finish()
    await work?.value
  }

  /// The stops the decoder has caught up with, by the audio decoded so far.
  private func stops(decodedTo time: Double) -> [Double] {
    lock.lock(); defer { lock.unlock() }
    let ready = quiets.filter { $0 + Self.settleSlack <= time }
    quiets.removeAll { $0 + Self.settleSlack <= time }
    return ready
  }

  private func decode(_ stream: AsyncStream<AVAudioPCMBuffer>) async {
    let latency = Double(Parakeet.config.latencyMs) / 1000
    var heard = 0.0
    var pending: [TokenTiming] = []
    var shown = ""
    let resample = Resampler()

    func show() {
      let text = pending.map(\.token).joined().trimmingCharacters(in: .whitespaces)
      guard text != shown else { return }
      shown = text
      if let first = pending.first, !text.isEmpty { emit(["type": "volatile", "text": text, "start": rounded(first.startTime)]) }
    }

    /// Settles the words begun before the voice stopped (`stop`, or all of them at the end): the pieces up to the first
    /// one that starts a word after the stop's slack. The decoder gives only where each piece begins, so a word is taken
    /// to last until the next one begins, or the voice stopped, but at most `wordReach` past its last piece (a longer
    /// gap is a pause, which the chat's grammar reads).
    func settle(stop: Double?) {
      let cut = stop.map { $0 + Self.settleSlack } ?? .infinity
      let index = pending.firstIndex { $0.startTime >= cut && startsWord($0.token) } ?? pending.count
      let words = buildWordTimings(from: Array(pending[..<index]))
      pending.removeFirst(index)
      shown = ""
      guard !words.isEmpty else { return }
      let timed = words.indices.map { i -> [String: Any] in
        let word = words[i]
        let next = i + 1 < words.count ? words[i + 1].startTime : stop ?? word.endTime
        let end = max(word.endTime, min(next, word.endTime + Self.wordReach))
        return ["text": word.word, "start": rounded(word.startTime), "end": rounded(end)]
      }
      emit(["type": "final", "words": timed])
    }

    do {
      for await buffer in stream {
        heard += Double(buffer.frameLength) / buffer.format.sampleRate
        guard let model = resample(buffer) else { continue }
        try await manager.appendAudio(model)
        try await manager.processBufferedAudio()
        pending += await manager.consumeTokenTimings()
        for stop in stops(decodedTo: heard - latency) { settle(stop: stop) }
        show()
      }
      // Listening ended: what is left of the audio is decoded, and everything heard is settled, stop by stop.
      _ = try await manager.finish()
      pending += await manager.consumeTokenTimings()
      for stop in stops(decodedTo: .infinity) { settle(stop: stop) }
      settle(stop: nil)
    } catch {
      emit(["type": "error", "message": "Speech recognition stopped: \(error.localizedDescription)"])
    }
  }
}

/// The heard audio at the model's rate, 16 kHz mono, by one converter kept from buffer to buffer, so its filter runs on
/// unbroken (FluidAudio's own resampling starts afresh at each buffer, and so breaks the audio every 85 ms or so).
final class Resampler {
  static let format = AVAudioFormat(commonFormat: .pcmFormatFloat32, sampleRate: 16000, channels: 1, interleaved: false)!
  var converter: AVAudioConverter?

  func callAsFunction(_ buffer: AVAudioPCMBuffer) -> AVAudioPCMBuffer? {
    if buffer.format == Self.format { return buffer }
    if converter == nil || converter?.inputFormat != buffer.format { converter = AVAudioConverter(from: buffer.format, to: Self.format) }
    guard let converter else { return nil }
    let capacity = AVAudioFrameCount(Double(buffer.frameLength) * Self.format.sampleRate / buffer.format.sampleRate) + 1024
    guard let out = AVAudioPCMBuffer(pcmFormat: Self.format, frameCapacity: capacity) else { return nil }
    var given = false
    var error: NSError?
    converter.convert(to: out, error: &error) { _, status in
      if given { status.pointee = .noDataNow; return nil }
      given = true
      status.pointee = .haveData
      return buffer
    }
    return error == nil && out.frameLength > 0 ? out : nil
  }
}

/// Whether a decoded piece begins a word (SentencePiece marks it with a leading space, written "▁" or " ").
func startsWord(_ piece: String) -> Bool { piece.hasPrefix(" ") || piece.hasPrefix("\u{2581}") }

/// A copy of a float buffer, every channel.
func copied(_ buffer: AVAudioPCMBuffer) -> AVAudioPCMBuffer? {
  guard let source = buffer.floatChannelData, let copy = AVAudioPCMBuffer(pcmFormat: buffer.format, frameCapacity: max(buffer.frameLength, 1)), let target = copy.floatChannelData else { return nil }
  copy.frameLength = buffer.frameLength
  let count = Int(buffer.frameLength) * (buffer.format.isInterleaved ? Int(buffer.format.channelCount) : 1)
  let channels = buffer.format.isInterleaved ? 1 : Int(buffer.format.channelCount)
  for c in 0..<channels { target[c].update(from: source[c], count: count) }
  return copy
}
