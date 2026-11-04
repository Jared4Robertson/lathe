// swift-tools-version: 6.2
// lathe-speech, the desktop chat's on-device speech helper (Sources/lathe-speech/main.swift says what it does).
// scripts/speech.ts builds it with `swift build -c release` and copies the binary to desktop/out/lathe-speech.
//
// FluidAudio runs NVIDIA's Parakeet speech model with Core ML on the Mac. Its traits are all off: the helper needs
// only speech recognition, so text-to-speech, diarization and the NeMo text normalizer stay out of the binary, and
// the binary carries no resource bundle (the packed app copies the one file).
import PackageDescription

let package = Package(
  name: "lathe-speech",
  platforms: [.macOS(.v26)],
  dependencies: [
    .package(url: "https://github.com/FluidInference/FluidAudio.git", exact: "0.18.2", traits: []),
  ],
  targets: [
    .executableTarget(
      name: "lathe-speech",
      dependencies: [.product(name: "FluidAudio", package: "FluidAudio")],
      path: "Sources/lathe-speech"
    ),
  ],
  swiftLanguageModes: [.v5]
)
