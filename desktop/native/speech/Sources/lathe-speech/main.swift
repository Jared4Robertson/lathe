// lathe-speech: the desktop chat's on-device speech helper (LA-PLT-UC20-R01). It hears the microphone (or, for tests,
// an audio file) and writes what it hears to stdout as JSON lines; desktop/src/voice.ts runs it and reads them.
// Recognition runs on the Mac: NVIDIA's Parakeet model by FluidAudio and Core ML (ParakeetRecognizer.swift), or, when
// that model cannot be fetched or loaded, macOS's own SpeechAnalyzer (AppleRecognizer.swift). Audio never leaves the
// Mac, and nothing is recorded or saved. Beside the words it marks where the voice starts and stops, and the pitch of
// the voice's last half second (falling, rising or level), for the chat's end-of-turn detection (VoiceActivity.swift).
//
//   lathe-speech probe          {"type":"support","onDevice":true|false,"reason":...}
//   lathe-speech prepare        fetches (once) and loads the Parakeet model, then ready (the tests, before timing)
//   lathe-speech listen         the microphone, until "stop" on stdin (or stdin closes)
//   lathe-speech file <audio>   an audio file, as if heard, then exits (the tests' fixtures)
//   lathe-speech file <audio> --live
//                               the file at the pace it was spoken, then quiet until "stop", as the microphone
//                               would be (the shell's LATHE_DESKTOP_SPEECH_FIXTURE, for trying dictation without one)
//   --engine apple              with listen or file: macOS's own recognizer instead of Parakeet (to compare them)
//
// Lines out: ready, preparing (the on-device model is being fetched), volatile {text,start} (the words so far of the
// stretch being heard), final {words:[{text,start,end}]}, speech {at} (the voice started), silence {at,pitch} (it
// stopped for a quarter second), error {message}. Times are seconds of audio from the start.
import AVFoundation
import Foundation
import Speech

/// What recognizes the words: fed the heard audio (from the microphone's thread), told where the voice stopped.
protocol Recognizer: AnyObject {
  func hear(_ buffer: AVAudioPCMBuffer)
  func quiet(at: Double)
  /// No more audio: settles what is left, writes its lines, and returns when they are written.
  func finish() async
}

enum Engine: String { case parakeet, apple }

@available(macOS 26, *)
func makeRecognizer(_ engine: Engine) async -> Recognizer {
  if engine == .parakeet {
    if let manager = await Parakeet.load() { return ParakeetRecognizer(manager: manager) }
    note("Using macOS's own recognizer instead.")
  }
  return await AppleRecognizer.start()
}

/// Feeds the heard audio, as mono, to the voice activity and then to the recognizer, so a stop is known before the
/// audio after it is recognized.
final class Feeder {
  let recognizer: Recognizer
  var activity: VoiceActivity?

  init(recognizer: Recognizer) { self.recognizer = recognizer }

  func feed(_ buffer: AVAudioPCMBuffer) {
    if activity == nil {
      let made = VoiceActivity(rate: buffer.format.sampleRate)
      made.onSilence = { [recognizer] at in recognizer.quiet(at: at) }
      activity = made
    }
    if let channel = buffer.floatChannelData?[0] { activity?.feed(UnsafeBufferPointer(start: channel, count: Int(buffer.frameLength))) }
    recognizer.hear(buffer)
  }
}

@available(macOS 26, *)
func run(file: String?, live: Bool, engine: Engine) async {
  let recognizer = await makeRecognizer(engine)
  let feeder = Feeder(recognizer: recognizer)

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
    await recognizer.finish()
    exit(0)
  }

  // The microphone, until "stop" or stdin closes (the shell quit).
  let microphone = AVAudioEngine()
  let node = microphone.inputNode
  let heard = node.outputFormat(forBus: 0)
  guard heard.sampleRate > 0 else { fail("No microphone is available.") }
  let mono = AVAudioFormat(commonFormat: .pcmFormatFloat32, sampleRate: heard.sampleRate, channels: 1, interleaved: false)!
  node.installTap(onBus: 0, bufferSize: 4096, format: mono) { buffer, _ in feeder.feed(buffer) }
  do { try microphone.start() } catch { fail("The microphone could not start: \(error.localizedDescription)") }
  emit(["type": "ready"])
  while !stopRequested.isSet { try? await Task.sleep(nanoseconds: 50_000_000) }
  node.removeTap(onBus: 0)
  microphone.stop()
  await recognizer.finish()
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

let args = Array(CommandLine.arguments.dropFirst())
/// The recognizer asked for (`--engine apple`), else Parakeet.
func engineAsked() -> Engine {
  guard let at = args.firstIndex(of: "--engine") else { return .parakeet }
  guard at + 1 < args.count, let engine = Engine(rawValue: args[at + 1]) else { fail("--engine takes parakeet or apple.") }
  return engine
}
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
case "prepare":
  Task {
    guard await Parakeet.load() != nil else { fail("The Parakeet speech model could not be fetched or loaded.") }
    emit(["type": "ready"])
    exit(0)
  }
case "listen":
  let engine = engineAsked()
  watchStdin()
  Task { await run(file: nil, live: false, engine: engine) }
case "file":
  guard args.count > 1, !args[1].hasPrefix("--") else { fail("Usage: lathe-speech file <audio> [--live] [--engine parakeet|apple]") }
  let file = args[1]
  let live = args.contains("--live")
  let engine = engineAsked()
  if live { watchStdin() }
  Task { await run(file: file, live: live, engine: engine) }
default:
  fail("Usage: lathe-speech probe | prepare | listen | file <audio> [--live] [--engine parakeet|apple]")
}
dispatchMain()
