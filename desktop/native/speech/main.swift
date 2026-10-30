// lathe-speech: the desktop chat's on-device speech helper (LA-PLT-UC20-R01). It hears the microphone (or, for tests,
// an audio file) and writes what it hears to stdout as JSON lines; desktop/src/voice.ts runs it and reads them.
// Recognition is macOS's own SpeechAnalyzer and SpeechTranscriber (macOS 26 and later), which run on the Mac: audio
// never leaves it, and nothing is recorded or saved. Beside the words it marks where the voice starts and stops, and
// the pitch of the voice's last half second (falling, rising or level), for the chat's end-of-turn detection.
//
//   lathe-speech probe          {"type":"support","onDevice":true|false,"reason":...}
//   lathe-speech listen         the microphone, until "stop" on stdin (or stdin closes)
//   lathe-speech file <audio>   an audio file, as if heard, then exits (the tests' fixtures)
//   lathe-speech file <audio> --live
//                               the file at the pace it was spoken, then quiet until "stop", as the microphone
//                               would be (the shell's LATHE_DESKTOP_SPEECH_FIXTURE, for trying dictation without one)
//
// Lines out: ready, preparing (the on-device model is being installed), volatile {text,start} (the words so far of the
// segment being heard), final {words:[{text,start,end}]}, speech {at} (the voice started), silence {at,pitch} (it
// stopped for a quarter second), error {message}. Times are seconds of audio from the start.
import AVFoundation
import Foundation
import Speech

// MARK: Output

let outLock = NSLock()
func emit(_ object: [String: Any]) {
  guard let data = try? JSONSerialization.data(withJSONObject: object), var line = String(data: data, encoding: .utf8) else { return }
  line += "\n"
  outLock.lock()
  FileHandle.standardOutput.write(line.data(using: .utf8)!)
  outLock.unlock()
}

func fail(_ message: String) -> Never {
  emit(["type": "error", "message": message])
  exit(1)
}

func rounded(_ seconds: Double) -> Double { (seconds * 1000).rounded() / 1000 }

// MARK: Voice activity and pitch

/// Finds where the voice starts and stops by its loudness against the room's, and the pitch of the voice before each
/// stop. Fed the audio as it is heard, in any buffer size; mono float samples.
final class VoiceActivity {
  let rate: Double
  /// A frame is 20 ms; pitch is read over 40 ms windows.
  let frame: Int
  var pending: [Float] = []
  var history: [Float] = []
  var at: Double = 0
  var floor: Float = 0.002
  var speaking = false
  var loudFrames = 0
  var quietFrames = 0
  /// (time, Hz) of the voiced frames since the voice started.
  var pitches: [(Double, Double)] = []

  init(rate: Double) {
    self.rate = rate
    frame = Int(rate * 0.02)
  }

  func feed(_ samples: UnsafeBufferPointer<Float>) {
    pending.append(contentsOf: samples)
    while pending.count >= frame {
      let chunk = Array(pending.prefix(frame))
      pending.removeFirst(frame)
      step(chunk)
    }
  }

  private func step(_ chunk: [Float]) {
    history.append(contentsOf: chunk)
    if history.count > frame * 2 { history.removeFirst(history.count - frame * 2) }
    var sum: Float = 0
    for s in chunk { sum += s * s }
    let rms = (sum / Float(chunk.count)).squareRoot()
    let time = at
    at += Double(chunk.count) / rate
    // The room's level follows the quiet slowly, and rises slowly, so speech never becomes the floor.
    if !speaking { floor = rms < floor ? floor * 0.9 + rms * 0.1 : floor * 0.995 + rms * 0.005 }
    let loud = rms > max(floor * 3.5, 0.004)
    if loud {
      loudFrames += 1
      quietFrames = 0
      if !speaking && loudFrames >= 2 {
        speaking = true
        pitches = []
        emit(["type": "speech", "at": rounded(time)])
      }
      if speaking, let hz = pitch(history) { pitches.append((time, hz)) }
    } else {
      loudFrames = 0
      quietFrames += 1
      if speaking && quietFrames >= 13 {
        speaking = false
        let stopped = time - Double(quietFrames) * 0.02
        emit(["type": "silence", "at": rounded(stopped), "pitch": contour(endingAt: stopped) ?? NSNull()])
      }
    }
  }

