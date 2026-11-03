// What the helper writes: one JSON object a line on stdout, read by desktop/src/voice.ts (main.swift lists them).
import Foundation

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

/// A note for whoever runs the helper by hand (the shell ignores stderr).
func note(_ message: String) {
  FileHandle.standardError.write("lathe-speech: \(message)\n".data(using: .utf8)!)
}

func rounded(_ seconds: Double) -> Double { (seconds * 1000).rounded() / 1000 }
