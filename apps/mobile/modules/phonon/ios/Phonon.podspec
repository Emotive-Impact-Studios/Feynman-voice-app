# On-device student voice for iPhone: Gradium's Phonon 31m (Apache 2.0) on the
# Neural Engine, through their Swift package. Android has no package yet and
# falls back to Kitten in JavaScript.
Pod::Spec.new do |s|
  s.name           = 'Phonon'
  s.version        = '0.6.0'
  s.summary        = 'Phonon text to speech for the Feynman app'
  s.description    = 'Streams the student voice on the phone with Phonon 31m'
  s.author         = 'Emotive Impact'
  s.homepage       = 'https://github.com/gradium-ai/xn-ptts'
  s.license        = { :type => 'MIT' }
  # The Swift package needs iOS 18 (Core ML 8). app.json raises the app to match.
  s.platforms      = { :ios => '18.0' }
  s.source         = { git: '' }
  s.static_framework = true
  s.swift_version  = '5.9'

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    # Phonon's compiled core is arm64 only.
    'EXCLUDED_ARCHS[sdk=iphonesimulator*]' => 'x86_64',
  }

  # React Native's helper links a Swift package into this pod.
  spm_dependency(s,
    url: 'https://github.com/gradium-ai/xn-ptts.git',
    requirement: { kind: 'exactVersion', version: '0.6.0' },
    products: ['ptts']
  )

  s.source_files = '**/*.{h,m,mm,swift}'
end