  /// The pitch of a 40 ms window by autocorrelation, 70–400 Hz, or nil when it is not clearly voiced.
  private func pitch(_ window: [Float]) -> Double? {
    let minLag = Int(rate / 400), maxLag = min(Int(rate / 70), window.count - 1)
    guard maxLag > minLag else { return nil }
    var energy: Float = 0
    for s in window { energy += s * s }
    guard energy > 0 else { return nil }
    var best: Float = 0, bestLag = 0
    for lag in minLag...maxLag {
      var c: Float = 0
      for i in 0..<(window.count - lag) { c += window[i] * window[i + lag] }
      if c > best { best = c; bestLag = lag }
    }
    return best / energy > 0.45 && bestLag > 0 ? rate / Double(bestLag) : nil
  }

  /// Whether the voice's last half second fell, rose or stayed level, by the slope of its pitch relative to its mean.
  private func contour(endingAt end: Double) -> String? {
    let last = pitches.filter { $0.0 >= end - 0.5 && $0.0 <= end }
    guard last.count >= 5 else { return nil }
    let n = Double(last.count)
    let mt = last.map(\.0).reduce(0, +) / n, mf = last.map(\.1).reduce(0, +) / n
    var num = 0.0, den = 0.0
    for (t, f) in last { num += (t - mt) * (f - mf); den += (t - mt) * (t - mt) }
    guard den > 0, mf > 0 else { return nil }
    let relative = num / den / mf
    return relative < -0.25 ? "falling" : relative > 0.25 ? "rising" : "level"
  }
}

// MARK: Recognition

@available(macOS 26, *)
func transcriberLocale() async -> Locale {
  await SpeechTranscriber.supportedLocale(equivalentTo: Locale.current) ?? Locale(identifier: "en-US")
}

@available(macOS 26, *)
func makeTranscriber() async throws -> (SpeechAnalyzer, SpeechTranscriber, AVAudioFormat) {
  let transcriber = SpeechTranscriber(locale: await transcriberLocale(), transcriptionOptions: [], reportingOptions: [.volatileResults], attributeOptions: [.audioTimeRange])
  // The on-device model: installed with macOS for common languages, else fetched once from Apple (the model, never audio).
  if let request = try await AssetInventory.assetInstallationRequest(supporting: [transcriber]) {
    emit(["type": "preparing"])
    try await request.downloadAndInstall()
  }
  let analyzer = SpeechAnalyzer(modules: [transcriber])
  guard let format = await SpeechAnalyzer.bestAvailableAudioFormat(compatibleWith: [transcriber]) else { fail("No audio format suits the speech model.") }
  return (analyzer, transcriber, format)
}

