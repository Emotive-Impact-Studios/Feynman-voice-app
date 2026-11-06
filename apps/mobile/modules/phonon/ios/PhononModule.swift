import AVFoundation
import ExpoModulesCore
import PhononTTS

/// The student's on-device voice. JavaScript calls prepare() once, then
/// speak() for each sentence as it arrives, and stop() when the learner cuts in.
public class PhononModule: Module {
  private var tts: Phonon?
  private var player: SpeakerPlayer?
  private let lock = NSLock()
  // Bumped by stop(), so audio from a cancelled sentence is never queued.
  private var generation = 0
  private var current: Task<SpeechStats, Error>?
  // When the audio queued so far will have finished playing.
  private var playsUntil = Date.distantPast

  public func definition() -> ModuleDefinition {
    Name("Phonon")

    Events("onProgress")

    AsyncFunction("isInstalled") { () -> Bool in
      PhononModels.isInstalled()
    }

    /// Download the model bundle if needed (it is checked file by file and
    /// resumes), load it, and pick a voice. Returns the voice names.
    AsyncFunction("prepare") { (baseUrl: String, voice: String) async throws -> [String] in
      guard let url = URL(string: baseUrl) else { throw PhononError(description: "Bad model URL \(baseUrl)") }
      let dir = try await PhononModels.download(from: url) { [weak self] fraction in
        self?.sendEvent("onProgress", ["fraction": fraction])
      }
      let tts: Phonon
      if let loaded = self.tts {
        tts = loaded
      } else {
        tts = try await Phonon.load(models: dir, language: .english)
        self.tts = tts
      }
      self.useSpeaker()
      if self.player == nil {
        // expo-audio owns the session (play and record), so the player must not change it.
        self.player = try SpeakerPlayer()
      }
      if tts.voices.contains(voice), tts.voice != voice {
        try await tts.setVoice(voice)
      }
      return tts.voices
    }

    AsyncFunction("setVoice") { (name: String) async throws in
      guard let tts = self.tts else { throw PhononError(description: "Call prepare() first") }
      try await tts.setVoice(name)
    }

    /// Speak one sentence. Resolves when it has been generated (Phonon runs
    /// well ahead of playback), with how long until it finishes playing.
    AsyncFunction("speak") { (text: String) async throws -> [String: Double] in
      guard let tts = self.tts, let player = self.player else { throw PhononError(description: "Call prepare() first") }
      self.lock.lock()
      let gen = self.generation
      self.lock.unlock()
      let task = Task { () throws -> SpeechStats in
        try await tts.speak(text) { [weak self] chunk in
          guard let self else { return }
          self.lock.lock()
          defer { self.lock.unlock() }
          guard gen == self.generation else { return }
          player.enqueue(chunk)
          let start = max(Date(), self.playsUntil)
          self.playsUntil = start.addingTimeInterval(Double(chunk.count) / Phonon.sampleRate)
        }
      }
      self.lock.lock()
      self.current = task
      self.lock.unlock()
      let stats = try await task.value
      self.lock.lock()
      let remaining = max(0, self.playsUntil.timeIntervalSinceNow)
      self.lock.unlock()
      let ttfa = stats.timeToFirstAudio.components
      return [
        "audioSeconds": stats.audioSeconds,
        "firstAudioMs": Double(ttfa.seconds) * 1000 + Double(ttfa.attoseconds) / 1e15,
        "remainingMs": remaining * 1000,
      ]
    }

    /// Stop talking now: cancel generation and drop queued audio.
    Function("stop") {
      self.lock.lock()
      self.generation += 1
      self.current?.cancel()
      self.current = nil
      self.playsUntil = Date.distantPast
      self.lock.unlock()
      self.player?.stop()
    }
  }

  /// A play-and-record session sends audio to the earpiece unless told
  /// otherwise. The student should come out of the speaker.
  private func useSpeaker() {
    let session = AVAudioSession.sharedInstance()
    guard session.category == .playAndRecord, !session.categoryOptions.contains(.defaultToSpeaker) else { return }
    try? session.setCategory(.playAndRecord, mode: session.mode, options: session.categoryOptions.union([.defaultToSpeaker, .allowBluetoothA2DP]))
  }
}

/// Plays Phonon's audio as it arrives. Like PhononPlayer, but it keeps its
/// engine running: iOS stops an AVAudioEngine whenever the audio setup
/// changes, such as the microphone closing when Teach me opens, and a
/// stopped engine silently drops every sentence queued after it.
final class SpeakerPlayer: @unchecked Sendable {
  private let engine = AVAudioEngine()
  private let node = AVAudioPlayerNode()
  private let format = AVAudioFormat(standardFormatWithSampleRate: Phonon.sampleRate, channels: 1)!
  private var observer: NSObjectProtocol?

  init() throws {
    engine.attach(node)
    engine.connect(node, to: engine.mainMixerNode, format: format)
    try engine.start()
    node.play()
    observer = NotificationCenter.default.addObserver(
      forName: .AVAudioEngineConfigurationChange, object: engine, queue: .main
    ) { [weak self] _ in self?.ensureRunning() }
  }

  deinit {
    if let observer { NotificationCenter.default.removeObserver(observer) }
    node.stop()
    engine.stop()
  }

  /// Start the engine again if iOS stopped it. Queued audio was lost with it.
  func ensureRunning() {
    if !engine.isRunning {
      engine.prepare()
      try? engine.start()
    }
    if engine.isRunning && !node.isPlaying { node.play() }
  }

  func enqueue(_ samples: [Float]) {
    guard !samples.isEmpty,
          let buf = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: AVAudioFrameCount(samples.count))
    else { return }
    ensureRunning()
    buf.frameLength = AVAudioFrameCount(samples.count)
    samples.withUnsafeBufferPointer { buf.floatChannelData![0].update(from: $0.baseAddress!, count: samples.count) }
    node.scheduleBuffer(buf)
  }

  /// Drop everything queued and go quiet. Playing again afterwards works.
  func stop() {
    node.stop()
    ensureRunning()
  }
}
