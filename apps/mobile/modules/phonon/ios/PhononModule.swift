import AVFoundation
import ExpoModulesCore
import PhononTTS

/// The student's on-device voice. JavaScript calls prepare() once, then
/// speak() for each sentence as it arrives, and stop() when the learner cuts in.
public class PhononModule: Module {
  private var tts: Phonon?
  private var player: PhononPlayer?
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
        self.player = try PhononPlayer(configureSession: false)
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