@available(macOS 26, *)
func report(_ transcriber: SpeechTranscriber) -> Task<Void, Never> {
  Task {
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

/// Converts heard audio to the model's format and hands it on, and feeds the voice activity the same audio as mono.
@available(macOS 26, *)
final class Feeder {
  let input: AsyncStream<AnalyzerInput>.Continuation
  let target: AVAudioFormat
  var converter: AVAudioConverter?
  var activity: VoiceActivity?

  init(input: AsyncStream<AnalyzerInput>.Continuation, target: AVAudioFormat) {
    self.input = input
    self.target = target
  }

  func feed(_ buffer: AVAudioPCMBuffer) {
    if activity == nil { activity = VoiceActivity(rate: buffer.format.sampleRate) }
    if let channel = buffer.floatChannelData?[0] { activity?.feed(UnsafeBufferPointer(start: channel, count: Int(buffer.frameLength))) }
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
}

@available(macOS 26, *)
func run(file: String?, live: Bool = false) async {
  let analyzer: SpeechAnalyzer, transcriber: SpeechTranscriber, format: AVAudioFormat
  do { (analyzer, transcriber, format) = try await makeTranscriber() } catch { fail("The on-device speech model is not available: \(error.localizedDescription)") }
  let (stream, continuation) = AsyncStream<AnalyzerInput>.makeStream()
  let feeder = Feeder(input: continuation, target: format)
  let results = report(transcriber)
  do { try await analyzer.start(inputSequence: stream) } catch { fail("Speech recognition could not start: \(error.localizedDescription)") }

  if let file {
    // A fixture: read it whole, as if heard, then finish.
    guard let audio = try? AVAudioFile(forReading: URL(fileURLWithPath: file)) else { fail("Could not read \(file).") }
    let mono = AVAudioFormat(commonFormat: .pcmFormatFloat32, sampleRate: audio.processingFormat.sampleRate, channels: 1, interleaved: false)!
    let reader = AVAudioConverter(from: audio.processingFormat, to: mono)
    let chunkSeconds = 4096 / mono.sampleRate
    let pace = { if live { Thread.sleep(forTimeInterval: chunkSeconds) } }
    emit(["type": "ready"])
    while audio.framePosition < audio.length {
      guard let chunk = AVAudioPCMBuffer(pcmFormat: audio.processingFormat, frameCapacity: 4096), (try? audio.read(into: chunk)) != nil, chunk.frameLength > 0 else { break }
      if let reader, let monoChunk = AVAudioPCMBuffer(pcmFormat: mono, frameCapacity: chunk.frameLength) {
        try? reader.convert(to: monoChunk, from: chunk)
        feeder.feed(monoChunk)
      } else {
        feeder.feed(chunk)
      }
      pace()
    }
    // Quiet after the file, so its last words end as a pause would end them: a second, or (live) until "stop".
    var quietChunks = 0
    while live ? !stopRequested.isSet : quietChunks * 4096 < Int(mono.sampleRate) {
      guard let quiet = AVAudioPCMBuffer(pcmFormat: mono, frameCapacity: 4096) else { break }
      quiet.frameLength = quiet.frameCapacity
      feeder.feed(quiet)
      quietChunks += 1
      pace()
    }
    continuation.finish()
    try? await analyzer.finalizeAndFinishThroughEndOfInput()
    await results.value
    exit(0)
  }

  // The microphone, until "stop" or stdin closes (the shell quit).
  let engine = AVAudioEngine()
  let node = engine.inputNode
  let heard = node.outputFormat(forBus: 0)
  guard heard.sampleRate > 0 else { fail("No microphone is available.") }
  let mono = AVAudioFormat(commonFormat: .pcmFormatFloat32, sampleRate: heard.sampleRate, channels: 1, interleaved: false)!
  node.installTap(onBus: 0, bufferSize: 4096, format: mono) { buffer, _ in feeder.feed(buffer) }
  do { try engine.start() } catch { fail("The microphone could not start: \(error.localizedDescription)") }
  emit(["type": "ready"])
  while !stopRequested.isSet { try? await Task.sleep(nanoseconds: 50_000_000) }
  node.removeTap(onBus: 0)
  engine.stop()
  continuation.finish()
  try? await analyzer.finalizeAndFinishThroughEndOfInput()
  await results.value
  exit(0)
}

/// Set once stdin says "stop" or closes (the shell quit): listening ends.
final class StopFlag: @unchecked Sendable {
  private let lock = NSLock()
  private var value = false
  var isSet: Bool { lock.lock(); defer { lock.unlock() }; return value }
  func set() { lock.lock(); value = true; lock.unlock() }
}
let stopRequested = StopFlag()
func watchStdin() {
  Thread.detachNewThread {
    while let line = readLine() { if line.trimmingCharacters(in: .whitespaces) == "stop" { break } }
    stopRequested.set()
  }
}

// MARK: Main

let args = CommandLine.arguments.dropFirst()
guard #available(macOS 26, *) else {
  emit(["type": "support", "onDevice": false, "reason": "On-device dictation needs macOS 26 or later."])
  exit(0)
}
switch args.first {
case "probe":
  if !SpeechTranscriber.isAvailable {
    emit(["type": "support", "onDevice": false, "reason": "This Mac cannot run on-device speech recognition."])
  } else {
    emit(["type": "support", "onDevice": true, "reason": NSNull()])
  }
  exit(0)
case "listen":
  watchStdin()
  Task { await run(file: nil) }
case "file":
  guard let file = args.dropFirst().first else { fail("Usage: lathe-speech file <audio> [--live]") }
  let live = args.contains("--live")
  if live { watchStdin() }
  Task { await run(file: file, live: live) }
default:
  fail("Usage: lathe-speech probe | listen | file <audio>")
}
dispatchMain()
