import AVFoundation
import ExpoModulesCore
import PhononTTS

/// The student's on-device voice. JavaScript calls prepare() once, then
/// speak() for each sentence as it arrives, and stop() when the learner cuts in.
public class PhononModule: Module {
  private var tts: Phonon?
  private var loading: Task<Phonon, Error>?
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

    /// Download the model bundle the first time (it is checked file by file
    /// and resumes), load it once, and pick a voice. Returns the voice names.
    AsyncFunction("prepare") { (baseUrl: String, voice: String) async throws -> [String] in
      guard let url = URL(string: baseUrl) else { throw PhononError(description: "Bad model URL \(baseUrl)") }
      let tts = try await self.loadOnce(from: url)
      self.useSpeaker()
      try self.makePlayerOnce()
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

    /// Headphones or earbuds, so the mic can't hear the student's voice.
    Function("usesHeadphones") { () -> Bool in
      let headphones: Set<AVAudioSession.Port> = [.headphones, .bluetoothA2DP, .bluetoothHFP, .bluetoothLE]
      return AVAudioSession.sharedInstance().currentRoute.outputs.contains { headphones.contains($0.portType) }
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

  /// One player, even if two prepares finish together.
  private func makePlayerOnce() throws {
    try lock.withLock {
      if player == nil {
        // expo-audio owns the session (play and record), so the player must not change it.
        player = try SpeakerPlayer()
      }
    }
  }

  /// Loads the voice once, however many callers ask at the same time (the app
  /// warms it up on launch while a call may also be starting). Two loads at
  /// once would hold two copies of the model in memory. Once the bundle is on
  /// the phone it loads straight from there, without asking the server first:
  /// the bundle's address names its version, so it never changes in place.
  private func loadOnce(from url: URL) async throws -> Phonon {
    let task: Task<Phonon, Error> = lock.withLock {
      if let tts = self.tts { return Task { () throws -> Phonon in tts } }
      if let running = loading { return running }
      let fresh = Task { [weak self] () throws -> Phonon in
        let dir: URL
        if PhononModels.isInstalled() {
          dir = PhononModels.defaultDirectory
          self?.sendEvent("onProgress", ["fraction": 1.0])
        } else {
          dir = try await PhononModels.download(from: url) { fraction in
            self?.sendEvent("onProgress", ["fraction": fraction])
          }
        }
        return try await Phonon.load(models: dir, language: .english)
      }
      loading = fresh
      return fresh
    }
    do {
      let tts = try await task.value
      lock.withLock {
        self.tts = tts
        loading = nil
      }
      return tts
    } catch {
      lock.withLock { loading = nil }
      throw error
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
///
/// Three threads touch the engine: Phonon's (new audio), JavaScript's (stop)
/// and the main thread (iOS saying the audio setup changed), and Teach me
/// opening sets off all three at once. AVAudioEngine is not safe to use from
/// several threads, and it raises an exception that closes the app if a
/// player is started just as iOS stops the engine. So every engine call runs
/// in order on one queue, and each is guarded so a refusal only skips a
/// sentence instead of closing the app.
final class SpeakerPlayer: @unchecked Sendable {
  private let engine = AVAudioEngine()
  private let node = AVAudioPlayerNode()
  private let format = AVAudioFormat(standardFormatWithSampleRate: Phonon.sampleRate, channels: 1)!
  private let queue = DispatchQueue(label: "phonon-player")
  private var observer: NSObjectProtocol?

  init() throws {
    var failure: Error?
    try PhononCatch.run {
      engine.attach(node)
      engine.connect(node, to: engine.mainMixerNode, format: format)
      do { try engine.start() } catch { failure = error }
      if engine.isRunning { node.play() }
    }
    if let failure { throw failure }
    observer = NotificationCenter.default.addObserver(
      forName: .AVAudioEngineConfigurationChange, object: engine, queue: nil
    ) { [weak self] _ in self?.queue.async { self?.ensureRunning() } }
  }

  deinit {
    if let observer { NotificationCenter.default.removeObserver(observer) }
    try? PhononCatch.run {
      node.stop()
      engine.stop()
    }
  }

  /// Start the engine again if iOS stopped it. Queued audio was lost with it.
  /// Only call on `queue`.
  private func ensureRunning() {
    try? PhononCatch.run {
      if !engine.isRunning {
        engine.prepare()
        try? engine.start()
      }
      if engine.isRunning && !node.isPlaying { node.play() }
    }
  }

  func enqueue(_ samples: [Float]) {
    guard !samples.isEmpty,
          let buf = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: AVAudioFrameCount(samples.count))
    else { return }
    buf.frameLength = AVAudioFrameCount(samples.count)
    samples.withUnsafeBufferPointer { buf.floatChannelData![0].update(from: $0.baseAddress!, count: samples.count) }
    queue.async { [self] in
      ensureRunning()
      try? PhononCatch.run { node.scheduleBuffer(buf) }
    }
  }

  /// Drop everything queued and go quiet. Playing again afterwards works.
  func stop() {
    queue.sync {
      try? PhononCatch.run { node.stop() }
      ensureRunning()
    }
  }
}
