// Where the voice starts and stops, and how its pitch moves before each stop, for the chat's end-of-turn detection.
// It is the same for either recognizer; the Parakeet recognizer also settles its words at each stop (onSilence).
import Foundation

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
  /// Told the time the voice stopped, after the silence line is written.
  var onSilence: ((Double) -> Void)?

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
        onSilence?(stopped)
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
